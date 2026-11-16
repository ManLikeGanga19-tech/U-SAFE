from __future__ import annotations

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.models.commerce import Fulfilment, OrderStatus, PaymentMethod, PaymentStatus

# KRA PIN: A (individual) or P (company), 9 digits, a check letter. e.g. P051234567X
KRA_PIN_RE = re.compile(r"^[AP]\d{9}[A-Z]$")
# M-Pesa receipt codes are 10 chars; bank refs vary. Keep it permissive but clean.
PAYMENT_REF_RE = re.compile(r"^[A-Z0-9-]{6,30}$")


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


class ContactIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=20)

    @field_validator("name", "phone")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("is required")
        return v


class CompanyIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    kra_pin: str | None = Field(default=None, max_length=20)
    po_number: str | None = Field(default=None, max_length=60)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Company name is required")
        return v

    @field_validator("kra_pin")
    @classmethod
    def _pin(cls, v: str | None) -> str | None:
        v = _clean(v)
        if v is None:
            return None
        v = v.upper().replace(" ", "")
        if not KRA_PIN_RE.match(v):
            raise ValueError("KRA PIN should look like P051234567X")
        return v

    @field_validator("po_number")
    @classmethod
    def _po(cls, v: str | None) -> str | None:
        return _clean(v)


class CheckoutIn(BaseModel):
    contact: ContactIn
    fulfilment: Fulfilment = Fulfilment.delivery
    # {city, address, notes}. Required for delivery, ignored for pickup.
    shipping_address: dict = Field(default_factory=dict)
    payment_method: PaymentMethod = PaymentMethod.mpesa_stk
    # Required for M-Pesa STK; ignored otherwise.
    mpesa_phone: str | None = Field(
        default=None, description="Safaricom number, e.g. 2547XXXXXXXX or 07XXXXXXXX"
    )
    company: CompanyIn | None = None

    @model_validator(mode="after")
    def _check(self) -> "CheckoutIn":
        if self.fulfilment == Fulfilment.delivery:
            addr = {k: (str(v).strip() if v is not None else "") for k, v in self.shipping_address.items()}
            if not addr.get("city"):
                raise ValueError("Enter the town or city for delivery")
            self.shipping_address = {
                k: addr[k][:300] for k in ("city", "address", "notes") if addr.get(k)
            }
        else:
            notes = str(self.shipping_address.get("notes") or "").strip()
            self.shipping_address = {"notes": notes[:300]} if notes else {}
        if self.payment_method == PaymentMethod.mpesa_stk and not _clean(self.mpesa_phone):
            raise ValueError("Enter the M-Pesa number to send the payment prompt to")
        return self


class RetryPaymentIn(BaseModel):
    mpesa_phone: str = Field(description="Safaricom number, e.g. 07XXXXXXXX")


class PaymentReferenceIn(BaseModel):
    reference: str = Field(min_length=6, max_length=30)

    @field_validator("reference")
    @classmethod
    def _ref(cls, v: str) -> str:
        v = v.strip().upper().replace(" ", "")
        if not PAYMENT_REF_RE.match(v):
            raise ValueError("Enter the transaction code, e.g. SJK1ABC2DE")
        return v


class CheckoutResult(BaseModel):
    order_id: uuid.UUID
    order_number: str
    checkout_request_id: str | None
    status: OrderStatus
    payment_method: PaymentMethod = PaymentMethod.mpesa_stk
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


class PaymentInstructions(BaseModel):
    """How to pay a manual (Paybill / bank) order. Amount includes VAT."""

    method: PaymentMethod
    amount_kes: float
    reference: str  # what the customer must quote: the order number
    paybill: str | None = None
    bank_name: str | None = None
    account_name: str | None = None
    account_number: str | None = None
    branch: str | None = None
    swift: str | None = None
    due_at: datetime | None = None


class OrderOut(BaseModel):
    id: uuid.UUID
    number: str
    status: OrderStatus
    subtotal_kes: float
    vat_kes: float = 0
    vat_rate: float = 0
    total_kes: float
    fulfilment: Fulfilment = Fulfilment.delivery
    payment_method: PaymentMethod = PaymentMethod.mpesa_stk
    payment_reference: str | None = None
    payment_instructions: PaymentInstructions | None = None
    pickup_address: str | None = None
    contact_name: str | None
    contact_phone: str | None
    contact_email: str | None
    company_name: str | None = None
    kra_pin: str | None = None
    po_number: str | None = None
    shipping_address: dict
    items: list[OrderLineOut]
    payment: PaymentOut | None
    can_retry_payment: bool = False
    created_at: datetime


class OrderAdminListItem(BaseModel):
    id: uuid.UUID
    number: str
    status: OrderStatus
    total_kes: float
    contact_name: str | None
    company_name: str | None = None
    payment_method: PaymentMethod = PaymentMethod.mpesa_stk
    fulfilment: Fulfilment = Fulfilment.delivery
    payment_status: PaymentStatus | None
    item_count: int
    created_at: datetime


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class PaymentMethodOption(BaseModel):
    id: PaymentMethod
    label: str
    description: str


class CheckoutOptions(BaseModel):
    vat_rate: float
    pickup_address: str
    pickup_hours: str | None
    manual_hold_days: int
    payment_methods: list[PaymentMethodOption]
