"""Safaricom Daraja (M-Pesa) STK Push.

Three modes (settings.MPESA_MODE):
  - "mock"    : no network; checkout returns a fake CheckoutRequestID and the
                ARQ worker simulates the customer confirming after a short delay.
  - "sandbox" : real Daraja sandbox API (needs credentials + public callback URL).
  - "live"    : production Daraja.

The mock lets the full order → payment → stock flow run locally in Docker.
"""
from __future__ import annotations

import base64
import json
import secrets
import urllib.request
from datetime import datetime

from app.core.config import settings


class MpesaError(Exception):
    pass


def normalize_phone(phone: str) -> str:
    """Return a Safaricom MSISDN as 2547XXXXXXXX / 2541XXXXXXXX."""
    p = phone.strip().replace(" ", "").replace("+", "")
    if p.startswith("0") and len(p) == 10:
        p = "254" + p[1:]
    elif len(p) == 9 and p[0] in "71":
        p = "254" + p
    return p


# ── Daraja HTTP helpers (sandbox/live only) ───────────────
def _http(method: str, url: str, *, headers: dict, data: bytes | None = None) -> dict:
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def _access_token() -> str:
    creds = f"{settings.MPESA_CONSUMER_KEY}:{settings.MPESA_CONSUMER_SECRET}"
    auth = base64.b64encode(creds.encode()).decode()
    url = f"{settings.mpesa_base_url}/oauth/v1/generate?grant_type=client_credentials"
    data = _http("GET", url, headers={"Authorization": f"Basic {auth}"})
    token = data.get("access_token")
    if not token:
        raise MpesaError("Failed to obtain Daraja access token")
    return token


def _stk_password(timestamp: str) -> str:
    raw = f"{settings.MPESA_SHORTCODE}{settings.MPESA_PASSKEY}{timestamp}"
    return base64.b64encode(raw.encode()).decode()


def initiate_stk_push(
    *, phone: str, amount: int, account_ref: str, description: str
) -> dict:
    """Kick off an STK push. Returns {checkout_request_id, merchant_request_id, message}."""
    msisdn = normalize_phone(phone)

    if settings.MPESA_MODE == "mock":
        return {
            "checkout_request_id": "mock-" + secrets.token_hex(8),
            "merchant_request_id": "mock-" + secrets.token_hex(6),
            "message": "STK push sent (mock). Awaiting confirmation…",
        }

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    body = {
        "BusinessShortCode": settings.MPESA_SHORTCODE,
        "Password": _stk_password(timestamp),
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": amount,
        "PartyA": msisdn,
        "PartyB": settings.MPESA_SHORTCODE,
        "PhoneNumber": msisdn,
        "CallBackURL": settings.MPESA_CALLBACK_URL,
        "AccountReference": account_ref[:12],
        "TransactionDesc": description[:20],
    }
    url = f"{settings.mpesa_base_url}/mpesa/stkpush/v1/processrequest"
    data = _http(
        "POST",
        url,
        headers={
            "Authorization": f"Bearer {_access_token()}",
            "Content-Type": "application/json",
        },
        data=json.dumps(body).encode(),
    )
    if data.get("ResponseCode") not in ("0", 0):
        raise MpesaError(data.get("errorMessage") or data.get("ResponseDescription") or "STK push failed")
    return {
        "checkout_request_id": data.get("CheckoutRequestID"),
        "merchant_request_id": data.get("MerchantRequestID"),
        "message": data.get("CustomerMessage", "STK push sent"),
    }


def parse_callback(body: dict) -> dict:
    """Extract result from a Daraja STK callback payload."""
    stk = body.get("Body", {}).get("stkCallback", {})
    result_code = stk.get("ResultCode")
    checkout_request_id = stk.get("CheckoutRequestID")
    receipt = None
    for item in stk.get("CallbackMetadata", {}).get("Item", []):
        if item.get("Name") == "MpesaReceiptNumber":
            receipt = item.get("Value")
    return {
        "checkout_request_id": checkout_request_id,
        "success": result_code in (0, "0"),
        "result_code": result_code,
        "receipt": receipt,
    }
