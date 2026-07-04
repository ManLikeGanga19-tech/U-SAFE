from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.queue import enqueue
from app.models.commerce import Order, Payment, PaymentProvider, PaymentStatus
from app.schemas.order import (
    CheckoutIn,
    CheckoutResult,
    OrderLineOut,
    OrderOut,
    PaymentOut,
)
from app.services import cart as cart_service
from app.services import mpesa
from app.services import orders as order_service

router = APIRouter()


def serialize_order(db: Session, order: Order) -> OrderOut:
    payment = db.scalar(
        select(Payment)
        .where(Payment.order_id == order.id)
        .order_by(Payment.created_at.desc())
    )
    return OrderOut(
        id=order.id,
        number=order.number,
        status=order.status,
        subtotal_kes=float(order.subtotal_kes),
        total_kes=float(order.total_kes),
        contact_name=order.contact_name,
        contact_phone=order.contact_phone,
        contact_email=order.contact_email,
        shipping_address=order.shipping_address,
        items=[
            OrderLineOut(
                sku=i.sku,
                name=i.name,
                unit_price_kes=float(i.unit_price_kes),
                quantity=i.quantity,
                line_total_kes=float(i.unit_price_kes) * i.quantity,
            )
            for i in order.items
        ],
        payment=PaymentOut(
            provider=payment.provider.value,
            status=payment.status,
            amount_kes=float(payment.amount_kes),
            checkout_request_id=payment.checkout_request_id,
            mpesa_receipt=payment.mpesa_receipt,
        )
        if payment
        else None,
        created_at=order.created_at,
    )


@router.post("/checkout", response_model=CheckoutResult)
def checkout(
    payload: CheckoutIn,
    db: Session = Depends(get_db),
    x_cart_token: str | None = Header(default=None),
) -> CheckoutResult:
    cart = cart_service.get_by_token(db, x_cart_token)
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")

    try:
        order = order_service.create_from_cart(
            db,
            cart,
            contact_name=payload.contact.name,
            contact_email=str(payload.contact.email),
            contact_phone=payload.contact.phone,
            shipping_address=payload.shipping_address,
        )
    except order_service.StockError as exc:
        raise HTTPException(status_code=409, detail=exc.message)

    amount = max(1, int(round(float(order.total_kes))))
    payment = Payment(
        order_id=order.id,
        provider=PaymentProvider.mpesa,
        status=PaymentStatus.pending,
        amount_kes=order.total_kes,
    )
    db.add(payment)
    db.flush()

    try:
        push = mpesa.initiate_stk_push(
            phone=payload.mpesa_phone,
            amount=amount,
            account_ref=order.number,
            description=f"USAFE {order.number}",
        )
    except mpesa.MpesaError as exc:
        db.rollback()
        raise HTTPException(status_code=502, detail=f"M-Pesa error: {exc}")

    payment.checkout_request_id = push["checkout_request_id"]
    db.commit()

    # In mock mode, simulate the customer confirming on their phone.
    if settings.MPESA_MODE == "mock":
        msisdn = mpesa.normalize_phone(payload.mpesa_phone)
        success = not msisdn.endswith("0")  # phones ending in 0 simulate failure
        enqueue(
            "process_mock_payment",
            str(payment.id),
            success,
            defer_seconds=settings.MPESA_MOCK_DELAY,
        )

    return CheckoutResult(
        order_id=order.id,
        order_number=order.number,
        checkout_request_id=payment.checkout_request_id,
        status=order.status,
        message=push["message"],
    )


@router.get("/orders/{number}", response_model=OrderOut)
def get_order(number: str, db: Session = Depends(get_db)) -> OrderOut:
    order = db.scalar(select(Order).where(Order.number == number))
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return serialize_order(db, order)
