"""Dashboard aggregates for the admin overview.

One round-trip returns everything the Overview page charts: totals, revenue
(confirmed orders only), a 14-day revenue series, status breakdowns, top
products and the low-stock count.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import Numeric, cast, func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.catalog import Brand, Category, Product, ProductStatus
from app.models.commerce import Order, OrderItem, OrderStatus, Quote, QuoteStatus
from app.models.inventory import InventoryItem

router = APIRouter()

# Orders that count as realised revenue (money in or committed), not pending/cancelled.
REVENUE_STATUSES = (OrderStatus.paid, OrderStatus.processing, OrderStatus.fulfilled)
SERIES_DAYS = 14


@router.get("/stats")
def dashboard_stats(db: Session = Depends(get_db)) -> dict:
    # ── Catalog totals ──
    products_total = db.scalar(select(func.count()).select_from(Product)) or 0
    products_published = (
        db.scalar(
            select(func.count()).select_from(Product).where(Product.status == ProductStatus.published)
        )
        or 0
    )
    products_draft = (
        db.scalar(
            select(func.count()).select_from(Product).where(Product.status == ProductStatus.draft)
        )
        or 0
    )
    categories_total = db.scalar(select(func.count()).select_from(Category)) or 0
    brands_total = db.scalar(select(func.count()).select_from(Brand)) or 0

    # ── Orders by status ──
    rows = db.execute(
        select(Order.status, func.count(), func.coalesce(func.sum(Order.total_kes), 0))
        .group_by(Order.status)
    ).all()
    orders_by_status = {s.value: 0 for s in OrderStatus}
    orders_total = 0
    revenue_total = 0.0
    revenue_orders = 0
    for status, count, total in rows:
        key = status.value if hasattr(status, "value") else str(status)
        orders_by_status[key] = count
        orders_total += count
        if status in REVENUE_STATUSES:
            revenue_total += float(total or 0)
            revenue_orders += count

    # ── Quotes by status ──
    qrows = db.execute(
        select(Quote.status, func.count()).group_by(Quote.status)
    ).all()
    quotes_by_status = {s.value: 0 for s in QuoteStatus}
    quotes_total = 0
    for status, count in qrows:
        key = status.value if hasattr(status, "value") else str(status)
        quotes_by_status[key] = count
        quotes_total += count

    # ── 14-day revenue series (confirmed orders) ──
    since = datetime.utcnow().date() - timedelta(days=SERIES_DAYS - 1)
    day = func.date(Order.created_at)
    series_rows = db.execute(
        select(day, func.count(), func.coalesce(func.sum(Order.total_kes), 0))
        .where(Order.status.in_(REVENUE_STATUSES))
        .where(func.date(Order.created_at) >= since)
        .group_by(day)
    ).all()
    by_day: dict[str, tuple[int, float]] = {}
    for d, count, total in series_rows:
        key = d.isoformat() if isinstance(d, date) else str(d)
        by_day[key] = (count, float(total or 0))
    revenue_series = []
    for i in range(SERIES_DAYS):
        d = (since + timedelta(days=i)).isoformat()
        c, t = by_day.get(d, (0, 0.0))
        revenue_series.append({"date": d, "orders": c, "revenue_kes": t})

    # ── Top products by revenue (from confirmed orders) ──
    top_rows = db.execute(
        select(
            OrderItem.name,
            func.sum(OrderItem.quantity),
            func.sum(cast(OrderItem.unit_price_kes, Numeric(14, 2)) * OrderItem.quantity),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .where(Order.status.in_(REVENUE_STATUSES))
        .group_by(OrderItem.name)
        .order_by(func.sum(cast(OrderItem.unit_price_kes, Numeric(14, 2)) * OrderItem.quantity).desc())
        .limit(5)
    ).all()
    top_products = [
        {"name": name, "qty": int(qty or 0), "revenue_kes": float(rev or 0)}
        for name, qty, rev in top_rows
    ]

    # ── Low stock count ──
    low_stock_count = (
        db.scalar(
            select(func.count())
            .select_from(InventoryItem)
            .where(InventoryItem.quantity_on_hand <= InventoryItem.reorder_level)
        )
        or 0
    )

    return {
        "products": {"total": products_total, "published": products_published, "draft": products_draft},
        "catalog": {"categories": categories_total, "brands": brands_total},
        "orders": {"total": orders_total, "by_status": orders_by_status},
        "quotes": {"total": quotes_total, "by_status": quotes_by_status},
        "revenue": {
            "total_kes": round(revenue_total, 2),
            "orders": revenue_orders,
            "avg_order_kes": round(revenue_total / revenue_orders, 2) if revenue_orders else 0.0,
        },
        "revenue_series": revenue_series,
        "top_products": top_products,
        "low_stock_count": low_stock_count,
    }
