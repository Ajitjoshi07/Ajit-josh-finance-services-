"""
OCR Document Processing Pipeline
Extracts data from uploaded documents and creates transactions automatically.
Works with both real OCR (Tesseract) and demo/sample files.
"""
import os
import re
import json
from datetime import datetime, date
from typing import Dict, Optional, Any, Tuple
from decimal import Decimal
from loguru import logger


def extract_text_from_file(file_path: str, mime_type: str = "") -> str:
    """Extract text from PDF, image, or Excel file"""
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        return extract_text_from_pdf(file_path)
    elif ext in [".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp"]:
        return extract_text_from_image(file_path)
    elif ext in [".xlsx", ".xls"]:
        return extract_text_from_excel(file_path)
    elif ext == ".csv":
        return extract_text_from_csv(file_path)
    else:
        return extract_text_from_pdf(file_path)


def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract text from PDF"""
    # Try pdfplumber first (best quality)
    try:
        import pdfplumber
        text_parts = []
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    text_parts.append(t)
        if text_parts:
            return "\n".join(text_parts)
    except Exception:
        pass

    # Try PyPDF2
    try:
        import PyPDF2
        text_parts = []
        with open(pdf_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    text_parts.append(t)
        if text_parts:
            return "\n".join(text_parts)
    except Exception:
        pass

    # Fallback: read as binary and find text
    try:
        with open(pdf_path, 'rb') as f:
            content = f.read()
        # Extract readable ASCII text
        text = content.decode('latin-1', errors='ignore')
        # Find text between PDF stream markers
        readable = re.findall(r'[A-Za-z0-9₹\s,./:@#\-()]{10,}', text)
        return " ".join(readable[:500])
    except Exception:
        return ""


def extract_text_from_image(image_path: str) -> str:
    """Extract text from image using Tesseract OCR"""
    try:
        import pytesseract
        from PIL import Image
        import cv2
        import numpy as np

        # Try OpenCV preprocessing
        img = cv2.imread(image_path)
        if img is not None:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            denoised = cv2.fastNlMeansDenoising(gray, h=10)
            _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            pil_img = Image.fromarray(thresh)
        else:
            pil_img = Image.open(image_path)

        text = pytesseract.image_to_string(pil_img, lang="eng", config="--oem 3 --psm 6")
        return text.strip()
    except Exception:
        pass

    try:
        import pytesseract
        from PIL import Image
        text = pytesseract.image_to_string(Image.open(image_path))
        return text.strip()
    except Exception:
        return ""


def extract_text_from_excel(excel_path: str) -> str:
    """Extract text from Excel/CSV file"""
    try:
        import pandas as pd
        df = pd.read_excel(excel_path)
        return df.to_string(index=False)
    except Exception:
        pass
    return ""


def extract_text_from_csv(csv_path: str) -> str:
    try:
        import pandas as pd
        df = pd.read_csv(csv_path)
        return df.to_string(index=False)
    except Exception:
        pass
    return ""


def parse_amount(s: str) -> Optional[float]:
    """Parse Indian number format like 1,23,456.78"""
    if not s:
        return None
    # Remove currency symbols and spaces
    s = re.sub(r'[₹Rs\.\s,]', '', str(s))
    s = s.replace(',', '')
    try:
        val = float(s)
        return val if val > 0 else None
    except Exception:
        return None


def parse_date_string(date_str: str) -> Optional[date]:
    """Parse various date formats"""
    if not date_str:
        return None
    formats = [
        "%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%d/%m/%y", "%d-%m-%y",
        "%d %b %Y", "%d %B %Y", "%B %d, %Y", "%b %d, %Y",
        "%d.%m.%Y", "%m/%d/%Y",
    ]
    clean = str(date_str).strip()
    for fmt in formats:
        try:
            return datetime.strptime(clean, fmt).date()
        except ValueError:
            continue

    # Try to extract date with regex
    m = re.search(r'(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2,4})', clean)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if y < 100:
            y += 2000
        try:
            if mo > 12:
                d, mo = mo, d
            return date(y, mo, d)
        except Exception:
            pass
    return None


def parse_invoice_fields(raw_text: str, document_type: str) -> Dict[str, Any]:
    """Extract key financial fields from raw text"""
    fields: Dict[str, Any] = {
        "invoice_number": None,
        "invoice_date": None,
        "gstin": None,
        "party_name": None,
        "taxable_amount": None,
        "cgst": None,
        "sgst": None,
        "igst": None,
        "total_amount": None,
        "hsn_code": None,
        "pan": None,
        "tds_amount": None,
        "tds_rate": None,
    }

    text = raw_text or ""
    text_lower = text.lower()

    # Invoice Number
    inv_patterns = [
        r'(?:invoice|bill|inv|receipt|voucher|challan)[\s#:no.]*([A-Z0-9\-/]{3,20})',
        r'\b(INV[-/]\d+)\b',
        r'\b(BILL[-/]\d+)\b',
        r'(?:invoice\s+no|bill\s+no|receipt\s+no)[\s:]+([A-Z0-9\-/]+)',
    ]
    for p in inv_patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            fields["invoice_number"] = m.group(1).strip()
            break

    # Date
    date_patterns = [
        r'(?:date|dt|invoice date|bill date)[:\s]+(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})',
        r'(\d{2}[/\-]\d{2}[/\-]\d{4})',
        r'(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})',
    ]
    for p in date_patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            parsed_date = parse_date_string(m.group(1))
            if parsed_date:
                fields["invoice_date"] = str(parsed_date)
                break

    # GSTIN (15-char alphanumeric)
    gstin_match = re.search(
        r'\b(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b', text, re.IGNORECASE
    )
    if gstin_match:
        fields["gstin"] = gstin_match.group(1).upper()

    # PAN
    pan_match = re.search(r'\b([A-Z]{5}\d{4}[A-Z])\b', text)
    if pan_match:
        fields["pan"] = pan_match.group(1)

    # Amounts — try multiple patterns
    amount_patterns = {
        "taxable_amount": [
            r'(?:taxable\s*(?:value|amount|amt)|basic\s*(?:amount|amt)|sub.?total)[:\s₹Rs.]*(\d[\d,]*\.?\d*)',
            r'(?:amount\s*before\s*tax|net\s*amount)[:\s₹Rs.]*(\d[\d,]*\.?\d*)',
        ],
        "cgst": [
            r'(?:cgst|c\.?g\.?s\.?t\.?)[\s@\d%.₹Rs:-]*?(\d[\d,]*\.?\d*)',
        ],
        "sgst": [
            r'(?:sgst|s\.?g\.?s\.?t\.?)[\s@\d%.₹Rs:-]*?(\d[\d,]*\.?\d*)',
        ],
        "igst": [
            r'(?:igst|i\.?g\.?s\.?t\.?)[\s@\d%.₹Rs:-]*?(\d[\d,]*\.?\d*)',
        ],
        "total_amount": [
            r'(?:total\s*(?:amount|amt)|grand\s*total|net\s*payable|amount\s*due|invoice\s*total)[:\s₹Rs.]*(\d[\d,]*\.?\d*)',
            r'(?:total)[:\s₹Rs.]*(\d[\d,]*\.?\d*)(?:\s|$)',
        ],
        "tds_amount": [
            r'(?:tds\s*(?:amount|deducted|deduction))[:\s₹Rs.]*(\d[\d,]*\.?\d*)',
        ],
        "tds_rate": [
            r'(?:tds\s*(?:rate|@))\s*(\d+\.?\d*)%?',
        ],
    }

    for field, patterns in amount_patterns.items():
        for pattern in patterns:
            m = re.search(pattern, text, re.IGNORECASE)
            if m:
                val = parse_amount(m.group(1))
                if val and val > 0:
                    fields[field] = val
                    break

    # HSN/SAC Code
    hsn_match = re.search(r'(?:hsn|sac|hsn/sac)[:\s]*(\d{4,8})', text, re.IGNORECASE)
    if hsn_match:
        fields["hsn_code"] = hsn_match.group(1)

    # If total not found, try to compute from taxable + GST
    if not fields["total_amount"] and fields["taxable_amount"]:
        gst = (fields.get("cgst") or 0) + (fields.get("sgst") or 0) + (fields.get("igst") or 0)
        fields["total_amount"] = fields["taxable_amount"] + gst

    # Party name — try to extract from common patterns
    name_patterns = [
        r'(?:to|bill to|sold to|customer|party|vendor|supplier)[:\s]+([A-Z][A-Za-z\s&.]{3,40})',
        r'(?:m/s|messrs?)[.\s]+([A-Z][A-Za-z\s&.]{3,40})',
    ]
    for p in name_patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            name = m.group(1).strip()
            if len(name) > 3:
                fields["party_name"] = name[:100]
                break

    return fields


def calculate_confidence(fields: Dict, raw_text: str) -> float:
    """Calculate OCR extraction confidence 0-1"""
    score = 0.0

    # Has meaningful text at all
    if len(raw_text) > 50:
        score += 0.2

    # Key financial fields found
    if fields.get("total_amount"):
        score += 0.3
    if fields.get("invoice_date"):
        score += 0.15
    if fields.get("invoice_number"):
        score += 0.1
    if fields.get("gstin"):
        score += 0.1
    if fields.get("taxable_amount"):
        score += 0.1
    if fields.get("cgst") or fields.get("sgst") or fields.get("igst"):
        score += 0.05

    return round(min(score, 1.0), 2)


def map_doc_type_to_txn_type(document_type: str) -> str:
    """Map document category to transaction type"""
    mapping = {
        "sales_invoice": "sales",
        "sales_return": "sales",
        "export_invoice": "sales",
        "service_invoice": "sales",
        "purchase_invoice": "purchase",
        "purchase_return": "purchase",
        "import_invoice": "purchase",
        "expense_bill": "expense",
        "salary_slip": "expense",
        "petty_cash": "expense",
        "bank_statement": "bank",
        "cash_book": "bank",
        "tds_certificate": "tds",
        "form_26as": "tds",
        "advance_tax_challan": "tds",
        "asset_invoice": "asset",
        "gstr2b_statement": "purchase",
        "rcm_invoice": "purchase",
        "loan_statement": "bank",
        "investment_proof": "bank",
        "bank_interest_cert": "bank",
        "gst_payment_challan": "expense",
    }
    return mapping.get(document_type, "other")


async def process_document_async(doc_id: int, file_path: str, document_type: str):
    """Main async OCR pipeline — runs in background after upload"""
    from app.db.database import AsyncSessionLocal
    from app.models.models import Document, Transaction
    from app.utils.financial_year import get_financial_year_from_date
    from sqlalchemy import select
    from datetime import datetime as dt

    logger.info(f"Processing document {doc_id}: {file_path}")

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(Document).where(Document.id == doc_id))
            doc = result.scalar_one_or_none()
            if not doc:
                logger.error(f"Document {doc_id} not found")
                return

            doc.processing_status = "processing"
            await db.flush()

            # Extract text
            mime = doc.mime_type or ""
            raw_text = extract_text_from_file(file_path, mime)
            doc.ocr_text = raw_text[:10000] if raw_text else ""

            # Parse fields
            parsed = parse_invoice_fields(raw_text, document_type)
            confidence = calculate_confidence(parsed, raw_text)

            # Map financial year
            invoice_date = None
            fy = doc.financial_year or "2024-25"
            month = None
            year = None

            if parsed.get("invoice_date"):
                invoice_date = parse_date_string(parsed["invoice_date"])
                if invoice_date:
                    from app.utils.financial_year import get_financial_year
                    fy = get_financial_year(invoice_date)
                    month = invoice_date.month
                    year = invoice_date.year

            doc.extracted_data = parsed
            doc.confidence_score = confidence
            doc.financial_year = fy
            doc.month = month
            doc.year = year
            doc.processing_status = "completed"
            doc.processed_at = dt.utcnow()

            # Auto-create transaction if we have a total amount
            txn_type = map_doc_type_to_txn_type(document_type)
            total = parsed.get("total_amount") or 0
            taxable = parsed.get("taxable_amount") or total

            # Mark as validated=True for document uploads (auto-approved)
            # Manual entries need CA approval, uploads are auto-approved
            if total > 0 and txn_type not in ["other", "tds", "bank"]:
                txn = Transaction(
                    client_id=doc.client_id,
                    document_id=doc.id,
                    transaction_type=txn_type,
                    invoice_number=parsed.get("invoice_number"),
                    invoice_date=invoice_date,
                    party_name=parsed.get("party_name"),
                    party_gstin=parsed.get("gstin"),
                    taxable_amount=Decimal(str(taxable)),
                    cgst_amount=Decimal(str(parsed.get("cgst") or 0)),
                    sgst_amount=Decimal(str(parsed.get("sgst") or 0)),
                    igst_amount=Decimal(str(parsed.get("igst") or 0)),
                    total_amount=Decimal(str(total)),
                    tds_amount=Decimal(str(parsed.get("tds_amount") or 0)),
                    hsn_code=parsed.get("hsn_code"),
                    financial_year=fy,
                    month=month,
                    year=year,
                    is_validated=True,  # Auto-approve uploaded documents
                    description=f"Auto-extracted from {doc.original_filename}",
                )
                db.add(txn)

            await db.commit()
            logger.info(f"✅ Document {doc_id} processed. Confidence: {confidence}, Total: {total}")

        except Exception as e:
            logger.error(f"❌ Error processing document {doc_id}: {e}")
            try:
                result2 = await db.execute(select(Document).where(Document.id == doc_id))
                doc2 = result2.scalar_one_or_none()
                if doc2:
                    doc2.processing_status = "failed"
                    await db.commit()
            except Exception:
                pass
