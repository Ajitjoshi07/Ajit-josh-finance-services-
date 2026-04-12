import uuid
from sqlalchemy import (
    Column, String, Float, Boolean, DateTime, Text,
    ForeignKey, JSON, Date, Numeric, Index, Integer
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.db.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20))
    role = Column(String(20), default="client")
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    client_profile = relationship("ClientProfile", back_populates="user", uselist=False)


class ClientProfile(Base):
    __tablename__ = "client_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    pan = Column(String(10), unique=True, index=True)
    gstin = Column(String(15), unique=True, index=True)
    business_name = Column(String(255), nullable=True, default="")
    business_type = Column(String(50))
    address = Column(Text)
    state = Column(String(50))
    pincode = Column(String(10))
    registration_date = Column(Date)
    current_financial_year = Column(String(10), default="2024-25")
    gstn_status = Column(String(50))
    risk_score = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="client_profile")
    documents = relationship("Document", back_populates="client")
    transactions = relationship("Transaction", back_populates="client")
    gst_filings = relationship("GSTFiling", back_populates="client")
    tds_records = relationship("TDSRecord", back_populates="client")
    itr_drafts = relationship("ITRDraft", back_populates="client")
    journal_entries = relationship("JournalEntry", back_populates="client")
    notifications = relationship("Notification", back_populates="client")
    manual_entries = relationship("ManualEntry", back_populates="client")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    client_id = Column(Integer, ForeignKey("client_profiles.id"), nullable=False, index=True)
    original_filename = Column(String(500), nullable=False)
    stored_filename = Column(String(500))
    file_path = Column(Text)
    file_size = Column(Integer)
    file_hash = Column(String(64), index=True)
    mime_type = Column(String(100))
    document_type = Column(String(100))
    financial_year = Column(String(10), default="2024-25", index=True)
    month = Column(Integer)
    year = Column(Integer)
    processing_status = Column(String(20), default="pending")
    ocr_text = Column(Text)
    extracted_data = Column(JSON)
    confidence_score = Column(Float, default=0.0)
    is_duplicate = Column(Boolean, default=False)
    processed_at = Column(DateTime(timezone=True))
    upload_date = Column(DateTime(timezone=True), server_default=func.now())

    client = relationship("ClientProfile", back_populates="documents")
    transactions = relationship("Transaction", back_populates="document")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    client_id = Column(Integer, ForeignKey("client_profiles.id"), nullable=False, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    transaction_type = Column(String(50), nullable=False)
    invoice_number = Column(String(100))
    invoice_date = Column(Date)
    party_name = Column(String(255))
    party_gstin = Column(String(15))
    taxable_amount = Column(Numeric(14, 2), default=0)
    cgst_amount = Column(Numeric(14, 2), default=0)
    sgst_amount = Column(Numeric(14, 2), default=0)
    igst_amount = Column(Numeric(14, 2), default=0)
    total_amount = Column(Numeric(14, 2), default=0)
    tds_amount = Column(Numeric(14, 2), default=0)
    hsn_code = Column(String(20))
    financial_year = Column(String(10), default="2024-25", index=True)
    month = Column(Integer)
    year = Column(Integer)
    is_validated = Column(Boolean, default=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    client = relationship("ClientProfile", back_populates="transactions")
    document = relationship("Document", back_populates="transactions")


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("client_profiles.id"), nullable=False, index=True)
    entry_date = Column(Date)
    account_code = Column(String(20))
    account_name = Column(String(200))
    debit_amount = Column(Numeric(14, 2), default=0)
    credit_amount = Column(Numeric(14, 2), default=0)
    narration = Column(Text)
    financial_year = Column(String(10), default="2024-25")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    client = relationship("ClientProfile", back_populates="journal_entries")


class GSTFiling(Base):
    __tablename__ = "gst_filings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("client_profiles.id"), nullable=False, index=True)
    financial_year = Column(String(10), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer)
    return_type = Column(String(20), default="GSTR3B")
    total_sales = Column(Numeric(14, 2), default=0)
    total_purchases = Column(Numeric(14, 2), default=0)
    output_gst = Column(Numeric(14, 2), default=0)
    input_gst = Column(Numeric(14, 2), default=0)
    net_gst_payable = Column(Numeric(14, 2), default=0)
    filing_status = Column(String(20), default="pending")
    filed_on = Column(DateTime(timezone=True))
    arn_number = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    client = relationship("ClientProfile", back_populates="gst_filings")


class TDSRecord(Base):
    __tablename__ = "tds_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("client_profiles.id"), nullable=False, index=True)
    financial_year = Column(String(10), nullable=False)
    quarter = Column(Integer, nullable=False)
    section = Column(String(10))
    deductee_name = Column(String(255))
    deductee_pan = Column(String(10))
    payment_date = Column(Date)
    payment_amount = Column(Numeric(14, 2), default=0)
    tds_rate = Column(Float)
    tds_amount = Column(Numeric(14, 2), default=0)
    deposited = Column(Boolean, default=False)
    challan_number = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    client = relationship("ClientProfile", back_populates="tds_records")


class ITRDraft(Base):
    __tablename__ = "itr_drafts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("client_profiles.id"), nullable=False, index=True)
    financial_year = Column(String(10), nullable=False)
    assessment_year = Column(String(10))
    itr_type = Column(String(20), default="ITR-4")
    gross_income = Column(Numeric(14, 2), default=0)
    total_deductions = Column(Numeric(14, 2), default=0)
    taxable_income = Column(Numeric(14, 2), default=0)
    tax_liability = Column(Numeric(14, 2), default=0)
    tds_paid = Column(Numeric(14, 2), default=0)
    net_tax_payable = Column(Numeric(14, 2), default=0)
    status = Column(String(20), default="draft")
    ca_notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    client = relationship("ClientProfile", back_populates="itr_drafts")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("client_profiles.id"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text)
    notification_type = Column(String(50), default="info")
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    client = relationship("ClientProfile", back_populates="notifications")


class ManualEntry(Base):
    __tablename__ = "manual_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("client_profiles.id"), nullable=False, index=True)
    transaction_type = Column(String(50))
    invoice_number = Column(String(100))
    invoice_date = Column(Date)
    party_name = Column(String(255))
    party_gstin = Column(String(15))
    description = Column(Text)
    hsn_code = Column(String(20))
    taxable_amount = Column(Numeric(14, 2), default=0)
    cgst_amount = Column(Numeric(14, 2), default=0)
    sgst_amount = Column(Numeric(14, 2), default=0)
    igst_amount = Column(Numeric(14, 2), default=0)
    total_amount = Column(Numeric(14, 2), default=0)
    tds_amount = Column(Numeric(14, 2), default=0)
    month = Column(Integer)
    financial_year = Column(String(10), default="2024-25")
    status = Column(String(20), default="pending")
    ca_notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    approved_at = Column(DateTime(timezone=True))

    client = relationship("ClientProfile", back_populates="manual_entries")
