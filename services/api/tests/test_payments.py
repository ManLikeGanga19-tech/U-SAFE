"""Daraja (sandbox/live) paths: STK errors, callback verification, reconcile."""
from __future__ import annotations

import io
import json
import urllib.error
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.commerce import Order, Payment, PaymentStatus
from app.services import mpesa
from app.worker import reconcile_once
from tests.conftest import add_to_cart, checkout, on_hand


class FakeDaraja:
    """Stands in for mpesa._http. Set .stk / .query to control responses."""

    def __init__(self):
        self.stk = {
            "ResponseCode": "0",
            "CheckoutRequestID": "ws_CO_TEST_1",
            "MerchantRequestID": "m-1",
            "CustomerMessage": "Success. Request accepted for processing",
        }
        self.query = {"ResultCode": "0", "ResultDesc": "The service request is processed successfully."}
        self.calls: list[str] = []

    def __call__(self, method, url, *, headers, data=None):
        self.calls.append(url)
        if "oauth" in url:
            return {"access_token": "tok"}
        if "stkpushquery" in url:
            if isinstance(self.query, Exception):
                raise self.query
            return self.query
        if "processrequest" in url:
            if isinstance(self.stk, Exception):
                raise self.stk
            return self.stk
        raise AssertionError(url)


@pytest.fixture
def daraja(monkeypatch, mpesa_mode):
    mpesa_mode("sandbox")
    fake = FakeDaraja()
    monkeypatch.setattr(mpesa, "_http", fake)
    return fake


def callback(cid: str, code: int = 0, receipt: str = "SJK1ABC2DE", amount: int = 1000) -> dict:
    stk = {"MerchantRequestID": "m-1", "CheckoutRequestID": cid, "ResultCode": code,
           "ResultDesc": "ok" if code == 0 else "Request cancelled by user"}
    if code == 0:
        stk["CallbackMetadata"] = {"Item": [
            {"Name": "Amount", "Value": amount},
            {"Name": "MpesaReceiptNumber", "Value": receipt},
            {"Name": "PhoneNumber", "Value": 254712345678},
        ]}
    return {"Body": {"stkCallback": stk}}


def _order(number):
    s = SessionLocal()
    try:
        o = s.scalar(select(Order).where(Order.number == number))
        p = s.scalar(select(Payment).where(Payment.order_id == o.id).order_by(Payment.created_at.desc()))
        return o.status.value, p.status, p.mpesa_receipt
    finally:
        s.close()


def test_daraja_rejection_is_a_clean_502_and_cart_survives(client, make_variant, daraja):
    daraja.stk = {"errorCode": "400.002.02", "errorMessage": "Bad Request - Invalid PhoneNumber"}
    vid = make_variant(stock=3)
    token = add_to_cart(client, vid)
    r = checkout(client, token)
    assert r.status_code == 502
    assert "Invalid PhoneNumber" in r.json()["detail"]
    assert on_hand(vid) == 3
    assert len(client.get("/api/v1/cart", headers={"X-Cart-Token": token}).json()["items"]) == 1


def test_daraja_unreachable_is_a_clean_502(client, make_variant, daraja):
    daraja.stk = mpesa.MpesaError("Could not reach M-Pesa: timed out")
    vid = make_variant(stock=3)
    r = checkout(client, add_to_cart(client, vid))
    assert r.status_code == 502
    assert on_hand(vid) == 3


def test_genuine_success_callback(client, make_variant, daraja):
    vid = make_variant(stock=3)
    number = checkout(client, add_to_cart(client, vid)).json()["order_number"]
    r = client.post("/api/v1/payments/mpesa/callback", json=callback("ws_CO_TEST_1"))
    assert r.json()["ResultCode"] == 0
    assert _order(number) == ("paid", PaymentStatus.success, "SJK1ABC2DE")
    assert on_hand(vid) == 2

    # Daraja retries the callback: no double decrement.
    client.post("/api/v1/payments/mpesa/callback", json=callback("ws_CO_TEST_1"))
    assert on_hand(vid) == 2


def test_forged_success_callback_is_not_trusted(client, make_variant, daraja):
    """Anyone can POST to the callback. Daraja says the customer cancelled."""
    vid = make_variant(stock=3)
    number = checkout(client, add_to_cart(client, vid)).json()["order_number"]
    daraja.query = {"ResultCode": "1032", "ResultDesc": "Request cancelled by user"}

    client.post("/api/v1/payments/mpesa/callback", json=callback("ws_CO_TEST_1"))
    status, pay_status, receipt = _order(number)
    assert status == "pending"
    assert pay_status == PaymentStatus.failed
    assert receipt is None
    assert on_hand(vid) == 3


def test_callback_while_daraja_still_processing_stays_pending(client, make_variant, daraja):
    vid = make_variant(stock=3)
    number = checkout(client, add_to_cart(client, vid)).json()["order_number"]
    daraja.query = {"errorCode": "500.001.1001", "errorMessage": "The transaction is being processed"}

    client.post("/api/v1/payments/mpesa/callback", json=callback("ws_CO_TEST_1"))
    assert _order(number)[:2] == ("pending", PaymentStatus.pending)
    assert on_hand(vid) == 2  # still reserved

    # Later the reconcile job settles it, keeping the receipt from the callback.
    daraja.query = {"ResultCode": "0", "ResultDesc": "ok"}
    counts = reconcile_once(now=datetime.now(timezone.utc) + timedelta(minutes=10))
    assert counts["paid"] == 1
    assert _order(number) == ("paid", PaymentStatus.success, "SJK1ABC2DE")


def test_unknown_or_malformed_callbacks_are_acked(client, daraja):
    for body in [{}, {"Body": None}, {"Body": {"stkCallback": None}}, callback("nope")]:
        r = client.post("/api/v1/payments/mpesa/callback", json=body)
        assert r.status_code == 200 and r.json()["ResultCode"] == 0


def test_reconcile_settles_lost_callbacks(client, make_variant, daraja):
    vid = make_variant(stock=5)
    paid = checkout(client, add_to_cart(client, vid)).json()["order_number"]
    daraja.stk = {**daraja.stk, "CheckoutRequestID": "ws_CO_TEST_2"}
    failed = checkout(client, add_to_cart(client, vid)).json()["order_number"]
    assert on_hand(vid) == 3

    # Not stale yet → untouched.
    assert reconcile_once() == {"paid": 0, "failed": 0, "pending": 0}

    later = datetime.now(timezone.utc) + timedelta(minutes=10)
    answers = iter([
        {"ResultCode": "0", "ResultDesc": "ok"},
        {"ResultCode": "1037", "ResultDesc": "DS timeout user cannot be reached"},
    ])
    original = daraja.__call__

    def scripted(method, url, *, headers, data=None):
        if "stkpushquery" in url:
            return next(answers)
        return original(method, url, headers=headers, data=data)

    import app.services.mpesa as m
    m._http = scripted
    try:
        counts = reconcile_once(now=later)
    finally:
        m._http = daraja
    assert counts == {"paid": 1, "failed": 1, "pending": 0}
    assert _order(paid)[0] == "paid"
    assert _order(failed)[:2] == ("pending", PaymentStatus.failed)
    assert on_hand(vid) == 4


def test_reconcile_survives_daraja_outage(client, make_variant, daraja):
    vid = make_variant(stock=5)
    number = checkout(client, add_to_cart(client, vid)).json()["order_number"]
    daraja.query = mpesa.MpesaError("Could not reach M-Pesa")
    counts = reconcile_once(now=datetime.now(timezone.utc) + timedelta(minutes=10))
    assert counts["pending"] == 1
    assert _order(number)[:2] == ("pending", PaymentStatus.pending)


# ── mpesa module unit tests ────────────────────────────────
@pytest.mark.parametrize(
    "raw,expected",
    [
        ("0712345678", "254712345678"),
        ("+254 712 345 678", "254712345678"),
        ("0712-345-678", "254712345678"),
        ("712345678", "254712345678"),
        ("0110123456", "254110123456"),
    ],
)
def test_normalize_phone(raw, expected):
    assert mpesa.normalize_phone(raw) == expected
    assert mpesa.is_valid_msisdn(raw)


@pytest.mark.parametrize("raw", ["12345", "0812345678", "", "2547123456789", "07123abcde"])
def test_invalid_phones(raw):
    assert not mpesa.is_valid_msisdn(raw)


def test_http_turns_daraja_error_bodies_into_dicts(monkeypatch):
    body = json.dumps({"errorCode": "404.001.03", "errorMessage": "Invalid Access Token"}).encode()

    def boom(req, timeout):
        raise urllib.error.HTTPError(req.full_url, 400, "Bad Request", {}, io.BytesIO(body))

    monkeypatch.setattr(mpesa.urllib.request, "urlopen", boom)
    out = mpesa._http("GET", "https://sandbox.safaricom.co.ke/x", headers={})
    assert out["errorMessage"] == "Invalid Access Token"
    assert out["_http_status"] == 400


def test_http_network_failure_is_mpesa_error(monkeypatch):
    def boom(req, timeout):
        raise urllib.error.URLError("Name or service not known")

    monkeypatch.setattr(mpesa.urllib.request, "urlopen", boom)
    with pytest.raises(mpesa.MpesaError):
        mpesa._http("GET", "https://sandbox.safaricom.co.ke/x", headers={})


def test_http_non_json_error_is_mpesa_error(monkeypatch):
    def boom(req, timeout):
        raise urllib.error.HTTPError(req.full_url, 503, "Unavailable", {}, io.BytesIO(b"<html>"))

    monkeypatch.setattr(mpesa.urllib.request, "urlopen", boom)
    with pytest.raises(mpesa.MpesaError, match="503"):
        mpesa._http("GET", "https://sandbox.safaricom.co.ke/x", headers={})


def test_stk_timestamp_is_nairobi_time():
    ts = mpesa._timestamp()
    eat = datetime.now(timezone(timedelta(hours=3)))
    assert abs(datetime.strptime(ts, "%Y%m%d%H%M%S") - eat.replace(tzinfo=None)) < timedelta(minutes=1)
