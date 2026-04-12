from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.db.database import engine, Base

# Import all models so Base knows them
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (safe — won't drop existing)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("✅ Database tables ready")
    except Exception as e:
        logger.error(f"❌ DB init error: {e}")
        raise
    yield


app = FastAPI(
    title="Ajit Joshi Finance Services API",
    description="CA SaaS Platform - GST, ITR, TDS, Bookkeeping",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS
origins = [o.strip() for o in (settings.ALLOWED_ORIGINS or "").split(",") if o.strip()]
origins += ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers under /api/v1
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
    return {"status": "healthy", "service": "Ajit Joshi Finance Services API", "version": "1.0.0"}


@app.get("/")
async def root():
    return {"message": "Ajit Joshi Finance Services API", "docs": "/api/docs"}
