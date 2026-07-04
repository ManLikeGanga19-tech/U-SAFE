"""Admin-side DTOs for catalog management (create/update)."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.catalog import ProductStatus
from app.models.inventory import StockReason


# ── Brands ────────────────────────────────────────────────
class BrandCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    slug: str | None = None
    logo_url: str | None = None
    description: str | None = None


class BrandUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    logo_url: str | None = None
    description: str | None = None


class BrandAdminOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    logo_url: str | None
    description: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Categories ────────────────────────────────────────────
class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    slug: str | None = None
    description: str | None = None
    image_url: str | None = None
    parent_id: uuid.UUID | None = None
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    image_url: str | None = None
    parent_id: uuid.UUID | None = None
    sort_order: int | None = None


class CategoryAdminOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None
    image_url: str | None
    parent_id: uuid.UUID | None
    sort_order: int
    product_count: int = 0

    model_config = {"from_attributes": True}


# ── Variants ──────────────────────────────────────────────
class VariantCreate(BaseModel):
    sku: str | None = None  # auto-generated if omitted
    name: str | None = None
    options: dict = Field(default_factory=dict)
    price_kes: float = Field(ge=0)
    compare_at_kes: float | None = None
    barcode: str | None = None
    is_active: bool = True
    initial_stock: int = Field(default=0, ge=0)
    reorder_level: int = Field(default=0, ge=0)


class VariantUpdate(BaseModel):
    sku: str | None = None
    name: str | None = None
    options: dict | None = None
    price_kes: float | None = Field(default=None, ge=0)
    compare_at_kes: float | None = None
    barcode: str | None = None
    is_active: bool | None = None


class VariantAdminOut(BaseModel):
    id: uuid.UUID
    sku: str
    name: str | None
    options: dict
    price_kes: float
    compare_at_kes: float | None
    barcode: str | None
    is_active: bool
    quantity_on_hand: int = 0
    reorder_level: int = 0

    model_config = {"from_attributes": True}


# ── Products ──────────────────────────────────────────────
class ProductImage(BaseModel):
    url: str
    alt: str | None = None


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str | None = None
    summary: str | None = None
    description: str | None = None
    brand_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    status: ProductStatus = ProductStatus.draft
    is_featured: bool = False
    images: list[ProductImage] = Field(default_factory=list)
    standards: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    attributes: dict = Field(default_factory=dict)
    variants: list[VariantCreate] = Field(default_factory=list)


class ProductUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    summary: str | None = None
    description: str | None = None
    brand_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    status: ProductStatus | None = None
    is_featured: bool | None = None
    images: list[ProductImage] | None = None
    standards: list[str] | None = None
    tags: list[str] | None = None
    attributes: dict | None = None


class ProductAdminListItem(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    status: ProductStatus
    is_featured: bool
    brand_name: str | None = None
    category_name: str | None = None
    variant_count: int = 0
    total_stock: int = 0
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProductAdminOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    summary: str | None
    description: str | None
    brand_id: uuid.UUID | None
    category_id: uuid.UUID | None
    status: ProductStatus
    is_featured: bool
    images: list
    standards: list
    tags: list
    attributes: dict
    variants: list[VariantAdminOut] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Inventory ─────────────────────────────────────────────
class StockAdjust(BaseModel):
    delta: int = Field(description="positive to add, negative to remove")
    reason: StockReason = StockReason.adjustment
    note: str | None = None
    reference: str | None = None


class StockMovementOut(BaseModel):
    id: uuid.UUID
    variant_id: uuid.UUID
    delta: int
    reason: StockReason
    reference: str | None
    note: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
