from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os
import uuid

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.environ.get("LOCAL_STORAGE_PATH", "/tmp/uploads")


def hash_password(password: str) -> str:
    import bcrypt
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


async def run_migrations():
    from app.db.database import engine
    from sqlalchemy import text
    stmts = [
        # users table fixes
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(255)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255) DEFAULT ''",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now()",
        # client_profiles fixes
        "ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS gstn_status VARCHAR(50)",
        "ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS risk_score FLOAT DEFAULT 0.0",
        "ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true",
        "ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE",
        # documents fixes
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS ocr_text TEXT",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS extracted_data JSONB",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS confidence_score FLOAT DEFAULT 0.0",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT false",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS month INTEGER",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS year INTEGER",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64)",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100)",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS stored_filename VARCHAR(500)",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_path TEXT",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size INTEGER",
        # transactions fixes
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS description TEXT",
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tds_amount NUMERIC(14,2) DEFAULT 0",
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20)",
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS year INTEGER",
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_validated BOOLEAN DEFAULT false",
        # gst_filings fixes
        "ALTER TABLE gst_filings ADD COLUMN IF NOT EXISTS filed_on TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE gst_filings ADD COLUMN IF NOT EXISTS arn_number VARCHAR(50)",
        "ALTER TABLE gst_filings ADD COLUMN IF NOT EXISTS year INTEGER",
        "ALTER TABLE gst_filings ADD COLUMN IF NOT EXISTS return_type VARCHAR(20) DEFAULT 'GSTR3B'",
    ]
    async with engine.begin() as conn:
        for s in stmts:
            try:
                await conn.execute(text(s))
            except Exception as e:
                if "already exists" not in str(e).lower():
                    logger.debug(f"Migration skip: {str(e)[:80]}")


async def ensure_admin():
    from app.db.database import AsyncSessionLocal
    from sqlalchemy import text
    email = os.environ.get("ADMIN_EMAIL", "admin@ajitjoshi.com")
    password = os.environ.get("ADMIN_PASSWORD", "Ajit07")
    hashed = hash_password(password)

    async with AsyncSessionLocal() as db:
        try:
            r = await db.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name='users'"
            ))
            cols = [x[0] for x in r.fetchall()]
            if not cols:
                logger.warning("users table not ready yet")
                return

            ex = await db.execute(text("SELECT id FROM users WHERE email=:e"), {"e": email})
            existing = ex.fetchone()
            pwd_col = next((c for c in ['hashed_password', 'password_hash', 'password'] if c in cols), None)
            name_col = next((c for c in ['full_name', 'name', 'username'] if c in cols), None)

            if existing:
                if pwd_col:
                    await db.execute(text(
                        f"UPDATE users SET {pwd_col}=:p, role='admin', is_active=true WHERE email=:e"
                    ), {"p": hashed, "e": email})
                    await db.commit()
                logger.info(f"✅ Admin synced: {email}")
            else:
                new_id = str(uuid.uuid4())
                cm = {"id": f"'{new_id}'::uuid", "email": f"'{email}'",
                      "role": "'admin'", "is_active": "true"}
                if pwd_col: cm[pwd_col] = f"'{hashed}'"
                if name_col: cm[name_col] = "'Ajit Joshi'"
                if "is_verified" in cols: cm["is_verified"] = "true"
                ic, iv = list(cm.keys()), list(cm.values())
                await db.execute(text(f"INSERT INTO users ({','.join(ic)}) VALUES ({','.join(iv)})"))
                await db.commit()
                logger.info(f"✅ Admin created: {email} / {password}")
        except Exception as e:
            logger.error(f"❌ Admin error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create upload directory
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    logger.info(f"✅ Upload dir: {UPLOAD_DIR}")

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
origins += ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"]
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
    return {"status": "healthy", "version": "1.0.0", "upload_dir": UPLOAD_DIR,
            "upload_dir_exists": os.path.exists(UPLOAD_DIR)}


@app.get("/make-admin")
async def make_admin(secret: str = ""):
    if secret != "AjitSetup2024":
        return {"error": "wrong secret — add ?secret=AjitSetup2024"}
    from app.db.database import AsyncSessionLocal
    from sqlalchemy import text
    hashed = hash_password("Ajit07")
    async with AsyncSessionLocal() as db:
        try:
            r = await db.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name='users'"
            ))
            cols = [x[0] for x in r.fetchall()]
            ex = await db.execute(text("SELECT id FROM users WHERE email='admin@ajitjoshi.com'"))
            existing = ex.fetchone()
            pwd_col = next((c for c in ['hashed_password', 'password_hash', 'password'] if c in cols), None)
            name_col = next((c for c in ['full_name', 'name', 'username'] if c in cols), None)
            if existing:
                if pwd_col:
                    await db.execute(text(
                        f"UPDATE users SET {pwd_col}=:p, role='admin', is_active=true WHERE email='admin@ajitjoshi.com'"
                    ), {"p": hashed})
                await db.commit()
                return {"ok": True, "action": "updated", "email": "admin@ajitjoshi.com",
                        "password": "Ajit07", "db_cols": cols}
            else:
                new_id = str(uuid.uuid4())
                cm = {"id": f"'{new_id}'::uuid", "email": "'admin@ajitjoshi.com'",
                      "role": "'admin'", "is_active": "true"}
                if pwd_col: cm[pwd_col] = f"'{hashed}'"
                if name_col: cm[name_col] = "'Ajit Joshi'"
                if "is_verified" in cols: cm["is_verified"] = "true"
                ic, iv = list(cm.keys()), list(cm.values())
                await db.execute(text(f"INSERT INTO users ({','.join(ic)}) VALUES ({','.join(iv)})"))
                await db.commit()
                return {"ok": True, "action": "created", "email": "admin@ajitjoshi.com",
                        "password": "Ajit07", "cols_used": ic, "all_cols": cols}
        except Exception as e:
            return {"ok": False, "error": str(e)}
