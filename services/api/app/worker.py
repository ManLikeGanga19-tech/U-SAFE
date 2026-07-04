"""ARQ background worker.

Jobs:
  - process_mock_payment: simulates a customer confirming an M-Pesa STK push
    (dev mock mode) after a delay, driving the same order/stock code path as a
    real Daraja callback.
  - reconcile_pending: safety net that re-checks stale pending payments. In mock
    mode it force-confirms anything left hanging; in live mode this is where a
    Daraja STK-query would go.
"""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from arq.connections import RedisSettings
from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.commerce import Payment, PaymentStatus
from app.services import orders as order_service


async def healthcheck(ctx: dict) -> str:
    return "ok"


async def process_mock_payment(ctx: dict, payment_id: str, success: bool) -> str:
    db = SessionLocal()
    try:
        payment = order_service.lock_payment(db, uuid.UUID(payment_id))
        if not payment:
            return "payment-not-found"
        if success:
            receipt = "MOCK" + secrets.token_hex(4).upper()
            order_service.mark_paid(db, payment, receipt, {"mock": True, "success": True})
            result = "paid"
        else:
            order_service.mark_failed(db, payment, {"mock": True, "success": False})
            result = "failed"
        db.commit()
        return result
    finally:
        db.close()


async def reconcile_pending(ctx: dict) -> str:
    """Confirm/settle payments stuck in pending for too long."""
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=5)
        stale = list(
            db.scalars(
                select(Payment)
                .where(
                    Payment.status == PaymentStatus.pending,
                    Payment.created_at < cutoff,
                )
                .with_for_update()
            )
        )
        for payment in stale:
            if settings.MPESA_MODE == "mock":
                order_service.mark_paid(
                    db, payment, "MOCK-RECON", {"mock": True, "reconciled": True}
                )
        db.commit()
        return f"reconciled={len(stale)}"
    finally:
        db.close()


class WorkerSettings:
    functions = [healthcheck, process_mock_payment, reconcile_pending]
    redis_settings = RedisSettings(host=settings.REDIS_HOST, port=settings.REDIS_PORT)
