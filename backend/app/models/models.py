from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text,
    ForeignKey, Enum, JSON, Date, Numeric, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.db.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    CA = "ca"
    CLIENT = "client"


class DocumentType(str, enum.Enum):
    SALES_INVOICE = "sales_invoice"
    PURCHASE_INVOICE = "purchase_invoice"
    BANK_STATEMENT = "bank_statement"
    EXPENSE_BILL = "expense_bill"
    OTHER = "other"


class ProcessingStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    DUPLICATE = "duplicate"


class FilingStatus(str, enum.Enum):
    PENDING = "pending"
    DRAFT = "draft"
    FILED = "filed"
    LATE = "late"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
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

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    pan = Column(String(10), unique=True, index=True)
    gstin = Column(String(15), unique=True, index=True)
    business_name = Column(String(255), nullable=False)
    business_type = Column(String(50))  # proprietorship, partnership, pvt_ltd, llp
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


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("client_profiles.id"), nullable=False)
    original_filename = Column(String(500), nullable=False)
    stored_filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_size = Column(Integer)
    file_hash = Column(String(64), index=True)
    mime_type = Column(String(100))
    document_type = Column(String(50))
    financial_year = Column(String(10))
    month = Column(Integer)
    year = Column(Integer)
    processing_status = Column(String(20), default="pending")
    extracted_data = Column(JSON)
    confidence_score = Column(Float, default=0.0)
    is_duplicate = Column(Boolean, default=False)
    duplicate_of_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    ocr_text = Column(Text)
    upload_date = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True))

    client = relationship("ClientProfile", back_populates="documents")
    transactions = relationship("Transaction", back_populates="document")

    __table_args__ = (
        Index("idx_doc_client_fy", "client_id", "financial_year"),
        Index("idx_doc_client_month", "client_id", "year", "month"),
    )


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("client_profiles.id"), nullable=False)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    transaction_type = Column(String(20))  # sales, purchase, expense, bank
    invoice_number = Column(String(100))
    invoice_date = Column(Date)
    financial_year = Column(String(10))
    month = Column(Integer)
    year = Column(Integer)
    party_name = Column(String(255))
    party_gstin = Column(String(15))
    taxable_amount = Column(Numeric(15, 2), default=0)
    cgst_amount = Column(Numeric(15, 2), default=0)
    sgst_amount = Column(Numeric(15, 2), default=0)
    igst_amount = Column(Numeric(15, 2), default=0)
    total_amount = Column(Numeric(15, 2), default=0)
    tds_amount = Column(Numeric(15, 2), default=0)
    hsn_code = Column(String(20))
    description = Column(Text)
    is_validated = Column(Boolean, default=False)
    validation_errors = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    client = relationship("ClientProfile", back_populates="transactions")
    document = relationship("Document", back_populates="transactions")
    journal_entries = relationship("JournalEntry", back_populates="transaction")

    __table_args__ = (
        Index("idx_txn_client_fy", "client_id", "financial_year"),
        Index("idx_txn_invoice", "client_id", "invoice_number"),
    )


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("client_profiles.id"), nullable=False)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)
    financial_year = Column(String(10))
    entry_date = Column(Date)
    account_code = Column(String(20))
    account_name = Column(String(255))
    debit_amount = Column(Numeric(15, 2), default=0)
    credit_amount = Column(Numeric(15, 2), default=0)
    narration = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transaction = relationship("Transaction", back_populates="journal_entries")


class GSTFiling(Base):
    __tablename__ = "gst_filings"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("client_profiles.id"), nullable=False)
    financial_year = Column(String(10))
    month = Column(Integer)
    year = Column(Integer)
    return_type = Column(String(20))  # GSTR1, GSTR3B
    total_sales = Column(Numeric(15, 2), default=0)
    total_purchases = Column(Numeric(15, 2), default=0)
    output_gst = Column(Numeric(15, 2), default=0)
    input_gst = Column(Numeric(15, 2), default=0)
    net_gst_payable = Column(Numeric(15, 2), default=0)
    filing_status = Column(String(20), default="pending")
    filed_on = Column(DateTime(timezone=True))
    due_date = Column(Date)
    report_data = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    client = relationship("ClientProfile", back_populates="gst_filings")

    __table_args__ = (
        Index("idx_gst_client_month", "client_id", "year", "month"),
    )


class TDSRecord(Base):
    __tablename__ = "tds_records"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("client_profiles.id"), nullable=False)
    financial_year = Column(String(10))
    quarter = Column(Integer)  # 1=Apr-Jun, 2=Jul-Sep, 3=Oct-Dec, 4=Jan-Mar
    deductee_name = Column(String(255))
    deductee_pan = Column(String(10))
    section = Column(String(20))  # 194C, 194J, etc.
    payment_date = Column(Date)
    payment_amount = Column(Numeric(15, 2), default=0)
    tds_rate = Column(Float, default=0)
    tds_amount = Column(Numeric(15, 2), default=0)
    deposited = Column(Boolean, default=False)
    deposit_date = Column(Date)
    challan_number = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    client = relationship("ClientProfile", back_populates="tds_records")


class ITRDraft(Base):
    __tablename__ = "itr_drafts"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("client_profiles.id"), nullable=False)
    financial_year = Column(String(10))
    assessment_year = Column(String(10))
    itr_type = Column(String(10))  # ITR-1, ITR-3, ITR-4
    gross_income = Column(Numeric(15, 2), default=0)
    total_deductions = Column(Numeric(15, 2), default=0)
    taxable_income = Column(Numeric(15, 2), default=0)
    tax_liability = Column(Numeric(15, 2), default=0)
    tds_paid = Column(Numeric(15, 2), default=0)
    advance_tax = Column(Numeric(15, 2), default=0)
    net_tax_payable = Column(Numeric(15, 2), default=0)
    status = Column(String(20), default="draft")
    data_json = Column(JSON)
    ca_notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("client_profiles.id"), nullable=False)
    title = Column(String(255))
    message = Column(Text)
    notification_type = Column(String(50))  # deadline, missing_doc, filing_ready
    is_read = Column(Boolean, default=False)
    sent_via_email = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
