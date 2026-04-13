from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os

from app.core.config import settings
from app.db.database import engine, Base, AsyncSessionLocal

# Import all models
from app.models import models  # noqa

# Import routers
from app.api.routes.auth import router as auth_router
from app.api.routes.documents import router as documents_router
from app.api.routes.gst import router as gst_router
from app.api.routes.export import router as export_router
from app.api.routes.manual_entry import router as manual_entry_router
from app.api.routes.other_routes import (
    tds_router, itr_router, bookkeeping_router,
    reports_router, clients_router, notifications_router, admin_router
)

logger = logging.getLogger(__name__)


async def ensure_admin_exists():
    """Create default admin if none exists — runs on every startup safely"""
    try:
        from app.models.models import User
        from sqlalchemy import select, func
        from passlib.context import CryptContext

        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

        # Read admin credentials from env or use defaults
        admin_email = os.environ.get("ADMIN_EMAIL", "admin@ajitjoshi.com")
        admin_password = os.environ.get("ADMIN_PASSWORD", "Ajit07")
        admin_name = os.environ.get("ADMIN_NAME", "Ajit Joshi")

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(User).where(User.email == admin_email)
            )
            existing = result.scalar_one_or_none()

            if existing:
                # Always sync the password from env on startup
                existing.hashed_password = pwd.hash(admin_password)
                existing.role = "admin"
                existing.is_active = True
                await db.commit()
                logger.info(f"✅ Admin account synced: {admin_email}")
            else:
                admin = User(
                    email=admin_email,
                    hashed_password=pwd.hash(admin_password),
                    full_name=admin_name,
                    role="admin",
                    is_active=True,
                    is_verified=True,
                )
                db.add(admin)
                await db.commit()
                logger.info(f"✅ Admin account created: {admin_email}")

    except Exception as e:
        logger.error(f"❌ Admin setup error: {e}")
        # Don't crash startup if admin creation fails


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Create all DB tables
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("✅ Database tables ready")
    except Exception as e:
        logger.error(f"❌ DB init error: {e}")
        raise

    # 2. Ensure admin user exists
    await ensure_admin_exists()

    yield


app = FastAPI(
    title="Ajit Joshi Finance Services API",
    description="Professional CA SaaS Platform — GST, ITR, TDS, Bookkeeping",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS — allow frontend + localhost dev
origins = [o.strip() for o in (settings.ALLOWED_ORIGINS or "").split(",") if o.strip()]
origins += [
    "http://localhost:3000", "http://localhost:3001",
    "http://localhost:5173", "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# All routes under /api/v1
PREFIX = "/api/v1"
app.include_router(auth_router, prefix=PREFIX)
app.include_router(documents_router, prefix=PREFIX)
app.include_router(gst_router, prefix=PREFIX)
app.include_router(export_router, prefix=PREFIX)
app.include_router(manual_entry_router, prefix=PREFIX)
app.include_router(tds_router, prefix=PREFIX)
app.include_router(itr_router, prefix=PREFIX)
app.include_router(bookkeeping_router, prefix=PREFIX)
app.include_router(reports_router, prefix=PREFIX)
app.include_router(clients_router, prefix=PREFIX)
app.include_router(notifications_router, prefix=PREFIX)
app.include_router(admin_router, prefix=PREFIX)


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "Ajit Joshi Finance Services",
        "version": "1.0.0"
    }


@app.get("/")
async def root():
    return {"message": "Ajit Joshi Finance Services API", "docs": "/api/docs"}
