from __future__ import annotations

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services import mpesa
from app.services import orders as order_service

router = APIRouter()


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
    if cid:
        payment = order_service.lock_payment_by_cid(db, cid)
        if payment:
            if result["success"]:
                order_service.mark_paid(db, payment, result.get("receipt"), body)
            else:
                order_service.mark_failed(db, payment, body)
            db.commit()
    return {"ResultCode": 0, "ResultDesc": "Accepted"}
