"""
Run this once to create admin user in production DB.
Usage: python create_admin.py
"""
import asyncio
import uuid
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_admin():
    import sys
    import os
    sys.path.insert(0, os.path.dirname(__file__))

    from app.core.config import settings
    from app.db.database import AsyncSessionLocal, engine, Base
    from app.models.models import User
    from sqlalchemy import select, text

    print(f"Connecting to DB...")
    print(f"URL: {settings.DATABASE_URL[:50]}...")

    # Create tables first
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Tables ready")

    async with AsyncSessionLocal() as db:
        # Check if admin already exists
        result = await db.execute(select(User).where(User.email == "admin@ajitjoshi.com"))
        existing = result.scalar_one_or_none()

        if existing:
            # Update password
            existing.hashed_password = pwd_context.hash("Ajit07")
            existing.role = "admin"
            existing.is_active = True
            await db.commit()
            print(f"✅ Admin password updated to 'Ajit07'")
            print(f"   Email: admin@ajitjoshi.com")
            print(f"   ID: {existing.id}")
        else:
            # Create new admin
            admin = User(
                email="admin@ajitjoshi.com",
                hashed_password=pwd_context.hash("Ajit07"),
                full_name="Ajit Joshi",
                role="admin",
                is_active=True,
                is_verified=True,
            )
            db.add(admin)
            await db.commit()
            await db.refresh(admin)
            print(f"✅ Admin created successfully!")
            print(f"   Email: admin@ajitjoshi.com")
            print(f"   Password: Ajit07")
            print(f"   ID: {admin.id}")

if __name__ == "__main__":
    asyncio.run(create_admin())
