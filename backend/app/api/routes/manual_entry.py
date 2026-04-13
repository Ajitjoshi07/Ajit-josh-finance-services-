"""
Manual Data Entry Routes
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel

from app.db.database import get_db
from app.models.models import User, ClientProfile, Transaction, JournalEntry
from app.core.security import get_current_user, require_ca

router = APIRouter(prefix="/manual-entry", tags=["Manual Entry"])


class ManualTransaction(BaseModel):
    transaction_type: str
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    party_name: Optional[str] = None
    party_gstin: Optional[str] = None
    description: Optional[str] = None
    taxable_amount: float = 0
    cgst_amount: float = 0
    sgst_amount: float = 0
    igst_amount: float = 0
    total_amount: float = 0
    tds_amount: float = 0
    hsn_code: Optional[str] = None
    financial_year: str = "2024-25"
    month: Optional[int] = None


class ManualEntryBatch(BaseModel):
    client_id: Optional[int] = None
    financial_year: str = "2024-25"
    entries: List[ManualTransaction]
    notes: Optional[str] = None


class TrialBalanceEntry(BaseModel):
    account_code: str
    account_name: str
    debit_amount: float = 0
    credit_amount: float = 0


class TrialBalanceBatch(BaseModel):
    client_id: Optional[int] = None
    financial_year: str = "2024-25"
    entries: List[TrialBalanceEntry]
    notes: Optional[str] = None


async def get_client_id(current_user: User, db: AsyncSession, client_id: Optional[int]) -> int:
    if current_user.role == "client":
        result = await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == current_user.id)
        )
        p = result.scalar_one_or_none()
        if not p:
            raise HTTPException(400, "Complete your Business Profile first before entering data")
        return p.id
    if not client_id:
        raise HTTPException(400, "client_id required for admin/CA users — select a client first")
    return client_id


@router.post("/submit")
async def submit_manual_entries(
    batch: ManualEntryBatch,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    cid = await get_client_id(current_user, db, batch.client_id)
    created = []

    for entry in batch.entries:
        month = entry.month
        year = None
        fy = batch.financial_year

        if entry.invoice_date:
            month = month or entry.invoice_date.month
            year = entry.invoice_date.year

        txn = Transaction(
            client_id=cid,
            transaction_type=entry.transaction_type,
            invoice_number=entry.invoice_number,
            invoice_date=entry.invoice_date,
            party_name=entry.party_name,
            party_gstin=entry.party_gstin,
            taxable_amount=Decimal(str(entry.taxable_amount)),
            cgst_amount=Decimal(str(entry.cgst_amount)),
            sgst_amount=Decimal(str(entry.sgst_amount)),
            igst_amount=Decimal(str(entry.igst_amount)),
            total_amount=Decimal(str(entry.total_amount or entry.taxable_amount)),
            tds_amount=Decimal(str(entry.tds_amount)),
            hsn_code=entry.hsn_code,
            financial_year=fy,
            month=month,
            year=year,
            is_validated=False,  # Pending CA review
            description=entry.description or f"Manual entry by {current_user.full_name}",
        )
        db.add(txn)
        created.append(txn)

    await db.flush()
    return {
        "message": f"{len(created)} entries submitted for CA review",
        "transaction_ids": [t.id for t in created],
        "status": "pending",
    }


@router.get("/my-entries")
async def get_my_entries(
    financial_year: str = "2024-25",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role == "client":
        result = await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == current_user.id)
        )
        p = result.scalar_one_or_none()
        if not p:
            return []
        cid = p.id
    else:
        # Admin sees all entries
        result = await db.execute(
            select(Transaction).where(
                Transaction.financial_year == financial_year
            ).order_by(Transaction.created_at.desc()).limit(200)
        )
        txns = result.scalars().all()
        return [_txn_to_dict(t) for t in txns]

    result = await db.execute(
        select(Transaction).where(
            and_(Transaction.client_id == cid,
                 Transaction.financial_year == financial_year)
        ).order_by(Transaction.created_at.desc())
    )
    txns = result.scalars().all()
    return [_txn_to_dict(t) for t in txns]


def _txn_to_dict(t: Transaction) -> dict:
    status = "approved" if t.is_validated else "pending"
    if t.description and "rejected" in str(t.description).lower():
        status = "rejected"
    return {
        "id": t.id,
        "client_id": t.client_id,
        "transaction_type": t.transaction_type,
        "invoice_number": t.invoice_number,
        "invoice_date": str(t.invoice_date) if t.invoice_date else None,
        "party_name": t.party_name,
        "party_gstin": t.party_gstin,
        "taxable_amount": float(t.taxable_amount or 0),
        "cgst_amount": float(t.cgst_amount or 0),
        "sgst_amount": float(t.sgst_amount or 0),
        "igst_amount": float(t.igst_amount or 0),
        "total_amount": float(t.total_amount or 0),
        "tds_amount": float(t.tds_amount or 0),
        "description": t.description,
        "financial_year": t.financial_year,
        "month": t.month,
        "status": status,
        "created_at": str(t.created_at) if t.created_at else None,
    }


@router.get("/pending")
async def get_pending_entries(
    financial_year: str = "2024-25",
    client_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Transaction).where(
        and_(
            Transaction.is_validated == False,
            Transaction.financial_year == financial_year,
        )
    )
    if client_id:
        query = query.where(Transaction.client_id == client_id)
    result = await db.execute(query.order_by(Transaction.created_at.desc()))
    return [_txn_to_dict(t) for t in result.scalars().all()]


@router.put("/approve/{txn_id}")
async def approve_entry(
    txn_id: int,
    current_user: User = Depends(require_ca),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Transaction).where(Transaction.id == txn_id))
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(404, "Transaction not found")
    txn.is_validated = True
    await db.flush()
    return {"message": "Approved — accounts updated", "id": txn_id}


@router.put("/approve-batch")
async def approve_batch(
    ids: List[int],
    current_user: User = Depends(require_ca),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Transaction).where(Transaction.id.in_(ids))
    )
    txns = result.scalars().all()
    for t in txns:
        t.is_validated = True
    await db.flush()
    return {"approved": len(txns), "ids": [t.id for t in txns]}


@router.put("/reject/{txn_id}")
async def reject_entry(
    txn_id: int,
    reason: str = "Rejected by CA",
    current_user: User = Depends(require_ca),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Transaction).where(Transaction.id == txn_id))
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(404, "Transaction not found")
    txn.description = f"REJECTED: {reason}"
    txn.is_validated = False
    await db.flush()
    return {"message": "Entry rejected", "id": txn_id}


# ── Trial Balance ─────────────────────────────────────────────────────────────

@router.post("/trial-balance/submit")
async def submit_trial_balance(
    batch: TrialBalanceBatch,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Submit trial balance — creates journal entries"""
    cid = await get_client_id(current_user, db, batch.client_id)

    # Delete old trial balance entries for this period
    old = await db.execute(
        select(JournalEntry).where(
            and_(JournalEntry.client_id == cid,
                 JournalEntry.financial_year == batch.financial_year,
                 JournalEntry.narration.like("Trial Balance%"))
        )
    )
    for je in old.scalars().all():
        await db.delete(je)

    created = []
    for entry in batch.entries:
        je = JournalEntry(
            client_id=cid,
            financial_year=batch.financial_year,
            account_code=entry.account_code,
            account_name=entry.account_name,
            debit_amount=Decimal(str(entry.debit_amount)),
            credit_amount=Decimal(str(entry.credit_amount)),
            narration=f"Trial Balance — {batch.financial_year}",
            entry_date=date(int("20" + batch.financial_year.split("-")[1]), 3, 31),
        )
        db.add(je)
        created.append(je)

    await db.flush()

    # Also create transactions from TB for accounts that map to transactions
    # This updates GST/ITR/P&L automatically
    txn_map = {
        "sales": ["Sales Revenue", "Sales Account", "Turnover", "Sales (Net)"],
        "purchase": ["Purchases", "Purchase Account", "Cost of Goods"],
        "expense": ["Expenses", "Operating Expenses", "Indirect Expenses"],
        "salary_slip": ["Salaries", "Salary", "Wages", "Remuneration"],
    }
    for entry in batch.entries:
        if entry.debit_amount > 0 or entry.credit_amount > 0:
            txn_type = None
            for t, keywords in txn_map.items():
                if any(k.lower() in entry.account_name.lower() for k in keywords):
                    txn_type = t
                    break
            if txn_type:
                amount = entry.debit_amount if txn_type in ["purchase","expense","salary_slip"] else entry.credit_amount
                if amount > 0:
                    txn = Transaction(
                        client_id=cid,
                        transaction_type=txn_type,
                        taxable_amount=Decimal(str(amount)),
                        total_amount=Decimal(str(amount)),
                        financial_year=batch.financial_year,
                        is_validated=True,
                        description=f"From Trial Balance: {entry.account_name}",
                    )
                    db.add(txn)

    await db.flush()
    return {
        "message": f"Trial balance submitted — {len(created)} entries saved",
        "status": "approved",
        "note": "All financial reports have been updated automatically"
    }


@router.get("/trial-balance/template")
async def get_trial_balance_template():
    """Returns ICAI standard trial balance accounts list"""
    return {
        "accounts": ICAI_TRIAL_BALANCE_ACCOUNTS
    }


ICAI_TRIAL_BALANCE_ACCOUNTS = [
    # ASSETS
    {"code": "1001", "name": "Cash in Hand", "group": "Current Assets", "normal_balance": "Dr"},
    {"code": "1002", "name": "Cash at Bank (Current A/c)", "group": "Current Assets", "normal_balance": "Dr"},
    {"code": "1003", "name": "Cash at Bank (Savings A/c)", "group": "Current Assets", "normal_balance": "Dr"},
    {"code": "1004", "name": "Fixed Deposits (FD)", "group": "Current Assets", "normal_balance": "Dr"},
    {"code": "1010", "name": "Sundry Debtors (Accounts Receivable)", "group": "Current Assets", "normal_balance": "Dr"},
    {"code": "1011", "name": "Bills Receivable", "group": "Current Assets", "normal_balance": "Dr"},
    {"code": "1020", "name": "Opening Stock", "group": "Current Assets", "normal_balance": "Dr"},
    {"code": "1021", "name": "Closing Stock", "group": "Current Assets", "normal_balance": "Dr"},
    {"code": "1030", "name": "Prepaid Expenses", "group": "Current Assets", "normal_balance": "Dr"},
    {"code": "1031", "name": "Advance to Suppliers", "group": "Current Assets", "normal_balance": "Dr"},
    {"code": "1032", "name": "Advance to Employees", "group": "Current Assets", "normal_balance": "Dr"},
    {"code": "1033", "name": "TDS Receivable / Tax Refund Due", "group": "Current Assets", "normal_balance": "Dr"},
    {"code": "1034", "name": "GST Input Tax Credit (ITC)", "group": "Current Assets", "normal_balance": "Dr"},
    {"code": "1035", "name": "Other Current Assets", "group": "Current Assets", "normal_balance": "Dr"},
    {"code": "1100", "name": "Land & Building", "group": "Fixed Assets", "normal_balance": "Dr"},
    {"code": "1101", "name": "Plant & Machinery", "group": "Fixed Assets", "normal_balance": "Dr"},
    {"code": "1102", "name": "Furniture & Fixtures", "group": "Fixed Assets", "normal_balance": "Dr"},
    {"code": "1103", "name": "Computers & IT Equipment", "group": "Fixed Assets", "normal_balance": "Dr"},
    {"code": "1104", "name": "Vehicles", "group": "Fixed Assets", "normal_balance": "Dr"},
    {"code": "1105", "name": "Office Equipment", "group": "Fixed Assets", "normal_balance": "Dr"},
    {"code": "1106", "name": "Less: Accumulated Depreciation", "group": "Fixed Assets", "normal_balance": "Cr"},
    {"code": "1110", "name": "Intangible Assets (Goodwill)", "group": "Fixed Assets", "normal_balance": "Dr"},
    {"code": "1120", "name": "Long-term Investments", "group": "Investments", "normal_balance": "Dr"},
    {"code": "1121", "name": "Short-term Investments / MF", "group": "Investments", "normal_balance": "Dr"},
    {"code": "1130", "name": "Preliminary Expenses", "group": "Misc Expenditure", "normal_balance": "Dr"},
    # LIABILITIES
    {"code": "2001", "name": "Sundry Creditors (Accounts Payable)", "group": "Current Liabilities", "normal_balance": "Cr"},
    {"code": "2002", "name": "Bills Payable", "group": "Current Liabilities", "normal_balance": "Cr"},
    {"code": "2003", "name": "Outstanding Expenses", "group": "Current Liabilities", "normal_balance": "Cr"},
    {"code": "2004", "name": "Advance from Customers", "group": "Current Liabilities", "normal_balance": "Cr"},
    {"code": "2010", "name": "GST Payable — CGST", "group": "Current Liabilities", "normal_balance": "Cr"},
    {"code": "2011", "name": "GST Payable — SGST", "group": "Current Liabilities", "normal_balance": "Cr"},
    {"code": "2012", "name": "GST Payable — IGST", "group": "Current Liabilities", "normal_balance": "Cr"},
    {"code": "2013", "name": "TDS Payable", "group": "Current Liabilities", "normal_balance": "Cr"},
    {"code": "2014", "name": "Salary Payable", "group": "Current Liabilities", "normal_balance": "Cr"},
    {"code": "2015", "name": "PF / ESIC Payable", "group": "Current Liabilities", "normal_balance": "Cr"},
    {"code": "2016", "name": "Income Tax Payable", "group": "Current Liabilities", "normal_balance": "Cr"},
    {"code": "2017", "name": "Other Current Liabilities", "group": "Current Liabilities", "normal_balance": "Cr"},
    {"code": "2100", "name": "Bank Overdraft (OD)", "group": "Secured Loans", "normal_balance": "Cr"},
    {"code": "2101", "name": "Bank Term Loan", "group": "Secured Loans", "normal_balance": "Cr"},
    {"code": "2102", "name": "Mortgage / Hypothecation Loan", "group": "Secured Loans", "normal_balance": "Cr"},
    {"code": "2110", "name": "Unsecured Loans from Partners/Directors", "group": "Unsecured Loans", "normal_balance": "Cr"},
    {"code": "2111", "name": "Inter-Corporate Deposits", "group": "Unsecured Loans", "normal_balance": "Cr"},
    # CAPITAL
    {"code": "3001", "name": "Capital Account / Proprietor's Capital", "group": "Capital", "normal_balance": "Cr"},
    {"code": "3002", "name": "Drawings Account", "group": "Capital", "normal_balance": "Dr"},
    {"code": "3003", "name": "Share Capital (if company)", "group": "Capital", "normal_balance": "Cr"},
    {"code": "3004", "name": "Reserves & Surplus", "group": "Capital", "normal_balance": "Cr"},
    {"code": "3005", "name": "Retained Earnings", "group": "Capital", "normal_balance": "Cr"},
    # INCOME
    {"code": "4001", "name": "Sales Revenue (Domestic)", "group": "Sales Income", "normal_balance": "Cr"},
    {"code": "4002", "name": "Sales Revenue (Export)", "group": "Sales Income", "normal_balance": "Cr"},
    {"code": "4003", "name": "Service Income / Fees", "group": "Sales Income", "normal_balance": "Cr"},
    {"code": "4004", "name": "Sales Returns (Deduct)", "group": "Sales Income", "normal_balance": "Dr"},
    {"code": "4005", "name": "Other Operating Income", "group": "Other Income", "normal_balance": "Cr"},
    {"code": "4010", "name": "Interest Income (Bank/FD)", "group": "Other Income", "normal_balance": "Cr"},
    {"code": "4011", "name": "Commission Received", "group": "Other Income", "normal_balance": "Cr"},
    {"code": "4012", "name": "Rent Received", "group": "Other Income", "normal_balance": "Cr"},
    {"code": "4013", "name": "Dividend Income", "group": "Other Income", "normal_balance": "Cr"},
    {"code": "4014", "name": "Discount Received", "group": "Other Income", "normal_balance": "Cr"},
    {"code": "4015", "name": "Profit on Sale of Fixed Assets", "group": "Other Income", "normal_balance": "Cr"},
    # DIRECT EXPENSES (COGS)
    {"code": "5001", "name": "Opening Stock (Raw Material)", "group": "Direct Expenses", "normal_balance": "Dr"},
    {"code": "5002", "name": "Purchases (Net)", "group": "Direct Expenses", "normal_balance": "Dr"},
    {"code": "5003", "name": "Purchase Returns (Deduct)", "group": "Direct Expenses", "normal_balance": "Cr"},
    {"code": "5004", "name": "Direct Wages / Labour Charges", "group": "Direct Expenses", "normal_balance": "Dr"},
    {"code": "5005", "name": "Factory Overhead", "group": "Direct Expenses", "normal_balance": "Dr"},
    {"code": "5006", "name": "Power & Fuel (Factory)", "group": "Direct Expenses", "normal_balance": "Dr"},
    {"code": "5007", "name": "Freight Inward / Carriage on Purchases", "group": "Direct Expenses", "normal_balance": "Dr"},
    {"code": "5008", "name": "Custom Duty / Import Charges", "group": "Direct Expenses", "normal_balance": "Dr"},
    {"code": "5009", "name": "Manufacturing / Production Expenses", "group": "Direct Expenses", "normal_balance": "Dr"},
    {"code": "5010", "name": "Closing Stock (Raw Material)", "group": "Direct Expenses", "normal_balance": "Cr"},
    # INDIRECT EXPENSES
    {"code": "6001", "name": "Salaries & Staff Welfare", "group": "Indirect Expenses", "normal_balance": "Dr"},
    {"code": "6002", "name": "Office / Shop Rent", "group": "Indirect Expenses", "normal_balance": "Dr"},
    {"code": "6003", "name": "Electricity & Water Charges", "group": "Indirect Expenses", "normal_balance": "Dr"},
    {"code": "6004", "name": "Telephone & Internet Charges", "group": "Indirect Expenses", "normal_balance": "Dr"},
    {"code": "6005", "name": "Advertising & Marketing Expenses", "group": "Indirect Expenses", "normal_balance": "Dr"},
    {"code": "6006", "name": "Repairs & Maintenance", "group": "Indirect Expenses", "normal_balance": "Dr"},
    {"code": "6007", "name": "Depreciation on Fixed Assets", "group": "Indirect Expenses", "normal_balance": "Dr"},
    {"code": "6008", "name": "Insurance Premium", "group": "Indirect Expenses", "normal_balance": "Dr"},
    {"code": "6009", "name": "Printing & Stationery", "group": "Indirect Expenses", "normal_balance": "Dr"},
    {"code": "6010", "name": "Travelling & Conveyance", "group": "Indirect Expenses", "normal_balance": "Dr"},
    {"code": "6011", "name": "Postage & Courier Charges", "group": "Indirect Expenses", "normal_balance": "Dr"},
    {"code": "6012", "name": "Audit & Legal Fees", "group": "Indirect Expenses", "normal_balance": "Dr"},
    {"code": "6013", "name": "Professional & Consultation Charges", "group": "Indirect Expenses", "normal_balance": "Dr"},
    {"code": "6014", "name": "Bank Charges & Interest on Loans", "group": "Indirect Expenses", "normal_balance": "Dr"},
    {"code": "6015", "name": "Bad Debts Written Off", "group": "Indirect Expenses", "normal_balance": "Dr"},
    {"code": "6016", "name": "Discount Allowed", "group": "Indirect Expenses", "normal_balance": "Dr"},
    {"code": "6017", "name": "Staff PF / ESIC Contribution", "group": "Indirect Expenses", "normal_balance": "Dr"},
    {"code": "6018", "name": "Miscellaneous Expenses", "group": "Indirect Expenses", "normal_balance": "Dr"},
    {"code": "6019", "name": "Freight Outward / Delivery Charges", "group": "Indirect Expenses", "normal_balance": "Dr"},
    {"code": "6020", "name": "Office Expenses", "group": "Indirect Expenses", "normal_balance": "Dr"},
    {"code": "6021", "name": "Business Promotion Expenses", "group": "Indirect Expenses", "normal_balance": "Dr"},
    {"code": "6022", "name": "Loss on Sale of Fixed Assets", "group": "Indirect Expenses", "normal_balance": "Dr"},
    {"code": "6030", "name": "Income Tax / Advance Tax Paid", "group": "Tax", "normal_balance": "Dr"},
    {"code": "6031", "name": "TDS Deducted at Source", "group": "Tax", "normal_balance": "Dr"},
]


# Also expose trial balance via bookkeeping path
@router.get("/trial-balance")
async def get_trial_balance_entries(
    financial_year: str = "2024-25",
    client_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    cid = await get_client_id(current_user, db, client_id)
    result = await db.execute(
        select(JournalEntry).where(
            and_(JournalEntry.client_id == cid,
                 JournalEntry.financial_year == financial_year)
        ).order_by(JournalEntry.account_code)
    )
    entries = result.scalars().all()
    total_dr = sum(float(e.debit_amount or 0) for e in entries)
    total_cr = sum(float(e.credit_amount or 0) for e in entries)
    return {
        "financial_year": financial_year,
        "entries": [{"id": e.id, "account_code": e.account_code, "account_name": e.account_name,
                     "debit_amount": float(e.debit_amount or 0), "credit_amount": float(e.credit_amount or 0)}
                    for e in entries],
        "total_debit": total_dr,
        "total_credit": total_cr,
        "is_balanced": abs(total_dr - total_cr) < 0.01,
        "has_data": len(entries) > 0,
    }
