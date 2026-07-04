from __future__ import annotations

import uuid

from pydantic import BaseModel, Field


class CartItemIn(BaseModel):
    variant_id: uuid.UUID
    quantity: int = Field(default=1, ge=1, le=999)


class CartItemUpdate(BaseModel):
    quantity: int = Field(ge=1, le=999)


class CartLineOut(BaseModel):
    id: uuid.UUID
    variant_id: uuid.UUID
    sku: str
    product_name: str
    product_slug: str
    variant_name: str | None
    image_url: str | None
    unit_price_kes: float
    quantity: int
    line_total_kes: float
    available: int


class CartOut(BaseModel):
    token: str
    items: list[CartLineOut]
    item_count: int
    subtotal_kes: float
