"""Server-authoritative cart, keyed by an opaque token (Cart.session_token)."""
from __future__ import annotations

import secrets
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.catalog import ProductVariant
from app.models.commerce import Cart, CartItem
from app.models.inventory import InventoryItem
from app.schemas.cart import CartLineOut, CartOut


def new_token() -> str:
    return secrets.token_urlsafe(24)


def get_by_token(db: Session, token: str | None) -> Cart | None:
    if not token:
        return None
    return db.scalar(
        select(Cart)
        .where(Cart.session_token == token)
        .options(selectinload(Cart.items))
    )


def get_or_create(db: Session, token: str | None) -> Cart:
    cart = get_by_token(db, token)
    if cart:
        return cart
    cart = Cart(session_token=new_token())
    db.add(cart)
    db.flush()
    return cart


def add_item(db: Session, cart: Cart, variant_id: uuid.UUID, quantity: int) -> None:
    variant = db.get(ProductVariant, variant_id)
    if not variant or not variant.is_active:
        raise ValueError("Variant not available")
    existing = db.scalar(
        select(CartItem).where(
            CartItem.cart_id == cart.id, CartItem.variant_id == variant_id
        )
    )
    if existing:
        existing.quantity = min(999, existing.quantity + quantity)
    else:
        db.add(CartItem(cart_id=cart.id, variant_id=variant_id, quantity=quantity))
    db.flush()


def serialize(db: Session, cart: Cart) -> CartOut:
    items = list(
        db.scalars(
            select(CartItem).where(CartItem.cart_id == cart.id).order_by(CartItem.created_at)
        )
    )
    lines: list[CartLineOut] = []
    subtotal = 0.0
    for it in items:
        variant = db.get(ProductVariant, it.variant_id)
        if not variant:
            continue
        product = variant.product
        inv = db.scalar(
            select(InventoryItem).where(InventoryItem.variant_id == variant.id)
        )
        price = float(variant.price_kes)
        line_total = price * it.quantity
        subtotal += line_total
        image = product.images[0]["url"] if product.images else None
        lines.append(
            CartLineOut(
                id=it.id,
                variant_id=variant.id,
                sku=variant.sku,
                product_name=product.name,
                product_slug=product.slug,
                variant_name=variant.name,
                image_url=image,
                unit_price_kes=price,
                quantity=it.quantity,
                line_total_kes=line_total,
                available=inv.quantity_on_hand if inv else 0,
            )
        )
    return CartOut(
        token=cart.session_token or "",
        items=lines,
        item_count=sum(line.quantity for line in lines),
        subtotal_kes=subtotal,
    )
