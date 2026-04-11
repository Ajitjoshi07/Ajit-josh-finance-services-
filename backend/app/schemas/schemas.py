from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal


# ─── Auth ─────────────────────────────────────────────
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    role: str = "client"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    phone: Optional[str]
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


# ─── Client Profile ───────────────────────────────────
class ClientProfileCreate(BaseModel):
    pan: str
    gstin: Optional[str] = None
    business_name: str
    business_type: str
    address: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    registration_date: Optional[date] = None

    @validator("pan")
    def validate_pan(cls, v):
        import re
        if not re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]$", v.upper()):
            raise ValueError("Invalid PAN format")
        return v.upper()

    @validator("gstin")
    def validate_gstin(cls, v):
        if v:
            import re
            if not re.match(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$", v.upper()):
                raise ValueError("Invalid GSTIN format")
            return v.upper()
        return v


class ClientProfileOut(BaseModel):
    id: int
    user_id: int
    pan: Optional[str]
    gstin: Optional[str]
    business_name: str
    business_type: Optional[str]
    address: Optional[str]
    state: Optional[str]
    current_financial_year: str
    gstn_status: Optional[str]
    risk_score: float
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Document ─────────────────────────────────────────
class DocumentOut(BaseModel):
    id: int
    original_filename: str
    document_type: Optional[str]
    financial_year: Optional[str]
    month: Optional[int]
    year: Optional[int]
    processing_status: str
    confidence_score: float
    is_duplicate: bool
    extracted_data: Optional[Dict]
    upload_date: datetime

    class Config:
        from_attributes = True


# ─── Transaction ──────────────────────────────────────
class TransactionCreate(BaseModel):
    transaction_type: str
    invoice_number: Optional[str]
    invoice_date: Optional[date]
    party_name: Optional[str]
    party_gstin: Optional[str]
    taxable_amount: Decimal = Decimal("0")
    cgst_amount: Decimal = Decimal("0")
    sgst_amount: Decimal = Decimal("0")
    igst_amount: Decimal = Decimal("0")
    total_amount: Decimal = Decimal("0")
    tds_amount: Decimal = Decimal("0")
    hsn_code: Optional[str]
    description: Optional[str]


class TransactionOut(TransactionCreate):
    id: int
    client_id: int
    financial_year: Optional[str]
    month: Optional[int]
    is_validated: bool
    validation_errors: Optional[List]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── GST ──────────────────────────────────────────────
class GSTSummary(BaseModel):
    month: int
    year: int
    financial_year: str
    total_sales: Decimal
    total_purchases: Decimal
    output_gst: Decimal
    input_gst: Decimal
    net_gst_payable: Decimal
    filing_status: str


class GSTR1Report(BaseModel):
    client_gstin: str
    financial_year: str
    month: int
    b2b_invoices: List[Dict]
    b2c_invoices: List[Dict]
    total_taxable: Decimal
    total_tax: Decimal


class GSTR3BReport(BaseModel):
    client_gstin: str
    financial_year: str
    month: int
    outward_supplies: Dict
    inward_supplies: Dict
    net_tax_payable: Decimal
    interest: Decimal = Decimal("0")


# ─── TDS ──────────────────────────────────────────────
class TDSCreate(BaseModel):
    deductee_name: str
    deductee_pan: str
    section: str
    payment_date: date
    payment_amount: Decimal
    tds_rate: float
    tds_amount: Decimal


class TDSQuarterlySummary(BaseModel):
    quarter: int
    financial_year: str
    total_payments: Decimal
    total_tds: Decimal
    deposited: bool
    records: List[Dict]


# ─── ITR ──────────────────────────────────────────────
class ITRSummary(BaseModel):
    financial_year: str
    assessment_year: str
    gross_income: Decimal
    total_deductions: Decimal
    taxable_income: Decimal
    tax_liability: Decimal
    tds_paid: Decimal
    advance_tax: Decimal
    net_tax_payable: Decimal
    status: str


# ─── Financial Statements ─────────────────────────────
class TrialBalanceRow(BaseModel):
    account_code: str
    account_name: str
    debit_total: Decimal
    credit_total: Decimal
    balance: Decimal


class ProfitLossStatement(BaseModel):
    financial_year: str
    income: Dict[str, Decimal]
    expenses: Dict[str, Decimal]
    gross_profit: Decimal
    net_profit: Decimal


class BalanceSheet(BaseModel):
    financial_year: str
    assets: Dict[str, Decimal]
    liabilities: Dict[str, Decimal]
    capital: Dict[str, Decimal]
    total_assets: Decimal
    total_liabilities_capital: Decimal
    is_balanced: bool


# ─── Dashboard ────────────────────────────────────────
class DashboardStats(BaseModel):
    total_clients: int
    active_clients: int
    pending_gst_filings: int
    overdue_filings: int
    total_revenue: Decimal
    documents_processed: int
    pending_documents: int


class ClientDashboard(BaseModel):
    client: ClientProfileOut
    current_fy: str
    gst_status: Dict
    pending_tasks: List[str]
    alerts: List[Dict]
    recent_transactions: int
    documents_uploaded: int


# ─── Validation ───────────────────────────────────────
class ValidationResult(BaseModel):
    is_valid: bool
    confidence_score: float
    risk_level: str  # low, medium, high
    errors: List[str]
    warnings: List[str]
    suggestions: List[str]


# ─── GSTN Verification ────────────────────────────────
class GSTNVerification(BaseModel):
    gstin: str
    business_name: str
    registration_date: Optional[str]
    status: str
    business_type: str
    state: str
    risk_score: float
