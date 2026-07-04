"""Bulk product import from CSV.

One row = one product with a single variant. Idempotent by product slug
(re-importing the same file skips products that already exist). Unknown brands
are created; unknown categories are reported (the 12 categories are fixed).

Columns (header row required; blank optional cells are fine):
  name, category, brand, summary, description, standards, tags, status,
  is_featured, sku, variant_name, price_kes, stock, reorder_level, image_url

  standards / tags : pipe-separated, e.g.  EN 388|EN 420
  status           : draft | published | archived   (default: published)
  is_featured      : true / false
"""
from __future__ import annotations

import csv
import io
import re
import secrets

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.catalog import Brand, Category, Product, ProductStatus, ProductVariant
from app.models.inventory import StockReason
from app.models.user import User
from app.services import audit, inventory
from app.services.slug import slugify, unique_slug


def _split(value: str | None) -> list[str]:
    return [s.strip() for s in re.split(r"[|]", value or "") if s.strip()]


def _flag(value: str | None) -> bool:
    return (value or "").strip().lower() in ("1", "true", "yes", "y")


def _int(value: str | None, default: int = 0) -> int:
    try:
        return int(float((value or "").strip()))
    except (TypeError, ValueError):
        return default


def import_products_csv(db: Session, data: bytes, actor: User) -> dict:
    text = data.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    created = 0
    skipped = 0
    errors: list[str] = []

    for i, row in enumerate(reader, start=2):  # row 1 is the header
        try:
            name = (row.get("name") or "").strip()
            if not name:
                continue

            if db.scalar(select(Product).where(Product.slug == slugify(name))):
                skipped += 1
                continue

            price_raw = (row.get("price_kes") or "").strip()
            if not price_raw:
                errors.append(f"row {i}: missing price_kes")
                continue
            price = float(price_raw)

            # Category — match existing (fixed set); report if unknown.
            category = None
            cval = (row.get("category") or "").strip()
            if cval:
                category = db.scalar(
                    select(Category).where(
                        or_(Category.slug == slugify(cval), Category.name == cval)
                    )
                )
                if not category:
                    errors.append(f"row {i}: category '{cval}' not found (left blank)")

            # Brand — match or create.
            brand = None
            bval = (row.get("brand") or "").strip()
            if bval:
                brand = db.scalar(
                    select(Brand).where(or_(Brand.slug == slugify(bval), Brand.name == bval))
                )
                if not brand:
                    brand = Brand(name=bval, slug=unique_slug(db, Brand, bval))
                    db.add(brand)
                    db.flush()

            status_val = (row.get("status") or "published").strip().lower()
            status = (
                ProductStatus(status_val)
                if status_val in ProductStatus._value2member_map_
                else ProductStatus.published
            )

            images = []
            img = (row.get("image_url") or "").strip()
            if img:
                images = [{"url": img}]

            product = Product(
                name=name,
                slug=unique_slug(db, Product, name),
                summary=(row.get("summary") or "").strip() or None,
                description=(row.get("description") or "").strip() or None,
                status=status,
                is_featured=_flag(row.get("is_featured")),
                standards=_split(row.get("standards")),
                tags=_split(row.get("tags")),
                category=category,
                brand=brand,
                images=images,
            )
            db.add(product)
            db.flush()

            sku = (row.get("sku") or "").strip()
            if sku:
                if db.scalar(select(ProductVariant).where(ProductVariant.sku == sku)):
                    errors.append(f"row {i}: SKU '{sku}' already exists")
                    db.delete(product)
                    db.flush()
                    continue
            else:
                sku = f"USF-{product.slug[:12].upper().replace('-', '')}-{secrets.token_hex(3).upper()}"

            variant = ProductVariant(
                product_id=product.id,
                sku=sku,
                name=(row.get("variant_name") or "Standard").strip() or "Standard",
                options={},
                price_kes=price,
            )
            db.add(variant)
            db.flush()

            item = inventory.get_or_create_item(db, variant.id)
            item.reorder_level = _int(row.get("reorder_level"))
            stock = _int(row.get("stock"))
            if stock:
                inventory.adjust(
                    db, variant.id, stock, reason=StockReason.restock,
                    actor=actor, note="CSV import",
                )
            created += 1
        except Exception as exc:  # noqa: BLE001 — collect and continue
            errors.append(f"row {i}: {exc}")

    audit.record(db, actor, "product.import", "product", None, {"created": created})
    db.commit()
    return {"created": created, "skipped": skipped, "errors": errors[:100]}
