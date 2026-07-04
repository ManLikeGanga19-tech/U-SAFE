from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.content import ContentBlock
from app.schemas.content import ContentBlockOut

router = APIRouter()


@router.get("", response_model=list[ContentBlockOut])
def list_blocks(
    db: Session = Depends(get_db),
    kind: str | None = Query(default=None),
) -> list[ContentBlock]:
    stmt = select(ContentBlock).where(ContentBlock.is_active.is_(True))
    if kind:
        stmt = stmt.where(ContentBlock.kind == kind)
    return list(db.scalars(stmt.order_by(ContentBlock.sort_order)))


@router.get("/{key}", response_model=ContentBlockOut)
def get_block(key: str, db: Session = Depends(get_db)) -> ContentBlock:
    block = db.scalar(
        select(ContentBlock).where(
            ContentBlock.key == key, ContentBlock.is_active.is_(True)
        )
    )
    if not block:
        raise HTTPException(status_code=404, detail="Content block not found")
    return block
