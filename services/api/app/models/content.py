"""Site content (CMS-lite) + audit log."""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class ContentBlock(UUIDMixin, TimestampMixin, Base):
    """Controls what the storefront shows: hero, banners, featured strips."""

    __tablename__ = "content_blocks"

    key: Mapped[str] = mapped_column(String(80), index=True, nullable=False)  # "home_hero"
    kind: Mapped[str] = mapped_column(String(40), nullable=False)             # "hero"|"banner"
    title: Mapped[str | None] = mapped_column(String(200))
    body: Mapped[str | None] = mapped_column(Text)
    data: Mapped[dict] = mapped_column(JSONB, default=dict)   # links, image urls, etc.
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class AuditLog(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "audit_logs"

    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    action: Mapped[str] = mapped_column(String(80), nullable=False)   # "product.update"
    entity: Mapped[str] = mapped_column(String(80), nullable=False)   # "product"
    entity_id: Mapped[str | None] = mapped_column(String(64))
    changes: Mapped[dict] = mapped_column(JSONB, default=dict)
