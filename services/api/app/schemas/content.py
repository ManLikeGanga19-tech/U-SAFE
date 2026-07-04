from __future__ import annotations

import uuid

from pydantic import BaseModel, Field


class ContentBlockOut(BaseModel):
    id: uuid.UUID
    key: str
    kind: str
    title: str | None
    body: str | None
    data: dict
    is_active: bool
    sort_order: int

    model_config = {"from_attributes": True}


class ContentBlockCreate(BaseModel):
    key: str = Field(min_length=1, max_length=80)
    kind: str = Field(min_length=1, max_length=40)
    title: str | None = None
    body: str | None = None
    data: dict = Field(default_factory=dict)
    is_active: bool = True
    sort_order: int = 0


class ContentBlockUpdate(BaseModel):
    key: str | None = None
    kind: str | None = None
    title: str | None = None
    body: str | None = None
    data: dict | None = None
    is_active: bool | None = None
    sort_order: int | None = None
