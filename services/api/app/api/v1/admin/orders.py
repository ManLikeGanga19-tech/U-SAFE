from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import require_staff
from app.api.v1.checkout import serialize_order
from app.core.database import get_db
from app.models.commerce import Order, OrderItem, OrderStatus, Payment
from app.models.user import User
from app.schemas.common import Page
from app.schemas.order import OrderAdminListItem, OrderOut, OrderStatusUpdate
from app.services import audit

router = APIRouter()


@router.get("", response_model=Page[OrderAdminListItem])
def list_orders(
    db: Session = Depends(get_db),
    status: OrderStatus | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> Page[OrderAdminListItem]:
    filters = []
    if status:
        filters.append(Order.status == status)
    total = db.scalar(select(func.count()).select_from(Order).where(*filters)) or 0
    rows = list(
        db.scalars(
            select(Order)
            .where(*filters)
            .options(selectinload(Order.items), selectinload(Order.payments))
            .order_by(Order.created_at.desc())
            .limit(page_size)
            .offset((page - 1) * page_size)
        )
    )
    items = [
        OrderAdminListItem(
            id=o.id,
            number=o.number,
            status=o.status,
            total_kes=float(o.total_kes),
            contact_name=o.contact_name,
            payment_status=o.payments[-1].status if o.payments else None,
            item_count=len(o.items),
            created_at=o.created_at,
        )
        for o in rows
    ]
    return Page.build(items, total, page, page_size)


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: uuid.UUID, db: Session = Depends(get_db)) -> OrderOut:
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return serialize_order(db, order)


@router.patch("/{order_id}", response_model=OrderOut)
def update_status(
    order_id: uuid.UUID,
    payload: OrderStatusUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_staff),
) -> OrderOut:
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = payload.status
    audit.record(db, actor, "order.status", "order", order.id, {"status": payload.status.value})
    db.commit()
    return serialize_order(db, order)
