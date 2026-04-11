from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from decimal import Decimal
from datetime import date

from app.db.database import get_db
from app.models.models import (
    TDSRecord, ITRDraft, JournalEntry, Transaction,
    ClientProfile, User, Notification, Document
)
from app.schemas.schemas import TDSCreate, ITRSummary
from app.core.security import get_current_user, require_admin, require_ca

# ─── TDS Router ───────────────────────────────────────────────────────────────
tds_router = APIRouter(prefix="/tds", tags=["TDS"])


async def get_my_client_id(current_user: User, db: AsyncSession, client_id: Optional[int] = None) -> int:
    if current_user.role == "client":
        result = await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == current_user.id)
        )
        p = result.scalar_one_or_none()
        return p.id if p else 0
    return client_id or 0


@tds_router.post("/", status_code=201)
async def create_tds_record(
    data: TDSCreate,
    client_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.utils.financial_year import get_fy_and_quarter
    cid = await get_my_client_id(current_user, db, client_id)
    fy, quarter = get_fy_and_quarter(data.payment_date)
    record = TDSRecord(client_id=cid, financial_year=fy, quarter=quarter, **data.model_dump())
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return {"id": record.id, "message": "TDS record created"}


@tds_router.get("/quarterly-summary")
async def get_quarterly_summary(
    financial_year: str = "2024-25",
    quarter: Optional[int] = None,
    client_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    cid = await get_my_client_id(current_user, db, client_id)
    query = select(TDSRecord).where(
        and_(TDSRecord.financial_year == financial_year, TDSRecord.client_id == cid)
    )
    if quarter:
        query = query.where(TDSRecord.quarter == quarter)
    result = await db.execute(query)
    records = result.scalars().all()

    summary = {}
    for rec in records:
        q = rec.quarter
        if q not in summary:
            summary[q] = {"total_payments": 0.0, "total_tds": 0.0, "records": []}
        summary[q]["total_payments"] += float(rec.payment_amount or 0)
        summary[q]["total_tds"] += float(rec.tds_amount or 0)
        summary[q]["records"].append({
            "id": rec.id,
            "deductee_name": rec.deductee_name,
            "section": rec.section,
            "payment_amount": float(rec.payment_amount or 0),
            "tds_amount": float(rec.tds_amount or 0),
            "deposited": rec.deposited,
        })
    return summary


@tds_router.get("/sections")
async def get_tds_sections():
    return {
        "194C": {"description": "Contractor payments", "rate": 1.0, "threshold": 30000},
        "194J": {"description": "Professional/Technical fees", "rate": 10.0, "threshold": 30000},
        "194H": {"description": "Commission/Brokerage", "rate": 5.0, "threshold": 15000},
        "194I": {"description": "Rent", "rate": 10.0, "threshold": 240000},
        "194A": {"description": "Interest (other than securities)", "rate": 10.0, "threshold": 40000},
        "194B": {"description": "Lottery winnings", "rate": 30.0, "threshold": 10000},
    }


# ─── ITR Router ───────────────────────────────────────────────────────────────
itr_router = APIRouter(prefix="/itr", tags=["ITR"])


@itr_router.get("/summary")
async def get_itr_summary(
    financial_year: str = "2024-25",
    client_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.services.tax.itr_engine import ITREngine
    cid = await get_my_client_id(current_user, db, client_id)
    engine = ITREngine(db)
    result = await engine.compute_itr(cid, financial_year)
    return result


@itr_router.post("/save-draft")
async def save_itr_draft(
    financial_year: str,
    ca_notes: Optional[str] = None,
    client_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.services.tax.itr_engine import ITREngine
    cid = await get_my_client_id(current_user, db, client_id)
    engine = ITREngine(db)
    summary = await engine.compute_itr(cid, financial_year)
    ay_parts = financial_year.split("-")
    assessment_year = f"20{ay_parts[1]}-{int(ay_parts[1])+1:02d}" if len(ay_parts) == 2 else "2025-26"
    draft = ITRDraft(
        client_id=cid, financial_year=financial_year,
        assessment_year=assessment_year, itr_type="ITR-4",
        gross_income=summary.gross_income, total_deductions=summary.total_deductions,
        taxable_income=summary.taxable_income, tax_liability=summary.tax_liability,
        tds_paid=summary.tds_paid, net_tax_payable=summary.net_tax_payable,
        ca_notes=ca_notes, status="draft",
    )
    db.add(draft)
    await db.flush()
    return {"message": "Draft saved", "id": draft.id}


# ─── Bookkeeping Router ───────────────────────────────────────────────────────
bookkeeping_router = APIRouter(prefix="/bookkeeping", tags=["Bookkeeping"])


@bookkeeping_router.get("/trial-balance")
async def get_trial_balance(
    financial_year: str = "2024-25",
    client_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.services.reports.financial_statements import FinancialStatementsService
    cid = await get_my_client_id(current_user, db, client_id)
    svc = FinancialStatementsService(db)
    return await svc.get_trial_balance(cid, financial_year)


@bookkeeping_router.get("/chart-of-accounts")
async def get_chart_of_accounts():
    return {
        "assets": [
            {"code": "1001", "name": "Cash in Hand"},
            {"code": "1002", "name": "Bank Account"},
            {"code": "1010", "name": "Accounts Receivable"},
            {"code": "1020", "name": "Inventory"},
            {"code": "1100", "name": "Fixed Assets"},
        ],
        "liabilities": [
            {"code": "2001", "name": "Accounts Payable"},
            {"code": "2010", "name": "GST Payable"},
            {"code": "2020", "name": "TDS Payable"},
            {"code": "2100", "name": "Loans"},
        ],
        "capital": [
            {"code": "3001", "name": "Owner's Capital"},
            {"code": "3010", "name": "Retained Earnings"},
        ],
        "income": [
            {"code": "4001", "name": "Sales Revenue"},
            {"code": "4010", "name": "Other Income"},
        ],
        "expenses": [
            {"code": "5001", "name": "Cost of Goods Sold"},
            {"code": "5010", "name": "Salaries"},
            {"code": "5020", "name": "Rent"},
            {"code": "5030", "name": "Utilities"},
            {"code": "5040", "name": "Professional Fees"},
            {"code": "5050", "name": "Depreciation"},
        ],
    }


@bookkeeping_router.get("/journal-entries")
async def get_journal_entries(
    financial_year: str = "2024-25",
    client_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    cid = await get_my_client_id(current_user, db, client_id)
    query = select(JournalEntry).where(
        and_(JournalEntry.financial_year == financial_year, JournalEntry.client_id == cid)
    ).limit(limit).offset(offset).order_by(JournalEntry.entry_date.desc())
    result = await db.execute(query)
    entries = result.scalars().all()
    return [
        {
            "id": e.id, "entry_date": str(e.entry_date),
            "account_code": e.account_code, "account_name": e.account_name,
            "debit": float(e.debit_amount or 0), "credit": float(e.credit_amount or 0),
            "narration": e.narration,
        }
        for e in entries
    ]


# ─── Reports Router ───────────────────────────────────────────────────────────
reports_router = APIRouter(prefix="/reports", tags=["Reports"])


@reports_router.get("/profit-loss")
async def get_profit_loss(
    financial_year: str = "2024-25",
    client_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.services.reports.financial_statements import FinancialStatementsService
    cid = await get_my_client_id(current_user, db, client_id)
    svc = FinancialStatementsService(db)
    return await svc.get_profit_loss(cid, financial_year)


@reports_router.get("/balance-sheet")
async def get_balance_sheet(
    financial_year: str = "2024-25",
    client_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.services.reports.financial_statements import FinancialStatementsService
    cid = await get_my_client_id(current_user, db, client_id)
    svc = FinancialStatementsService(db)
    return await svc.get_balance_sheet(cid, financial_year)


# ─── Client Management Router ────────────────────────────────────────────────
clients_router = APIRouter(prefix="/clients", tags=["Clients"])


@clients_router.get("/")
async def list_clients(
    is_active: Optional[bool] = None,
    current_user: User = Depends(require_ca),
    db: AsyncSession = Depends(get_db)
):
    query = select(ClientProfile, User).join(User, User.id == ClientProfile.user_id)
    if is_active is not None:
        query = query.where(ClientProfile.is_active == is_active)
    result = await db.execute(query)
    rows = result.all()
    return [
        {
            "id": p.id, "user_id": p.user_id,
            "business_name": p.business_name,
            "pan": p.pan, "gstin": p.gstin,
            "business_type": p.business_type,
            "state": p.state,
            "current_fy": p.current_financial_year,
            "is_active": p.is_active,
            "email": u.email,
            "full_name": u.full_name,
            "phone": u.phone,
        }
        for p, u in rows
    ]


@clients_router.get("/{client_id}/dashboard")
async def get_client_dashboard(
    client_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(ClientProfile).where(ClientProfile.id == client_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Client not found")

    from app.models.models import GSTFiling
    fy = profile.current_financial_year

    doc_count = await db.execute(
        select(func.count(Document.id)).where(
            and_(Document.client_id == client_id, Document.financial_year == fy)
        )
    )
    pending_docs = await db.execute(
        select(func.count(Document.id)).where(
            and_(Document.client_id == client_id, Document.processing_status == "pending")
        )
    )
    completed_docs = await db.execute(
        select(func.count(Document.id)).where(
            and_(Document.client_id == client_id, Document.processing_status == "completed")
        )
    )
    gst_filed = await db.execute(
        select(func.count(GSTFiling.id)).where(
            and_(GSTFiling.client_id == client_id,
                 GSTFiling.financial_year == fy,
                 GSTFiling.filing_status == "filed")
        )
    )
    total_sales = await db.execute(
        select(func.coalesce(func.sum(Transaction.total_amount), 0)).where(
            and_(Transaction.client_id == client_id,
                 Transaction.financial_year == fy,
                 Transaction.transaction_type == "sales")
        )
    )
    total_purchases = await db.execute(
        select(func.coalesce(func.sum(Transaction.total_amount), 0)).where(
            and_(Transaction.client_id == client_id,
                 Transaction.financial_year == fy,
                 Transaction.transaction_type == "purchase")
        )
    )
    total_expenses = await db.execute(
        select(func.coalesce(func.sum(Transaction.total_amount), 0)).where(
            and_(Transaction.client_id == client_id,
                 Transaction.financial_year == fy,
                 Transaction.transaction_type == "expense")
        )
    )

    return {
        "client_id": client_id,
        "business_name": profile.business_name,
        "pan": profile.pan,
        "gstin": profile.gstin,
        "financial_year": fy,
        "stats": {
            "documents_uploaded": doc_count.scalar(),
            "pending_ocr": pending_docs.scalar(),
            "completed_ocr": completed_docs.scalar(),
            "gst_months_filed": gst_filed.scalar(),
            "total_sales": float(total_sales.scalar() or 0),
            "total_purchases": float(total_purchases.scalar() or 0),
            "total_expenses": float(total_expenses.scalar() or 0),
        },
        "pending_tasks": [],
        "alerts": [],
    }


@clients_router.get("/{client_id}/full-profile")
async def get_client_full_profile(
    client_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ClientProfile, User)
        .join(User, User.id == ClientProfile.user_id)
        .where(ClientProfile.id == client_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(404, "Client not found")
    p, u = row
    return {
        "id": p.id, "user_id": p.user_id,
        "email": u.email, "full_name": u.full_name, "phone": u.phone,
        "pan": p.pan, "gstin": p.gstin,
        "business_name": p.business_name,
        "business_type": p.business_type,
        "address": p.address, "state": p.state, "pincode": p.pincode,
        "registration_date": str(p.registration_date) if p.registration_date else None,
        "current_financial_year": p.current_financial_year,
        "gstn_status": p.gstn_status,
        "risk_score": p.risk_score,
        "is_active": p.is_active,
    }


@clients_router.put("/{client_id}/update-profile")
async def update_client_profile(
    client_id: int,
    data: dict,
    current_user: User = Depends(require_ca),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(ClientProfile).where(ClientProfile.id == client_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Client not found")
    for k, v in data.items():
        if hasattr(profile, k):
            setattr(profile, k, v)
    await db.flush()
    return {"message": "Profile updated"}


# ─── Notifications Router ─────────────────────────────────────────────────────
notifications_router = APIRouter(prefix="/notifications", tags=["Notifications"])


@notifications_router.get("/")
async def get_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role == "client":
        profile_result = await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == current_user.id)
        )
        profile = profile_result.scalar_one_or_none()
        if not profile:
            return []
        query = select(Notification).where(
            Notification.client_id == profile.id
        ).order_by(Notification.created_at.desc()).limit(20)
    else:
        query = select(Notification).order_by(Notification.created_at.desc()).limit(50)

    result = await db.execute(query)
    notifs = result.scalars().all()
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "type": n.notification_type,
            "is_read": n.is_read,
            "created_at": str(n.created_at),
        }
        for n in notifs
    ]


@notifications_router.put("/{notif_id}/read")
async def mark_notification_read(
    notif_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Notification).where(Notification.id == notif_id))
    notif = result.scalar_one_or_none()
    if notif:
        notif.is_read = True
        await db.flush()
    return {"message": "Marked as read"}


@notifications_router.put("/mark-all-read")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role == "client":
        profile_result = await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == current_user.id)
        )
        profile = profile_result.scalar_one_or_none()
        if profile:
            result = await db.execute(
                select(Notification).where(
                    and_(Notification.client_id == profile.id, Notification.is_read == False)
                )
            )
            for n in result.scalars().all():
                n.is_read = True
    await db.flush()
    return {"message": "All marked as read"}


# ─── Admin Router ─────────────────────────────────────────────────────────────
admin_router = APIRouter(prefix="/admin", tags=["Admin"])


@admin_router.get("/stats")
async def get_admin_stats(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    total_clients = await db.execute(select(func.count(ClientProfile.id)))
    active_clients = await db.execute(
        select(func.count(ClientProfile.id)).where(ClientProfile.is_active == True)
    )
    total_users = await db.execute(select(func.count(User.id)))
    total_docs = await db.execute(select(func.count(Document.id)))
    pending_docs = await db.execute(
        select(func.count(Document.id)).where(Document.processing_status == "pending")
    )
    total_txns = await db.execute(select(func.count(Transaction.id)))

    return {
        "total_clients": total_clients.scalar(),
        "active_clients": active_clients.scalar(),
        "total_users": total_users.scalar(),
        "total_documents": total_docs.scalar(),
        "pending_documents": pending_docs.scalar(),
        "total_transactions": total_txns.scalar(),
    }


@admin_router.get("/users")
async def list_users(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User))
    users = result.scalars().all()
    return [
        {
            "id": u.id, "email": u.email,
            "full_name": u.full_name, "phone": u.phone,
            "role": u.role, "is_active": u.is_active,
        }
        for u in users
    ]


@admin_router.put("/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    user.is_active = not user.is_active
    await db.flush()
    return {"id": user_id, "is_active": user.is_active}


@admin_router.put("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    new_password: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    from app.core.security import get_password_hash
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    user.hashed_password = get_password_hash(new_password)
    await db.flush()
    return {"message": "Password reset successfully"}
