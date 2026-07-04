"""Slug generation with uniqueness enforcement against a model column."""
from __future__ import annotations

import re

from sqlalchemy import func, select
from sqlalchemy.orm import Session


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "item"


def unique_slug(
    db: Session, model, base: str, *, exclude_id=None, column: str = "slug"
) -> str:
    """Return a slug unique for `model.column`, appending -2, -3, … if needed."""
    root = slugify(base)
    col = getattr(model, column)
    candidate = root
    n = 1
    while True:
        stmt = select(func.count()).select_from(model).where(col == candidate)
        if exclude_id is not None:
            stmt = stmt.where(model.id != exclude_id)
        if db.scalar(stmt) == 0:
            return candidate
        n += 1
        candidate = f"{root}-{n}"
