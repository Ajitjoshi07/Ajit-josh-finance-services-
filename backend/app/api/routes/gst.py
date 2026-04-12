from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, case
from decimal import Decimal

from app.db.database import get_db
from app.models.models import Transaction, GSTFiling, ClientProfile, User
from app.schemas.schemas import GSTSummary, GSTR1Report, GSTR3BReport
from app.core.security import get_current_user, require_ca
from app.services.tax.gst_engine import GSTEngine

router = APIRouter(prefix="/gst", tags=["GST"])


async def get_client_id(current_user: User, db: AsyncSession, client_id: Optional[int] = None) -> int:
    if current_user.role == "client":
        result = await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == current_user.id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(404, "Client profile not found")
        return profile.id
    if not client_id:
        raise HTTPException(400, "client_id required")
    return client_id


@router.get("/summary", response_model=List[GSTSummary])
async def get_gst_summary(
    financial_year: str = "2024-25",
    client_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    cid = await get_client_id(current_user, db, client_id)
    engine = GSTEngine(db)
    return await engine.get_monthly_summary(cid, financial_year)


@router.get("/gstr1", response_model=GSTR1Report)
async def get_gstr1(
    financial_year: str,
    month: int,
    client_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    cid = await get_client_id(current_user, db, client_id)

    result = await db.execute(
        select(ClientProfile).where(ClientProfile.id == cid)
    )
    profile = result.scalar_one_or_none()

    engine = GSTEngine(db)
    report = await engine.generate_gstr1(cid, financial_year, month)
    report["client_gstin"] = profile.gstin or "NOT_REGISTERED"
    return GSTR1Report(**report)


@router.get("/gstr3b", response_model=GSTR3BReport)
async def get_gstr3b(
    financial_year: str,
    month: int,
    client_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    cid = await get_client_id(current_user, db, client_id)
    result = await db.execute(select(ClientProfile).where(ClientProfile.id == cid))
    profile = result.scalar_one_or_none()

    engine = GSTEngine(db)
    report = await engine.generate_gstr3b(cid, financial_year, month)
    report["client_gstin"] = profile.gstin or "NOT_REGISTERED"
    return GSTR3BReport(**report)


@router.post("/file/{filing_id}")
async def mark_filing_submitted(
    filing_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from datetime import datetime
    result = await db.execute(select(GSTFiling).where(GSTFiling.id == filing_id))
    filing = result.scalar_one_or_none()
    if not filing:
        raise HTTPException(404, "Filing not found")

    filing.filing_status = "filed"
    filing.filed_on = datetime.utcnow()
    await db.flush()
    return {"message": "Filing marked as submitted", "id": filing_id}


@router.put("/update-status")
async def update_filing_status(
    month: int,
    year: int,
    financial_year: str,
    status: str,
    client_id: Optional[int] = None,
    current_user: User = Depends(require_ca),
    db: AsyncSession = Depends(get_db)
):
    """Admin/CA endpoint to update filing status for any month"""
    from datetime import datetime
    if status not in ["pending", "draft", "filed", "late"]:
        raise HTTPException(400, "Invalid status. Must be pending, draft, filed, or late")

    # Find or create the filing record
    cid = client_id
    if not cid:
        raise HTTPException(400, "client_id required")

    result = await db.execute(
        select(GSTFiling).where(
            and_(
                GSTFiling.client_id == cid,
                GSTFiling.financial_year == financial_year,
                GSTFiling.month == month,
            )
        )
    )
    filing = result.scalar_one_or_none()

    if not filing:
        filing = GSTFiling(
            client_id=cid,
            financial_year=financial_year,
            month=month,
            year=year,
            filing_status=status,
        )
        db.add(filing)
    else:
        filing.filing_status = status
        if status == "filed":
            filing.filed_on = datetime.utcnow()

    await db.flush()
    return {"message": f"Filing status updated to {status}", "month": month, "year": year, "status": status}



@router.get("/verify-gstin/{gstin}")
async def verify_gstin(
    gstin: str,
    current_user: User = Depends(get_current_user)
):
    from app.services.tax.gstn_verifier import verify_gstin_api
    result = await verify_gstin_api(gstin)
    return result


@router.get("/deadlines")
async def get_filing_deadlines(
    financial_year: str = "2024-25",
    current_user: User = Depends(get_current_user)
):
    from app.utils.financial_year import get_gst_deadlines
    return get_gst_deadlines(financial_year)
