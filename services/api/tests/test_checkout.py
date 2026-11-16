"""Checkout → stock reservation → mock payment, end to end through the API."""
from __future__ import annotations

import asyncio
import threading

from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.models.catalog import Product, ProductStatus, ProductVariant
from app.models.commerce import Order, OrderStatus, Payment, PaymentStatus
from app.models.inventory import StockMovement
from app.worker import process_mock_payment
from tests.conftest import add_to_cart, checkout, on_hand


def _payment_for(number: str) -> Payment:
    s = SessionLocal()
    try:
        order = s.scalar(select(Order).where(Order.number == number))
        return s.scalar(
            select(Payment).where(Payment.order_id == order.id).order_by(Payment.created_at.desc())
        )
    finally:
        s.close()


def _run_mock(payment_id, success: bool) -> str:
    return asyncio.run(process_mock_payment({}, str(payment_id), success))


def test_checkout_reserves_stock_and_payment_keeps_it(client, make_variant, jobs):
    vid = make_variant(price=1500, stock=5)
    token = add_to_cart(client, vid, qty=2)

    r = checkout(client, token)
    assert r.status_code == 200, r.text
    number = r.json()["order_number"]

    # Reserved immediately, so nobody else can buy these two units meanwhile.
    assert on_hand(vid) == 3
    assert jobs and jobs[0][0] == "process_mock_payment"
    # Cart is consumed.
    assert client.get("/api/v1/cart", headers={"X-Cart-Token": token}).json()["items"] == []

    payment = _payment_for(number)
    assert _run_mock(payment.id, True) == "paid"
    order = client.get(f"/api/v1/orders/{number}").json()
    assert order["status"] == "paid"
    assert order["payment"]["mpesa_receipt"].startswith("MOCK")
    assert on_hand(vid) == 3  # the reservation became the sale — no double decrement

    # A duplicate confirmation is a no-op.
    _run_mock(payment.id, True)
    assert on_hand(vid) == 3


def test_failed_payment_releases_stock_and_can_be_retried(client, make_variant, jobs):
    vid = make_variant(stock=4)
    token = add_to_cart(client, vid, qty=3)
    number = checkout(client, token).json()["order_number"]
    assert on_hand(vid) == 1

    _run_mock(_payment_for(number).id, False)
    order = client.get(f"/api/v1/orders/{number}").json()
    assert order["status"] == "pending"
    assert order["payment"]["status"] == "failed"
    assert order["can_retry_payment"] is True
    assert on_hand(vid) == 4  # back on the shelf

    r = client.post(f"/api/v1/orders/{number}/retry-payment", json={"mpesa_phone": "0712345678"})
    assert r.status_code == 200, r.text
    assert on_hand(vid) == 1  # re-reserved
    assert client.get(f"/api/v1/orders/{number}").json()["payment"]["status"] == "pending"

    # Can't retry while a payment is in flight.
    r = client.post(f"/api/v1/orders/{number}/retry-payment", json={"mpesa_phone": "0712345678"})
    assert r.status_code == 409

    _run_mock(_payment_for(number).id, True)
    assert client.get(f"/api/v1/orders/{number}").json()["status"] == "paid"
    assert on_hand(vid) == 1


def test_retry_refused_when_stock_ran_out(client, make_variant, db):
    vid = make_variant(stock=2)
    number = checkout(client, add_to_cart(client, vid, qty=2)).json()["order_number"]
    _run_mock(_payment_for(number).id, False)
    assert on_hand(vid) == 2

    # Someone else buys both units meanwhile.
    other = checkout(client, add_to_cart(client, vid, qty=2)).json()["order_number"]
    assert on_hand(vid) == 0

    r = client.post(f"/api/v1/orders/{number}/retry-payment", json={"mpesa_phone": "0712345678"})
    assert r.status_code == 409
    assert "Insufficient stock" in r.json()["detail"]
    assert on_hand(vid) == 0
    assert other


def test_invalid_phone_rejected_before_anything_happens(client, make_variant):
    vid = make_variant(stock=5)
    token = add_to_cart(client, vid)
    r = checkout(client, token, phone="12345")
    assert r.status_code == 422
    assert "Safaricom" in r.json()["detail"]
    assert on_hand(vid) == 5
    assert len(client.get("/api/v1/cart", headers={"X-Cart-Token": token}).json()["items"]) == 1


def test_insufficient_stock_keeps_cart(client, make_variant, db):
    vid = make_variant(stock=1)
    token = add_to_cart(client, vid, qty=3)
    r = checkout(client, token)
    assert r.status_code == 409
    assert "Insufficient stock" in r.json()["detail"]
    assert db.scalar(select(func.count()).select_from(Order)) == 0
    assert len(client.get("/api/v1/cart", headers={"X-Cart-Token": token}).json()["items"]) == 1
    assert on_hand(vid) == 1


def test_unpublished_products_cannot_be_bought(client, make_variant, db):
    draft = make_variant(status=ProductStatus.draft)
    r = client.post("/api/v1/cart/items", json={"variant_id": str(draft), "quantity": 1})
    assert r.status_code == 400

    vid = make_variant(stock=5)
    token = add_to_cart(client, vid)
    # Archived after it was put in the cart.
    product = db.get(ProductVariant, vid).product
    product.status = ProductStatus.archived
    db.commit()
    r = checkout(client, token)
    assert r.status_code == 409
    assert on_hand(vid) == 5


def test_last_unit_cannot_be_sold_twice(client, make_variant):
    """Two shoppers check out the last unit at the same moment."""
    vid = make_variant(stock=1)
    tokens = [add_to_cart(client, vid), add_to_cart(client, vid)]
    results: list[int] = []
    barrier = threading.Barrier(2)

    def go(tok):
        barrier.wait()
        results.append(checkout(client, tok).status_code)

    threads = [threading.Thread(target=go, args=(t,)) for t in tokens]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert sorted(results) == [200, 409]
    assert on_hand(vid) == 0


def test_public_order_hides_checkout_request_id(client, make_variant, admin_headers, db):
    vid = make_variant()
    number = checkout(client, add_to_cart(client, vid)).json()["order_number"]
    public = client.get(f"/api/v1/orders/{number}").json()
    assert public["payment"]["checkout_request_id"] is None

    order_id = public["id"]
    admin = client.get(f"/api/v1/admin/orders/{order_id}", headers=admin_headers).json()
    assert admin["payment"]["checkout_request_id"]


def test_ledger_matches_on_hand(client, make_variant, db):
    vid = make_variant(stock=10)
    n1 = checkout(client, add_to_cart(client, vid, qty=2)).json()["order_number"]
    n2 = checkout(client, add_to_cart(client, vid, qty=3)).json()["order_number"]
    _run_mock(_payment_for(n1).id, True)
    _run_mock(_payment_for(n2).id, False)
    ledger = db.scalar(
        select(func.sum(StockMovement.delta)).where(StockMovement.variant_id == vid)
    )
    assert ledger == on_hand(vid) == 8
    assert db.scalar(select(Order.status).where(Order.number == n1)) == OrderStatus.paid
    assert db.scalar(select(Product).limit(1)) is not None
    assert _payment_for(n2).status == PaymentStatus.failed
