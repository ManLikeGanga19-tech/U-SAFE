from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_staff
from app.core.database import get_db
from app.models.content import ContentBlock
from app.models.user import User
from app.schemas.content import ContentBlockCreate, ContentBlockOut, ContentBlockUpdate
from app.services import audit

router = APIRouter()


@router.get("", response_model=list[ContentBlockOut])
def list_blocks(db: Session = Depends(get_db)) -> list[ContentBlock]:
    return list(db.scalars(select(ContentBlock).order_by(ContentBlock.kind, ContentBlock.sort_order)))


@router.post("", response_model=ContentBlockOut, status_code=201)
def create_block(
    payload: ContentBlockCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_staff),
) -> ContentBlock:
    block = ContentBlock(**payload.model_dump())
    db.add(block)
    audit.record(db, actor, "content.create", "content_block", None, {"key": payload.key})
    db.commit()
    db.refresh(block)
    return block


@router.patch("/{block_id}", response_model=ContentBlockOut)
def update_block(
    block_id: uuid.UUID,
    payload: ContentBlockUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_staff),
) -> ContentBlock:
    block = db.get(ContentBlock, block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Content block not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(block, k, v)
    audit.record(db, actor, "content.update", "content_block", block.id, {"key": block.key})
    db.commit()
    db.refresh(block)
    return block


@router.delete("/{block_id}", status_code=204)
def delete_block(
    block_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: User = Depends(require_staff),
) -> Response:
    block = db.get(ContentBlock, block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Content block not found")
    audit.record(db, actor, "content.delete", "content_block", block.id, {"key": block.key})
    db.delete(block)
    db.commit()
    return Response(status_code=204)
