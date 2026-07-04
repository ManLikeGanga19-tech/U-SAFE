from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import require_staff
from app.core.database import get_db
from app.models.catalog import Brand, Category, Product, ProductStatus, ProductVariant
from app.models.inventory import InventoryItem, StockReason
from app.models.user import User
from app.schemas.admin import (
    ProductAdminListItem,
    ProductAdminOut,
    ProductCreate,
    ProductUpdate,
    VariantAdminOut,
    VariantCreate,
    VariantUpdate,
)
from app.schemas.common import Page
from app.services import audit, inventory
from app.services.slug import slugify, unique_slug

router = APIRouter()


# ── Serialization helpers ─────────────────────────────────
def _variant_out(db: Session, v: ProductVariant) -> VariantAdminOut:
    inv = db.scalar(select(InventoryItem).where(InventoryItem.variant_id == v.id))
    return VariantAdminOut(
        id=v.id,
        sku=v.sku,
        name=v.name,
        options=v.options,
        price_kes=float(v.price_kes),
        compare_at_kes=float(v.compare_at_kes) if v.compare_at_kes is not None else None,
        barcode=v.barcode,
        is_active=v.is_active,
        quantity_on_hand=inv.quantity_on_hand if inv else 0,
        reorder_level=inv.reorder_level if inv else 0,
    )


def _product_out(db: Session, p: Product) -> ProductAdminOut:
    return ProductAdminOut(
        id=p.id,
        name=p.name,
        slug=p.slug,
        summary=p.summary,
        description=p.description,
        brand_id=p.brand_id,
        category_id=p.category_id,
        status=p.status,
        is_featured=p.is_featured,
        images=p.images,
        standards=p.standards,
        tags=p.tags,
        attributes=p.attributes,
        variants=[_variant_out(db, v) for v in p.variants],
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


def _load(db: Session, product_id: uuid.UUID) -> Product:
    p = db.scalar(
        select(Product)
        .where(Product.id == product_id)
        .options(selectinload(Product.variants))
    )
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return p


def _gen_sku(product_slug: str) -> str:
    return f"USF-{product_slug[:12].upper().replace('-', '')}-{uuid.uuid4().hex[:5].upper()}"


# ── List ──────────────────────────────────────────────────
@router.get("", response_model=Page[ProductAdminListItem])
def list_products(
    db: Session = Depends(get_db),
    q: str | None = Query(default=None, description="search name/slug"),
    status: ProductStatus | None = None,
    brand_id: uuid.UUID | None = None,
    category_id: uuid.UUID | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> Page[ProductAdminListItem]:
    filters = []
    if q:
        like = f"%{q.lower()}%"
        filters.append(or_(func.lower(Product.name).like(like), Product.slug.like(like)))
    if status:
        filters.append(Product.status == status)
    if brand_id:
        filters.append(Product.brand_id == brand_id)
    if category_id:
        filters.append(Product.category_id == category_id)

    total = db.scalar(select(func.count()).select_from(Product).where(*filters)) or 0

    rows = db.scalars(
        select(Product)
        .where(*filters)
        .options(
            selectinload(Product.variants).selectinload(ProductVariant.inventory),
            selectinload(Product.brand),
            selectinload(Product.category),
        )
        .order_by(Product.updated_at.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    ).unique()

    items = [
        ProductAdminListItem(
            id=p.id,
            name=p.name,
            slug=p.slug,
            status=p.status,
            is_featured=p.is_featured,
            brand_name=p.brand.name if p.brand else None,
            category_name=p.category.name if p.category else None,
            variant_count=len(p.variants),
            total_stock=sum(
                v.inventory.quantity_on_hand if v.inventory else 0 for v in p.variants
            ),
            updated_at=p.updated_at,
        )
        for p in rows
    ]
    return Page.build(items, total, page, page_size)


# ── Create ────────────────────────────────────────────────
@router.post("", response_model=ProductAdminOut, status_code=201)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_staff),
) -> ProductAdminOut:
    slug = unique_slug(db, Product, payload.slug or payload.name)
    product = Product(
        name=payload.name,
        slug=slug,
        summary=payload.summary,
        description=payload.description,
        brand_id=payload.brand_id,
        category_id=payload.category_id,
        status=payload.status,
        is_featured=payload.is_featured,
        images=[i.model_dump() for i in payload.images],
        standards=payload.standards,
        tags=payload.tags,
        attributes=payload.attributes,
    )
    db.add(product)
    db.flush()

    for vc in payload.variants:
        sku = vc.sku or _gen_sku(slug)
        variant = ProductVariant(
            product_id=product.id,
            sku=sku,
            name=vc.name,
            options=vc.options,
            price_kes=vc.price_kes,
            compare_at_kes=vc.compare_at_kes,
            barcode=vc.barcode,
            is_active=vc.is_active,
        )
        db.add(variant)
        db.flush()
        item = inventory.get_or_create_item(db, variant.id)
        item.reorder_level = vc.reorder_level
        if vc.initial_stock:
            inventory.adjust(
                db, variant.id, vc.initial_stock, reason=StockReason.restock,
                actor=actor, note="Initial stock",
            )

    audit.record(db, actor, "product.create", "product", product.id, {"name": product.name})
    db.commit()
    return _product_out(db, _load(db, product.id))


# ── Read ──────────────────────────────────────────────────
@router.get("/{product_id}", response_model=ProductAdminOut)
def get_product(product_id: uuid.UUID, db: Session = Depends(get_db)) -> ProductAdminOut:
    return _product_out(db, _load(db, product_id))


# ── Update ────────────────────────────────────────────────
@router.patch("/{product_id}", response_model=ProductAdminOut)
def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_staff),
) -> ProductAdminOut:
    product = _load(db, product_id)
    data = payload.model_dump(exclude_unset=True)

    if "slug" in data and data["slug"]:
        data["slug"] = unique_slug(db, Product, data["slug"], exclude_id=product.id)
    if "images" in data and data["images"] is not None:
        data["images"] = [
            i if isinstance(i, dict) else i.model_dump() for i in payload.images or []
        ]

    for field, value in data.items():
        setattr(product, field, value)

    audit.record(db, actor, "product.update", "product", product.id, list(data.keys()))
    db.commit()
    return _product_out(db, _load(db, product.id))


# ── Delete ────────────────────────────────────────────────
@router.delete("/{product_id}", status_code=204)
def delete_product(
    product_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: User = Depends(require_staff),
) -> Response:
    product = _load(db, product_id)
    audit.record(db, actor, "product.delete", "product", product.id, {"name": product.name})
    db.delete(product)
    db.commit()
    return Response(status_code=204)


# ── Variants ──────────────────────────────────────────────
@router.post("/{product_id}/variants", response_model=VariantAdminOut, status_code=201)
def add_variant(
    product_id: uuid.UUID,
    payload: VariantCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_staff),
) -> VariantAdminOut:
    product = _load(db, product_id)
    sku = payload.sku or _gen_sku(product.slug)
    if db.scalar(select(ProductVariant).where(ProductVariant.sku == sku)):
        raise HTTPException(status_code=409, detail="SKU already exists")
    variant = ProductVariant(
        product_id=product.id,
        sku=sku,
        name=payload.name,
        options=payload.options,
        price_kes=payload.price_kes,
        compare_at_kes=payload.compare_at_kes,
        barcode=payload.barcode,
        is_active=payload.is_active,
    )
    db.add(variant)
    db.flush()
    item = inventory.get_or_create_item(db, variant.id)
    item.reorder_level = payload.reorder_level
    if payload.initial_stock:
        inventory.adjust(
            db, variant.id, payload.initial_stock, reason=StockReason.restock,
            actor=actor, note="Initial stock",
        )
    audit.record(db, actor, "variant.create", "variant", variant.id, {"sku": sku})
    db.commit()
    return _variant_out(db, variant)


@router.patch("/{product_id}/variants/{variant_id}", response_model=VariantAdminOut)
def update_variant(
    product_id: uuid.UUID,
    variant_id: uuid.UUID,
    payload: VariantUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_staff),
) -> VariantAdminOut:
    variant = db.scalar(
        select(ProductVariant).where(
            ProductVariant.id == variant_id, ProductVariant.product_id == product_id
        )
    )
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    data = payload.model_dump(exclude_unset=True)
    if "sku" in data and data["sku"] and data["sku"] != variant.sku:
        if db.scalar(select(ProductVariant).where(ProductVariant.sku == data["sku"])):
            raise HTTPException(status_code=409, detail="SKU already exists")
    for field, value in data.items():
        setattr(variant, field, value)
    audit.record(db, actor, "variant.update", "variant", variant.id, list(data.keys()))
    db.commit()
    return _variant_out(db, variant)


@router.delete("/{product_id}/variants/{variant_id}", status_code=204)
def delete_variant(
    product_id: uuid.UUID,
    variant_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: User = Depends(require_staff),
) -> Response:
    variant = db.scalar(
        select(ProductVariant).where(
            ProductVariant.id == variant_id, ProductVariant.product_id == product_id
        )
    )
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    audit.record(db, actor, "variant.delete", "variant", variant.id, {"sku": variant.sku})
    db.delete(variant)
    db.commit()
    return Response(status_code=204)
