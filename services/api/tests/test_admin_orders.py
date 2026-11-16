"""Admin order status changes: allowed transitions + stock side effects."""
from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.commerce import Order, Payment
from app.worker import process_mock_payment
from tests.conftest import add_to_cart, checkout, on_hand


def _place(client, vid, qty=1, pay: bool | None = None) -> str:
    number = checkout(client, add_to_cart(client, vid, qty=qty)).json()["order_number"]
    if pay is not None:
        s = SessionLocal()
        try:
            oid = s.scalar(select(Order.id).where(Order.number == number))
            pid = s.scalar(select(Payment.id).where(Payment.order_id == oid))
        finally:
            s.close()
        asyncio.run(process_mock_payment({}, str(pid), pay))
    return number


def _set(client, headers, number, status):
    oid = client.get(f"/api/v1/orders/{number}").json()["id"]
    return client.patch(f"/api/v1/admin/orders/{oid}", json={"status": status}, headers=headers)


def test_requires_staff(client, make_variant):
    number = _place(client, make_variant())
    oid = client.get(f"/api/v1/orders/{number}").json()["id"]
    assert client.patch(f"/api/v1/admin/orders/{oid}", json={"status": "paid"}).status_code == 401


def test_cancel_pending_releases_reservation(client, make_variant, admin_headers):
    vid = make_variant(stock=5)
    number = _place(client, vid, qty=2)
    assert on_hand(vid) == 3
    assert _set(client, admin_headers, number, "cancelled").status_code == 200
    assert on_hand(vid) == 5
    # Cancelling is final.
    r = _set(client, admin_headers, number, "paid")
    assert r.status_code == 409


def test_illegal_jumps_rejected(client, make_variant, admin_headers):
    number = _place(client, make_variant())
    r = _set(client, admin_headers, number, "fulfilled")
    assert r.status_code == 409
    assert "pending" in r.json()["detail"]


def test_fulfilment_flow_keeps_stock(client, make_variant, admin_headers):
    vid = make_variant(stock=5)
    number = _place(client, vid, qty=2, pay=True)
    for status in ["processing", "fulfilled"]:
        assert _set(client, admin_headers, number, status).status_code == 200
    assert on_hand(vid) == 3
    # Refund after shipping doesn't magically restock (goods aren't back).
    assert _set(client, admin_headers, number, "refunded").status_code == 200
    assert on_hand(vid) == 3


def test_refund_before_shipping_restocks(client, make_variant, admin_headers):
    vid = make_variant(stock=5)
    number = _place(client, vid, qty=2, pay=True)
    assert _set(client, admin_headers, number, "refunded").status_code == 200
    assert on_hand(vid) == 5
    # Idempotent: no second restock possible (refunded is terminal anyway).
    assert _set(client, admin_headers, number, "refunded").status_code == 200
    assert on_hand(vid) == 5


def test_manual_paid_after_failed_payment_takes_stock(client, make_variant, admin_headers):
    """Customer's STK failed, they paid by bank transfer, staff mark it paid."""
    vid = make_variant(stock=5)
    number = _place(client, vid, qty=2, pay=False)
    assert on_hand(vid) == 5
    assert _set(client, admin_headers, number, "paid").status_code == 200
    assert on_hand(vid) == 3


def test_admin_list_shows_latest_payment(client, make_variant, admin_headers):
    vid = make_variant(stock=5)
    number = _place(client, vid, pay=False)
    client.post(f"/api/v1/orders/{number}/retry-payment", json={"mpesa_phone": "0712345678"})
    rows = client.get("/api/v1/admin/orders", headers=admin_headers).json()["items"]
    assert rows[0]["number"] == number
    assert rows[0]["payment_status"] == "pending"
