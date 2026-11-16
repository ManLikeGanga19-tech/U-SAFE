from __future__ import annotations

import logging
from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.queue import enqueue
from app.models.commerce import (
    Fulfilment,
    Order,
    Payment,
    PaymentMethod,
    PaymentProvider,
    PaymentStatus,
)
from app.schemas.order import (
    CheckoutIn,
    CheckoutOptions,
    CheckoutResult,
    OrderLineOut,
    OrderOut,
    PaymentMethodOption,
    PaymentOut,
    PaymentReferenceIn,
    RetryPaymentIn,
)
from app.services import cart as cart_service
from app.services import mpesa
from app.services import orders as order_service

router = APIRouter()
log = logging.getLogger(__name__)


def serialize_order(db: Session, order: Order, *, public: bool = False) -> OrderOut:
    """public=True hides internal payment references from the storefront."""
    payment = order_service.latest_payment(db, order)
    return OrderOut(
        id=order.id,
        number=order.number,
        status=order.status,
        subtotal_kes=float(order.subtotal_kes),
        vat_kes=float(order.vat_kes or 0),
        vat_rate=settings.VAT_RATE if float(order.vat_kes or 0) else 0,
        total_kes=float(order.total_kes),
        fulfilment=order.fulfilment,
        payment_method=order.payment_method,
        payment_reference=order.payment_reference,
        payment_instructions=order_service.payment_instructions(order),
        pickup_address=settings.PICKUP_ADDRESS
        if order.fulfilment == Fulfilment.pickup.value
        else None,
        contact_name=order.contact_name,
        contact_phone=order.contact_phone,
        contact_email=order.contact_email,
        company_name=order.company_name,
        kra_pin=order.kra_pin,
        po_number=order.po_number,
        shipping_address=order.shipping_address or {},
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
            checkout_request_id=None if public else payment.checkout_request_id,
            mpesa_receipt=payment.mpesa_receipt,
        )
        if payment
        else None,
        can_retry_payment=order_service.can_retry_payment(db, order),
        created_at=order.created_at,
    )


def _start_payment(db: Session, order: Order, phone: str) -> tuple[Payment, str]:
    """Create a pending Payment and fire the STK push. Commits on success;
    rolls back and raises HTTPException(502) if Daraja refuses."""
    # M-Pesa takes whole shillings; round half up (VAT can produce cents).
    amount = max(1, int(Decimal(str(order.total_kes)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)))
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
            phone=phone,
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
        msisdn = mpesa.normalize_phone(phone)
        success = not msisdn.endswith("0")  # phones ending in 0 simulate failure
        try:
            enqueue(
                "process_mock_payment",
                str(payment.id),
                success,
                defer_seconds=settings.MPESA_MOCK_DELAY,
            )
        except Exception:  # noqa: BLE001 — order is committed; reconcile settles it
            log.exception("mock payment enqueue failed for %s", order.number)

    return payment, push["message"]


def _require_valid_phone(phone: str) -> None:
    if not mpesa.is_valid_msisdn(phone):
        raise HTTPException(
            status_code=422,
            detail="Enter a valid Safaricom M-Pesa number, e.g. 07XX XXX XXX",
        )


@router.post("/checkout", response_model=CheckoutResult)
def checkout(
    payload: CheckoutIn,
    db: Session = Depends(get_db),
    x_cart_token: str | None = Header(default=None),
) -> CheckoutResult:
    method = payload.payment_method
    if method not in order_service.enabled_payment_methods():
        raise HTTPException(status_code=422, detail="That payment option isn't available")
    if method == PaymentMethod.mpesa_stk:
        _require_valid_phone(payload.mpesa_phone or "")

    cart = cart_service.get_by_token(db, x_cart_token)
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")

    company = payload.company
    try:
        order = order_service.create_from_cart(
            db,
            cart,
            contact_name=payload.contact.name,
            contact_email=str(payload.contact.email),
            contact_phone=payload.contact.phone,
            shipping_address=payload.shipping_address,
            fulfilment=payload.fulfilment,
            payment_method=method,
            company_name=company.name if company else None,
            kra_pin=company.kra_pin if company else None,
            po_number=company.po_number if company else None,
        )
    except order_service.StockError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=exc.message)

    if method == PaymentMethod.mpesa_stk:
        payment, message = _start_payment(db, order, payload.mpesa_phone or "")
        cid = payment.checkout_request_id
    else:
        # Paybill / bank: stock is held until payment_due_at; staff confirm.
        db.commit()
        cid = None
        message = (
            f"Order placed. Pay KES {float(order.total_kes):,.2f} quoting "
            f"{order.number} as the reference."
        )

    return CheckoutResult(
        order_id=order.id,
        order_number=order.number,
        checkout_request_id=cid,
        status=order.status,
        payment_method=method,
        message=message,
    )


_METHOD_COPY = {
    PaymentMethod.mpesa_stk: (
        "M-Pesa (prompt on your phone)",
        "We send a payment request to your phone. Enter your PIN to confirm.",
    ),
    PaymentMethod.mpesa_paybill: (
        "M-Pesa Paybill",
        "Pay via Lipa na M-Pesa → Paybill using your order number as the account.",
    ),
    PaymentMethod.bank_transfer: (
        "Bank transfer / invoice",
        "Transfer to our bank account using your order number as the reference.",
    ),
}


@router.get("/checkout/options", response_model=CheckoutOptions)
def checkout_options() -> CheckoutOptions:
    """What the checkout page should offer (driven by server config)."""
    return CheckoutOptions(
        vat_rate=settings.VAT_RATE,
        pickup_address=settings.PICKUP_ADDRESS,
        pickup_hours=settings.PICKUP_HOURS or None,
        manual_hold_days=settings.MANUAL_PAYMENT_HOLD_DAYS,
        payment_methods=[
            PaymentMethodOption(id=m, label=_METHOD_COPY[m][0], description=_METHOD_COPY[m][1])
            for m in order_service.enabled_payment_methods()
        ],
    )


@router.get("/orders/{number}", response_model=OrderOut)
def get_order(number: str, db: Session = Depends(get_db)) -> OrderOut:
    order = db.scalar(select(Order).where(Order.number == number))
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return serialize_order(db, order, public=True)


@router.post("/orders/{number}/retry-payment", response_model=CheckoutResult)
def retry_payment(
    number: str, payload: RetryPaymentIn, db: Session = Depends(get_db)
) -> CheckoutResult:
    """Re-send the STK push for an unpaid order whose last attempt failed
    (customer cancelled, wrong PIN, timed out…). Re-reserves stock first."""
    _require_valid_phone(payload.mpesa_phone)
    order = db.scalar(select(Order).where(Order.number == number).with_for_update())
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not order_service.can_retry_payment(db, order):
        raise HTTPException(
            status_code=409, detail="This order isn't awaiting a new payment"
        )
    try:
        order_service.reserve_stock(db, order, check=True)
    except order_service.StockError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=exc.message)

    payment, message = _start_payment(db, order, payload.mpesa_phone)
    return CheckoutResult(
        order_id=order.id,
        order_number=order.number,
        checkout_request_id=payment.checkout_request_id,
        status=order.status,
        message=message,
    )


@router.post("/orders/{number}/payment-reference", response_model=OrderOut)
def submit_payment_reference(
    number: str, payload: PaymentReferenceIn, db: Session = Depends(get_db)
) -> OrderOut:
    """Customer reports the M-Pesa / bank transaction code for a manual
    payment, so staff can match it. Doesn't mark the order paid by itself."""
    order = db.scalar(select(Order).where(Order.number == number).with_for_update())
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    try:
        order_service.set_payment_reference(db, order, payload.reference)
    except order_service.OrderTransitionError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=exc.message)
    db.commit()
    return serialize_order(db, order, public=True)
