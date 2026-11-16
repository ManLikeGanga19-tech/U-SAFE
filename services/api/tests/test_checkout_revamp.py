"""Checkout revamp: VAT, pickup/delivery, manual payment methods, B2B details."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.commerce import Order, Payment, PaymentProvider, PaymentStatus
from app.worker import expire_manual_once
from tests.conftest import CONTACT, add_to_cart, on_hand


def place(client, token, **body):
    payload = {
        "contact": CONTACT,
        "fulfilment": "delivery",
        "shipping_address": {"city": "Nairobi", "address": "Mombasa Rd"},
        "payment_method": "mpesa_stk",
        "mpesa_phone": "0712345678",
        **body,
    }
    return client.post("/api/v1/checkout", json=payload, headers={"X-Cart-Token": token})


def payments_for(number):
    s = SessionLocal()
    try:
        oid = s.scalar(select(Order.id).where(Order.number == number))
        return list(s.scalars(select(Payment).where(Payment.order_id == oid)))
    finally:
        s.close()


@pytest.fixture
def manual_methods(monkeypatch):
    monkeypatch.setattr(settings, "PAYBILL_NUMBER", "522522")
    monkeypatch.setattr(settings, "BANK_NAME", "KCB")
    monkeypatch.setattr(settings, "BANK_ACCOUNT_NAME", "U-SAFE KE LTD")
    monkeypatch.setattr(settings, "BANK_ACCOUNT_NUMBER", "1234567890")


# ── VAT ────────────────────────────────────────────────────
def test_vat_is_added_on_top_and_charged(client, make_variant):
    vid = make_variant(price=1500, stock=5)
    r = place(client, add_to_cart(client, vid, qty=2))
    assert r.status_code == 200, r.text
    order = client.get(f"/api/v1/orders/{r.json()['order_number']}").json()
    assert order["subtotal_kes"] == 3000
    assert order["vat_kes"] == 480
    assert order["vat_rate"] == 0.16
    assert order["total_kes"] == 3480
    assert payments_for(order["number"])[0].amount_kes == 3480


def test_vat_rounding_and_whole_shilling_stk_amount(client, make_variant, monkeypatch):
    sent = {}

    def fake_stk(**kw):
        sent.update(kw)
        return {"checkout_request_id": "x-1", "merchant_request_id": "m", "message": "ok"}

    monkeypatch.setattr("app.services.mpesa.initiate_stk_push", fake_stk)
    vid = make_variant(price=999.99, stock=5)
    number = place(client, add_to_cart(client, vid)).json()["order_number"]
    order = client.get(f"/api/v1/orders/{number}").json()
    assert order["vat_kes"] == 160.0  # 159.9984 → 160.00
    assert order["total_kes"] == 1159.99
    assert sent["amount"] == 1160


# ── Fulfilment ─────────────────────────────────────────────
def test_pickup_needs_no_address(client, make_variant):
    vid = make_variant()
    r = place(client, add_to_cart(client, vid), fulfilment="pickup", shipping_address={})
    assert r.status_code == 200, r.text
    order = client.get(f"/api/v1/orders/{r.json()['order_number']}").json()
    assert order["fulfilment"] == "pickup"
    assert order["pickup_address"] == settings.PICKUP_ADDRESS
    assert order["shipping_address"] == {}


def test_delivery_requires_city(client, make_variant):
    token = add_to_cart(client, make_variant())
    r = place(client, token, shipping_address={"city": "  ", "address": "x"})
    assert r.status_code == 422
    assert "city" in str(r.json()["detail"]).lower()


def test_stk_requires_phone(client, make_variant):
    r = place(client, add_to_cart(client, make_variant()), mpesa_phone=None)
    assert r.status_code == 422


def test_legacy_payload_still_works(client, make_variant):
    """Old storefront builds send only contact + shipping_address + mpesa_phone."""
    vid = make_variant()
    r = client.post(
        "/api/v1/checkout",
        json={"contact": CONTACT, "shipping_address": {"city": "Nakuru"}, "mpesa_phone": "0712345678"},
        headers={"X-Cart-Token": add_to_cart(client, vid)},
    )
    assert r.status_code == 200, r.text


# ── Options ────────────────────────────────────────────────
def test_options_only_offer_configured_methods(client, monkeypatch):
    opts = client.get("/api/v1/checkout/options").json()
    assert [m["id"] for m in opts["payment_methods"]] == ["mpesa_stk"]
    assert opts["vat_rate"] == 0.16

    monkeypatch.setattr(settings, "PAYBILL_NUMBER", "522522")
    monkeypatch.setattr(settings, "BANK_ACCOUNT_NUMBER", "123")
    ids = [m["id"] for m in client.get("/api/v1/checkout/options").json()["payment_methods"]]
    assert ids == ["mpesa_stk", "mpesa_paybill", "bank_transfer"]


def test_unconfigured_method_rejected(client, make_variant):
    r = place(client, add_to_cart(client, make_variant()), payment_method="bank_transfer")
    assert r.status_code == 422


# ── Manual payments ────────────────────────────────────────
def test_paybill_order_flow(client, make_variant, manual_methods, admin_headers, jobs):
    vid = make_variant(price=1000, stock=5)
    token = add_to_cart(client, vid, qty=2)
    r = place(client, token, payment_method="mpesa_paybill", mpesa_phone=None)
    assert r.status_code == 200, r.text
    assert r.json()["checkout_request_id"] is None
    number = r.json()["order_number"]

    assert on_hand(vid) == 3  # held while awaiting payment
    assert payments_for(number) == [] and jobs == []
    assert client.get("/api/v1/cart", headers={"X-Cart-Token": token}).json()["items"] == []

    order = client.get(f"/api/v1/orders/{number}").json()
    ins = order["payment_instructions"]
    assert ins["paybill"] == "522522"
    assert ins["reference"] == number
    assert ins["amount_kes"] == 2320
    assert ins["due_at"]

    r = client.post(f"/api/v1/orders/{number}/payment-reference", json={"reference": " sjk1abc2de "})
    assert r.status_code == 200
    assert r.json()["payment_reference"] == "SJK1ABC2DE"

    # Staff verify and mark paid → a manual payment record carries the code.
    oid = order["id"]
    r = client.patch(f"/api/v1/admin/orders/{oid}", json={"status": "paid"}, headers=admin_headers)
    assert r.status_code == 200, r.text
    (pay,) = payments_for(number)
    assert pay.provider == PaymentProvider.manual
    assert pay.status == PaymentStatus.success
    assert pay.mpesa_receipt == "SJK1ABC2DE"
    assert float(pay.amount_kes) == 2320
    assert on_hand(vid) == 3

    after = client.get(f"/api/v1/orders/{number}").json()
    assert after["status"] == "paid" and after["payment_instructions"] is None
    r = client.post(f"/api/v1/orders/{number}/payment-reference", json={"reference": "SJK1ABC2DF"})
    assert r.status_code == 409


def test_bank_instructions(client, make_variant, manual_methods):
    vid = make_variant(price=500)
    number = place(
        client, add_to_cart(client, vid), payment_method="bank_transfer", mpesa_phone=None
    ).json()["order_number"]
    ins = client.get(f"/api/v1/orders/{number}").json()["payment_instructions"]
    assert ins["account_number"] == "1234567890"
    assert ins["bank_name"] == "KCB"
    assert ins["amount_kes"] == 580


def test_reference_rejected_for_stk_orders(client, make_variant):
    number = place(client, add_to_cart(client, make_variant())).json()["order_number"]
    r = client.post(f"/api/v1/orders/{number}/payment-reference", json={"reference": "SJK1ABC2DE"})
    assert r.status_code == 409


def test_bad_reference_format(client, make_variant, manual_methods):
    number = place(
        client, add_to_cart(client, make_variant()), payment_method="mpesa_paybill"
    ).json()["order_number"]
    r = client.post(f"/api/v1/orders/{number}/payment-reference", json={"reference": "abc; drop"})
    assert r.status_code == 422


def test_unpaid_manual_orders_expire_and_release_stock(client, make_variant, manual_methods):
    vid = make_variant(stock=5)
    unpaid = place(client, add_to_cart(client, vid, qty=2), payment_method="mpesa_paybill").json()["order_number"]
    reported = place(client, add_to_cart(client, vid, qty=1), payment_method="bank_transfer").json()["order_number"]
    client.post(f"/api/v1/orders/{reported}/payment-reference", json={"reference": "FT123456789"})
    stk = place(client, add_to_cart(client, vid, qty=1)).json()["order_number"]
    assert on_hand(vid) == 1

    assert expire_manual_once() == 0  # not due yet
    later = datetime.now(timezone.utc) + timedelta(days=settings.MANUAL_PAYMENT_HOLD_DAYS, hours=1)
    assert expire_manual_once(now=later) == 1

    assert client.get(f"/api/v1/orders/{unpaid}").json()["status"] == "cancelled"
    # Customer said they paid → left for staff; STK orders aren't touched.
    assert client.get(f"/api/v1/orders/{reported}").json()["status"] == "pending"
    assert client.get(f"/api/v1/orders/{stk}").json()["status"] == "pending"
    assert on_hand(vid) == 3


def test_manual_order_can_switch_to_stk(client, make_variant, manual_methods):
    vid = make_variant(stock=5)
    number = place(client, add_to_cart(client, vid), payment_method="bank_transfer").json()["order_number"]
    assert client.get(f"/api/v1/orders/{number}").json()["can_retry_payment"] is True
    r = client.post(f"/api/v1/orders/{number}/retry-payment", json={"mpesa_phone": "0712345678"})
    assert r.status_code == 200
    assert on_hand(vid) == 4  # still one reservation, not two


# ── B2B ────────────────────────────────────────────────────
def test_company_details_saved_and_validated(client, make_variant, admin_headers):
    vid = make_variant()
    bad = place(client, add_to_cart(client, vid), company={"name": "Acme", "kra_pin": "12345"})
    assert bad.status_code == 422
    assert "KRA PIN" in str(bad.json()["detail"])

    r = place(
        client,
        add_to_cart(client, vid),
        company={"name": " Acme Construction Ltd ", "kra_pin": "p051234567x", "po_number": "PO-778"},
    )
    assert r.status_code == 200, r.text
    order = client.get(f"/api/v1/orders/{r.json()['order_number']}").json()
    assert (order["company_name"], order["kra_pin"], order["po_number"]) == (
        "Acme Construction Ltd", "P051234567X", "PO-778",
    )
    row = client.get("/api/v1/admin/orders", headers=admin_headers).json()["items"][0]
    assert row["company_name"] == "Acme Construction Ltd"
    assert row["payment_method"] == "mpesa_stk"
