import os

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db

router = APIRouter()

# Render injects RENDER_GIT_COMMIT at build/run time; the CI/CD pipeline compares
# this to the pushed SHA to confirm the new version is actually live.
VERSION = (os.getenv("RENDER_GIT_COMMIT") or os.getenv("GIT_COMMIT") or "dev")[:7]


@router.get("/health")
def health(db: Session = Depends(get_db)) -> dict:
    db_ok = True
    try:
        db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        db_ok = False
    return {
        "status": "ok" if db_ok else "degraded",
        "service": "usafe-api",
        "environment": settings.ENVIRONMENT,
        "database": "up" if db_ok else "down",
        "version": VERSION,
    }
