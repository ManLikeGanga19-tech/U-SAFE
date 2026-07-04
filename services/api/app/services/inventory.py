"""Event-sourced stock. All quantity changes go through here so that every
delta is recorded as a StockMovement and the on-hand cache stays reconciled.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.inventory import InventoryItem, StockMovement, StockReason
from app.models.user import User


def get_or_create_item(db: Session, variant_id: uuid.UUID) -> InventoryItem:
    item = db.scalar(select(InventoryItem).where(InventoryItem.variant_id == variant_id))
    if item is None:
        item = InventoryItem(variant_id=variant_id, quantity_on_hand=0, reorder_level=0)
        db.add(item)
        db.flush()
    return item


def adjust(
    db: Session,
    variant_id: uuid.UUID,
    delta: int,
    *,
    reason: StockReason = StockReason.adjustment,
    actor: User | None = None,
    reference: str | None = None,
    note: str | None = None,
) -> InventoryItem:
    """Apply a stock delta: append a movement + update the on-hand cache."""
    item = get_or_create_item(db, variant_id)
    item.quantity_on_hand = max(0, item.quantity_on_hand + delta)
    db.add(
        StockMovement(
            variant_id=variant_id,
            delta=delta,
            reason=reason,
            reference=reference,
            note=note,
            actor_id=actor.id if actor else None,
        )
    )
    db.flush()
    return item


def on_hand(db: Session, variant_id: uuid.UUID) -> int:
    item = db.scalar(select(InventoryItem).where(InventoryItem.variant_id == variant_id))
    return item.quantity_on_hand if item else 0
