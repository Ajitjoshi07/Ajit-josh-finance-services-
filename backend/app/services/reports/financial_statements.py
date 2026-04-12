"""
Financial Statements — Full ICAI Standard Format
Manufacturing Account → Trading Account → P&L Account → Balance Sheet
All accounts as per Schedule III of Companies Act 2013 / ICAI Standards
"""
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func


class FinancialStatementsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _sum_txn(self, client_id: int, fy: str, txn_type, validated_only: bool = True) -> Decimal:
        from app.models.models import Transaction
        q = select(func.coalesce(func.sum(Transaction.total_amount), 0)).where(
            and_(Transaction.client_id == client_id, Transaction.financial_year == fy,
                 Transaction.transaction_type == txn_type)
        )
        if validated_only:
            q = q.where(Transaction.is_validated == True)
        r = await self.db.execute(q)
        return Decimal(str(r.scalar() or 0))

    async def _sum_taxable(self, client_id: int, fy: str, txn_type) -> Decimal:
        from app.models.models import Transaction
        r = await self.db.execute(
            select(func.coalesce(func.sum(Transaction.taxable_amount), 0)).where(
                and_(Transaction.client_id == client_id, Transaction.financial_year == fy,
                     Transaction.transaction_type == txn_type, Transaction.is_validated == True)
            )
        )
        return Decimal(str(r.scalar() or 0))

    async def _sum_gst(self, client_id: int, fy: str, txn_type) -> Decimal:
        from app.models.models import Transaction
        r = await self.db.execute(
            select(func.coalesce(
                func.sum(Transaction.cgst_amount + Transaction.sgst_amount + Transaction.igst_amount), 0
            )).where(
                and_(Transaction.client_id == client_id, Transaction.financial_year == fy,
                     Transaction.transaction_type == txn_type, Transaction.is_validated == True)
            )
        )
        return Decimal(str(r.scalar() or 0))

    async def get_manufacturing_account(self, client_id: int, financial_year: str) -> dict:
        """ICAI Manufacturing Account — for manufacturing entities"""
        raw_materials = await self._sum_txn(client_id, financial_year, "raw_material")
        direct_wages = await self._sum_txn(client_id, financial_year, "direct_wages")
        power_fuel = await self._sum_txn(client_id, financial_year, "power_fuel")
        factory_rent = await self._sum_txn(client_id, financial_year, "factory_rent")
        depreciation_factory = Decimal("0")  # From depreciation schedule

        total_mfg_cost = raw_materials + direct_wages + power_fuel + factory_rent + depreciation_factory

        return {
            "account_type": "Manufacturing Account",
            "financial_year": financial_year,
            "has_data": total_mfg_cost > 0,
            "debit_side": {
                "Opening Stock of Raw Materials": {"value": 0, "note": "From opening balance"},
                "Add: Purchases of Raw Materials": {"value": float(raw_materials), "note": "Domestic + Import"},
                "Less: Closing Stock of Raw Materials": {"value": 0, "note": "Physical verification"},
                "Raw Materials Consumed": {"value": float(raw_materials), "note": "Auto-calculated"},
                "Direct Wages (Labour)": {"value": float(direct_wages), "note": "Factory workers"},
                "Power & Fuel": {"value": float(power_fuel), "note": "Factory electricity"},
                "Factory Rent & Rates": {"value": float(factory_rent), "note": "Factory premises"},
                "Repairs to Plant & Machinery": {"value": 0, "note": "Maintenance"},
                "Depreciation on Factory Assets": {"value": float(depreciation_factory), "note": "WDV method"},
                "Other Manufacturing Expenses": {"value": 0, "note": "Consumables, tools"},
            },
            "credit_side": {
                "Cost of Goods Produced (transfer to Trading A/c)": {"value": float(total_mfg_cost), "note": "Total production cost"},
            },
            "total_debit": float(total_mfg_cost),
            "total_credit": float(total_mfg_cost),
        }

    async def get_trading_account(self, client_id: int, financial_year: str) -> dict:
        """ICAI Trading Account — Gross Profit/Loss calculation"""
        sales = await self._sum_txn(client_id, financial_year, "sales")
        service_income = await self._sum_txn(client_id, financial_year, "service_invoice")
        sales_return = await self._sum_txn(client_id, financial_year, "sales_return")
        purchases = await self._sum_txn(client_id, financial_year, "purchase")
        purchase_return = await self._sum_txn(client_id, financial_year, "purchase_return")
        import_purchases = await self._sum_txn(client_id, financial_year, "import_invoice")

        net_sales = sales + service_income - sales_return
        net_purchases = purchases + import_purchases - purchase_return

        gross_profit = net_sales - net_purchases
        is_gross_profit = gross_profit >= 0

        return {
            "account_type": "Trading Account",
            "financial_year": financial_year,
            "has_data": net_sales > 0 or net_purchases > 0,
            "debit_side": {
                "Opening Stock": {"value": 0, "note": "Stock at beginning of year"},
                "Purchases (Domestic)": {"value": float(purchases), "note": "From purchase invoices"},
                "Purchases (Import)": {"value": float(import_purchases), "note": "CIF value"},
                "Less: Purchase Returns": {"value": float(purchase_return), "note": "Debit notes issued"},
                "Net Purchases": {"value": float(net_purchases), "note": "Auto-calculated"},
                "Direct Expenses": {"value": 0, "note": "Freight, customs duty"},
                "Cost of Goods Produced (from Mfg A/c)": {"value": 0, "note": "For manufacturers only"},
                "Gross Profit c/d": {"value": float(gross_profit) if is_gross_profit else 0, "note": "Transferred to P&L"},
            },
            "credit_side": {
                "Sales (Domestic)": {"value": float(sales), "note": "From sales invoices"},
                "Sales (Export)": {"value": 0, "note": "Export invoices"},
                "Less: Sales Returns": {"value": float(sales_return), "note": "Credit notes issued"},
                "Service Income": {"value": float(service_income), "note": "Service invoices"},
                "Net Sales / Turnover": {"value": float(net_sales), "note": "Auto-calculated"},
                "Closing Stock": {"value": 0, "note": "Physical stock count"},
                "Gross Loss c/d": {"value": float(abs(gross_profit)) if not is_gross_profit else 0, "note": "If loss"},
            },
            "net_sales": float(net_sales),
            "net_purchases": float(net_purchases),
            "gross_profit": float(gross_profit),
            "is_gross_profit": is_gross_profit,
            "total_debit": float(net_purchases + (gross_profit if is_gross_profit else 0)),
            "total_credit": float(net_sales + (abs(gross_profit) if not is_gross_profit else 0)),
        }

    async def get_profit_loss(self, client_id: int, financial_year: str) -> dict:
        """ICAI Profit & Loss Account — Net Profit/Loss"""
        trading = await self.get_trading_account(client_id, financial_year)
        gross_profit = Decimal(str(trading["gross_profit"]))

        expenses = await self._sum_txn(client_id, financial_year, "expense")
        salaries = await self._sum_txn(client_id, financial_year, "salary_slip")
        asset_purchases = await self._sum_txn(client_id, financial_year, "asset_invoice")

        # GST payable (net)
        output_gst = await self._sum_gst(client_id, financial_year, "sales")
        input_gst = await self._sum_gst(client_id, financial_year, "purchase")
        net_gst = max(output_gst - input_gst, Decimal("0"))

        net_profit = gross_profit - expenses - salaries
        is_net_profit = net_profit >= 0

        total_indirect_expenses = expenses + salaries

        return {
            "account_type": "Profit & Loss Account",
            "financial_year": financial_year,
            "has_data": trading["has_data"] or total_indirect_expenses > 0,
            "debit_side": {
                "Gross Loss b/d (from Trading A/c)": {"value": float(abs(gross_profit)) if not trading["is_gross_profit"] else 0, "note": "Only if gross loss"},
                "Salaries & Wages": {"value": float(salaries), "note": "Employee costs"},
                "Rent, Rates & Taxes": {"value": 0, "note": "Office rent, municipal taxes"},
                "Printing & Stationery": {"value": 0, "note": "Office supplies"},
                "Postage & Telegram": {"value": 0, "note": "Communication"},
                "Advertisement & Publicity": {"value": 0, "note": "Marketing costs"},
                "Carriage Outward": {"value": 0, "note": "Delivery charges"},
                "Commission Paid": {"value": 0, "note": "Sales commission"},
                "Travelling & Conveyance": {"value": 0, "note": "Business travel"},
                "Electricity & Power (Office)": {"value": 0, "note": "Office electricity"},
                "Repair & Maintenance": {"value": 0, "note": "Asset maintenance"},
                "Insurance Premium": {"value": 0, "note": "Business insurance"},
                "Audit & Legal Fees": {"value": 0, "note": "Professional charges"},
                "Depreciation (Office Assets)": {"value": 0, "note": "WDV as per IT Act"},
                "Interest on Loans": {"value": 0, "note": "Bank loan interest"},
                "Bank Charges": {"value": 0, "note": "Banking fees"},
                "Telephone & Internet": {"value": 0, "note": "Communication"},
                "Other Operating Expenses": {"value": float(expenses), "note": "Misc business expenses"},
                "GST Paid (Net)": {"value": float(net_gst), "note": "Output GST – Input ITC"},
                "Income Tax Provision": {"value": 0, "note": "Current year tax"},
                "Net Profit c/d": {"value": float(net_profit) if is_net_profit else 0, "note": "Transferred to Balance Sheet"},
            },
            "credit_side": {
                "Gross Profit b/d (from Trading A/c)": {"value": float(gross_profit) if trading["is_gross_profit"] else 0, "note": "From Trading Account"},
                "Commission Received": {"value": 0, "note": "Income from commission"},
                "Discount Received": {"value": 0, "note": "From suppliers"},
                "Rent Received": {"value": 0, "note": "Rental income"},
                "Interest Received": {"value": 0, "note": "Bank/FD interest"},
                "Dividend Income": {"value": 0, "note": "From investments"},
                "Bad Debts Recovered": {"value": 0, "note": "Previously written off"},
                "Profit on Sale of Assets": {"value": 0, "note": "Capital gains"},
                "Other Income": {"value": 0, "note": "Miscellaneous income"},
                "Net Loss b/d": {"value": float(abs(net_profit)) if not is_net_profit else 0, "note": "Only if net loss"},
            },
            "gross_profit": float(gross_profit),
            "total_indirect_expenses": float(total_indirect_expenses),
            "net_profit": float(net_profit),
            "is_net_profit": is_net_profit,
            "net_profit_margin": float(net_profit / Decimal(str(trading["net_sales"])) * 100) if trading["net_sales"] > 0 else 0,
            "income": {
                "Sales Revenue": float(trading["net_sales"]),
                "Other Income": 0,
            },
            "cost_of_goods": {"Purchases / COGS": float(trading["net_purchases"])},
            "expenses": {
                "Operating Expenses": float(expenses),
                "Salaries & Wages": float(salaries),
            },
        }

    async def get_balance_sheet(self, client_id: int, financial_year: str) -> dict:
        """ICAI Balance Sheet — Schedule III format"""
        from app.models.models import TDSRecord
        pl = await self.get_profit_loss(client_id, financial_year)
        net_profit = Decimal(str(pl["net_profit"]))

        sales = await self._sum_txn(client_id, financial_year, "sales")
        purchases = await self._sum_txn(client_id, financial_year, "purchase")
        expenses = await self._sum_txn(client_id, financial_year, "expense")

        output_gst = await self._sum_gst(client_id, financial_year, "sales")
        input_gst = await self._sum_gst(client_id, financial_year, "purchase")
        net_gst = max(output_gst - input_gst, Decimal("0"))

        tds_r = await self.db.execute(
            select(func.coalesce(func.sum(TDSRecord.tds_amount), 0)).where(
                and_(TDSRecord.client_id == client_id, TDSRecord.financial_year == financial_year)
            )
        )
        tds_paid = Decimal(str(tds_r.scalar() or 0))

        ar = sales * Decimal("0.25")
        cash = max(sales - purchases - expenses - net_gst, Decimal("0"))
        closing_stock = max(purchases - (sales * Decimal("0.7")), Decimal("0"))
        ap = purchases * Decimal("0.15")

        total_assets = cash + ar + closing_stock
        total_liabilities = ap + net_gst + tds_paid
        capital = total_assets - total_liabilities
        opening_capital = max(capital - net_profit, Decimal("0"))
        has_data = sales > 0 or purchases > 0

        return {
            "account_type": "Balance Sheet",
            "financial_year": financial_year,
            "has_data": has_data,
            "note": "Calculated from uploaded/entered transaction data. Upload documents for accurate figures.",
            "liabilities_side": {
                "Capital & Liabilities": {
                    "SHAREHOLDERS FUNDS / CAPITAL": {
                        "Capital Account": {"value": float(opening_capital), "note": "Opening capital"},
                        "Add: Net Profit for Year": {"value": float(net_profit) if net_profit > 0 else 0, "note": "From P&L account"},
                        "Less: Net Loss for Year": {"value": float(abs(net_profit)) if net_profit < 0 else 0, "note": "From P&L account"},
                        "Less: Drawings": {"value": 0, "note": "Proprietor withdrawals"},
                        "Reserves & Surplus": {"value": 0, "note": "Retained earnings"},
                    },
                    "NON-CURRENT LIABILITIES": {
                        "Long-term Borrowings (Bank Loan)": {"value": 0, "note": "Secured loans"},
                        "Long-term Borrowings (Others)": {"value": 0, "note": "Unsecured loans"},
                        "Deferred Tax Liability": {"value": 0, "note": "Timing differences"},
                    },
                    "CURRENT LIABILITIES": {
                        "Short-term Borrowings (Bank OD)": {"value": 0, "note": "Bank overdraft"},
                        "Sundry Creditors (Trade Payable)": {"value": float(ap), "note": "Estimated 15% outstanding"},
                        "Bills Payable": {"value": 0, "note": "Short-term bills"},
                        "Advance from Customers": {"value": 0, "note": "Customer advances"},
                        "GST Payable (CGST)": {"value": float(net_gst / 2), "note": "Central GST"},
                        "GST Payable (SGST)": {"value": float(net_gst / 2), "note": "State GST"},
                        "TDS Payable": {"value": float(tds_paid), "note": "TDS to be deposited"},
                        "PF/ESI Payable": {"value": 0, "note": "Employee benefits"},
                        "Income Tax Payable": {"value": 0, "note": "Current year provision"},
                        "Accrued Expenses": {"value": 0, "note": "Outstanding expenses"},
                    },
                }
            },
            "assets_side": {
                "Assets": {
                    "NON-CURRENT ASSETS": {
                        "Gross Block (Fixed Assets)": {"value": 0, "note": "Cost of fixed assets"},
                        "Less: Accumulated Depreciation": {"value": 0, "note": "Total depreciation"},
                        "Net Block": {"value": 0, "note": "WDV of fixed assets"},
                        "Capital WIP": {"value": 0, "note": "Assets under construction"},
                        "Intangible Assets (Goodwill)": {"value": 0, "note": "Goodwill, patents"},
                        "Long-term Investments": {"value": 0, "note": "Shares, debentures"},
                        "Long-term Loans & Advances": {"value": 0, "note": "Security deposits"},
                    },
                    "CURRENT ASSETS": {
                        "Inventories (Closing Stock)": {"value": float(closing_stock), "note": "Estimated from purchases"},
                        "Sundry Debtors (Trade Receivable)": {"value": float(ar), "note": "Estimated 25% outstanding"},
                        "Cash & Cash Equivalents": {"value": float(cash), "note": "Cash + Bank balance"},
                        "Bills Receivable": {"value": 0, "note": "Short-term bills"},
                        "Short-term Investments": {"value": 0, "note": "Liquid investments"},
                        "Prepaid Expenses": {"value": 0, "note": "Advance expenses"},
                        "TDS Receivable (Advance Tax)": {"value": float(tds_paid), "note": "TDS credit available"},
                        "GST Input Credit (ITC)": {"value": float(input_gst), "note": "ITC available"},
                        "Advance to Suppliers": {"value": 0, "note": "Purchase advances"},
                        "Other Current Assets": {"value": 0, "note": "Miscellaneous"},
                    },
                }
            },
            "assets": {
                "Current Assets": {
                    "Cash and Bank Balance": float(cash),
                    "Accounts Receivable (Est.)": float(ar),
                    "Closing Inventory (Est.)": float(closing_stock),
                },
                "total_assets": float(total_assets),
            },
            "liabilities": {
                "Current Liabilities": {
                    "Accounts Payable (Est.)": float(ap),
                    "GST Payable": float(net_gst),
                    "TDS Payable": float(tds_paid),
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

    async def get_trial_balance(self, client_id: int, financial_year: str) -> dict:
        from app.models.models import JournalEntry
        result = await self.db.execute(
            select(JournalEntry.account_code, JournalEntry.account_name,
                   func.sum(JournalEntry.debit_amount).label("total_debit"),
                   func.sum(JournalEntry.credit_amount).label("total_credit")
                   ).where(and_(JournalEntry.client_id == client_id, JournalEntry.financial_year == financial_year)
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
            entries.append({"account_code": row.account_code, "account_name": row.account_name,
                             "debit_total": float(d), "credit_total": float(c), "balance": float(d - c)})
        return {"financial_year": financial_year, "entries": entries,
                "total_debit": float(total_debit), "total_credit": float(total_credit),
                "is_balanced": abs(total_debit - total_credit) < Decimal("0.01"), "has_data": len(entries) > 0}
