import os
import hashlib
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, BackgroundTasks, Form, Query
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.db.database import get_db
from app.models.models import Document, ClientProfile, User
from app.core.security import get_current_user

router = APIRouter(prefix="/documents", tags=["Documents"])

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB

# Use /tmp/uploads — always writable on any platform including Render free tier
UPLOAD_DIR = os.environ.get("LOCAL_STORAGE_PATH", "/tmp/uploads")


def get_storage_path(client_id: int, fy: str, doc_type: str) -> str:
    path = os.path.join(UPLOAD_DIR, str(client_id), fy or "2024-25", doc_type or "other")
    os.makedirs(path, exist_ok=True)
    return path


def get_file_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def is_valid_file(filename: str, content_type: str) -> bool:
    """Accept PDF, images, Excel, CSV"""
    fn = (filename or "").lower()
    ct = (content_type or "").lower()
    valid_ext = [".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp",
                 ".xlsx", ".xls", ".csv", ".doc", ".docx"]
    valid_ct = ["pdf", "image/", "excel", "spreadsheet", "csv",
                "octet-stream", "msword", "wordprocessingml"]
    return (any(fn.endswith(e) for e in valid_ext) or
            any(v in ct for v in valid_ct))


async def resolve_client_id(current_user: User, db: AsyncSession, client_id: Optional[int]) -> int:
    if current_user.role == "client":
        result = await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == current_user.id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(
                400,
                "Please complete your Business Profile first — go to Profile → Business Profile tab, "
                "add your PAN and Business Name, then try uploading again."
            )
        return profile.id
    else:
        if not client_id:
            raise HTTPException(
                400,
                "Please select a client before uploading. Use the client selector dropdown above."
            )
        # Verify client profile exists
        result = await db.execute(
            select(ClientProfile).where(ClientProfile.id == client_id)
        )
        if not result.scalar_one_or_none():
            raise HTTPException(404, f"Client profile #{client_id} not found.")
        return client_id


@router.post("/upload", status_code=201)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    document_type: str = Form(default="other"),
    financial_year: Optional[str] = Form(default="2024-25"),
    client_id: Optional[int] = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. Resolve client
    target_client_id = await resolve_client_id(current_user, db, client_id)

    # 2. Read file
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(400, f"Failed to read file: {str(e)}")

    if len(content) == 0:
        raise HTTPException(400, "File is empty — please select a valid file.")
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(413, f"File too large ({len(content)//1024//1024}MB). Maximum 20MB allowed.")

    # 3. Validate file type — be generous
    if not is_valid_file(file.filename or "", file.content_type or ""):
        raise HTTPException(
            400,
            f"File type not supported. Please upload PDF, JPG, PNG, TIFF, XLSX, or CSV files."
        )

    # 4. Check duplicate for same client
    file_hash = get_file_hash(content)
    dup = await db.execute(
        select(Document).where(
            and_(Document.client_id == target_client_id,
                 Document.file_hash == file_hash)
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(409, f"'{file.filename}' was already uploaded. Duplicate file detected.")

    # 5. Save to disk
    fy = (financial_year or "2024-25").strip()
    doc_type = (document_type or "other").strip()

    try:
        storage_path = get_storage_path(target_client_id, fy, doc_type)
        safe_filename = f"{uuid.uuid4().hex}_{(file.filename or 'doc').replace(' ', '_')}"
        file_path = os.path.join(storage_path, safe_filename)
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(500, f"Failed to save file: {str(e)}")

    # 6. Save to DB
    try:
        doc = Document(
            client_id=target_client_id,
            original_filename=file.filename or "unnamed",
            stored_filename=safe_filename,
            file_path=file_path,
            file_size=len(content),
            file_hash=file_hash,
            mime_type=file.content_type or "application/octet-stream",
            document_type=doc_type,
            financial_year=fy,
            processing_status="pending",
            confidence_score=0.0,
        )
        db.add(doc)
        await db.flush()
        await db.refresh(doc)
    except Exception as e:
        # Clean up file if DB save fails
        try:
            os.remove(file_path)
        except Exception:
            pass
        raise HTTPException(500, f"Database error saving document: {str(e)}")

    # 7. Start background OCR
    try:
        from app.services.ocr.processor import process_document_async
        background_tasks.add_task(process_document_async, doc.id, file_path, doc_type)
    except Exception:
        pass  # OCR failure shouldn't block upload success

    return {
        "id": doc.id,
        "original_filename": doc.original_filename,
        "document_type": doc.document_type,
        "financial_year": fy,
        "processing_status": "pending",
        "client_id": target_client_id,
        "file_size_kb": round(len(content) / 1024, 1),
        "message": f"✅ '{file.filename}' uploaded successfully! OCR processing started — GST/ITR/reports will update automatically."
    }


async def verify_token(token: Optional[str], db: AsyncSession) -> User:
    if not token:
        raise HTTPException(401, "Token required — not authenticated")
    try:
        from app.core.security import decode_token
        import uuid as _uuid
        payload = decode_token(token)
        uid_str = payload.get("sub")
        try:
            uid = _uuid.UUID(str(uid_str))
            result = await db.execute(select(User).where(User.id == uid))
        except Exception:
            result = await db.execute(select(User).where(User.id == int(uid_str)))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(401, f"Invalid token: {str(e)}")


@router.get("/my-client-id")
async def get_my_client_id(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == current_user.id)
    )
    p = result.scalar_one_or_none()
    if not p:
        return {"client_id": None, "has_profile": False, "message": "No profile found"}
    return {
        "client_id": p.id, "has_profile": True,
        "business_name": p.business_name, "pan": p.pan, "gstin": p.gstin,
    }


@router.get("/by-client/{client_id}/categories")
async def get_by_category(
    client_id: int,
    financial_year: Optional[str] = "2024-25",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Document).where(
            and_(Document.client_id == client_id,
                 Document.financial_year == financial_year)
        ).order_by(Document.upload_date.desc())
    )
    docs = result.scalars().all()
    cats = {}
    for doc in docs:
        cat = doc.document_type or "other"
        cats.setdefault(cat, []).append({
            "id": doc.id, "original_filename": doc.original_filename,
            "file_size": doc.file_size, "processing_status": doc.processing_status,
            "confidence_score": float(doc.confidence_score or 0),
            "upload_date": str(doc.upload_date or ""),
            "month": doc.month, "year": doc.year,
            "extracted_data": doc.extracted_data,
            "is_duplicate": doc.is_duplicate,
            "mime_type": doc.mime_type,
        })
    total_r = await db.execute(select(func.count(Document.id)).where(
        and_(Document.client_id == client_id, Document.financial_year == financial_year)))
    processed_r = await db.execute(select(func.count(Document.id)).where(
        and_(Document.client_id == client_id, Document.financial_year == financial_year,
             Document.processing_status == "completed")))
    return {
        "client_id": client_id, "financial_year": financial_year,
        "summary": {"total": total_r.scalar() or 0, "processed": processed_r.scalar() or 0},
        "categories": cats,
    }


@router.get("/{doc_id}/download")
async def download(doc_id: int, token: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    await verify_token(token, db)
    r = await db.execute(select(Document).where(Document.id == doc_id))
    doc = r.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")
    if not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(404, "File not found on disk — it may have been deleted")
    return FileResponse(
        path=doc.file_path, filename=doc.original_filename,
        media_type=doc.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{doc.original_filename}"'}
    )


@router.get("/{doc_id}/view")
async def view(doc_id: int, token: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    await verify_token(token, db)
    r = await db.execute(select(Document).where(Document.id == doc_id))
    doc = r.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")
    if not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(404, "File not found on disk")
    return FileResponse(
        path=doc.file_path, filename=doc.original_filename,
        media_type=doc.mime_type or "application/octet-stream",
        headers={"Content-Disposition": "inline"}
    )


@router.get("/")
async def list_docs(
    client_id: Optional[int] = None,
    financial_year: Optional[str] = None,
    document_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Document)
    if current_user.role == "client":
        r = await db.execute(select(ClientProfile).where(ClientProfile.user_id == current_user.id))
        p = r.scalar_one_or_none()
        if not p:
            return []
        query = query.where(Document.client_id == p.id)
    elif client_id:
        query = query.where(Document.client_id == client_id)
    if financial_year:
        query = query.where(Document.financial_year == financial_year)
    if document_type:
        query = query.where(Document.document_type == document_type)
    result = await db.execute(query.order_by(Document.upload_date.desc()))
    docs = result.scalars().all()
    return [{"id": d.id, "original_filename": d.original_filename, "document_type": d.document_type,
             "financial_year": d.financial_year, "processing_status": d.processing_status,
             "confidence_score": float(d.confidence_score or 0), "upload_date": str(d.upload_date or "")}
            for d in docs]


@router.delete("/{doc_id}")
async def delete_doc(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(Document).where(Document.id == doc_id))
    doc = r.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception:
            pass
    await db.delete(doc)
    return {"message": "Document deleted successfully"}


@router.post("/{doc_id}/reprocess")
async def reprocess(
    doc_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(Document).where(Document.id == doc_id))
    doc = r.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")
    doc.processing_status = "pending"
    await db.flush()
    try:
        from app.services.ocr.processor import process_document_async
        background_tasks.add_task(process_document_async, doc.id, doc.file_path, doc.document_type)
    except Exception:
        pass
    return {"message": "Queued for reprocessing"}
