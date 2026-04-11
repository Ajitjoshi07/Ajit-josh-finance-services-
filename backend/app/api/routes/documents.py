import os
import hashlib
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, BackgroundTasks, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.db.database import get_db
from app.models.models import Document, ClientProfile, User
from app.schemas.schemas import DocumentOut
from app.core.security import get_current_user
from app.core.config import settings
from app.services.ocr.processor import process_document_async

router = APIRouter(prefix="/documents", tags=["Documents"])

ALLOWED_MIME_TYPES = {
    "application/pdf", "image/jpeg", "image/jpg", "image/png", "image/tiff",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel", "text/csv",
}
MAX_FILE_SIZE = 20 * 1024 * 1024


def get_file_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


async def get_storage_path(client_id: int, fy: str, doc_type: str) -> str:
    base = settings.LOCAL_STORAGE_PATH
    path = os.path.join(base, str(client_id), fy, doc_type)
    os.makedirs(path, exist_ok=True)
    return path


async def get_client_profile_id(current_user: User, db: AsyncSession) -> int:
    """Get the client profile id for the current user"""
    result = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            400,
            "Client profile not found. Please complete your profile first (go to Profile page and fill Business Profile tab)"
        )
    return profile.id


@router.post("/upload", status_code=201)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    document_type: str = Form(...),
    financial_year: Optional[str] = Form("2024-25"),
    client_id: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Resolve client ID
    if current_user.role == "client":
        # Client uploads for themselves
        target_client_id = await get_client_profile_id(current_user, db)
    else:
        # Admin/CA must provide client_id
        if not client_id:
            raise HTTPException(400, "client_id is required for admin/CA uploads")
        target_client_id = client_id

    # Validate file type - be lenient, accept common types
    content_type = file.content_type or ""
    if content_type not in ALLOWED_MIME_TYPES and not content_type.startswith("image/"):
        # Allow if filename has valid extension
        filename_lower = (file.filename or "").lower()
        valid_exts = [".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".xlsx", ".xls", ".csv"]
        if not any(filename_lower.endswith(ext) for ext in valid_exts):
            raise HTTPException(400, f"File type '{content_type}' not allowed. Use PDF, image, or Excel files.")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(413, "File too large. Max 20MB per file.")
    if len(content) == 0:
        raise HTTPException(400, "File is empty")

    file_hash = get_file_hash(content)

    # Check duplicate within same client
    dup = await db.execute(
        select(Document).where(
            and_(Document.client_id == target_client_id, Document.file_hash == file_hash)
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(409, f"This file was already uploaded. Duplicate detected.")

    fy = financial_year or "2024-25"
    storage_path = await get_storage_path(target_client_id, fy, document_type)
    stored_filename = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = os.path.join(storage_path, stored_filename)

    with open(file_path, "wb") as f:
        f.write(content)

    doc = Document(
        client_id=target_client_id,
        original_filename=file.filename,
        stored_filename=stored_filename,
        file_path=file_path,
        file_size=len(content),
        file_hash=file_hash,
        mime_type=file.content_type,
        document_type=document_type,
        financial_year=fy,
        processing_status="pending",
        confidence_score=0.0,
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)

    # Start OCR processing in background
    background_tasks.add_task(process_document_async, doc.id, file_path, document_type)

    return {
        "id": doc.id,
        "original_filename": doc.original_filename,
        "document_type": doc.document_type,
        "financial_year": doc.financial_year,
        "processing_status": doc.processing_status,
        "client_id": target_client_id,
        "message": f"'{file.filename}' uploaded successfully and queued for processing"
    }


@router.get("/my-client-id")
async def get_my_client_id(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Endpoint for client to get their own profile/client ID"""
    result = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        return {"client_id": None, "has_profile": False, "message": "No profile found"}
    return {
        "client_id": profile.id,
        "has_profile": True,
        "business_name": profile.business_name,
        "pan": profile.pan,
        "gstin": profile.gstin,
    }


@router.get("/by-client/{client_id}/categories")
async def get_documents_by_category(
    client_id: int,
    financial_year: Optional[str] = "2024-25",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all documents for a client grouped by document_type"""
    result = await db.execute(
        select(Document).where(
            and_(Document.client_id == client_id, Document.financial_year == financial_year)
        ).order_by(Document.upload_date.desc())
    )
    all_docs = result.scalars().all()

    categories = {}
    for doc in all_docs:
        cat = doc.document_type or "other"
        if cat not in categories:
            categories[cat] = []
        categories[cat].append({
            "id": doc.id,
            "original_filename": doc.original_filename,
            "file_size": doc.file_size,
            "processing_status": doc.processing_status,
            "confidence_score": float(doc.confidence_score or 0),
            "upload_date": str(doc.upload_date),
            "month": doc.month,
            "year": doc.year,
            "extracted_data": doc.extracted_data,
            "is_duplicate": doc.is_duplicate,
            "mime_type": doc.mime_type,
        })

    total = await db.execute(
        select(func.count(Document.id)).where(
            and_(Document.client_id == client_id, Document.financial_year == financial_year)
        )
    )
    processed = await db.execute(
        select(func.count(Document.id)).where(
            and_(Document.client_id == client_id,
                 Document.financial_year == financial_year,
                 Document.processing_status == "completed")
        )
    )

    return {
        "client_id": client_id,
        "financial_year": financial_year,
        "summary": {"total": total.scalar(), "processed": processed.scalar()},
        "categories": categories
    }


async def verify_token_param(token: Optional[str], db: AsyncSession) -> User:
    """Verify JWT token from query parameter"""
    if not token:
        raise HTTPException(401, "Not authenticated — token required")
    try:
        from app.core.security import decode_token
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(401, "Invalid token")
        result = await db.execute(select(User).where(User.id == int(user_id)))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(401, "User not found or inactive")
        return user
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(401, "Invalid or expired token")


@router.get("/{doc_id}/download")
async def download_document(
    doc_id: int,
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Download document with JWT token as query param"""
    await verify_token_param(token, db)

    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")
    if not os.path.exists(doc.file_path):
        raise HTTPException(404, "File not found on disk")

    return FileResponse(
        path=doc.file_path,
        filename=doc.original_filename,
        media_type=doc.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{doc.original_filename}"'}
    )


@router.get("/{doc_id}/view")
async def view_document(
    doc_id: int,
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """View/preview document inline in browser"""
    await verify_token_param(token, db)

    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")
    if not os.path.exists(doc.file_path):
        raise HTTPException(404, "File not found on disk")

    # For images and PDFs, display inline
    media_type = doc.mime_type or "application/octet-stream"
    return FileResponse(
        path=doc.file_path,
        filename=doc.original_filename,
        media_type=media_type,
        headers={"Content-Disposition": "inline"}
    )


@router.get("/", response_model=List[DocumentOut])
async def list_documents(
    client_id: Optional[int] = None,
    financial_year: Optional[str] = None,
    document_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Document)
    if current_user.role == "client":
        profile_result = await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == current_user.id)
        )
        profile = profile_result.scalar_one_or_none()
        if not profile:
            return []
        query = query.where(Document.client_id == profile.id)
    elif client_id:
        query = query.where(Document.client_id == client_id)

    if financial_year:
        query = query.where(Document.financial_year == financial_year)
    if document_type:
        query = query.where(Document.document_type == document_type)

    result = await db.execute(query.order_by(Document.upload_date.desc()))
    return result.scalars().all()


@router.delete("/{doc_id}")
async def delete_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")
    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception:
            pass
    await db.delete(doc)
    return {"message": "Document deleted"}


@router.post("/{doc_id}/reprocess")
async def reprocess_document(
    doc_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")
    doc.processing_status = "pending"
    await db.flush()
    background_tasks.add_task(process_document_async, doc.id, doc.file_path, doc.document_type)
    return {"message": "Queued for reprocessing"}
