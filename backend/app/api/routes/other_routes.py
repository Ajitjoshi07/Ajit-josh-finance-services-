from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from decimal import Decimal

from app.db.database import get_db
from app.models.models import (
    TDSRecord, ITRDraft, JournalEntry, Transaction,
    ClientProfile, User, Notification, Document
)
from app.core.security import get_current_user, require_admin, require_ca

# ─── Helper ───────────────────────────────────────────────────────────────────
async def resolve_cid(current_user: User, db: AsyncSession, client_id: Optional[int]) -> int:
    if current_user.role == "client":
        r = await db.execute(select(ClientProfile).where(ClientProfile.user_id == current_user.id))
        p = r.scalar_one_or_none()
        if not p:
            raise HTTPException(404, "Complete your profile first")
        return p.id
    if not client_id:
        raise HTTPException(400, "client_id is required")
    return client_id


# ─── TDS Router ───────────────────────────────────────────────────────────────
tds_router = APIRouter(prefix="/tds", tags=["TDS"])


@tds_router.post("/", status_code=201)
async def create_tds(data: dict, client_id: Optional[int] = None,
                     current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from app.utils.financial_year import get_fy_and_quarter
    from datetime import date
    cid = await resolve_cid(current_user, db, client_id)
    pd = date.fromisoformat(data["payment_date"]) if isinstance(data.get("payment_date"), str) else data.get("payment_date")
    fy, quarter = get_fy_and_quarter(pd) if pd else ("2024-25", 1)
    record = TDSRecord(
        client_id=cid, financial_year=fy, quarter=quarter,
        deductee_name=data.get("deductee_name", ""),
        deductee_pan=data.get("deductee_pan", ""),
        section=data.get("section", "194C"),
        payment_date=pd,
        payment_amount=Decimal(str(data.get("payment_amount", 0))),
        tds_rate=float(data.get("tds_rate", 0)),
        tds_amount=Decimal(str(data.get("tds_amount", 0))),
    )
    db.add(record)
    await db.flush()
    await db.commit()
    return {"id": record.id, "message": "TDS record created"}


@tds_router.get("/quarterly-summary")
async def tds_summary(financial_year: str = "2024-25", quarter: Optional[int] = None,
                      client_id: Optional[int] = None, current_user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    cid = await resolve_cid(current_user, db, client_id)
    query = select(TDSRecord).where(and_(TDSRecord.financial_year == financial_year, TDSRecord.client_id == cid))
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
            "id": rec.id, "deductee_name": rec.deductee_name, "section": rec.section,
            "payment_amount": float(rec.payment_amount or 0), "tds_amount": float(rec.tds_amount or 0),
            "deposited": rec.deposited,
        })
    return summary


@tds_router.get("/sections")
async def tds_sections():
    return {
        "192": {"description": "Salary", "rate": "Slab rates", "threshold": "Basic exemption limit"},
        "194C": {"description": "Contractor payments", "rate": "1% (individual/HUF), 2% (others)", "threshold": "₹30,000 single / ₹1,00,000 aggregate"},
        "194J": {"description": "Professional/Technical fees", "rate": "10%", "threshold": "₹30,000"},
        "194H": {"description": "Commission/Brokerage", "rate": "5%", "threshold": "₹15,000"},
        "194I": {"description": "Rent (land/building)", "rate": "10%", "threshold": "₹2,40,000/yr"},
        "194IA": {"description": "Transfer of immovable property", "rate": "1%", "threshold": "₹50,00,000"},
        "194A": {"description": "Interest (other than securities)", "rate": "10%", "threshold": "₹40,000 (bank)"},
        "194B": {"description": "Lottery/crossword winnings", "rate": "30%", "threshold": "₹10,000"},
        "194D": {"description": "Insurance commission", "rate": "5%", "threshold": "₹15,000"},
        "194Q": {"description": "Purchase of goods", "rate": "0.1%", "threshold": "₹50,00,000 aggregate"},
        "206C": {"description": "Tax collected at source (TCS)", "rate": "Various", "threshold": "Various"},
    }


# ─── ITR Router ───────────────────────────────────────────────────────────────
itr_router = APIRouter(prefix="/itr", tags=["ITR"])


@itr_router.get("/summary")
async def itr_summary(financial_year: str = "2024-25", client_id: Optional[int] = None,
                      current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from app.services.tax.itr_engine import ITREngine
    cid = await resolve_cid(current_user, db, client_id)
    engine = ITREngine(db)
    return await engine.compute_itr(cid, financial_year)


@itr_router.post("/save-draft")
async def save_draft(financial_year: str, ca_notes: Optional[str] = None,
                     client_id: Optional[int] = None, current_user: User = Depends(get_current_user),
                     db: AsyncSession = Depends(get_db)):
    from app.services.tax.itr_engine import ITREngine
    cid = await resolve_cid(current_user, db, client_id)
    engine = ITREngine(db)
    summary = await engine.compute_itr(cid, financial_year)
    ay_parts = financial_year.split("-")
    assessment_year = f"20{ay_parts[1]}-{int(ay_parts[1])+1:02d}" if len(ay_parts) == 2 else "2025-26"
    draft = ITRDraft(
        client_id=cid, financial_year=financial_year, assessment_year=assessment_year,
        itr_type="ITR-4", gross_income=summary.gross_income, total_deductions=summary.total_deductions,
        taxable_income=summary.taxable_income, tax_liability=summary.tax_liability,
        tds_paid=summary.tds_paid, net_tax_payable=summary.net_tax_payable,
        ca_notes=ca_notes, status="draft",
    )
    db.add(draft)
    await db.flush()
    await db.commit()
    return {"message": "Draft saved", "id": draft.id}


# ─── Bookkeeping Router ───────────────────────────────────────────────────────
bookkeeping_router = APIRouter(prefix="/bookkeeping", tags=["Bookkeeping"])


@bookkeeping_router.get("/trial-balance")
async def trial_balance(financial_year: str = "2024-25", client_id: Optional[int] = None,
                        current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from app.services.reports.financial_statements import FinancialStatementsService
    cid = await resolve_cid(current_user, db, client_id)
    svc = FinancialStatementsService(db)
    return await svc.get_trial_balance(cid, financial_year)


@bookkeeping_router.post("/trial-balance/submit")
async def submit_trial_balance(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Submit trial balance — creates journal entries and updates all reports"""
    from app.models.models import JournalEntry, Transaction
    from decimal import Decimal
    from datetime import date

    client_id = data.get("client_id")
    cid = await resolve_cid(current_user, db, client_id)
    financial_year = data.get("financial_year", "2024-25")
    entries = data.get("entries", [])

    if not entries:
        raise HTTPException(400, "No entries provided")

    # Delete previous trial balance entries
    old = await db.execute(
        select(JournalEntry).where(
            and_(JournalEntry.client_id == cid,
                 JournalEntry.financial_year == financial_year,
                 JournalEntry.narration.like("Trial Balance%"))
        )
    )
    for je in old.scalars().all():
        await db.delete(je)

    # Create new journal entries
    fy_year = int("20" + financial_year.split("-")[1]) if "-" in financial_year else 2025
    for entry in entries:
        je = JournalEntry(
            client_id=cid,
            financial_year=financial_year,
            account_code=entry.get("account_code", ""),
            account_name=entry.get("account_name", ""),
            debit_amount=Decimal(str(entry.get("debit_amount", 0))),
            credit_amount=Decimal(str(entry.get("credit_amount", 0))),
            narration=f"Trial Balance — {financial_year}",
            entry_date=date(fy_year, 3, 31),
        )
        db.add(je)

    # Map TB accounts to transactions for auto-calculation
    txn_keywords = {
        "sales": ["Sales Revenue", "Sales (Domestic)", "Sales Account", "Turnover", "Service Income"],
        "purchase": ["Purchases", "Purchase Account"],
        "expense": ["Rent", "Electricity", "Telephone", "Advertising", "Insurance", "Printing",
                    "Postage", "Repair", "Maintenance", "Miscellaneous", "Bank Charges", "Interest on Loan"],
        "salary_slip": ["Salaries", "Salary", "Wages", "Remuneration", "Staff Welfare"],
    }
    for entry in entries:
        acc_name = entry.get("account_name", "")
        dr = float(entry.get("debit_amount", 0))
        cr = float(entry.get("credit_amount", 0))
        txn_type = None
        for t, keywords in txn_keywords.items():
            if any(k.lower() in acc_name.lower() for k in keywords):
                txn_type = t
                break
        if txn_type:
            amount = cr if txn_type == "sales" else dr
            if amount > 0:
                txn = Transaction(
                    client_id=cid,
                    transaction_type=txn_type,
                    taxable_amount=Decimal(str(amount)),
                    total_amount=Decimal(str(amount)),
                    financial_year=financial_year,
                    is_validated=True,
                    description=f"Trial Balance: {acc_name}",
                )
                db.add(txn)

    await db.flush()
    return {"message": f"Trial balance submitted — {len(entries)} entries saved. All reports updated.", "status": "ok"}


@bookkeeping_router.get("/chart-of-accounts")
async def chart_of_accounts():
    return {
        "assets": [
            {"code": "1001", "name": "Cash in Hand"}, {"code": "1002", "name": "Cash at Bank"},
            {"code": "1010", "name": "Sundry Debtors (Accounts Receivable)"},
            {"code": "1020", "name": "Bills Receivable"}, {"code": "1030", "name": "Closing Stock"},
            {"code": "1040", "name": "Prepaid Expenses"}, {"code": "1050", "name": "Advance to Suppliers"},
            {"code": "1060", "name": "TDS Receivable"}, {"code": "1070", "name": "GST Input Credit (ITC)"},
            {"code": "1100", "name": "Land & Building"}, {"code": "1110", "name": "Plant & Machinery"},
            {"code": "1120", "name": "Furniture & Fixtures"}, {"code": "1130", "name": "Vehicles"},
            {"code": "1140", "name": "Computer & Equipment"}, {"code": "1150", "name": "Goodwill"},
            {"code": "1160", "name": "Patents & Trademarks"},
        ],
        "liabilities": [
            {"code": "2001", "name": "Sundry Creditors (Accounts Payable)"},
            {"code": "2010", "name": "Bills Payable"}, {"code": "2020", "name": "GST Payable (CGST)"},
            {"code": "2021", "name": "GST Payable (SGST)"}, {"code": "2022", "name": "GST Payable (IGST)"},
            {"code": "2030", "name": "TDS Payable"}, {"code": "2040", "name": "PF Payable"},
            {"code": "2050", "name": "ESI Payable"}, {"code": "2060", "name": "Professional Tax Payable"},
            {"code": "2070", "name": "Income Tax Payable"}, {"code": "2080", "name": "Advance from Customers"},
            {"code": "2100", "name": "Bank Loan (Secured)"}, {"code": "2110", "name": "Bank Overdraft"},
            {"code": "2120", "name": "Unsecured Loans"}, {"code": "2130", "name": "Loan from Directors"},
        ],
        "capital": [
            {"code": "3001", "name": "Capital Account"}, {"code": "3010", "name": "Drawings Account"},
            {"code": "3020", "name": "Retained Earnings"}, {"code": "3030", "name": "Reserves & Surplus"},
        ],
        "income": [
            {"code": "4001", "name": "Sales (Domestic)"}, {"code": "4002", "name": "Sales (Export)"},
            {"code": "4003", "name": "Service Income"}, {"code": "4010", "name": "Commission Received"},
            {"code": "4020", "name": "Rent Received"}, {"code": "4030", "name": "Interest Received"},
            {"code": "4040", "name": "Discount Received"}, {"code": "4050", "name": "Other Income"},
        ],
        "direct_expenses": [
            {"code": "5001", "name": "Opening Stock"}, {"code": "5002", "name": "Purchases (Domestic)"},
            {"code": "5003", "name": "Purchases (Import)"}, {"code": "5010", "name": "Direct Wages"},
            {"code": "5020", "name": "Freight & Carriage Inward"}, {"code": "5030", "name": "Customs Duty"},
            {"code": "5040", "name": "Manufacturing Expenses"}, {"code": "5050", "name": "Power & Fuel"},
        ],
        "indirect_expenses": [
            {"code": "6001", "name": "Salaries & Wages"}, {"code": "6010", "name": "Rent & Rates"},
            {"code": "6020", "name": "Electricity Charges"}, {"code": "6030", "name": "Telephone & Internet"},
            {"code": "6040", "name": "Printing & Stationery"}, {"code": "6050", "name": "Advertisement"},
            {"code": "6060", "name": "Audit Fees"}, {"code": "6070", "name": "Legal & Professional Fees"},
            {"code": "6080", "name": "Repair & Maintenance"}, {"code": "6090", "name": "Insurance Premium"},
            {"code": "6100", "name": "Depreciation"}, {"code": "6110", "name": "Interest on Loan"},
            {"code": "6120", "name": "Bank Charges"}, {"code": "6130", "name": "Travel & Conveyance"},
            {"code": "6140", "name": "Postage & Courier"}, {"code": "6150", "name": "Miscellaneous Expenses"},
        ],
    }


@bookkeeping_router.get("/journal-entries")
async def journal_entries(financial_year: str = "2024-25", client_id: Optional[int] = None,
                          limit: int = 100, offset: int = 0,
                          current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    cid = await resolve_cid(current_user, db, client_id)
    query = select(JournalEntry).where(
        and_(JournalEntry.financial_year == financial_year, JournalEntry.client_id == cid)
    ).limit(limit).offset(offset).order_by(JournalEntry.entry_date.desc())
    result = await db.execute(query)
    entries = result.scalars().all()
    return [{"id": e.id, "entry_date": str(e.entry_date), "account_code": e.account_code,
             "account_name": e.account_name, "debit": float(e.debit_amount or 0),
             "credit": float(e.credit_amount or 0), "narration": e.narration} for e in entries]


# ─── Reports Router ───────────────────────────────────────────────────────────
reports_router = APIRouter(prefix="/reports", tags=["Reports"])


@reports_router.get("/profit-loss")
async def profit_loss(financial_year: str = "2024-25", client_id: Optional[int] = None,
                      current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from app.services.reports.financial_statements import FinancialStatementsService
    cid = await resolve_cid(current_user, db, client_id)
    svc = FinancialStatementsService(db)
    return await svc.get_profit_loss(cid, financial_year)


@reports_router.get("/balance-sheet")
async def balance_sheet(financial_year: str = "2024-25", client_id: Optional[int] = None,
                        current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from app.services.reports.financial_statements import FinancialStatementsService
    cid = await resolve_cid(current_user, db, client_id)
    svc = FinancialStatementsService(db)
    return await svc.get_balance_sheet(cid, financial_year)


@reports_router.get("/manufacturing-account")
async def manufacturing_account(financial_year: str = "2024-25", client_id: Optional[int] = None,
                                current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from app.services.reports.financial_statements import FinancialStatementsService
    cid = await resolve_cid(current_user, db, client_id)
    svc = FinancialStatementsService(db)
    return await svc.get_manufacturing_account(cid, financial_year)


@reports_router.get("/trading-account")
async def trading_account(financial_year: str = "2024-25", client_id: Optional[int] = None,
                           current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from app.services.reports.financial_statements import FinancialStatementsService
    cid = await resolve_cid(current_user, db, client_id)
    svc = FinancialStatementsService(db)
    return await svc.get_trading_account(cid, financial_year)


# ─── Clients Router ───────────────────────────────────────────────────────────
clients_router = APIRouter(prefix="/clients", tags=["Clients"])


@clients_router.get("/")
async def list_clients(is_active: Optional[bool] = None, current_user: User = Depends(require_ca),
                       db: AsyncSession = Depends(get_db)):
    query = select(ClientProfile, User).join(User, User.id == ClientProfile.user_id)
    if is_active is not None:
        query = query.where(ClientProfile.is_active == is_active)
    result = await db.execute(query)
    rows = result.all()
    return [{"id": p.id, "user_id": p.user_id, "business_name": p.business_name, "pan": p.pan,
             "gstin": p.gstin, "business_type": p.business_type, "state": p.state,
             "current_fy": p.current_financial_year, "is_active": p.is_active,
             "email": u.email, "full_name": u.full_name, "phone": u.phone} for p, u in rows]


@clients_router.get("/{client_id}/dashboard")
async def client_dashboard(client_id: int, current_user: User = Depends(get_current_user),
                            db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ClientProfile).where(ClientProfile.id == client_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Client not found")
    from app.models.models import GSTFiling
    fy = profile.current_financial_year
    doc_count = await db.execute(select(func.count(Document.id)).where(and_(Document.client_id == client_id, Document.financial_year == fy)))
    pending_docs = await db.execute(select(func.count(Document.id)).where(and_(Document.client_id == client_id, Document.processing_status == "pending")))
    gst_filed = await db.execute(select(func.count(GSTFiling.id)).where(and_(GSTFiling.client_id == client_id, GSTFiling.financial_year == fy, GSTFiling.filing_status == "filed")))
    total_sales = await db.execute(select(func.coalesce(func.sum(Transaction.total_amount), 0)).where(and_(Transaction.client_id == client_id, Transaction.financial_year == fy, Transaction.transaction_type == "sales", Transaction.is_validated == True)))
    total_purchases = await db.execute(select(func.coalesce(func.sum(Transaction.total_amount), 0)).where(and_(Transaction.client_id == client_id, Transaction.financial_year == fy, Transaction.transaction_type == "purchase", Transaction.is_validated == True)))
    return {
        "client_id": client_id, "business_name": profile.business_name, "pan": profile.pan,
        "gstin": profile.gstin, "financial_year": fy,
        "stats": {
            "documents_uploaded": doc_count.scalar(), "pending_ocr": pending_docs.scalar(),
            "gst_months_filed": gst_filed.scalar(),
            "total_sales": float(total_sales.scalar() or 0),
            "total_purchases": float(total_purchases.scalar() or 0),
        },
    }


@clients_router.get("/{client_id}/full-profile")
async def client_full_profile(client_id: int, current_user: User = Depends(get_current_user),
                               db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ClientProfile, User).join(User, User.id == ClientProfile.user_id).where(ClientProfile.id == client_id))
    row = result.one_or_none()
    if not row:
        raise HTTPException(404, "Client not found")
    p, u = row
    return {"id": p.id, "user_id": p.user_id, "email": u.email, "full_name": u.full_name, "phone": u.phone,
            "pan": p.pan, "gstin": p.gstin, "business_name": p.business_name, "business_type": p.business_type,
            "address": p.address, "state": p.state, "pincode": p.pincode,
            "registration_date": str(p.registration_date) if p.registration_date else None,
            "current_financial_year": p.current_financial_year, "gstn_status": p.gstn_status,
            "risk_score": p.risk_score, "is_active": p.is_active}


# ─── Notifications Router ─────────────────────────────────────────────────────
notifications_router = APIRouter(prefix="/notifications", tags=["Notifications"])


@notifications_router.get("/")
async def get_notifications(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role == "client":
        r = await db.execute(select(ClientProfile).where(ClientProfile.user_id == current_user.id))
        p = r.scalar_one_or_none()
        if not p:
            return []
        query = select(Notification).where(Notification.client_id == p.id).order_by(Notification.created_at.desc()).limit(30)
    else:
        query = select(Notification).order_by(Notification.created_at.desc()).limit(50)
    result = await db.execute(query)
    notifs = result.scalars().all()
    return [{"id": n.id, "title": n.title, "message": n.message, "type": n.notification_type,
             "is_read": n.is_read, "created_at": str(n.created_at)} for n in notifs]


@notifications_router.put("/{notif_id}/read")
async def mark_read(notif_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Notification).where(Notification.id == notif_id))
    n = result.scalar_one_or_none()
    if n:
        n.is_read = True
        await db.flush()
        await db.commit()
    return {"message": "Marked as read"}


@notifications_router.put("/mark-all-read")
async def mark_all_read(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role == "client":
        r = await db.execute(select(ClientProfile).where(ClientProfile.user_id == current_user.id))
        p = r.scalar_one_or_none()
        if p:
            result = await db.execute(select(Notification).where(and_(Notification.client_id == p.id, Notification.is_read == False)))
            for n in result.scalars().all():
                n.is_read = True
    await db.flush()
    await db.commit()
    return {"message": "All marked as read"}


# ─── Admin Router ─────────────────────────────────────────────────────────────
admin_router = APIRouter(prefix="/admin", tags=["Admin"])


@admin_router.get("/stats")
async def admin_stats(current_user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    total_clients = await db.execute(select(func.count(ClientProfile.id)))
    active_clients = await db.execute(select(func.count(ClientProfile.id)).where(ClientProfile.is_active == True))
    total_users = await db.execute(select(func.count(User.id)))
    total_docs = await db.execute(select(func.count(Document.id)))
    pending_docs = await db.execute(select(func.count(Document.id)).where(Document.processing_status == "pending"))
    total_txns = await db.execute(select(func.count(Transaction.id)))
    return {"total_clients": total_clients.scalar(), "active_clients": active_clients.scalar(),
            "total_users": total_users.scalar(), "total_documents": total_docs.scalar(),
            "pending_documents": pending_docs.scalar(), "total_transactions": total_txns.scalar()}


@admin_router.get("/users")
async def list_users(current_user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    users = result.scalars().all()
    return [{"id": u.id, "email": u.email, "full_name": u.full_name, "phone": u.phone,
             "role": u.role, "is_active": u.is_active} for u in users]


@admin_router.put("/users/{user_id}/toggle-active")
async def toggle_user(user_id: int, current_user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    user.is_active = not user.is_active
    await db.flush()
    await db.commit()
    return {"id": user_id, "is_active": user.is_active}


@admin_router.put("/users/{user_id}/reset-password")
async def reset_password(user_id: int, new_password: str, current_user: User = Depends(require_admin),
                          db: AsyncSession = Depends(get_db)):
    from app.core.security import get_password_hash
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    user.hashed_password = get_password_hash(new_password)
    await db.flush()
    await db.commit()
    return {"message": "Password reset successfully"}
