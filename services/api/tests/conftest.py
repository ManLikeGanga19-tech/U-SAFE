"""Test harness: a real Postgres (row locks, JSONB and enums matter here).

Point POSTGRES_* at a throwaway database. The schema is built with the real
Alembic migrations (so migrations are tested too), and every table is truncated
between tests.

    docker run -d --name usafe-test-pg -p 55432:5432 \
      -e POSTGRES_USER=usafe -e POSTGRES_PASSWORD=usafe_test_pw \
      -e POSTGRES_DB=usafe_test postgres:16-alpine
    POSTGRES_HOST=localhost POSTGRES_PORT=55432 POSTGRES_DB=usafe_test \
      POSTGRES_PASSWORD=usafe_test_pw pytest
"""
from __future__ import annotations

import os
import uuid

os.environ.setdefault("POSTGRES_HOST", "localhost")
os.environ.setdefault("POSTGRES_PORT", "55432")
os.environ.setdefault("POSTGRES_USER", "usafe")
os.environ.setdefault("POSTGRES_PASSWORD", "usafe_test_pw")
os.environ.setdefault("POSTGRES_DB", "usafe_test")
os.environ["ENVIRONMENT"] = "development"
os.environ["MPESA_MODE"] = "mock"
os.environ["JWT_SECRET"] = "test-secret"

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.database import SessionLocal, engine  # noqa: E402
from app.core.security import create_access_token, hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402
from app.models.catalog import Product, ProductStatus, ProductVariant  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.services import inventory  # noqa: E402
from app.models.inventory import StockReason  # noqa: E402

API_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@pytest.fixture(scope="session", autouse=True)
def _schema():
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
    cfg = Config(os.path.join(API_DIR, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(API_DIR, "alembic"))
    command.upgrade(cfg, "head")
    yield


@pytest.fixture(autouse=True)
def _clean_tables():
    yield
    names = ", ".join(f'"{t.name}"' for t in reversed(Base.metadata.sorted_tables))
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))


@pytest.fixture(autouse=True)
def jobs(monkeypatch):
    """Capture ARQ enqueues instead of talking to Redis."""
    captured: list[tuple] = []
    monkeypatch.setattr(
        "app.api.v1.checkout.enqueue",
        lambda name, *args, **kw: captured.append((name, args, kw)),
    )
    return captured


@pytest.fixture
def mpesa_mode(monkeypatch):
    def _set(mode: str):
        monkeypatch.setattr(settings, "MPESA_MODE", mode)

    return _set


@pytest.fixture
def db():
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def make_variant(db):
    def _make(price=1000, stock=5, status=ProductStatus.published, name=None):
        slug = f"p-{uuid.uuid4().hex[:8]}"
        product = Product(name=name or f"Helmet {slug}", slug=slug, status=status)
        db.add(product)
        db.flush()
        variant = ProductVariant(
            product_id=product.id, sku=f"SKU-{slug}", price_kes=price, is_active=True
        )
        db.add(variant)
        db.flush()
        if stock:
            inventory.adjust(db, variant.id, stock, reason=StockReason.restock)
        db.commit()
        return variant.id

    return _make


@pytest.fixture
def admin_headers(db):
    user = User(
        email=f"admin-{uuid.uuid4().hex[:6]}@test.local",
        hashed_password=hash_password("x"),
        role=UserRole.admin,
    )
    db.add(user)
    db.commit()
    return {"Authorization": f"Bearer {create_access_token(str(user.id), user.role.value)}"}


def on_hand(variant_id) -> int:
    s = SessionLocal()
    try:
        return inventory.on_hand(s, variant_id)
    finally:
        s.close()


CONTACT = {"name": "Jane Buyer", "email": "jane@example.com", "phone": "0712345678"}


def add_to_cart(client, variant_id, qty=1, token=None) -> str:
    headers = {"X-Cart-Token": token} if token else {}
    r = client.post(
        "/api/v1/cart/items", json={"variant_id": str(variant_id), "quantity": qty},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()["token"]


def checkout(client, token, phone="0712345678"):
    return client.post(
        "/api/v1/checkout",
        json={"contact": CONTACT, "shipping_address": {"city": "Nairobi"}, "mpesa_phone": phone},
        headers={"X-Cart-Token": token},
    )
