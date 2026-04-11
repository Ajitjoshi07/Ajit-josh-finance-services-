# ─── ITR Engine ───────────────────────────────────────────────────────────────
# app/services/tax/itr_engine.py
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func


class ITREngine:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def compute_itr(self, client_id: int, financial_year: str):
        from app.models.models import Transaction, TDSRecord
        from app.schemas.schemas import ITRSummary

        # Total sales income
        sales_result = await self.db.execute(
            select(func.coalesce(func.sum(Transaction.taxable_amount), 0)).where(
                and_(
                    Transaction.client_id == client_id,
                    Transaction.financial_year == financial_year,
                    Transaction.transaction_type == "sales",
                )
            )
        )
        gross_income = Decimal(str(sales_result.scalar() or 0))

        # Total expenses
        exp_result = await self.db.execute(
            select(func.coalesce(func.sum(Transaction.total_amount), 0)).where(
                and_(
                    Transaction.client_id == client_id,
                    Transaction.financial_year == financial_year,
                    Transaction.transaction_type.in_(["expense", "purchase"]),
                )
            )
        )
        total_expenses = Decimal(str(exp_result.scalar() or 0))

        # Standard deduction: 80C limit 1.5L, 80D, etc.
        deductions_80c = min(Decimal("150000"), gross_income * Decimal("0.1"))
        total_deductions = deductions_80c

        taxable_income = max(gross_income - total_expenses - total_deductions, Decimal("0"))

        # Tax slabs (new regime FY 2024-25)
        tax_liability = self._compute_tax_new_regime(taxable_income)

        # TDS paid
        tds_result = await self.db.execute(
            select(func.coalesce(func.sum(TDSRecord.tds_amount), 0)).where(
                and_(
                    TDSRecord.client_id == client_id,
                    TDSRecord.financial_year == financial_year,
                    TDSRecord.deposited == True,
                )
            )
        )
        tds_paid = Decimal(str(tds_result.scalar() or 0))

        net_payable = max(tax_liability - tds_paid, Decimal("0"))

        ay_parts = financial_year.split("-")
        assessment_year = f"20{ay_parts[1]}-{int(ay_parts[1])+1:02d}" if len(ay_parts) == 2 else "2025-26"

        return ITRSummary(
            financial_year=financial_year,
            assessment_year=assessment_year,
            gross_income=gross_income,
            total_deductions=total_deductions,
            taxable_income=taxable_income,
            tax_liability=tax_liability,
            tds_paid=tds_paid,
            advance_tax=Decimal("0"),
            net_tax_payable=net_payable,
            status="draft",
        )

    def _compute_tax_new_regime(self, income: Decimal) -> Decimal:
        """New tax regime slabs FY 2024-25."""
        if income <= Decimal("300000"):
            return Decimal("0")
        elif income <= Decimal("700000"):
            tax = (income - Decimal("300000")) * Decimal("0.05")
        elif income <= Decimal("1000000"):
            tax = Decimal("20000") + (income - Decimal("700000")) * Decimal("0.10")
        elif income <= Decimal("1200000"):
            tax = Decimal("50000") + (income - Decimal("1000000")) * Decimal("0.15")
        elif income <= Decimal("1500000"):
            tax = Decimal("80000") + (income - Decimal("1200000")) * Decimal("0.20")
        else:
            tax = Decimal("140000") + (income - Decimal("1500000")) * Decimal("0.30")

        # Surcharge and cess
        cess = tax * Decimal("0.04")
        return (tax + cess).quantize(Decimal("0.01"))
