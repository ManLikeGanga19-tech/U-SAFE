"""B2B quote lifecycle: request → price → accept, with PDF generation."""
from __future__ import annotations

import secrets

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.catalog import ProductVariant
from app.models.commerce import CartItem, Quote, QuoteItem, QuoteStatus
from app.schemas.quote import QuoteLineOut, QuoteOut, QuoteRequestIn


def gen_quote_number(db: Session) -> str:
    while True:
        number = "QUO-" + secrets.token_hex(4).upper()
        if not db.scalar(select(Quote).where(Quote.number == number)):
            return number


def create_from_request(db: Session, payload: QuoteRequestIn) -> Quote:
    quote = Quote(
        number=gen_quote_number(db),
        status=QuoteStatus.requested,
        company_name=payload.company_name,
        contact_name=payload.contact.name,
        contact_email=str(payload.contact.email),
        contact_phone=payload.contact.phone,
        message=payload.message,
    )
    db.add(quote)
    db.flush()

    # Explicit items first.
    for item in payload.items:
        db.add(
            QuoteItem(
                quote_id=quote.id,
                variant_id=item.variant_id,
                description=item.description,
                quantity=item.quantity,
            )
        )

    # Optionally fold in a cart's contents.
    if payload.cart_token:
        from app.models.commerce import Cart

        cart = db.scalar(select(Cart).where(Cart.session_token == payload.cart_token))
        if cart:
            for ci in db.scalars(select(CartItem).where(CartItem.cart_id == cart.id)):
                variant = db.get(ProductVariant, ci.variant_id)
                if not variant:
                    continue
                name = variant.product.name + (f" — {variant.name}" if variant.name else "")
                db.add(
                    QuoteItem(
                        quote_id=quote.id,
                        variant_id=variant.id,
                        description=name,
                        quantity=ci.quantity,
                    )
                )

    db.flush()
    return quote


def apply_prices(db: Session, quote: Quote, prices: dict) -> None:
    """prices: {item_id: unit_price}. Sets line prices, recomputes total, marks priced."""
    items = list(db.scalars(select(QuoteItem).where(QuoteItem.quote_id == quote.id)))
    total = 0.0
    for it in items:
        if it.id in prices:
            it.unit_price_kes = prices[it.id]
        if it.unit_price_kes is not None:
            total += float(it.unit_price_kes) * it.quantity
    quote.total_kes = total
    if quote.status == QuoteStatus.requested:
        quote.status = QuoteStatus.priced
    db.flush()


def serialize(db: Session, quote: Quote) -> QuoteOut:
    items = list(
        db.scalars(
            select(QuoteItem).where(QuoteItem.quote_id == quote.id).order_by(QuoteItem.created_at)
        )
    )
    lines = []
    for it in items:
        sku = None
        if it.variant_id:
            v = db.get(ProductVariant, it.variant_id)
            sku = v.sku if v else None
        unit = float(it.unit_price_kes) if it.unit_price_kes is not None else None
        lines.append(
            QuoteLineOut(
                id=it.id,
                description=it.description,
                sku=sku,
                quantity=it.quantity,
                unit_price_kes=unit,
                line_total_kes=unit * it.quantity if unit is not None else None,
            )
        )
    return QuoteOut(
        id=quote.id,
        number=quote.number,
        status=quote.status,
        company_name=quote.company_name,
        contact_name=quote.contact_name,
        contact_email=quote.contact_email,
        contact_phone=quote.contact_phone,
        message=quote.message,
        items=lines,
        total_kes=float(quote.total_kes) if quote.total_kes is not None else None,
        pdf_url=quote.pdf_url,
        created_at=quote.created_at,
    )


def item_count(db: Session, quote: Quote) -> int:
    return (
        db.scalar(select(func.count()).select_from(QuoteItem).where(QuoteItem.quote_id == quote.id))
        or 0
    )
