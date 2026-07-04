from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_staff
from app.core.database import get_db
from app.models.catalog import Brand, Category, Product
from app.models.user import User
from app.schemas.admin import (
    BrandAdminOut,
    BrandCreate,
    BrandUpdate,
    CategoryAdminOut,
    CategoryCreate,
    CategoryUpdate,
)
from app.services import audit
from app.services.slug import unique_slug

router = APIRouter()


# ── Brands ────────────────────────────────────────────────
@router.get("/brands", response_model=list[BrandAdminOut])
def list_brands(db: Session = Depends(get_db)) -> list[Brand]:
    return list(db.scalars(select(Brand).order_by(Brand.name)))


@router.post("/brands", response_model=BrandAdminOut, status_code=201)
def create_brand(
    payload: BrandCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_staff),
) -> Brand:
    brand = Brand(
        name=payload.name,
        slug=unique_slug(db, Brand, payload.slug or payload.name),
        logo_url=payload.logo_url,
        description=payload.description,
    )
    db.add(brand)
    audit.record(db, actor, "brand.create", "brand", None, {"name": payload.name})
    db.commit()
    db.refresh(brand)
    return brand


@router.patch("/brands/{brand_id}", response_model=BrandAdminOut)
def update_brand(
    brand_id: uuid.UUID,
    payload: BrandUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_staff),
) -> Brand:
    brand = db.get(Brand, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    data = payload.model_dump(exclude_unset=True)
    if "slug" in data and data["slug"]:
        data["slug"] = unique_slug(db, Brand, data["slug"], exclude_id=brand.id)
    for k, v in data.items():
        setattr(brand, k, v)
    audit.record(db, actor, "brand.update", "brand", brand.id, list(data.keys()))
    db.commit()
    db.refresh(brand)
    return brand


@router.delete("/brands/{brand_id}", status_code=204)
def delete_brand(
    brand_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: User = Depends(require_staff),
) -> Response:
    brand = db.get(Brand, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    audit.record(db, actor, "brand.delete", "brand", brand.id, {"name": brand.name})
    db.delete(brand)
    db.commit()
    return Response(status_code=204)


# ── Categories ────────────────────────────────────────────
@router.get("/categories", response_model=list[CategoryAdminOut])
def list_categories(db: Session = Depends(get_db)) -> list[CategoryAdminOut]:
    cats = list(db.scalars(select(Category).order_by(Category.sort_order, Category.name)))
    counts = dict(
        db.execute(
            select(Product.category_id, func.count(Product.id)).group_by(Product.category_id)
        ).all()
    )
    return [
        CategoryAdminOut(
            id=c.id,
            name=c.name,
            slug=c.slug,
            description=c.description,
            image_url=c.image_url,
            parent_id=c.parent_id,
            sort_order=c.sort_order,
            product_count=counts.get(c.id, 0),
        )
        for c in cats
    ]


@router.post("/categories", response_model=CategoryAdminOut, status_code=201)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_staff),
) -> CategoryAdminOut:
    cat = Category(
        name=payload.name,
        slug=unique_slug(db, Category, payload.slug or payload.name),
        description=payload.description,
        image_url=payload.image_url,
        parent_id=payload.parent_id,
        sort_order=payload.sort_order,
    )
    db.add(cat)
    audit.record(db, actor, "category.create", "category", None, {"name": payload.name})
    db.commit()
    db.refresh(cat)
    return CategoryAdminOut(
        id=cat.id, name=cat.name, slug=cat.slug, description=cat.description,
        image_url=cat.image_url, parent_id=cat.parent_id, sort_order=cat.sort_order,
        product_count=0,
    )


@router.patch("/categories/{category_id}", response_model=CategoryAdminOut)
def update_category(
    category_id: uuid.UUID,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_staff),
) -> CategoryAdminOut:
    cat = db.get(Category, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    data = payload.model_dump(exclude_unset=True)
    if "slug" in data and data["slug"]:
        data["slug"] = unique_slug(db, Category, data["slug"], exclude_id=cat.id)
    for k, v in data.items():
        setattr(cat, k, v)
    audit.record(db, actor, "category.update", "category", cat.id, list(data.keys()))
    db.commit()
    db.refresh(cat)
    count = db.scalar(
        select(func.count()).select_from(Product).where(Product.category_id == cat.id)
    )
    return CategoryAdminOut(
        id=cat.id, name=cat.name, slug=cat.slug, description=cat.description,
        image_url=cat.image_url, parent_id=cat.parent_id, sort_order=cat.sort_order,
        product_count=count or 0,
    )


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(
    category_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: User = Depends(require_staff),
) -> Response:
    cat = db.get(Category, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    audit.record(db, actor, "category.delete", "category", cat.id, {"name": cat.name})
    db.delete(cat)
    db.commit()
    return Response(status_code=204)
