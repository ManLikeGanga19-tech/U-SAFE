from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.models.catalog import Brand, Category, Product, ProductStatus, ProductVariant
from app.models.commerce import Order, OrderItem, OrderStatus
from app.schemas.catalog import BrandOut, CategoryOut, ProductOut
from app.schemas.common import Page

router = APIRouter()


@router.get("/brands", response_model=list[BrandOut])
def list_brands(db: Session = Depends(get_db)) -> list[Brand]:
    return list(db.scalars(select(Brand).order_by(Brand.name)))


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)) -> list[Category]:
    return list(db.scalars(select(Category).order_by(Category.sort_order, Category.name)))


def _bestseller_subquery():
    """Units sold per product across fulfilled/paid orders."""
    return (
        select(
            ProductVariant.product_id.label("pid"),
            func.coalesce(func.sum(OrderItem.quantity), 0).label("sold"),
        )
        .join(OrderItem, OrderItem.variant_id == ProductVariant.id)
        .join(Order, Order.id == OrderItem.order_id)
        .where(
            Order.status.in_(
                [OrderStatus.paid, OrderStatus.processing, OrderStatus.fulfilled]
            )
        )
        .group_by(ProductVariant.product_id)
        .subquery()
    )


@router.get("/products", response_model=Page[ProductOut])
def list_products(
    db: Session = Depends(get_db),
    q: str | None = Query(default=None, description="search term"),
    category: str | None = Query(default=None, description="category slug"),
    brand: str | None = Query(default=None, description="brand slug"),
    tag: str | None = Query(default=None, description="collection tag, e.g. 'kit'"),
    featured: bool | None = None,
    sort: str = Query(default="newest", pattern="^(newest|name|bestselling)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=24, ge=1, le=60),
) -> Page[ProductOut]:
    filters = [Product.status == ProductStatus.published]
    if q:
        like = f"%{q.lower()}%"
        filters.append(
            or_(func.lower(Product.name).like(like), func.lower(Product.summary).like(like))
        )
    if tag:
        filters.append(Product.tags.contains([tag]))

    base = select(Product).where(*filters)
    if category:
        base = base.join(Category, Product.category_id == Category.id).where(
            Category.slug == category
        )
    if brand:
        base = base.join(Brand, Product.brand_id == Brand.id).where(Brand.slug == brand)
    if featured is not None:
        base = base.where(Product.is_featured == featured)

    if sort == "bestselling":
        bs = _bestseller_subquery()
        # Only products that have actually sold, ranked by units sold.
        base = base.join(bs, bs.c.pid == Product.id)
        total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
        rows = db.scalars(
            base.options(
                selectinload(Product.brand),
                selectinload(Product.category),
                selectinload(Product.variants),
            )
            .order_by(bs.c.sold.desc())
            .limit(page_size)
            .offset((page - 1) * page_size)
        ).unique()
    else:
        total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
        order = Product.name.asc() if sort == "name" else Product.created_at.desc()
        rows = db.scalars(
            base.options(
                selectinload(Product.brand),
                selectinload(Product.category),
                selectinload(Product.variants),
            )
            .order_by(order)
            .limit(page_size)
            .offset((page - 1) * page_size)
        ).unique()

    items = [ProductOut.model_validate(p) for p in rows]
    return Page.build(items, total, page, page_size)


@router.get("/products/{slug}", response_model=ProductOut)
def get_product(slug: str, db: Session = Depends(get_db)) -> Product:
    product = db.scalar(
        select(Product)
        .where(Product.slug == slug, Product.status == ProductStatus.published)
        .options(
            selectinload(Product.brand),
            selectinload(Product.category),
            selectinload(Product.variants),
        )
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product
