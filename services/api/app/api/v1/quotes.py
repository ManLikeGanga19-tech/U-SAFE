from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.commerce import Quote, QuoteStatus
from app.schemas.quote import QuoteOut, QuoteRequestIn
from app.services import quotes as quote_service

router = APIRouter()


@router.post("", response_model=QuoteOut, status_code=201)
def request_quote(payload: QuoteRequestIn, db: Session = Depends(get_db)) -> QuoteOut:
    if not payload.items and not payload.cart_token:
        raise HTTPException(status_code=400, detail="Add at least one item or a cart")
    quote = quote_service.create_from_request(db, payload)
    if quote_service.item_count(db, quote) == 0:
        db.rollback()
        raise HTTPException(status_code=400, detail="No valid items to quote")
    db.commit()
    return quote_service.serialize(db, quote)


@router.get("/{number}", response_model=QuoteOut)
def get_quote(number: str, db: Session = Depends(get_db)) -> QuoteOut:
    quote = db.scalar(select(Quote).where(Quote.number == number))
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return quote_service.serialize(db, quote)


@router.post("/{number}/accept", response_model=QuoteOut)
def accept_quote(number: str, db: Session = Depends(get_db)) -> QuoteOut:
    quote = db.scalar(select(Quote).where(Quote.number == number))
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    if quote.status != QuoteStatus.priced:
        raise HTTPException(
            status_code=409, detail="Only a priced quote can be accepted"
        )
    quote.status = QuoteStatus.accepted
    db.commit()
    return quote_service.serialize(db, quote)
