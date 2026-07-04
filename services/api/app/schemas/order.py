from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.commerce import OrderStatus, PaymentStatus


class ContactIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=20)


class CheckoutIn(BaseModel):
    contact: ContactIn
    shipping_address: dict = Field(default_factory=dict)
    mpesa_phone: str = Field(description="Safaricom number, e.g. 2547XXXXXXXX or 07XXXXXXXX")


class CheckoutResult(BaseModel):
    order_id: uuid.UUID
    order_number: str
    checkout_request_id: str | None
    status: OrderStatus
    message: str


class OrderLineOut(BaseModel):
    sku: str
    name: str
    unit_price_kes: float
    quantity: int
    line_total_kes: float


class PaymentOut(BaseModel):
    provider: str
    status: PaymentStatus
    amount_kes: float
    checkout_request_id: str | None
    mpesa_receipt: str | None

    model_config = {"from_attributes": True}


class OrderOut(BaseModel):
    id: uuid.UUID
    number: str
    status: OrderStatus
    subtotal_kes: float
    total_kes: float
    contact_name: str | None
    contact_phone: str | None
    contact_email: str | None
    shipping_address: dict
    items: list[OrderLineOut]
    payment: PaymentOut | None
    created_at: datetime


class OrderAdminListItem(BaseModel):
    id: uuid.UUID
    number: str
    status: OrderStatus
    total_kes: float
    contact_name: str | None
    payment_status: PaymentStatus | None
    item_count: int
    created_at: datetime


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
