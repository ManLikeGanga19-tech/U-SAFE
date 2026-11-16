"""Order lifecycle: create from cart, reserve stock, mark paid/failed.

Stock model
-----------
Stock is RESERVED at checkout (a negative `sale` movement referencing the order
number), so two customers can't both pay for the last unit. If the payment
fails the reservation is released; if it succeeds the reservation simply
becomes the sale. The ledger is the source of truth for "does this order hold
stock?": the net sum of movements referencing the order number.

Every transition is idempotent so repeated Daraja callbacks, reconcile runs and
admin clicks are safe.
"""
from __future__ import annotations

import secrets
import uuid
from collections import defaultdict

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.catalog import ProductStatus, ProductVariant
from app.models.commerce import (
    Cart,
    CartItem,
    Order,
    OrderItem,
    OrderStatus,
    Payment,
    PaymentStatus,
)
from app.models.inventory import InventoryItem, StockMovement, StockReason
from app.models.user import User
from app.services import inventory


class StockError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class OrderTransitionError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


# Admin-driven status transitions. Anything not listed is rejected.
ALLOWED_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.pending: {OrderStatus.paid, OrderStatus.cancelled},
    OrderStatus.paid: {
        OrderStatus.processing,
        OrderStatus.fulfilled,
        OrderStatus.cancelled,
        OrderStatus.refunded,
    },
    OrderStatus.processing: {
        OrderStatus.fulfilled,
        OrderStatus.cancelled,
        OrderStatus.refunded,
    },
    OrderStatus.fulfilled: {OrderStatus.refunded},
    OrderStatus.cancelled: set(),
    OrderStatus.refunded: set(),
}


def gen_order_number(db: Session) -> str:
    while True:
        number = "USF-" + secrets.token_hex(4).upper()
        if not db.scalar(select(Order).where(Order.number == number)):
            return number


# ── Stock reservation (ledger-backed, idempotent) ─────────
def _held_by_variant(db: Session, order: Order) -> dict[uuid.UUID, int]:
    """Units this order currently holds, per variant (positive numbers)."""
    rows = db.execute(
        select(StockMovement.variant_id, func.sum(StockMovement.delta))
        .where(StockMovement.reference == order.number)
        .group_by(StockMovement.variant_id)
    ).all()
    return {vid: -int(total) for vid, total in rows if total and total < 0}


def holds_stock(db: Session, order: Order) -> bool:
    return bool(_held_by_variant(db, order))


def _lock_inventory(db: Session, variant_ids) -> dict[uuid.UUID, InventoryItem]:
    """Row-lock inventory for these variants, in a stable order (no deadlocks)."""
    ids = sorted(set(variant_ids), key=str)
    if not ids:
        return {}
    rows = db.scalars(
        select(InventoryItem)
        .where(InventoryItem.variant_id.in_(ids))
        .order_by(InventoryItem.variant_id)
        .with_for_update()
    )
    return {r.variant_id: r for r in rows}


def reserve_stock(db: Session, order: Order, *, check: bool = True) -> None:
    """Take this order's units out of stock, once.

    check=True refuses (StockError) if any line can't be covered — used at
    checkout and on payment retry. check=False is used when money has already
    been received, where recording the sale matters more than the count.
    """
    if holds_stock(db, order):
        return
    wanted: dict[uuid.UUID, int] = defaultdict(int)
    names: dict[uuid.UUID, str] = {}
    for item in order.items:
        if item.variant_id:
            wanted[item.variant_id] += item.quantity
            names[item.variant_id] = item.name
    locked = _lock_inventory(db, wanted)
    if check:
        for vid, qty in wanted.items():
            available = locked[vid].quantity_on_hand if vid in locked else 0
            if qty > available:
                raise StockError(
                    f"Insufficient stock for {names[vid]} "
                    f"({available} available, {qty} requested)"
                )
    for vid, qty in wanted.items():
        inventory.adjust(
            db,
            vid,
            -qty,
            reason=StockReason.sale,
            reference=order.number,
            note="Reserved for order",
        )


def release_stock(
    db: Session,
    order: Order,
    *,
    reason: StockReason = StockReason.adjustment,
    note: str = "Reservation released",
    actor: User | None = None,
) -> None:
    """Put back whatever this order holds, once."""
    held = _held_by_variant(db, order)
    _lock_inventory(db, held)
    for vid, qty in held.items():
        inventory.adjust(
            db, vid, qty, reason=reason, reference=order.number, note=note, actor=actor
        )


# ── Checkout ──────────────────────────────────────────────
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
        if (
            not variant
            or not variant.is_active
            or variant.product.status != ProductStatus.published
        ):
            raise StockError("A product in your cart is no longer available")
        price = float(variant.price_kes)
        subtotal += price * it.quantity
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
    db.flush()
    db.refresh(order, attribute_names=["items"])

    # Locks inventory rows and raises StockError if anything ran out meanwhile.
    reserve_stock(db, order, check=True)

    # Consume the cart so it can't be re-checked-out. A failed payment is retried
    # against the ORDER (see retry_payment), so nothing is lost.
    for it in items:
        db.delete(it)

    db.flush()
    return order


# ── Payment outcomes ──────────────────────────────────────
def mark_paid(db: Session, payment: Payment, receipt: str | None, raw: dict) -> None:
    """Confirm payment, flip order to paid, make sure stock is taken — once.

    A payment may only transition out of `pending`, so any repeated or concurrent
    callback (Daraja retries, reconcile races) is a no-op. Callers MUST have
    row-locked the payment (SELECT ... FOR UPDATE) so the pending check is
    serialized.
    """
    if payment.status != PaymentStatus.pending:
        return
    payment.status = PaymentStatus.success
    payment.mpesa_receipt = receipt
    payment.raw_callback = raw

    order = db.get(Order, payment.order_id)
    if order and order.status == OrderStatus.pending:
        order.status = OrderStatus.paid
        # Normally already reserved at checkout. Covers orders created before
        # reservations existed, and a late success after a release.
        reserve_stock(db, order, check=False)
    db.flush()


def mark_failed(db: Session, payment: Payment, raw: dict) -> None:
    """Only a pending payment can fail; never override a success.

    The order stays `pending` (the customer can retry), but its stock goes back
    on the shelf unless another payment for it is still in flight.
    """
    if payment.status != PaymentStatus.pending:
        return
    payment.status = PaymentStatus.failed
    payment.raw_callback = raw
    db.flush()

    order = db.get(Order, payment.order_id)
    if order and order.status == OrderStatus.pending:
        other_live = db.scalar(
            select(func.count())
            .select_from(Payment)
            .where(
                Payment.order_id == order.id,
                Payment.id != payment.id,
                Payment.status.in_([PaymentStatus.pending, PaymentStatus.success]),
            )
        )
        if not other_live:
            release_stock(db, order, note="Payment failed")
    db.flush()


def latest_payment(db: Session, order: Order) -> Payment | None:
    return db.scalar(
        select(Payment)
        .where(Payment.order_id == order.id)
        .order_by(Payment.created_at.desc(), Payment.id.desc())
        .limit(1)
    )


def can_retry_payment(db: Session, order: Order) -> bool:
    if order.status != OrderStatus.pending:
        return False
    last = latest_payment(db, order)
    return last is None or last.status == PaymentStatus.failed


# ── Admin status changes ──────────────────────────────────
def set_status(
    db: Session, order: Order, new: OrderStatus, actor: User | None = None
) -> None:
    old = order.status
    if new == old:
        return
    if new not in ALLOWED_TRANSITIONS[old]:
        raise OrderTransitionError(f"Can't change an order from {old.value} to {new.value}")

    if new == OrderStatus.paid:
        # Staff confirming an offline/manual payment: make sure stock is taken.
        reserve_stock(db, order, check=False)
    elif new == OrderStatus.cancelled:
        release_stock(db, order, note="Order cancelled", actor=actor)
    elif new == OrderStatus.refunded and old != OrderStatus.fulfilled:
        # Never shipped → goods are still here. (A refund after fulfilment only
        # restocks if staff record the return via inventory adjust.)
        release_stock(
            db, order, reason=StockReason.return_, note="Order refunded", actor=actor
        )
    order.status = new
    db.flush()


# ── Locking helpers ───────────────────────────────────────
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
