"""
Manual Data Entry Routes
Allows clients to submit financial data by text/numbers
Admin reviews and approves before it updates the books
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from typing import Optional, List
from datetime import date
from decimal import Decimal
from pydantic import BaseModel

from app.db.database import get_db
from app.models.models import User, ClientProfile, Transaction, JournalEntry
from app.core.security import get_current_user, require_ca

router = APIRouter(prefix="/manual-entry", tags=["Manual Entry"])


class ManualTransaction(BaseModel):
    transaction_type: str  # sales, purchase, expense, bank, tds
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


class ManualEntryStatus(BaseModel):
    batch_id: int
    status: str  # pending, approved, rejected


async def get_client_id_for_user(current_user: User, db: AsyncSession, client_id: Optional[int]) -> int:
    if current_user.role == "client":
        result = await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == current_user.id)
        )
        p = result.scalar_one_or_none()
        if not p:
            raise HTTPException(404, "Complete your profile first before entering data")
        return p.id
    return client_id or 0


@router.post("/submit")
async def submit_manual_entries(
    batch: ManualEntryBatch,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Client submits manual data entries for CA review"""
    cid = await get_client_id_for_user(current_user, db, batch.client_id)

    from app.utils.financial_year import get_financial_year, FY_MONTHS
    from datetime import datetime as dt

    created = []
    for entry in batch.entries:
        # Determine month and year from invoice_date or current month
        if entry.invoice_date:
            month = entry.invoice_date.month
            year = entry.invoice_date.year
            fy = entry.financial_year
        else:
            month = entry.month or dt.now().month
            year = dt.now().year
            fy = entry.financial_year

        txn = Transaction(
            client_id=cid,
            document_id=None,
            transaction_type=entry.transaction_type,
            invoice_number=entry.invoice_number,
            invoice_date=entry.invoice_date,
            financial_year=fy,
            month=month,
            year=year,
            party_name=entry.party_name,
            party_gstin=entry.party_gstin,
            taxable_amount=Decimal(str(entry.taxable_amount)),
            cgst_amount=Decimal(str(entry.cgst_amount)),
            sgst_amount=Decimal(str(entry.sgst_amount)),
            igst_amount=Decimal(str(entry.igst_amount)),
            total_amount=Decimal(str(entry.total_amount)),
            tds_amount=Decimal(str(entry.tds_amount)),
            hsn_code=entry.hsn_code,
            description=entry.description,
            is_validated=False,  # Pending CA review
            validation_errors=["pending_review"],
        )
        db.add(txn)
        await db.flush()
        created.append(txn.id)

    await db.commit()

    # Notify admin
    from app.models.models import Notification
    notif = Notification(
        client_id=cid,
        title="Manual entries submitted for review",
        message=f"{len(created)} entries submitted by client. Please review and approve.",
        notification_type="manual_entry",
        is_read=False,
    )
    db.add(notif)
    await db.commit()

    return {
        "message": f"{len(created)} entries submitted for CA review",
        "transaction_ids": created,
        "status": "pending_review"
    }


@router.get("/pending")
async def get_pending_entries(
    client_id: Optional[int] = None,
    financial_year: str = "2024-25",
    current_user: User = Depends(require_ca),
    db: AsyncSession = Depends(get_db)
):
    """CA views all pending manual entries"""
    query = select(Transaction).where(
        and_(
            Transaction.financial_year == financial_year,
            Transaction.document_id == None,
            Transaction.is_validated == False,
        )
    )
    if client_id:
        query = query.where(Transaction.client_id == client_id)

    result = await db.execute(query.order_by(Transaction.created_at.desc()))
    txns = result.scalars().all()

    return [
        {
            "id": t.id,
            "client_id": t.client_id,
            "transaction_type": t.transaction_type,
            "invoice_number": t.invoice_number,
            "invoice_date": str(t.invoice_date) if t.invoice_date else None,
            "party_name": t.party_name,
            "total_amount": float(t.total_amount or 0),
            "cgst": float(t.cgst_amount or 0),
            "sgst": float(t.sgst_amount or 0),
            "igst": float(t.igst_amount or 0),
            "tds": float(t.tds_amount or 0),
            "description": t.description,
            "created_at": str(t.created_at),
        }
        for t in txns
    ]


@router.put("/approve/{txn_id}")
async def approve_entry(
    txn_id: int,
    current_user: User = Depends(require_ca),
    db: AsyncSession = Depends(get_db)
):
    """CA approves a manual entry — it then updates all modules"""
    result = await db.execute(select(Transaction).where(Transaction.id == txn_id))
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(404, "Transaction not found")

    txn.is_validated = True
    txn.validation_errors = None

    # Auto create journal entry
    _create_journal_entry(db, txn)

    await db.flush()

    # Notify client
    from app.models.models import Notification
    notif = Notification(
        client_id=txn.client_id,
        title="Entry approved",
        message=f"Your manual entry #{txn.invoice_number or txn.id} has been approved and added to your books.",
        notification_type="approval",
    )
    db.add(notif)
    await db.commit()

    return {"message": "Entry approved and books updated", "id": txn_id}


@router.put("/approve-batch")
async def approve_batch(
    txn_ids: List[int],
    current_user: User = Depends(require_ca),
    db: AsyncSession = Depends(get_db)
):
    """Approve multiple entries at once"""
    approved = 0
    for txn_id in txn_ids:
        result = await db.execute(select(Transaction).where(Transaction.id == txn_id))
        txn = result.scalar_one_or_none()
        if txn:
            txn.is_validated = True
            txn.validation_errors = None
            _create_journal_entry(db, txn)
            approved += 1
    await db.commit()
    return {"message": f"{approved} entries approved", "approved": approved}


@router.put("/reject/{txn_id}")
async def reject_entry(
    txn_id: int,
    reason: str = "Incorrect data",
    current_user: User = Depends(require_ca),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Transaction).where(Transaction.id == txn_id))
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(404, "Transaction not found")

    txn.validation_errors = [f"rejected: {reason}"]
    await db.flush()

    from app.models.models import Notification
    notif = Notification(
        client_id=txn.client_id,
        title="Entry rejected",
        message=f"Entry #{txn.invoice_number or txn.id} rejected: {reason}. Please resubmit with corrections.",
        notification_type="rejection",
    )
    db.add(notif)
    await db.commit()
    return {"message": "Entry rejected", "id": txn_id}


@router.get("/my-entries")
async def get_my_entries(
    financial_year: str = "2024-25",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Client views their submitted manual entries with status"""
    cid = await get_client_id_for_user(current_user, db, None)

    result = await db.execute(
        select(Transaction).where(
            and_(
                Transaction.client_id == cid,
                Transaction.financial_year == financial_year,
                Transaction.document_id == None,
            )
        ).order_by(Transaction.created_at.desc())
    )
    txns = result.scalars().all()

    return [
        {
            "id": t.id,
            "transaction_type": t.transaction_type,
            "invoice_number": t.invoice_number,
            "invoice_date": str(t.invoice_date) if t.invoice_date else None,
            "party_name": t.party_name,
            "total_amount": float(t.total_amount or 0),
            "description": t.description,
            "status": "approved" if t.is_validated else ("rejected" if t.validation_errors and "rejected" in str(t.validation_errors) else "pending"),
            "created_at": str(t.created_at),
        }
        for t in txns
    ]


def _create_journal_entry(db, txn: Transaction):
    """Auto-create double entry bookkeeping from a transaction"""
    from datetime import date as d
    entry_date = txn.invoice_date or d.today()

    if txn.transaction_type == "sales":
        # Debit: Accounts Receivable, Credit: Sales Revenue
        db.add(JournalEntry(
            client_id=txn.client_id, transaction_id=txn.id,
            financial_year=txn.financial_year, entry_date=entry_date,
            account_code="1010", account_name="Accounts Receivable",
            debit_amount=txn.total_amount, credit_amount=Decimal("0"),
            narration=f"Sale to {txn.party_name or 'Customer'} - {txn.invoice_number or ''}"
        ))
        db.add(JournalEntry(
            client_id=txn.client_id, transaction_id=txn.id,
            financial_year=txn.financial_year, entry_date=entry_date,
            account_code="4001", account_name="Sales Revenue",
            debit_amount=Decimal("0"), credit_amount=txn.taxable_amount or txn.total_amount,
            narration=f"Sale revenue - {txn.invoice_number or ''}"
        ))

    elif txn.transaction_type == "purchase":
        # Debit: Purchases, Credit: Accounts Payable
        db.add(JournalEntry(
            client_id=txn.client_id, transaction_id=txn.id,
            financial_year=txn.financial_year, entry_date=entry_date,
            account_code="5001", account_name="Cost of Goods Sold",
            debit_amount=txn.taxable_amount or txn.total_amount, credit_amount=Decimal("0"),
            narration=f"Purchase from {txn.party_name or 'Supplier'}"
        ))
        db.add(JournalEntry(
            client_id=txn.client_id, transaction_id=txn.id,
            financial_year=txn.financial_year, entry_date=entry_date,
            account_code="2001", account_name="Accounts Payable",
            debit_amount=Decimal("0"), credit_amount=txn.total_amount,
            narration=f"Purchase payable - {txn.invoice_number or ''}"
        ))

    elif txn.transaction_type == "expense":
        db.add(JournalEntry(
            client_id=txn.client_id, transaction_id=txn.id,
            financial_year=txn.financial_year, entry_date=entry_date,
            account_code="5010", account_name=txn.description or "Operating Expenses",
            debit_amount=txn.total_amount, credit_amount=Decimal("0"),
            narration=f"Expense: {txn.description or 'Operating'}"
        ))
        db.add(JournalEntry(
            client_id=txn.client_id, transaction_id=txn.id,
            financial_year=txn.financial_year, entry_date=entry_date,
            account_code="1002", account_name="Bank Account",
            debit_amount=Decimal("0"), credit_amount=txn.total_amount,
            narration=f"Payment for expense"
        ))
