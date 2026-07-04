from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.commerce import QuoteStatus


class QuoteItemIn(BaseModel):
    variant_id: uuid.UUID | None = None
    description: str = Field(min_length=1, max_length=240)
    quantity: int = Field(ge=1, le=100000)


class QuoteContact(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    email: EmailStr
    phone: str | None = None


class QuoteRequestIn(BaseModel):
    company_name: str | None = None
    contact: QuoteContact
    message: str | None = None
    items: list[QuoteItemIn] = Field(default_factory=list)
    cart_token: str | None = None  # pull items from a cart if provided


class QuoteLineOut(BaseModel):
    id: uuid.UUID
    description: str
    sku: str | None = None
    quantity: int
    unit_price_kes: float | None = None
    line_total_kes: float | None = None


class QuoteOut(BaseModel):
    id: uuid.UUID
    number: str
    status: QuoteStatus
    company_name: str | None
    contact_name: str | None
    contact_email: str | None
    contact_phone: str | None
    message: str | None
    items: list[QuoteLineOut]
    total_kes: float | None
    pdf_url: str | None
    created_at: datetime


class QuoteAdminListItem(BaseModel):
    id: uuid.UUID
    number: str
    status: QuoteStatus
    company_name: str | None
    contact_name: str | None
    item_count: int
    total_kes: float | None
    created_at: datetime


# ── Admin actions ──
class QuoteLinePrice(BaseModel):
    item_id: uuid.UUID
    unit_price_kes: float = Field(ge=0)


class QuotePriceIn(BaseModel):
    lines: list[QuoteLinePrice]


class QuoteStatusUpdate(BaseModel):
    status: QuoteStatus
