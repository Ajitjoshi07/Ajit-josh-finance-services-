"""
Export Routes — Excel downloads with token-based auth
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from typing import Optional
import io
from decimal import Decimal
from datetime import datetime

from app.db.database import get_db
from app.models.models import (
    User, ClientProfile, Transaction, Document,
    TDSRecord, JournalEntry
)
from app.core.security import get_current_user

router = APIRouter(prefix="/export", tags=["Export"])


async def get_user_from_token(token: Optional[str], db: AsyncSession) -> User:
    """Authenticate via query param token"""
    if not token:
        raise HTTPException(401, "Not authenticated — include token parameter")
    try:
        from app.core.security import decode_token
        payload = decode_token(token)
        user_id = payload.get("sub")
        result = await db.execute(select(User).where(User.id == int(user_id)))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(401, "Invalid token")


async def resolve_profile(current_user: User, db: AsyncSession, client_id: Optional[int]) -> ClientProfile:
    if current_user.role == "client":
        result = await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == current_user.id)
        )
    else:
        if not client_id:
            raise HTTPException(400, "client_id required")
        result = await db.execute(
            select(ClientProfile).where(ClientProfile.id == client_id)
        )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Client profile not found")
    return p


def make_workbook():
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment
        return openpyxl, Font, PatternFill, Alignment
    except ImportError:
        raise HTTPException(500, "openpyxl not available")


def style_header(ws, row, headers, openpyxl, Font, PatternFill):
    fill = PatternFill(start_color="1E3A5F", end_color="1E3A5F", fill_type="solid")
    font = Font(color="FFFFFF", bold=True)
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=row, column=col, value=h)
        cell.font = font
        cell.fill = fill


@router.get("/excel/transactions")
async def export_transactions(
    financial_year: str = "2024-25",
    client_id: Optional[int] = None,
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    current_user = await get_user_from_token(token, db)
    profile = await resolve_profile(current_user, db, client_id)
    openpyxl, Font, PatternFill, Alignment = make_workbook()

    result = await db.execute(
        select(Transaction).where(
            and_(Transaction.client_id == profile.id,
                 Transaction.financial_year == financial_year)
        ).order_by(Transaction.invoice_date)
    )
    txns = result.scalars().all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Transaction Register"
    ws.merge_cells("A1:N1")
    ws["A1"] = f"Transaction Register — {profile.business_name} — FY {financial_year}"
    ws["A1"].font = Font(bold=True, size=13)
    ws["A2"] = f"PAN: {profile.pan or '—'} | GSTIN: {profile.gstin or 'Not Registered'}"

    headers = ["#", "Type", "Invoice No", "Date", "Party Name", "GSTIN",
               "Taxable Amt", "CGST", "SGST", "IGST", "Total Amt", "TDS", "Month", "Validated"]
    style_header(ws, 4, headers, openpyxl, Font, PatternFill)

    for i, t in enumerate(txns, 1):
        ws.append([
            i, t.transaction_type, t.invoice_number or "",
            str(t.invoice_date) if t.invoice_date else "",
            t.party_name or "", t.party_gstin or "",
            float(t.taxable_amount or 0), float(t.cgst_amount or 0),
            float(t.sgst_amount or 0), float(t.igst_amount or 0),
            float(t.total_amount or 0), float(t.tds_amount or 0),
            t.month or "", "Yes" if t.is_validated else "Pending"
        ])

    # Total row
    if txns:
        ws.append(["", "TOTAL", "", "", "", "",
                   sum(float(t.taxable_amount or 0) for t in txns),
                   sum(float(t.cgst_amount or 0) for t in txns),
                   sum(float(t.sgst_amount or 0) for t in txns),
                   sum(float(t.igst_amount or 0) for t in txns),
                   sum(float(t.total_amount or 0) for t in txns),
                   sum(float(t.tds_amount or 0) for t in txns), "", ""])
        for c in range(1, 15):
            ws.cell(ws.max_row, c).font = Font(bold=True)

    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = min(
            max(len(str(cell.value or "")) for cell in col) + 4, 30
        )

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    fname = f"{profile.business_name}_{financial_year}_Transactions.xlsx"
    return StreamingResponse(buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.get("/excel/gst")
async def export_gst(
    financial_year: str = "2024-25",
    client_id: Optional[int] = None,
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    current_user = await get_user_from_token(token, db)
    profile = await resolve_profile(current_user, db, client_id)
    openpyxl, Font, PatternFill, Alignment = make_workbook()

    from app.services.tax.gst_engine import GSTEngine
    engine = GSTEngine(db)
    summary = await engine.get_monthly_summary(profile.id, financial_year)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "GST Summary"
    ws.merge_cells("A1:H1")
    ws["A1"] = f"GST Summary — {profile.business_name} — FY {financial_year}"
    ws["A1"].font = Font(bold=True, size=13)
    ws["A2"] = f"GSTIN: {profile.gstin or 'Not Registered'}"

    headers = ["Month", "Year", "Total Sales (₹)", "Total Purchases (₹)",
               "Output GST (₹)", "Input ITC (₹)", "Net GST Payable (₹)", "Status"]
    style_header(ws, 4, headers, openpyxl, Font, PatternFill)

    total_payable = 0
    for m in summary:
        net = float(m["net_gst_payable"])
        total_payable += net
        ws.append([
            m.get("month_name", m["month"]), m["year"],
            float(m["total_sales"]), float(m["total_purchases"]),
            float(m["output_gst"]), float(m["input_gst"]),
            net, m["filing_status"].upper()
        ])

    ws.append(["ANNUAL TOTAL", "", "", "", "", "", total_payable, ""])
    for c in range(1, 9):
        ws.cell(ws.max_row, c).font = Font(bold=True)

    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = 20

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    fname = f"{profile.business_name}_{financial_year}_GST_Summary.xlsx"
    return StreamingResponse(buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.get("/excel/tds")
async def export_tds(
    financial_year: str = "2024-25",
    client_id: Optional[int] = None,
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    current_user = await get_user_from_token(token, db)
    profile = await resolve_profile(current_user, db, client_id)
    openpyxl, Font, PatternFill, Alignment = make_workbook()

    result = await db.execute(
        select(TDSRecord).where(
            and_(TDSRecord.client_id == profile.id, TDSRecord.financial_year == financial_year)
        ).order_by(TDSRecord.quarter)
    )
    records = result.scalars().all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "TDS Records"
    ws["A1"] = f"TDS Records — {profile.business_name} — FY {financial_year}"
    ws["A1"].font = Font(bold=True, size=13)

    headers = ["Quarter", "Section", "Deductee Name", "Deductee PAN",
               "Payment Date", "Payment Amt (₹)", "TDS Rate %", "TDS Amount (₹)", "Deposited", "Challan No"]
    style_header(ws, 3, headers, openpyxl, Font, PatternFill)

    for r in records:
        ws.append([
            f"Q{r.quarter}", r.section or "", r.deductee_name or "", r.deductee_pan or "",
            str(r.payment_date) if r.payment_date else "",
            float(r.payment_amount or 0), r.tds_rate or 0,
            float(r.tds_amount or 0), "Yes" if r.deposited else "No",
            r.challan_number or ""
        ])

    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = 20

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    fname = f"{profile.business_name}_{financial_year}_TDS.xlsx"
    return StreamingResponse(buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.get("/excel/complete")
async def export_complete(
    financial_year: str = "2024-25",
    client_id: Optional[int] = None,
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Complete CA file — all data in one multi-sheet Excel"""
    current_user = await get_user_from_token(token, db)
    profile = await resolve_profile(current_user, db, client_id)
    openpyxl, Font, PatternFill, Alignment = make_workbook()

    wb = openpyxl.Workbook()
    title_font = Font(bold=True, size=13)

    def add_headers(ws, row, headers):
        fill = PatternFill(start_color="1E3A5F", end_color="1E3A5F", fill_type="solid")
        font = Font(color="FFFFFF", bold=True)
        for col, h in enumerate(headers, 1):
            cell = ws.cell(row=row, column=col, value=h)
            cell.font = font
            cell.fill = fill

    def auto_width(ws):
        for col in ws.columns:
            ws.column_dimensions[col[0].column_letter].width = min(
                max(len(str(cell.value or "")) for cell in col) + 4, 35
            )

    # Sheet 1: Cover
    ws_cover = wb.active
    ws_cover.title = "Cover Page"
    ws_cover["A1"] = "CLIENT FINANCIAL FILE"
    ws_cover["A1"].font = Font(bold=True, size=18)
    info = [
        ("Firm Name", "Ajit Joshi Finance Services"),
        ("", ""),
        ("Client Business Name", profile.business_name or "—"),
        ("PAN", profile.pan or "—"),
        ("GSTIN", profile.gstin or "Not Registered"),
        ("Business Type", profile.business_type or "—"),
        ("State", profile.state or "—"),
        ("Financial Year", financial_year),
        ("Assessment Year", f"20{financial_year.split('-')[1]}-{int(financial_year.split('-')[1])+1:02d}"),
        ("", ""),
        ("Prepared On", datetime.now().strftime("%d-%m-%Y")),
        ("Prepared By", "Ajit Joshi Finance Services"),
    ]
    for i, (k, v) in enumerate(info, 3):
        ws_cover[f"A{i}"] = k
        ws_cover[f"A{i}"].font = Font(bold=True)
        ws_cover[f"B{i}"] = v
    ws_cover.column_dimensions["A"].width = 25
    ws_cover.column_dimensions["B"].width = 40

    # Sheet 2: All Transactions
    txn_result = await db.execute(
        select(Transaction).where(
            and_(Transaction.client_id == profile.id,
                 Transaction.financial_year == financial_year)
        ).order_by(Transaction.invoice_date)
    )
    txns = txn_result.scalars().all()

    ws_txn = wb.create_sheet("All Transactions")
    ws_txn["A1"] = f"Transaction Register — FY {financial_year}"
    ws_txn["A1"].font = title_font
    headers_txn = ["#", "Type", "Invoice No", "Date", "Party", "GSTIN",
                   "Taxable", "CGST", "SGST", "IGST", "Total", "TDS", "Month", "Status"]
    add_headers(ws_txn, 3, headers_txn)
    for i, t in enumerate(txns, 1):
        ws_txn.append([
            i, t.transaction_type, t.invoice_number or "",
            str(t.invoice_date or ""), t.party_name or "", t.party_gstin or "",
            float(t.taxable_amount or 0), float(t.cgst_amount or 0),
            float(t.sgst_amount or 0), float(t.igst_amount or 0),
            float(t.total_amount or 0), float(t.tds_amount or 0),
            t.month or "", "Approved" if t.is_validated else "Pending"
        ])
    auto_width(ws_txn)

    # Sheet 3: Sales Register
    ws_sales = wb.create_sheet("Sales Register")
    ws_sales["A1"] = f"Sales Register — FY {financial_year}"
    ws_sales["A1"].font = title_font
    add_headers(ws_sales, 3, ["#", "Invoice No", "Date", "Customer", "GSTIN", "Taxable", "CGST", "SGST", "IGST", "Total"])
    sales_txns = [t for t in txns if t.transaction_type in ("sales", "service_invoice", "export_invoice")]
    for i, t in enumerate(sales_txns, 1):
        ws_sales.append([i, t.invoice_number or "", str(t.invoice_date or ""), t.party_name or "",
                         t.party_gstin or "", float(t.taxable_amount or 0),
                         float(t.cgst_amount or 0), float(t.sgst_amount or 0),
                         float(t.igst_amount or 0), float(t.total_amount or 0)])
    if sales_txns:
        ws_sales.append(["", "TOTAL", "", "", "",
                         sum(float(t.taxable_amount or 0) for t in sales_txns), "", "", "",
                         sum(float(t.total_amount or 0) for t in sales_txns)])
    auto_width(ws_sales)

    # Sheet 4: Purchase Register
    ws_purch = wb.create_sheet("Purchase Register")
    ws_purch["A1"] = f"Purchase Register — FY {financial_year}"
    ws_purch["A1"].font = title_font
    add_headers(ws_purch, 3, ["#", "Invoice No", "Date", "Supplier", "GSTIN", "Taxable", "CGST", "SGST", "IGST", "Total"])
    purch_txns = [t for t in txns if t.transaction_type in ("purchase", "import_invoice")]
    for i, t in enumerate(purch_txns, 1):
        ws_purch.append([i, t.invoice_number or "", str(t.invoice_date or ""), t.party_name or "",
                         t.party_gstin or "", float(t.taxable_amount or 0),
                         float(t.cgst_amount or 0), float(t.sgst_amount or 0),
                         float(t.igst_amount or 0), float(t.total_amount or 0)])
    auto_width(ws_purch)

    # Sheet 5: GST Summary
    from app.services.tax.gst_engine import GSTEngine
    gst_engine = GSTEngine(db)
    gst_summary = await gst_engine.get_monthly_summary(profile.id, financial_year)
    ws_gst = wb.create_sheet("GST Summary")
    ws_gst["A1"] = f"GST Summary — GSTIN: {profile.gstin or 'Not Registered'} — FY {financial_year}"
    ws_gst["A1"].font = title_font
    add_headers(ws_gst, 3, ["Month", "Year", "Sales", "Purchases", "Output GST", "Input ITC", "Net Payable", "Status"])
    for m in gst_summary:
        ws_gst.append([m.get("month_name", m["month"]), m["year"],
                       float(m["total_sales"]), float(m["total_purchases"]),
                       float(m["output_gst"]), float(m["input_gst"]),
                       float(m["net_gst_payable"]), m["filing_status"].upper()])
    auto_width(ws_gst)

    # Sheet 6: TDS
    tds_result = await db.execute(
        select(TDSRecord).where(
            and_(TDSRecord.client_id == profile.id, TDSRecord.financial_year == financial_year)
        )
    )
    tds_records = tds_result.scalars().all()
    ws_tds = wb.create_sheet("TDS Records")
    ws_tds["A1"] = f"TDS Records — FY {financial_year}"
    ws_tds["A1"].font = title_font
    add_headers(ws_tds, 3, ["Quarter", "Section", "Deductee", "PAN", "Date", "Payment", "Rate%", "TDS Amt", "Deposited"])
    for r in tds_records:
        ws_tds.append([f"Q{r.quarter}", r.section or "", r.deductee_name or "", r.deductee_pan or "",
                       str(r.payment_date or ""), float(r.payment_amount or 0),
                       r.tds_rate or 0, float(r.tds_amount or 0), "Yes" if r.deposited else "No"])
    auto_width(ws_tds)

    # Sheet 7: P&L
    from app.services.reports.financial_statements import FinancialStatementsService
    svc = FinancialStatementsService(db)
    pl = await svc.get_profit_loss(profile.id, financial_year)
    ws_pl = wb.create_sheet("Profit & Loss")
    ws_pl["A1"] = f"Trading & P&L Account — {profile.business_name} — FY {financial_year}"
    ws_pl["A1"].font = title_font
    row = 3
    for section, items in [("INCOME", pl.get("income", {})),
                            ("COST OF GOODS SOLD", pl.get("cost_of_goods", {})),
                            ("EXPENSES", pl.get("expenses", {}))]:
        ws_pl.cell(row, 1).value = section
        ws_pl.cell(row, 1).font = Font(bold=True, size=11)
        row += 1
        for k, v in items.items():
            ws_pl.cell(row, 2).value = k
            ws_pl.cell(row, 3).value = float(v or 0)
            row += 1
        row += 1
    ws_pl.cell(row, 1).value = "Gross Profit"
    ws_pl.cell(row, 3).value = float(pl.get("gross_profit", 0))
    ws_pl.cell(row, 1).font = Font(bold=True)
    row += 2
    ws_pl.cell(row, 1).value = "NET PROFIT / (LOSS)"
    ws_pl.cell(row, 3).value = float(pl.get("net_profit", 0))
    ws_pl.cell(row, 1).font = Font(bold=True, size=12)
    ws_pl.cell(row, 3).font = Font(bold=True, size=12)
    ws_pl.column_dimensions["A"].width = 5
    ws_pl.column_dimensions["B"].width = 35
    ws_pl.column_dimensions["C"].width = 20

    # Sheet 8: Balance Sheet
    bs = await svc.get_balance_sheet(profile.id, financial_year)
    ws_bs = wb.create_sheet("Balance Sheet")
    ws_bs["A1"] = f"Balance Sheet — {profile.business_name} — As at 31st March"
    ws_bs["A1"].font = title_font
    ws_bs["A3"] = "ASSETS"
    ws_bs["A3"].font = Font(bold=True)
    ws_bs["D3"] = "LIABILITIES & CAPITAL"
    ws_bs["D3"].font = Font(bold=True)
    a_row = 4
    for group, items in bs.get("assets", {}).items():
        if group == "total_assets":
            continue
        ws_bs.cell(a_row, 1).value = group
        ws_bs.cell(a_row, 1).font = Font(bold=True)
        a_row += 1
        if isinstance(items, dict):
            for k, v in items.items():
                ws_bs.cell(a_row, 2).value = k
                ws_bs.cell(a_row, 3).value = float(v or 0)
                a_row += 1
    ws_bs.cell(a_row + 1, 1).value = "TOTAL ASSETS"
    ws_bs.cell(a_row + 1, 3).value = float(bs.get("assets", {}).get("total_assets", 0))
    ws_bs.cell(a_row + 1, 1).font = Font(bold=True)

    # Sheet 9: ITR Summary
    from app.services.tax.itr_engine import ITREngine
    itr_engine = ITREngine(db)
    itr = await itr_engine.compute_itr(profile.id, financial_year)
    ws_itr = wb.create_sheet("ITR Summary")
    ws_itr["A1"] = f"ITR Summary — AY {itr.assessment_year} — {profile.business_name}"
    ws_itr["A1"].font = title_font
    itr_data = [
        ("PAN", profile.pan or "—"),
        ("Assessment Year", itr.assessment_year),
        ("ITR Type", "ITR-4 (Presumptive)"),
        ("", ""),
        ("Gross Income", f"₹ {float(itr.gross_income):,.2f}"),
        ("Less: Total Deductions", f"₹ {float(itr.total_deductions):,.2f}"),
        ("Net Taxable Income", f"₹ {float(itr.taxable_income):,.2f}"),
        ("Tax Liability (+ 4% Cess)", f"₹ {float(itr.tax_liability):,.2f}"),
        ("Less: TDS Paid", f"₹ {float(itr.tds_paid):,.2f}"),
        ("Net Tax Payable / (Refund)", f"₹ {float(itr.net_tax_payable):,.2f}"),
    ]
    for i, (k, v) in enumerate(itr_data, 3):
        ws_itr.cell(i, 1).value = k
        ws_itr.cell(i, 2).value = v
        if k and k != "":
            ws_itr.cell(i, 1).font = Font(bold=True)
    ws_itr.column_dimensions["A"].width = 30
    ws_itr.column_dimensions["B"].width = 25

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    fname = f"{profile.business_name}_{financial_year}_Complete_CA_File.xlsx"
    return StreamingResponse(buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.get("/ca-file-summary")
async def ca_file_summary(
    financial_year: str = "2024-25",
    client_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    profile = await resolve_profile(current_user, db, client_id)

    txn_count = await db.execute(
        select(func.count(Transaction.id)).where(
            and_(Transaction.client_id == profile.id, Transaction.financial_year == financial_year)
        )
    )
    doc_count = await db.execute(
        select(func.count(Document.id)).where(
            and_(Document.client_id == profile.id, Document.financial_year == financial_year)
        )
    )
    sales_sum = await db.execute(
        select(func.coalesce(func.sum(Transaction.total_amount), 0)).where(
            and_(Transaction.client_id == profile.id, Transaction.financial_year == financial_year,
                 Transaction.transaction_type == "sales", Transaction.is_validated == True)
        )
    )
    purch_sum = await db.execute(
        select(func.coalesce(func.sum(Transaction.total_amount), 0)).where(
            and_(Transaction.client_id == profile.id, Transaction.financial_year == financial_year,
                 Transaction.transaction_type == "purchase", Transaction.is_validated == True)
        )
    )

    from app.services.tax.gst_engine import GSTEngine
    gst_engine = GSTEngine(db)
    gst_summary = await gst_engine.get_monthly_summary(profile.id, financial_year)
    total_gst = sum(float(m["net_gst_payable"]) for m in gst_summary)

    from app.services.tax.itr_engine import ITREngine
    itr_engine = ITREngine(db)
    itr = await itr_engine.compute_itr(profile.id, financial_year)

    return {
        "client": {"name": profile.business_name, "pan": profile.pan, "gstin": profile.gstin, "fy": financial_year},
        "data_summary": {
            "total_transactions": txn_count.scalar(),
            "total_documents": doc_count.scalar(),
            "total_sales": float(sales_sum.scalar() or 0),
            "total_purchases": float(purch_sum.scalar() or 0),
        },
        "gst": {"total_payable": total_gst, "months_filed": sum(1 for m in gst_summary if m["filing_status"] == "filed")},
        "itr": {
            "gross_income": float(itr.gross_income),
            "taxable_income": float(itr.taxable_income),
            "tax_liability": float(itr.tax_liability),
            "net_payable": float(itr.net_tax_payable),
        },
    }
