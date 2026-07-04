"""Commerce: carts, orders, payments, B2B quotes."""
from __future__ import annotations

import enum
import uuid

from sqlalchemy import Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class OrderStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    processing = "processing"
    fulfilled = "fulfilled"
    cancelled = "cancelled"
    refunded = "refunded"


class PaymentProvider(str, enum.Enum):
    mpesa = "mpesa"
    manual = "manual"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    success = "success"
    failed = "failed"


class QuoteStatus(str, enum.Enum):
    requested = "requested"
    priced = "priced"
    accepted = "accepted"
    expired = "expired"
    cancelled = "cancelled"


# ── Cart ──────────────────────────────────────────────────────
class Cart(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "carts"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    session_token: Mapped[str | None] = mapped_column(String(120), index=True)

    items: Mapped[list["CartItem"]] = relationship(
        back_populates="cart", cascade="all, delete-orphan"
    )


class CartItem(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "cart_items"

    cart_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("carts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    variant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    cart: Mapped["Cart"] = relationship(back_populates="items")


# ── Orders ────────────────────────────────────────────────────
class Order(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "orders"

    number: Mapped[str] = mapped_column(String(24), unique=True, index=True, nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="order_status"),
        default=OrderStatus.pending,
        nullable=False,
        index=True,
    )
    subtotal_kes: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    total_kes: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)

    contact_name: Mapped[str | None] = mapped_column(String(160))
    contact_phone: Mapped[str | None] = mapped_column(String(32))
    contact_email: Mapped[str | None] = mapped_column(String(255))
    shipping_address: Mapped[dict] = mapped_column(JSONB, default=dict)

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )
    payments: Mapped[list["Payment"]] = relationship(back_populates="order")


class OrderItem(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "order_items"

    order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), index=True, nullable=False
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("product_variants.id", ondelete="SET NULL")
    )
    sku: Mapped[str] = mapped_column(String(80), nullable=False)          # snapshot
    name: Mapped[str] = mapped_column(String(240), nullable=False)        # snapshot
    unit_price_kes: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)

    order: Mapped["Order"] = relationship(back_populates="items")


# ── Payments ──────────────────────────────────────────────────
class Payment(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "payments"

    order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), index=True, nullable=False
    )
    provider: Mapped[PaymentProvider] = mapped_column(
        Enum(PaymentProvider, name="payment_provider"), nullable=False
    )
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status"),
        default=PaymentStatus.pending,
        nullable=False,
    )
    amount_kes: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    # M-Pesa Daraja references. Unique so one STK request maps to one payment row
    # (Postgres allows multiple NULLs, so manual/non-mpesa payments are unaffected).
    checkout_request_id: Mapped[str | None] = mapped_column(
        String(120), unique=True, index=True
    )
    mpesa_receipt: Mapped[str | None] = mapped_column(String(64))
    raw_callback: Mapped[dict] = mapped_column(JSONB, default=dict)

    order: Mapped["Order"] = relationship(back_populates="payments")


# ── B2B Quotes ────────────────────────────────────────────────
class Quote(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "quotes"

    number: Mapped[str] = mapped_column(String(24), unique=True, index=True, nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    status: Mapped[QuoteStatus] = mapped_column(
        Enum(QuoteStatus, name="quote_status"),
        default=QuoteStatus.requested,
        nullable=False,
        index=True,
    )
    company_name: Mapped[str | None] = mapped_column(String(200))
    contact_name: Mapped[str | None] = mapped_column(String(160))
    contact_email: Mapped[str | None] = mapped_column(String(255))
    contact_phone: Mapped[str | None] = mapped_column(String(32))
    message: Mapped[str | None] = mapped_column(Text)
    total_kes: Mapped[float | None] = mapped_column(Numeric(12, 2))
    pdf_url: Mapped[str | None] = mapped_column(String(500))

    items: Mapped[list["QuoteItem"]] = relationship(
        back_populates="quote", cascade="all, delete-orphan"
    )


class QuoteItem(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "quote_items"

    quote_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quotes.id", ondelete="CASCADE"), index=True, nullable=False
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("product_variants.id", ondelete="SET NULL")
    )
    description: Mapped[str] = mapped_column(String(240), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price_kes: Mapped[float | None] = mapped_column(Numeric(12, 2))

    quote: Mapped["Quote"] = relationship(back_populates="items")
