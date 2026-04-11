from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func


class FinancialStatementsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_trial_balance(self, client_id: int, financial_year: str):
        from app.models.models import JournalEntry
        result = await self.db.execute(
            select(
                JournalEntry.account_code,
                JournalEntry.account_name,
                func.sum(JournalEntry.debit_amount).label("total_debit"),
                func.sum(JournalEntry.credit_amount).label("total_credit"),
            ).where(
                and_(
                    JournalEntry.client_id == client_id,
                    JournalEntry.financial_year == financial_year,
                )
            ).group_by(JournalEntry.account_code, JournalEntry.account_name)
        )
        rows = result.all()

        entries = []
        total_debit = Decimal("0")
        total_credit = Decimal("0")
        for row in rows:
            d = Decimal(str(row.total_debit or 0))
            c = Decimal(str(row.total_credit or 0))
            total_debit += d
            total_credit += c
            entries.append({
                "account_code": row.account_code,
                "account_name": row.account_name,
                "debit_total": float(d),
                "credit_total": float(c),
                "balance": float(d - c),
            })

        return {
            "financial_year": financial_year,
            "entries": entries,
            "total_debit": float(total_debit),
            "total_credit": float(total_credit),
            "is_balanced": abs(total_debit - total_credit) < Decimal("0.01"),
            "has_data": len(entries) > 0,
        }

    async def get_profit_loss(self, client_id: int, financial_year: str):
        from app.models.models import Transaction

        async def sum_validated(txn_type):
            res = await self.db.execute(
                select(func.coalesce(func.sum(Transaction.total_amount), 0)).where(
                    and_(
                        Transaction.client_id == client_id,
                        Transaction.financial_year == financial_year,
                        Transaction.transaction_type == txn_type,
                        Transaction.is_validated == True,  # Only approved data
                    )
                )
            )
            return Decimal(str(res.scalar() or 0))

        async def sum_taxable_validated(txn_type):
            res = await self.db.execute(
                select(func.coalesce(func.sum(Transaction.taxable_amount), 0)).where(
                    and_(
                        Transaction.client_id == client_id,
                        Transaction.financial_year == financial_year,
                        Transaction.transaction_type == txn_type,
                        Transaction.is_validated == True,
                    )
                )
            )
            return Decimal(str(res.scalar() or 0))

        sales = await sum_validated("sales")
        service_income = await sum_validated("service_invoice")
        other_income = await sum_validated("other_income")
        total_income = sales + service_income + other_income

        purchases = await sum_validated("purchase")
        cogs = await sum_taxable_validated("purchase")

        expenses = await sum_validated("expense")
        salaries = await sum_validated("salary_slip")
        total_expenses = expenses + salaries

        gross_profit = total_income - purchases
        net_profit = gross_profit - total_expenses

        return {
            "financial_year": financial_year,
            "has_data": total_income > 0 or purchases > 0,
            "income": {
                "Sales Revenue": float(sales),
                "Service Income": float(service_income),
                "Other Income": float(other_income),
            },
            "cost_of_goods": {
                "Purchases / COGS": float(purchases),
            },
            "gross_profit": float(gross_profit),
            "expenses": {
                "Operating Expenses": float(expenses),
                "Salaries & Wages": float(salaries),
            },
            "net_profit": float(net_profit),
            "net_profit_margin": float(net_profit / total_income * 100) if total_income > 0 else 0,
        }

    async def get_balance_sheet(self, client_id: int, financial_year: str):
        from app.models.models import Transaction, TDSRecord

        # Get actual data only
        pl = await self.get_profit_loss(client_id, financial_year)
        net_profit = Decimal(str(pl["net_profit"]))

        # Assets — from actual transactions
        sales_result = await self.db.execute(
            select(func.coalesce(func.sum(Transaction.total_amount), 0)).where(
                and_(Transaction.client_id == client_id,
                     Transaction.financial_year == financial_year,
                     Transaction.transaction_type == "sales",
                     Transaction.is_validated == True)
            )
        )
        total_sales = Decimal(str(sales_result.scalar() or 0))

        purchase_result = await self.db.execute(
            select(func.coalesce(func.sum(Transaction.total_amount), 0)).where(
                and_(Transaction.client_id == client_id,
                     Transaction.financial_year == financial_year,
                     Transaction.transaction_type == "purchase",
                     Transaction.is_validated == True)
            )
        )
        total_purchases = Decimal(str(purchase_result.scalar() or 0))

        expense_result = await self.db.execute(
            select(func.coalesce(func.sum(Transaction.total_amount), 0)).where(
                and_(Transaction.client_id == client_id,
                     Transaction.financial_year == financial_year,
                     Transaction.transaction_type == "expense",
                     Transaction.is_validated == True)
            )
        )
        total_expenses = Decimal(str(expense_result.scalar() or 0))

        # GST payable
        gst_output = await self.db.execute(
            select(
                func.coalesce(func.sum(Transaction.cgst_amount + Transaction.sgst_amount + Transaction.igst_amount), 0)
            ).where(
                and_(Transaction.client_id == client_id,
                     Transaction.financial_year == financial_year,
                     Transaction.transaction_type == "sales",
                     Transaction.is_validated == True)
            )
        )
        gst_input = await self.db.execute(
            select(
                func.coalesce(func.sum(Transaction.cgst_amount + Transaction.sgst_amount + Transaction.igst_amount), 0)
            ).where(
                and_(Transaction.client_id == client_id,
                     Transaction.financial_year == financial_year,
                     Transaction.transaction_type == "purchase",
                     Transaction.is_validated == True)
            )
        )
        net_gst = max(Decimal(str(gst_output.scalar() or 0)) - Decimal(str(gst_input.scalar() or 0)), Decimal("0"))

        # TDS paid
        tds_paid = await self.db.execute(
            select(func.coalesce(func.sum(TDSRecord.tds_amount), 0)).where(
                and_(TDSRecord.client_id == client_id,
                     TDSRecord.financial_year == financial_year)
            )
        )
        tds_amount = Decimal(str(tds_paid.scalar() or 0))

        # Calculate balance sheet components
        accounts_receivable = total_sales * Decimal("0.3")  # Estimate 30% outstanding
        cash_and_bank = total_sales - total_purchases - total_expenses - net_gst
        cash_and_bank = max(cash_and_bank, Decimal("0"))
        inventory = max(total_purchases - (total_sales * Decimal("0.7")), Decimal("0"))

        total_current_assets = cash_and_bank + accounts_receivable + inventory
        total_assets = total_current_assets  # Simplified (no fixed assets unless from documents)

        accounts_payable = total_purchases * Decimal("0.2")  # Estimate 20% outstanding
        total_liabilities = accounts_payable + net_gst + tds_amount

        capital = total_assets - total_liabilities
        opening_capital = capital - net_profit
        if opening_capital < 0:
            opening_capital = Decimal("0")

        has_data = total_sales > 0 or total_purchases > 0

        return {
            "financial_year": financial_year,
            "has_data": has_data,
            "note": "Balance sheet calculated from uploaded/entered transaction data only." if has_data else "No data available. Upload documents or enter data manually.",
            "assets": {
                "Current Assets": {
                    "Cash and Bank Balance": float(cash_and_bank),
                    "Accounts Receivable (Est.)": float(accounts_receivable),
                    "Closing Inventory (Est.)": float(inventory),
                },
                "total_assets": float(total_assets),
            },
            "liabilities": {
                "Current Liabilities": {
                    "Accounts Payable (Est.)": float(accounts_payable),
                    "GST Payable": float(net_gst),
                    "TDS Payable": float(tds_amount),
                },
                "total_liabilities": float(total_liabilities),
            },
            "capital": {
                "Opening Capital": float(opening_capital),
                "Add: Net Profit for Year": float(net_profit),
                "total_capital": float(capital),
            },
            "total_liabilities_capital": float(total_liabilities + capital),
            "is_balanced": abs(total_assets - (total_liabilities + capital)) < Decimal("1"),
        }
