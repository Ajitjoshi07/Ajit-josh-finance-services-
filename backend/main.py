from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os

from app.core.config import settings
from app.db.database import init_db
from app.api.routes.auth import router as auth_router
from app.api.routes.documents import router as documents_router
from app.api.routes.gst import router as gst_router
from app.api.routes.other_routes import (
    tds_router, itr_router, bookkeeping_router,
    reports_router, clients_router, admin_router, notifications_router
)
from app.api.routes.manual_entry import router as manual_entry_router
from app.api.routes.export import router as export_router
from app.api.routes.ai_chat import router as ai_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    os.makedirs(settings.LOCAL_STORAGE_PATH, exist_ok=True)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Full-stack CA SaaS — GST, TDS, ITR, Bookkeeping, Audit",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"
app.include_router(auth_router, prefix=PREFIX)
app.include_router(documents_router, prefix=PREFIX)
app.include_router(gst_router, prefix=PREFIX)
app.include_router(tds_router, prefix=PREFIX)
app.include_router(itr_router, prefix=PREFIX)
app.include_router(bookkeeping_router, prefix=PREFIX)
app.include_router(reports_router, prefix=PREFIX)
app.include_router(clients_router, prefix=PREFIX)
app.include_router(admin_router, prefix=PREFIX)
app.include_router(notifications_router, prefix=PREFIX)
app.include_router(manual_entry_router, prefix=PREFIX)
app.include_router(export_router, prefix=PREFIX)
app.include_router(ai_router, prefix=PREFIX)


@app.get("/")
async def root():
    return {"app": settings.APP_NAME, "version": settings.APP_VERSION, "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
