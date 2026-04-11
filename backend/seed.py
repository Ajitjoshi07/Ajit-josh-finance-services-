"""
Seed script — creates demo admin user + sample client data.
Run: python seed.py (from backend directory with venv activated)
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.models import User, ClientProfile
from app.db.database import Base


async def seed():
    engine = create_async_engine(settings.ASYNC_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as db:
        from sqlalchemy import select

        # Create Admin
        existing = await db.execute(select(User).where(User.email == "admin@ajitjoshi.com"))
        if not existing.scalar_one_or_none():
            admin = User(
                email="admin@ajitjoshi.com",
                hashed_password=get_password_hash("admin123"),
                full_name="Ajit Joshi",
                phone="+91 9876543210",
                role="admin",
                is_active=True,
                is_verified=True,
            )
            db.add(admin)
            await db.flush()
            print(f"✓ Admin created: admin@ajitjoshi.com / admin123")
        else:
            print("  Admin already exists, skipping")

        # Create Demo Client User
        existing_client = await db.execute(select(User).where(User.email == "client@demo.com"))
        if not existing_client.scalar_one_or_none():
            client_user = User(
                email="client@demo.com",
                hashed_password=get_password_hash("client123"),
                full_name="Demo Client",
                phone="+91 9000000001",
                role="client",
                is_active=True,
                is_verified=True,
            )
            db.add(client_user)
            await db.flush()

            # Create client profile
            profile = ClientProfile(
                user_id=client_user.id,
                pan="ABCDE1234F",
                gstin="27ABCDE1234F1Z5",
                business_name="Demo Trading Co.",
                business_type="proprietorship",
                address="123 MG Road, Pune",
                state="Maharashtra",
                pincode="411001",
                current_financial_year="2024-25",
                gstn_status="Active",
                risk_score=0.1,
            )
            db.add(profile)
            print(f"✓ Client created: client@demo.com / client123")
        else:
            print("  Demo client already exists, skipping")

        await db.commit()

    await engine.dispose()
    print("\n✅ Database seeded successfully!")
    print("\nLogin credentials:")
    print("  Admin:  admin@ajitjoshi.com  / admin123")
    print("  Client: client@demo.com     / client123")
    print("\nAPI Docs: http://localhost:8000/api/docs")


if __name__ == "__main__":
    asyncio.run(seed())
