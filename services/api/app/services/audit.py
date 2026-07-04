"""Audit trail helper. Every admin mutation records who did what."""
from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.models.content import AuditLog
from app.models.user import User


def record(
    db: Session,
    actor: User | None,
    action: str,
    entity: str,
    entity_id: str | uuid.UUID | None = None,
    changes: dict | None = None,
) -> None:
    db.add(
        AuditLog(
            actor_id=actor.id if actor else None,
            action=action,
            entity=entity,
            entity_id=str(entity_id) if entity_id is not None else None,
            changes=changes or {},
        )
    )
