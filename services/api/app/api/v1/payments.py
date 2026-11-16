from __future__ import annotations

import logging

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.services import mpesa
from app.services import orders as order_service

router = APIRouter()
log = logging.getLogger(__name__)


def settle_payment(db: Session, payment, *, receipt: str | None, raw: dict) -> str:
    """Settle a row-locked pending payment from Daraja's authoritative status.

    The callback endpoint is public, so its body is only a HINT that something
    happened: anyone who learns a CheckoutRequestID could post a fake
    "ResultCode 0". We therefore ask Daraja (STK Query) what really happened and
    act on that. Returns "paid" | "failed" | "pending".
    """
    try:
        status = mpesa.query_stk_status(payment.checkout_request_id)
    except mpesa.MpesaError as exc:
        log.warning("STK query failed for %s: %s", payment.checkout_request_id, exc)
        return "pending"  # reconcile job will retry

    raw = {**raw, "stk_query": status}
    if status["state"] == "success":
        order_service.mark_paid(db, payment, receipt, raw)
        return "paid"
    if status["state"] == "failed":
        order_service.mark_failed(db, payment, raw)
        return "failed"
    # Not settled yet: keep the callback (it carries the receipt number, which
    # STK Query doesn't return) so the reconcile job can use it later.
    if raw:
        payment.raw_callback = raw
    return "pending"


@router.post("/mpesa/callback")
def mpesa_callback(body: dict = Body(...), db: Session = Depends(get_db)) -> dict:
    """Daraja STK callback.

    Sync endpoint (runs in the threadpool) so the row-lock below doesn't block
    the event loop. Idempotent: the payment is fetched FOR UPDATE and only a
    still-`pending` payment is acted on, so Daraja retries are safe no-ops.
    Always ACK with ResultCode 0 so Daraja stops retrying.
    """
    result = mpesa.parse_callback(body)
    cid = result.get("checkout_request_id")
    if not cid:
        return {"ResultCode": 0, "ResultDesc": "Accepted"}

    payment = order_service.lock_payment_by_cid(db, cid)
    if payment is None or payment.status.value != "pending":
        db.rollback()
        return {"ResultCode": 0, "ResultDesc": "Accepted"}

    if settings.MPESA_MODE == "mock":
        # Local simulator only — there's no Daraja to verify against.
        if result["success"]:
            order_service.mark_paid(db, payment, result.get("receipt"), body)
        else:
            order_service.mark_failed(db, payment, body)
    else:
        settle_payment(db, payment, receipt=result.get("receipt"), raw=body)
    db.commit()
    return {"ResultCode": 0, "ResultDesc": "Accepted"}
