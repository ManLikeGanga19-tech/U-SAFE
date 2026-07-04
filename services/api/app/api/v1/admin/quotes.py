from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import require_staff
from app.core.database import get_db
from app.models.commerce import Quote, QuoteItem, QuoteStatus
from app.models.user import User
from app.schemas.common import Page
from app.schemas.quote import (
    QuoteAdminListItem,
    QuoteOut,
    QuotePriceIn,
    QuoteStatusUpdate,
)
from app.services import audit, media
from app.services import quotes as quote_service
from app.services.pdf import build_quote_pdf

router = APIRouter()


@router.get("", response_model=Page[QuoteAdminListItem])
def list_quotes(
    db: Session = Depends(get_db),
    status: QuoteStatus | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> Page[QuoteAdminListItem]:
    filters = []
    if status:
        filters.append(Quote.status == status)
    total = db.scalar(select(func.count()).select_from(Quote).where(*filters)) or 0
    rows = list(
        db.scalars(
            select(Quote)
            .where(*filters)
            .options(selectinload(Quote.items))
            .order_by(Quote.created_at.desc())
            .limit(page_size)
            .offset((page - 1) * page_size)
        )
    )
    items = [
        QuoteAdminListItem(
            id=q.id,
            number=q.number,
            status=q.status,
            company_name=q.company_name,
            contact_name=q.contact_name,
            item_count=len(q.items),
            total_kes=float(q.total_kes) if q.total_kes is not None else None,
            created_at=q.created_at,
        )
        for q in rows
    ]
    return Page.build(items, total, page, page_size)


def _load(db: Session, quote_id: uuid.UUID) -> Quote:
    quote = db.get(Quote, quote_id)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return quote


@router.get("/{quote_id}", response_model=QuoteOut)
def get_quote(quote_id: uuid.UUID, db: Session = Depends(get_db)) -> QuoteOut:
    return quote_service.serialize(db, _load(db, quote_id))


@router.post("/{quote_id}/price", response_model=QuoteOut)
def price_quote(
    quote_id: uuid.UUID,
    payload: QuotePriceIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_staff),
) -> QuoteOut:
    quote = _load(db, quote_id)
    prices = {line.item_id: line.unit_price_kes for line in payload.lines}
    quote_service.apply_prices(db, quote, prices)
    audit.record(db, actor, "quote.price", "quote", quote.id, {"total": float(quote.total_kes or 0)})
    db.commit()
    return quote_service.serialize(db, quote)


@router.post("/{quote_id}/pdf", response_model=QuoteOut)
def generate_pdf(
    quote_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: User = Depends(require_staff),
) -> QuoteOut:
    quote = _load(db, quote_id)
    data = quote_service.serialize(db, quote)
    lines = [
        {
            "description": ln.description,
            "sku": ln.sku,
            "quantity": ln.quantity,
            "unit_price_kes": ln.unit_price_kes,
            "line_total_kes": ln.line_total_kes,
        }
        for ln in data.items
    ]
    try:
        pdf_bytes = build_quote_pdf(quote, lines)
        url = media.upload_bytes(pdf_bytes, "application/pdf", "quotes", "pdf")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"PDF generation failed: {exc}")
    quote.pdf_url = url
    audit.record(db, actor, "quote.pdf", "quote", quote.id, {"url": url})
    db.commit()
    return quote_service.serialize(db, quote)


@router.patch("/{quote_id}", response_model=QuoteOut)
def update_status(
    quote_id: uuid.UUID,
    payload: QuoteStatusUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_staff),
) -> QuoteOut:
    quote = _load(db, quote_id)
    quote.status = payload.status
    audit.record(db, actor, "quote.status", "quote", quote.id, {"status": payload.status.value})
    db.commit()
    return quote_service.serialize(db, quote)
