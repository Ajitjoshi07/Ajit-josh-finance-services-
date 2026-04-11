"""Initial migration - create all tables

Revision ID: 001
Revises: 
Create Date: 2024-04-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tables are created via SQLAlchemy metadata in init_db()
    # This migration is a placeholder for future schema changes
    pass


def downgrade() -> None:
    pass
