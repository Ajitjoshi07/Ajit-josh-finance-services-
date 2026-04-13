from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os
import uuid

logger = logging.getLogger(__name__)


def hash_password(password: str) -> str:
    import bcrypt
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    import bcrypt
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


async def run_migrations():
    from app.db.database import engine
    from sqlalchemy import text

    # Fix role column — convert from enum to plain varchar if needed
    async with engine.connect() as conn:
        await conn.execution_options(isolation_level="AUTOCOMMIT")
        try:
            await conn.execute(text(
                "ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(20) USING role::text"
            ))
        except Exception as e:
            logger.warning(f"role column fix: {e}")
        for label in ["admin", "ca", "user", "client"]:
            try:
                await conn.execute(text(
                    f"DO $$ BEGIN "
                    f"IF EXISTS (SELECT 1 FROM pg_type WHERE typname='role') THEN "
                    f"IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='{label}' "
                    f"AND enumtypid=(SELECT oid FROM pg_type WHERE typname='role')) "
                    f"THEN ALTER TYPE role ADD VALUE '{label}'; END IF; END IF; END $$"
                ))
            except Exception as e:
                logger.warning(f"Enum migration '{label}': {e}")

    # Regular column migrations
    stmts = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(255)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255) DEFAULT ''",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now()",
        "ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL",
    ]
    async with engine.begin() as conn:
        for s in stmts:
            try:
                await conn.execute(text(s))
            except Exception:
                pass


async def ensure_admin():
    from app.db.database import AsyncSessionLocal
    from sqlalchemy import text
    email = os.environ.get("ADMIN_EMAIL", "admin@ajitjoshi.com")
    password = os.environ.get("ADMIN_PASSWORD", "Ajit@123")
    hashed = hash_password(password)
    async with AsyncSessionLocal() as db:
        try:
            ex = await db.execute(text("SELECT id FROM users WHERE email=:e"), {"e": email})
            existing = ex.fetchone()
            if existing:
                await db.execute(text(
                    "UPDATE users SET hashed_password=:p, role='admin', is_active=true, "
                    "full_name='Ajit Joshi', is_verified=true WHERE email=:e"
                ), {"p": hashed, "e": email})
                await db.commit()
                logger.info(f"✅ Admin updated: {email}")
            else:
                new_id = str(uuid.uuid4())
                await db.execute(text(
                    "INSERT INTO users (id, email, hashed_password, full_name, role, is_active, is_verified, created_at) "
                    "VALUES (CAST(:id AS uuid), :email, :pwd, 'Ajit Joshi', 'admin', true, true, now())"
                ), {"id": new_id, "email": email, "pwd": hashed})
                await db.commit()
                logger.info(f"✅ Admin created: {email}")
        except Exception as e:
            logger.error(f"❌ Admin setup error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.db.database import engine, Base
    from app.models import models  # noqa
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("✅ Tables ready")
    except Exception as e:
        logger.error(f"❌ Table error: {e}")
        raise
    await run_migrations()
    await ensure_admin()
    yield


app = FastAPI(
    title="Ajit Joshi Finance Services",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

from app.core.config import settings
origins = [o.strip() for o in (settings.ALLOWED_ORIGINS or "").split(",") if o.strip()]
origins += ["http://localhost:3000", "http://localhost:5173"]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

PREFIX = "/api/v1"

try:
    from app.api.routes.auth import router as auth_router
    app.include_router(auth_router, prefix=PREFIX)
except Exception as e:
    logger.error(f"auth router: {e}")

try:
    from app.api.routes.documents import router as documents_router
    app.include_router(documents_router, prefix=PREFIX)
except Exception as e:
    logger.error(f"documents router: {e}")

try:
    from app.api.routes.gst import router as gst_router
    app.include_router(gst_router, prefix=PREFIX)
except Exception as e:
    logger.error(f"gst router: {e}")

try:
    from app.api.routes.export import router as export_router
    app.include_router(export_router, prefix=PREFIX)
except Exception as e:
    logger.error(f"export router: {e}")

try:
    from app.api.routes.manual_entry import router as manual_entry_router
    app.include_router(manual_entry_router, prefix=PREFIX)
except Exception as e:
    logger.error(f"manual_entry router: {e}")

try:
    from app.api.routes.other_routes import (
        tds_router, itr_router, bookkeeping_router,
        reports_router, clients_router, notifications_router, admin_router
    )
    for r in [tds_router, itr_router, bookkeeping_router, reports_router,
              clients_router, notifications_router, admin_router]:
        app.include_router(r, prefix=PREFIX)
except Exception as e:
    logger.error(f"other routes: {e}")

try:
    from app.api.routes.setup import router as setup_router
    app.include_router(setup_router, prefix=PREFIX)
except Exception:
    pass


@app.get("/")
async def root():
    return {"message": "Ajit Joshi Finance Services API", "docs": "/api/docs"}


@app.get("/health")
async def health():
    return {"status": "healthy", "version": "1.0.0"}


@app.get("/make-admin")
async def make_admin(secret: str = ""):
    if secret != "AjitSetup2024":
        return {"error": "wrong secret — add ?secret=AjitSetup2024"}
    from app.db.database import AsyncSessionLocal
    from sqlalchemy import text
    hashed = hash_password("Ajit@123")
    async with AsyncSessionLocal() as db:
        try:
            ex = await db.execute(text("SELECT id FROM users WHERE email='admin@ajitjoshi.com'"))
            existing = ex.fetchone()
            if existing:
                await db.execute(text(
                    "UPDATE users SET hashed_password=:p, role='admin', is_active=true, "
                    "full_name='Ajit Joshi', is_verified=true WHERE email='admin@ajitjoshi.com'"
                ), {"p": hashed})
                await db.commit()
                return {"ok": True, "action": "updated", "email": "admin@ajitjoshi.com", "password": "Ajit@123"}
            else:
                new_id = str(uuid.uuid4())
                await db.execute(text(
                    "INSERT INTO users (id, email, hashed_password, full_name, role, is_active, is_verified, created_at) "
                    "VALUES (CAST(:id AS uuid), :email, :pwd, 'Ajit Joshi', 'admin', true, true, now())"
                ), {"id": new_id, "email": "admin@ajitjoshi.com", "pwd": hashed})
                await db.commit()
                return {"ok": True, "action": "created", "email": "admin@ajitjoshi.com", "password": "Ajit@123"}
        except Exception as e:
            return {"ok": False, "error": str(e)}
