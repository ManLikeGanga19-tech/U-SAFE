from __future__ import annotations

import uuid

from pydantic import BaseModel

from app.models.catalog import ProductStatus


class BrandOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    logo_url: str | None = None

    model_config = {"from_attributes": True}


class CategoryOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None = None
    image_url: str | None = None
    parent_id: uuid.UUID | None = None
    sort_order: int

    model_config = {"from_attributes": True}


class VariantOut(BaseModel):
    id: uuid.UUID
    sku: str
    name: str | None = None
    options: dict
    price_kes: float
    compare_at_kes: float | None = None

    model_config = {"from_attributes": True}


class ProductOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    summary: str | None = None
    description: str | None = None
    status: ProductStatus
    is_featured: bool
    images: list
    standards: list
    attributes: dict = {}
    brand: BrandOut | None = None
    category: CategoryOut | None = None
    variants: list[VariantOut] = []

    model_config = {"from_attributes": True}
