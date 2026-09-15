from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import (
    workflow_router,
    app_router,
    auth_router,
    profile_router,
    workflow_access_router,
    admin_router,
    token_router,
    media_router,
    payment_router,
    legal_router,
)
from app.init_db import init_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

APP_URL = os.getenv("APP_URL", "http://localhost:5000")

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

OFFERS_DIR = UPLOAD_DIR / "offers"
OFFERS_DIR.mkdir(parents=True, exist_ok=True)

LEGAL_DIR = UPLOAD_DIR / "legal"
LEGAL_DIR.mkdir(parents=True, exist_ok=True)

STORAGE_DIR = Path(__file__).resolve().parent.parent / "storage"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5000",
    APP_URL,
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup/shutdown tasks."""
    logger.info("Starting up — initializing database tables...")
    await init_db()
    logger.info("Database ready.")
    yield
    logger.info("Shutting down.")


app = FastAPI(title="Workflow API", version="2.0.0", lifespan=lifespan)

# ── Static Uploads ───────────────────────────────────────────────────────────
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="api_uploads")
app.mount("/uploads",     StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(workflow_router.router,        prefix="/api/workflow",   tags=["workflow"])
app.include_router(app_router.router,             prefix="/api/app",        tags=["app"])
app.include_router(auth_router.router,            prefix="/api/auth",       tags=["auth"])
app.include_router(profile_router.router,         prefix="/api/profile",    tags=["profile"])
app.include_router(workflow_access_router.router, prefix="/api/workflows",  tags=["workflow-access"])
app.include_router(admin_router.router,           prefix="/api/admin",      tags=["admin"])
app.include_router(token_router.router,           prefix="/api/tokens",     tags=["tokens"])
app.include_router(media_router.router,           prefix="/api/media",      tags=["media"])
app.include_router(payment_router.router,         prefix="/api/payment",    tags=["payment"])
app.include_router(legal_router.router,                                     tags=["legal"])


# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Welcome to Workflow API v2"}


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}
