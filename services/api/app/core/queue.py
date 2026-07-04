"""Enqueue ARQ jobs from the (sync) API process."""
from __future__ import annotations

import asyncio
from datetime import timedelta

from arq import create_pool
from arq.connections import RedisSettings

from app.core.config import settings


def redis_settings() -> RedisSettings:
    # Prefer a full DSN (managed Redis / Render Key Value); else host/port (local).
    if settings.REDIS_URL:
        return RedisSettings.from_dsn(settings.REDIS_URL)
    return RedisSettings(host=settings.REDIS_HOST, port=settings.REDIS_PORT)


def enqueue(func_name: str, *args, defer_seconds: int = 0) -> None:
    async def _run() -> None:
        redis = await create_pool(redis_settings())
        try:
            await redis.enqueue_job(
                func_name, *args, _defer_by=timedelta(seconds=defer_seconds)
            )
        finally:
            try:
                await redis.aclose()
            except AttributeError:  # older redis-py
                await redis.close()

    asyncio.run(_run())
