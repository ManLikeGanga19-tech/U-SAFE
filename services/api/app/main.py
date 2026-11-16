"""U-SAFE KE API — FastAPI application factory."""
from __future__ import annotations

import logging
import mimetypes
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1 import api_router
from app.core.config import settings


mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("image/avif", ".avif")


class MediaFiles(StaticFiles):
    """Serves locally stored uploads. Filenames are random UUIDs and never
    overwritten, so browsers/CDNs may cache them forever."""

    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            response.headers["X-Content-Type-Options"] = "nosniff"
        return response


def create_app() -> FastAPI:
    app = FastAPI(
        title=f"{settings.PROJECT_NAME} API",
        version="0.1.0",
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    if settings.STORAGE_BACKEND == "local":
        Path(settings.MEDIA_ROOT).mkdir(parents=True, exist_ok=True)
        app.mount("/media", MediaFiles(directory=settings.MEDIA_ROOT), name="media")

    for problem in settings.storage_problems():
        logging.getLogger("usafe").error("media storage misconfigured: %s", problem)

    @app.get("/", tags=["root"])
    def root() -> dict:
        return {
            "service": "usafe-api",
            "docs": "/docs",
            "health": f"{settings.API_V1_PREFIX}/health",
        }

    return app


app = create_app()
