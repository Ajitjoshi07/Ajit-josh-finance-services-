from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from decimal import Decimal
from datetime import datetime

from app.db.database import get_db
from app.models.models import Transaction, GSTFiling, ClientProfile, User
from app.core.security import get_current_user, require_ca
from app.services.tax.gst_engine import GSTEngine

router = APIRouter(prefix="/gst", tags=["GST"])


async def get_resolved_client_id(current_user: User, db: AsyncSession, client_id: Optional[int]) -> int:
    """Always resolve to correct client_id — never mix clients"""
    if current_user.role == "client":
        result = await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == current_user.id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(404, "Client profile not found. Complete your profile first.")
        return profile.id
    # Admin/CA must provide client_id
    if not client_id:
        raise HTTPException(400, "client_id is required for admin/CA users")
    return client_id


@router.get("/summary")
async def get_gst_summary(
    financial_year: str = "2024-25",
    client_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    cid = await get_resolved_client_id(current_user, db, client_id)
    engine = GSTEngine(db)
    return await engine.get_monthly_summary(cid, financial_year)


@router.get("/gstr1")
async def get_gstr1(
    financial_year: str,
    month: int,
    client_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    cid = await get_resolved_client_id(current_user, db, client_id)
    result = await db.execute(select(ClientProfile).where(ClientProfile.id == cid))
    profile = result.scalar_one_or_none()
    engine = GSTEngine(db)
    report = await engine.generate_gstr1(cid, financial_year, month)
    report["client_gstin"] = profile.gstin if profile else "NOT_REGISTERED"
    return report


@router.get("/gstr3b")
async def get_gstr3b(
    financial_year: str,
    month: int,
    client_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    cid = await get_resolved_client_id(current_user, db, client_id)
    result = await db.execute(select(ClientProfile).where(ClientProfile.id == cid))
    profile = result.scalar_one_or_none()
    engine = GSTEngine(db)
    report = await engine.generate_gstr3b(cid, financial_year, month)
    report["client_gstin"] = profile.gstin if profile else "NOT_REGISTERED"
    return report


@router.post("/file/{client_id}/{financial_year}/{month}")
async def mark_month_filed(
    client_id: int,
    financial_year: str,
    month: int,
    return_type: str = "GSTR3B",
    current_user: User = Depends(require_ca),
    db: AsyncSession = Depends(get_db)
):
    """Mark a specific month's GST as filed — creates or updates filing record"""
    # Check if filing record exists
    result = await db.execute(
        select(GSTFiling).where(
            and_(
                GSTFiling.client_id == client_id,
                GSTFiling.financial_year == financial_year,
                GSTFiling.month == month,
            )
        )
    )
    filing = result.scalar_one_or_none()

    if not filing:
        # Get the month data
        engine = GSTEngine(db)
        summary = await engine.get_monthly_summary(client_id, financial_year)
        month_data = next((m for m in summary if m["month"] == month), None)

        filing = GSTFiling(
            client_id=client_id,
            financial_year=financial_year,
            month=month,
            year=month_data["year"] if month_data else 2024,
            return_type=return_type,
            total_sales=Decimal(str(month_data["total_sales"])) if month_data else Decimal("0"),
            total_purchases=Decimal(str(month_data["total_purchases"])) if month_data else Decimal("0"),
            output_gst=Decimal(str(month_data["output_gst"])) if month_data else Decimal("0"),
            input_gst=Decimal(str(month_data["input_gst"])) if month_data else Decimal("0"),
            net_gst_payable=Decimal(str(month_data["net_gst_payable"])) if month_data else Decimal("0"),
            filing_status="filed",
            filed_on=datetime.utcnow(),
        )
        db.add(filing)
    else:
        filing.filing_status = "filed"
        filing.filed_on = datetime.utcnow()

    await db.flush()
    return {"message": f"Month {month} marked as filed", "filing_id": filing.id}


@router.post("/unfile/{client_id}/{financial_year}/{month}")
async def mark_month_unfiled(
    client_id: int,
    financial_year: str,
    month: int,
    current_user: User = Depends(require_ca),
    db: AsyncSession = Depends(get_db)
):
    """Revert filing status to pending"""
    result = await db.execute(
        select(GSTFiling).where(
            and_(
                GSTFiling.client_id == client_id,
                GSTFiling.financial_year == financial_year,
                GSTFiling.month == month,
            )
        )
    )
    filing = result.scalar_one_or_none()
    if filing:
        filing.filing_status = "pending"
        filing.filed_on = None
        await db.flush()
    return {"message": f"Month {month} reverted to pending"}


@router.get("/verify-gstin/{gstin}")
async def verify_gstin(gstin: str, current_user: User = Depends(get_current_user)):
    from app.services.tax.gstn_verifier import verify_gstin_api
    return await verify_gstin_api(gstin)


@router.get("/deadlines")
async def get_filing_deadlines(
    financial_year: str = "2024-25",
    current_user: User = Depends(get_current_user)
):
    from app.utils.financial_year import get_gst_deadlines
    return get_gst_deadlines(financial_year)
