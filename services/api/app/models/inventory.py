"""Inventory: event-sourced stock via StockMovement; on-hand is a cache."""
from __future__ import annotations

import enum
import uuid

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class StockReason(str, enum.Enum):
    restock = "restock"
    sale = "sale"
    adjustment = "adjustment"
    return_ = "return"


class InventoryItem(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "inventory_items"

    variant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("product_variants.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    quantity_on_hand: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reorder_level: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    location: Mapped[str | None] = mapped_column(String(120))

    variant = relationship("ProductVariant", back_populates="inventory")


class StockMovement(UUIDMixin, TimestampMixin, Base):
    """Append-only ledger. `quantity_on_hand` is reconciled from these rows."""

    __tablename__ = "stock_movements"

    variant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("product_variants.id", ondelete="CASCADE"), index=True, nullable=False
    )
    delta: Mapped[int] = mapped_column(Integer, nullable=False)  # +restock / -sale
    reason: Mapped[StockReason] = mapped_column(
        Enum(StockReason, name="stock_reason"), nullable=False
    )
    reference: Mapped[str | None] = mapped_column(String(120))   # order id, PO, etc.
    note: Mapped[str | None] = mapped_column(Text)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
