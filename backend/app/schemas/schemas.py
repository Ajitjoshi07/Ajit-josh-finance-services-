from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List, Any
from datetime import date, datetime
from decimal import Decimal


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    role: Optional[str] = "client"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: Any  # UUID or int
    email: str
    full_name: str
    phone: Optional[str] = None
    role: str
    is_active: bool
    is_verified: bool = False

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: Optional[UserOut] = None


class ClientProfileCreate(BaseModel):
    business_name: str
    business_type: Optional[str] = None
    pan: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    registration_date: Optional[date] = None
    current_financial_year: Optional[str] = "2024-25"


class DocumentOut(BaseModel):
    id: int
    original_filename: str
    document_type: Optional[str] = None
    financial_year: Optional[str] = None
    processing_status: str
    confidence_score: Optional[float] = 0.0
    upload_date: Optional[datetime] = None
    extracted_data: Optional[Any] = None

    class Config:
        from_attributes = True


class TDSCreate(BaseModel):
    section: str
    deductee_name: str
    deductee_pan: Optional[str] = None
    payment_date: date
    payment_amount: Decimal
    tds_rate: float
    tds_amount: Decimal
    deposited: bool = False
    challan_number: Optional[str] = None


class ITRSummary(BaseModel):
    financial_year: str
    assessment_year: str
    gross_income: Decimal
    total_deductions: Decimal
    taxable_income: Decimal
    tax_liability: Decimal
    tds_paid: Decimal
    net_tax_payable: Decimal
