from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_staff
from app.core.database import get_db
from app.models.catalog import Product, ProductVariant
from app.models.inventory import InventoryItem, StockMovement
from app.models.user import User
from app.schemas.admin import StockAdjust, StockMovementOut, VariantAdminOut
from app.schemas.common import Page
from app.services import audit, inventory

router = APIRouter()


@router.post("/variants/{variant_id}/adjust", response_model=VariantAdminOut)
def adjust_stock(
    variant_id: uuid.UUID,
    payload: StockAdjust,
    db: Session = Depends(get_db),
    actor: User = Depends(require_staff),
) -> VariantAdminOut:
    variant = db.get(ProductVariant, variant_id)
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    item = inventory.adjust(
        db, variant_id, payload.delta, reason=payload.reason,
        actor=actor, reference=payload.reference, note=payload.note,
    )
    audit.record(
        db, actor, "stock.adjust", "variant", variant_id,
        {"delta": payload.delta, "reason": payload.reason.value},
    )
    db.commit()
    return VariantAdminOut(
        id=variant.id, sku=variant.sku, name=variant.name, options=variant.options,
        price_kes=float(variant.price_kes),
        compare_at_kes=float(variant.compare_at_kes) if variant.compare_at_kes is not None else None,
        barcode=variant.barcode, is_active=variant.is_active,
        quantity_on_hand=item.quantity_on_hand, reorder_level=item.reorder_level,
    )


@router.get("/movements", response_model=Page[StockMovementOut])
def list_movements(
    db: Session = Depends(get_db),
    variant_id: uuid.UUID | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> Page[StockMovementOut]:
    filters = []
    if variant_id:
        filters.append(StockMovement.variant_id == variant_id)
    total = db.scalar(select(func.count()).select_from(StockMovement).where(*filters)) or 0
    rows = list(
        db.scalars(
            select(StockMovement)
            .where(*filters)
            .order_by(StockMovement.created_at.desc())
            .limit(page_size)
            .offset((page - 1) * page_size)
        )
    )
    return Page.build([StockMovementOut.model_validate(r) for r in rows], total, page, page_size)


@router.get("/low-stock", response_model=list[dict])
def low_stock(db: Session = Depends(get_db)) -> list[dict]:
    """Variants at or below their reorder level."""
    rows = db.execute(
        select(InventoryItem, ProductVariant, Product)
        .join(ProductVariant, ProductVariant.id == InventoryItem.variant_id)
        .join(Product, Product.id == ProductVariant.product_id)
        .where(InventoryItem.quantity_on_hand <= InventoryItem.reorder_level)
        .order_by(InventoryItem.quantity_on_hand)
    ).all()
    return [
        {
            "variant_id": str(inv.variant_id),
            "sku": v.sku,
            "product": p.name,
            "on_hand": inv.quantity_on_hand,
            "reorder_level": inv.reorder_level,
        }
        for inv, v, p in rows
    ]
