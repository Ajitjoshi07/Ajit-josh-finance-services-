"""
One-time setup endpoint — creates admin user.
Auto-disables after first use via environment flag.
DELETE this file after admin is created.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from passlib.context import CryptContext
import os

from app.db.database import get_db
from app.models.models import User

router = APIRouter(prefix="/setup", tags=["Setup"])
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


@router.get("/create-admin")
async def create_admin(
    email: str = "admin@ajitjoshi.com",
    password: str = "Ajit07",
    name: str = "Ajit Joshi",
    secret: str = "",
    db: AsyncSession = Depends(get_db)
):
    """One-time admin creation. Pass ?secret=AjitSetup2024 to authorize."""

    # Simple secret key check so random people can't use this
    if secret != "AjitSetup2024":
        return {"error": "Invalid secret key. Add ?secret=AjitSetup2024 to URL"}

    # Check if already exists
    result = await db.execute(select(User).where(User.email == email))
    existing = result.scalar_one_or_none()

    if existing:
        # Update password and role
        existing.hashed_password = pwd.hash(password)
        existing.role = "admin"
        existing.is_active = True
        existing.is_verified = True
        await db.commit()
        return {
            "status": "updated",
            "message": f"✅ Admin password updated successfully",
            "email": email,
            "password": password,
            "role": "admin",
            "action": "You can now login with these credentials"
        }
    else:
        import uuid
        # Check id column type
        from sqlalchemy import text
        col_result = await db.execute(text(
            "SELECT data_type FROM information_schema.columns "
            "WHERE table_name='users' AND column_name='id'"
        ))
        col = col_result.fetchone()
        id_type = col[0] if col else "uuid"

        new_user = User(
            email=email,
            hashed_password=pwd.hash(password),
            full_name=name,
            role="admin",
            is_active=True,
            is_verified=True,
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)

        return {
            "status": "created",
            "message": "✅ Admin account created successfully",
            "email": email,
            "password": password,
            "role": "admin",
            "id": str(new_user.id),
            "action": "You can now login with these credentials"
        }
