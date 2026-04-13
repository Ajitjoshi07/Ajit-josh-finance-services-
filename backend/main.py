from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os

from app.core.config import settings
from app.db.database import engine, Base, AsyncSessionLocal
from app.models import models  # noqa

from app.api.routes.auth import router as auth_router
from fastapi.responses import JSONResponse
from sqlalchemy import text
from passlib.context import CryptContext as _CryptPwd
from app.api.routes.documents import router as documents_router
from app.api.routes.gst import router as gst_router
from app.api.routes.export import router as export_router
from app.api.routes.manual_entry import router as manual_entry_router
from app.api.routes.setup import router as setup_router
from app.api.routes.other_routes import (
    tds_router, itr_router, bookkeeping_router,
    reports_router, clients_router, notifications_router, admin_router
)

logger = logging.getLogger(__name__)


async def ensure_admin_exists():
    """Auto-create admin on startup using env vars"""
    try:
        from app.models.models import User
        from sqlalchemy import select
        from passlib.context import CryptContext

        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        admin_email = os.environ.get("ADMIN_EMAIL", "admin@ajitjoshi.com")
        admin_password = os.environ.get("ADMIN_PASSWORD", "Ajit07")
        admin_name = os.environ.get("ADMIN_NAME", "Ajit Joshi")

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.email == admin_email))
            existing = result.scalar_one_or_none()

            if existing:
                existing.hashed_password = pwd.hash(admin_password)
                existing.role = "admin"
                existing.is_active = True
                await db.commit()
                logger.info(f"✅ Admin synced: {admin_email}")
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
                logger.info(f"✅ Admin created: {admin_email}")
    except Exception as e:
        logger.error(f"❌ Admin setup error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("✅ Database tables ready")
    except Exception as e:
        logger.error(f"❌ DB init error: {e}")
        raise

    await ensure_admin_exists()
    yield


app = FastAPI(
    title="Ajit Joshi Finance Services API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

origins = [o.strip() for o in (settings.ALLOWED_ORIGINS or "").split(",") if o.strip()]
origins += ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"
app.include_router(auth_router, prefix=PREFIX)
app.include_router(documents_router, prefix=PREFIX)
app.include_router(gst_router, prefix=PREFIX)
app.include_router(export_router, prefix=PREFIX)
app.include_router(manual_entry_router, prefix=PREFIX)
app.include_router(setup_router, prefix=PREFIX)
app.include_router(tds_router, prefix=PREFIX)
app.include_router(itr_router, prefix=PREFIX)
app.include_router(bookkeeping_router, prefix=PREFIX)
app.include_router(reports_router, prefix=PREFIX)
app.include_router(clients_router, prefix=PREFIX)
app.include_router(notifications_router, prefix=PREFIX)
app.include_router(admin_router, prefix=PREFIX)

@app.get("/api/v1/make-admin")
async def make_admin(secret: str = ""):
    if secret != "AjitSetup2024":
        return {"error": "wrong secret"}
    import uuid as _u
    from sqlalchemy import text as _t
    _pwd = _CryptPwd(schemes=["bcrypt"], deprecated="auto")
    _h = _pwd.hash("Ajit07")
    async with AsyncSessionLocal() as db:
        try:
            cols = await db.execute(_t("SELECT column_name FROM information_schema.columns WHERE table_name='users'"))
            col_names = [r[0] for r in cols.fetchall()]
            pc = next((c for c in ['hashed_password','password_hash','password'] if c in col_names), None)
            nc = next((c for c in ['full_name','name','username'] if c in col_names), None)
            ex = await db.execute(_t("SELECT id FROM users WHERE email='admin@ajitjoshi.com'"))
            if ex.fetchone():
                await db.execute(_t(f"UPDATE users SET {pc}=:p,role='admin',is_active=true WHERE email='admin@ajitjoshi.com'"),{"p":_h})
                await db.commit()
                return {"ok": True, "msg": "Password updated to Ajit07", "email": "admin@ajitjoshi.com"}
            else:
                nid = str(_u.uuid4())
                ic = ["id","email",pc,"role","is_active"]
                iv = [f"'{nid}'::uuid","'admin@ajitjoshi.com'",f"'{_h}'","'admin'","true"]
                if nc: ic.append(nc); iv.append("'Ajit Joshi'")
                if "is_verified" in col_names: ic.append("is_verified"); iv.append("true")
                await db.execute(_t(f"INSERT INTO users ({','.join(ic)}) VALUES ({','.join(iv)})"))
                await db.commit()
                return {"ok": True, "msg": "Admin created", "email": "admin@ajitjoshi.com", "password": "Ajit07", "cols": ic}
        except Exception as e:
            return {"ok": False, "error": str(e), "columns": col_names if 'col_names' in dir() else "unknown"}
@app.get("/health")
async def health():
    return {"status": "healthy", "service": "Ajit Joshi Finance Services", "version": "1.0.0"}

@app.get("/")
async def root():
    return {"message": "Ajit Joshi Finance Services API", "docs": "/api/docs"}
