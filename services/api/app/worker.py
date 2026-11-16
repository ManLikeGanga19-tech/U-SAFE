"""ARQ background worker.

Jobs:
  - process_mock_payment: simulates a customer confirming an M-Pesa STK push
    (dev mock mode) after a delay, driving the same order/stock code path as a
    real Daraja callback.
  - reconcile_pending (cron, every 2 min): safety net for payments whose
    callback never arrived or couldn't be verified. Sandbox/live: asks Daraja
    (STK Query) for the real outcome. Mock: force-confirms stale payments.
"""
from __future__ import annotations

import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from arq import cron
from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.queue import redis_settings
from app.models.commerce import Payment, PaymentStatus
from app.services import mpesa
from app.services import orders as order_service

log = logging.getLogger(__name__)

# STK prompts expire after ~1 min; give Daraja's own callback a head start.
RECONCILE_AFTER = timedelta(minutes=2)
RECONCILE_BATCH = 25


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


def reconcile_once(now: datetime | None = None) -> dict:
    """Settle stale pending payments. Sync so tests can call it directly.

    Each payment is handled in its own short transaction with SKIP LOCKED, so a
    concurrent callback for the same payment isn't blocked or double-applied,
    and we never hold row locks across a slow Daraja HTTP call for a batch.
    """
    from app.api.v1.payments import settle_payment  # avoid import cycle at load

    now = now or datetime.now(timezone.utc)
    cutoff = now - RECONCILE_AFTER
    counts = {"paid": 0, "failed": 0, "pending": 0}

    db = SessionLocal()
    try:
        ids = list(
            db.scalars(
                select(Payment.id)
                .where(
                    Payment.status == PaymentStatus.pending,
                    Payment.created_at < cutoff,
                    Payment.checkout_request_id.is_not(None),
                )
                .order_by(Payment.created_at)
                .limit(RECONCILE_BATCH)
            )
        )
        db.rollback()

        for pid in ids:
            payment = db.scalar(
                select(Payment)
                .where(Payment.id == pid, Payment.status == PaymentStatus.pending)
                .with_for_update(skip_locked=True)
            )
            if payment is None:
                db.rollback()
                continue
            if settings.MPESA_MODE == "mock":
                order_service.mark_paid(
                    db, payment, "MOCK-RECON", {"mock": True, "reconciled": True}
                )
                outcome = "paid"
            else:
                hint = mpesa.parse_callback(payment.raw_callback or {})
                outcome = settle_payment(
                    db,
                    payment,
                    receipt=hint.get("receipt") if hint.get("success") else None,
                    raw={**(payment.raw_callback or {}), "reconciled": True},
                )
            db.commit()
            counts[outcome] += 1
    finally:
        db.close()
    return counts


def expire_manual_once(now: datetime | None = None) -> int:
    db = SessionLocal()
    try:
        n = order_service.expire_unpaid_manual_orders(db, now)
        db.commit()
        return n
    finally:
        db.close()


async def reconcile_pending(ctx: dict) -> str:
    try:
        counts = reconcile_once()
        counts["expired"] = expire_manual_once()
    except Exception:  # noqa: BLE001 — never kill the worker; next tick retries
        log.exception("reconcile_pending failed")
        return "error"
    return ",".join(f"{k}={v}" for k, v in counts.items())


class WorkerSettings:
    functions = [healthcheck, process_mock_payment, reconcile_pending]
    cron_jobs = [cron(reconcile_pending, minute=set(range(0, 60, 2)), second=0)]
    redis_settings = redis_settings()
