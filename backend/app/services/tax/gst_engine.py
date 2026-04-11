from decimal import Decimal
from typing import List, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func


class GSTEngine:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_monthly_summary(self, client_id: int, financial_year: str) -> List[Dict]:
        from app.models.models import Transaction
        from app.utils.financial_year import FY_MONTHS

        results = []
        for month_num, month_name in FY_MONTHS:
            year_part = int("20" + financial_year.split("-")[0][2:])
            year = year_part if month_num >= 4 else year_part + 1

            sales = await self.db.execute(
                select(
                    func.coalesce(func.sum(Transaction.taxable_amount), 0).label("taxable"),
                    func.coalesce(func.sum(Transaction.cgst_amount), 0).label("cgst"),
                    func.coalesce(func.sum(Transaction.sgst_amount), 0).label("sgst"),
                    func.coalesce(func.sum(Transaction.igst_amount), 0).label("igst"),
                    func.coalesce(func.sum(Transaction.total_amount), 0).label("total"),
                ).where(
                    and_(
                        Transaction.client_id == client_id,
                        Transaction.financial_year == financial_year,
                        Transaction.month == month_num,
                        Transaction.transaction_type == "sales",
                    )
                )
            )
            sales_row = sales.one()

            purchases = await self.db.execute(
                select(
                    func.coalesce(func.sum(Transaction.taxable_amount), 0).label("taxable"),
                    func.coalesce(func.sum(Transaction.cgst_amount), 0).label("cgst"),
                    func.coalesce(func.sum(Transaction.sgst_amount), 0).label("sgst"),
                    func.coalesce(func.sum(Transaction.igst_amount), 0).label("igst"),
                    func.coalesce(func.sum(Transaction.total_amount), 0).label("total"),
                ).where(
                    and_(
                        Transaction.client_id == client_id,
                        Transaction.financial_year == financial_year,
                        Transaction.month == month_num,
                        Transaction.transaction_type == "purchase",
                    )
                )
            )
            purch_row = purchases.one()

            output_gst = Decimal(str(sales_row.cgst or 0)) + Decimal(str(sales_row.sgst or 0)) + Decimal(str(sales_row.igst or 0))
            input_gst = Decimal(str(purch_row.cgst or 0)) + Decimal(str(purch_row.sgst or 0)) + Decimal(str(purch_row.igst or 0))
            net_payable = max(output_gst - input_gst, Decimal("0"))

            from app.models.models import GSTFiling
            filing_result = await self.db.execute(
                select(GSTFiling).where(
                    and_(
                        GSTFiling.client_id == client_id,
                        GSTFiling.financial_year == financial_year,
                        GSTFiling.month == month_num,
                    )
                )
            )
            filing = filing_result.scalar_one_or_none()

            results.append({
                "month": month_num,
                "month_name": month_name,
                "year": year,
                "financial_year": financial_year,
                "total_sales": Decimal(str(sales_row.total or 0)),
                "total_purchases": Decimal(str(purch_row.total or 0)),
                "output_gst": output_gst,
                "input_gst": input_gst,
                "net_gst_payable": net_payable,
                "filing_status": filing.filing_status if filing else "pending",
            })

        return results

    async def generate_gstr1(self, client_id: int, financial_year: str, month: int) -> Dict:
        from app.models.models import Transaction
        result = await self.db.execute(
            select(Transaction).where(
                and_(
                    Transaction.client_id == client_id,
                    Transaction.financial_year == financial_year,
                    Transaction.month == month,
                    Transaction.transaction_type == "sales",
                )
            )
        )
        transactions = result.scalars().all()

        b2b = []
        b2c = []
        total_taxable = Decimal("0")
        total_tax = Decimal("0")

        for txn in transactions:
            tax = (txn.cgst_amount or 0) + (txn.sgst_amount or 0) + (txn.igst_amount or 0)
            total_taxable += txn.taxable_amount or Decimal("0")
            total_tax += Decimal(str(tax))

            entry = {
                "invoice_number": txn.invoice_number,
                "invoice_date": str(txn.invoice_date) if txn.invoice_date else None,
                "party_gstin": txn.party_gstin,
                "taxable_amount": float(txn.taxable_amount or 0),
                "cgst": float(txn.cgst_amount or 0),
                "sgst": float(txn.sgst_amount or 0),
                "igst": float(txn.igst_amount or 0),
                "total": float(txn.total_amount or 0),
            }
            if txn.party_gstin:
                b2b.append(entry)
            else:
                b2c.append(entry)

        return {
            "financial_year": financial_year,
            "month": month,
            "b2b_invoices": b2b,
            "b2c_invoices": b2c,
            "total_taxable": total_taxable,
            "total_tax": total_tax,
        }

    async def generate_gstr3b(self, client_id: int, financial_year: str, month: int) -> Dict:
        from app.models.models import Transaction

        async def aggregate(txn_type: str):
            res = await self.db.execute(
                select(
                    func.coalesce(func.sum(Transaction.taxable_amount), 0).label("taxable"),
                    func.coalesce(func.sum(Transaction.cgst_amount), 0).label("cgst"),
                    func.coalesce(func.sum(Transaction.sgst_amount), 0).label("sgst"),
                    func.coalesce(func.sum(Transaction.igst_amount), 0).label("igst"),
                ).where(
                    and_(
                        Transaction.client_id == client_id,
                        Transaction.financial_year == financial_year,
                        Transaction.month == month,
                        Transaction.transaction_type == txn_type,
                    )
                )
            )
            row = res.one()
            return {
                "taxable": float(row.taxable or 0),
                "cgst": float(row.cgst or 0),
                "sgst": float(row.sgst or 0),
                "igst": float(row.igst or 0),
            }

        outward = await aggregate("sales")
        inward = await aggregate("purchase")

        output_gst = Decimal(str(outward["cgst"])) + Decimal(str(outward["sgst"])) + Decimal(str(outward["igst"]))
        input_gst = Decimal(str(inward["cgst"])) + Decimal(str(inward["sgst"])) + Decimal(str(inward["igst"]))
        net = max(output_gst - input_gst, Decimal("0"))

        return {
            "financial_year": financial_year,
            "month": month,
            "outward_supplies": outward,
            "inward_supplies": inward,
            "net_tax_payable": net,
            "interest": Decimal("0"),
        }
