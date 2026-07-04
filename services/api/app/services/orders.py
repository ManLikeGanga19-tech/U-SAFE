"""Order lifecycle: create from cart, mark paid/failed, decrement stock.

Stock is only decremented on a *successful* payment, via the event-sourced
inventory ledger. mark_paid is idempotent so repeated callbacks are safe.
"""
from __future__ import annotations

import secrets

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.commerce import (
    Cart,
    CartItem,
    Order,
    OrderItem,
    OrderStatus,
    Payment,
    PaymentStatus,
)
from app.models.catalog import ProductVariant
from app.models.inventory import InventoryItem, StockMovement, StockReason
from app.services import inventory


class StockError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def gen_order_number(db: Session) -> str:
    while True:
        number = "USF-" + secrets.token_hex(4).upper()
        if not db.scalar(select(Order).where(Order.number == number)):
            return number


def create_from_cart(
    db: Session,
    cart: Cart,
    *,
    contact_name: str,
    contact_email: str,
    contact_phone: str,
    shipping_address: dict,
) -> Order:
    items = list(db.scalars(select(CartItem).where(CartItem.cart_id == cart.id)))
    if not items:
        raise StockError("Cart is empty")

    order = Order(
        number=gen_order_number(db),
        status=OrderStatus.pending,
        contact_name=contact_name,
        contact_email=contact_email,
        contact_phone=contact_phone,
        shipping_address=shipping_address,
    )
    db.add(order)
    db.flush()

    subtotal = 0.0
    for it in items:
        variant = db.get(ProductVariant, it.variant_id)
        if not variant or not variant.is_active:
            raise StockError("A product in your cart is no longer available")
        inv = db.scalar(
            select(InventoryItem).where(InventoryItem.variant_id == variant.id)
        )
        available = inv.quantity_on_hand if inv else 0
        if it.quantity > available:
            raise StockError(
                f"Insufficient stock for {variant.product.name} "
                f"({available} available, {it.quantity} requested)"
            )
        price = float(variant.price_kes)
        line_total = price * it.quantity
        subtotal += line_total
        db.add(
            OrderItem(
                order_id=order.id,
                variant_id=variant.id,
                sku=variant.sku,
                name=variant.product.name
                + (f" — {variant.name}" if variant.name else ""),
                unit_price_kes=price,
                quantity=it.quantity,
            )
        )

    order.subtotal_kes = subtotal
    order.total_kes = subtotal  # shipping/tax added in a later phase

    # Consume the cart so it can't be re-checked-out.
    for it in items:
        db.delete(it)

    db.flush()
    return order


def mark_paid(db: Session, payment: Payment, receipt: str | None, raw: dict) -> None:
    """Confirm payment, flip order to paid, decrement stock — strictly once.

    A payment may only transition out of `pending`, so any repeated or concurrent
    callback (Daraja retries, reconcile races) is a no-op. Callers MUST have
    row-locked the payment (SELECT ... FOR UPDATE) so the pending check is
    serialized. A ledger guard is a second line of defence against double-sale.
    """
    if payment.status != PaymentStatus.pending:
        return
    payment.status = PaymentStatus.success
    payment.mpesa_receipt = receipt
    payment.raw_callback = raw

    order = db.get(Order, payment.order_id)
    if order and order.status == OrderStatus.pending:
        order.status = OrderStatus.paid
        already_sold = db.scalar(
            select(func.count())
            .select_from(StockMovement)
            .where(
                StockMovement.reference == order.number,
                StockMovement.reason == StockReason.sale,
            )
        )
        if not already_sold:
            for item in order.items:
                if item.variant_id:
                    inventory.adjust(
                        db,
                        item.variant_id,
                        -item.quantity,
                        reason=StockReason.sale,
                        reference=order.number,
                        note="Order payment",
                    )
    db.flush()


def mark_failed(db: Session, payment: Payment, raw: dict) -> None:
    """Only a pending payment can fail; never override a success."""
    if payment.status != PaymentStatus.pending:
        return
    payment.status = PaymentStatus.failed
    payment.raw_callback = raw
    db.flush()


def lock_payment_by_cid(db: Session, checkout_request_id: str) -> Payment | None:
    """Row-locked fetch by CheckoutRequestID (serializes concurrent callbacks)."""
    return db.scalar(
        select(Payment)
        .where(Payment.checkout_request_id == checkout_request_id)
        .with_for_update()
    )


def lock_payment(db: Session, payment_id) -> Payment | None:
    return db.scalar(
        select(Payment).where(Payment.id == payment_id).with_for_update()
    )


def item_count(db: Session, order: Order) -> int:
    return (
        db.scalar(
            select(func.count()).select_from(OrderItem).where(OrderItem.order_id == order.id)
        )
        or 0
    )
