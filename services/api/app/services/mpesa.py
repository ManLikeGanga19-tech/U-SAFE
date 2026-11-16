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
import re
import secrets
import socket
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

from app.core.config import settings


class MpesaError(Exception):
    pass


# Kenya is UTC+3 all year (no DST). Daraja timestamps are local time; a fixed
# offset avoids depending on tzdata being present in the slim image.
EAT = timezone(timedelta(hours=3))

_MSISDN_RE = re.compile(r"^254(7|1)\d{8}$")


def normalize_phone(phone: str) -> str:
    """Return a Safaricom MSISDN as 2547XXXXXXXX / 2541XXXXXXXX."""
    p = re.sub(r"[\s\-()]", "", phone.strip()).replace("+", "")
    if p.startswith("0") and len(p) == 10:
        p = "254" + p[1:]
    elif len(p) == 9 and p[0] in "71":
        p = "254" + p
    return p


def is_valid_msisdn(phone: str) -> bool:
    return bool(_MSISDN_RE.match(normalize_phone(phone)))


# ── Daraja HTTP helpers (sandbox/live only) ───────────────
def _http(method: str, url: str, *, headers: dict, data: bytes | None = None) -> dict:
    """Call Daraja and return the JSON body.

    Daraja reports most failures (bad phone, bad credentials, rate limits, "still
    processing") as non-2xx responses with a JSON body. urllib raises HTTPError
    for those; we surface the body to callers instead of crashing with a 500.
    Network failures become MpesaError so checkout can answer cleanly.
    """
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode(errors="replace") if exc.fp else ""
        try:
            body = json.loads(raw) if raw else {}
        except ValueError:
            body = {}
        if isinstance(body, dict) and body:
            body.setdefault("_http_status", exc.code)
            return body
        raise MpesaError(f"Daraja HTTP {exc.code}: {raw[:200] or exc.reason}") from exc
    except (urllib.error.URLError, socket.timeout, TimeoutError, ConnectionError) as exc:
        raise MpesaError(f"Could not reach M-Pesa: {exc}") from exc
    except ValueError as exc:  # invalid JSON on a 2xx
        raise MpesaError("Invalid response from M-Pesa") from exc


def _access_token() -> str:
    creds = f"{settings.MPESA_CONSUMER_KEY}:{settings.MPESA_CONSUMER_SECRET}"
    auth = base64.b64encode(creds.encode()).decode()
    url = f"{settings.mpesa_base_url}/oauth/v1/generate?grant_type=client_credentials"
    data = _http("GET", url, headers={"Authorization": f"Basic {auth}"})
    token = data.get("access_token")
    if not token:
        raise MpesaError(
            "Failed to obtain Daraja access token"
            + (f": {data.get('errorMessage')}" if data.get("errorMessage") else "")
        )
    return token


def _timestamp() -> str:
    return datetime.now(EAT).strftime("%Y%m%d%H%M%S")


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

    if not _MSISDN_RE.match(msisdn):
        raise MpesaError("Enter a valid Safaricom number, e.g. 07XX XXX XXX")

    timestamp = _timestamp()
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


def query_stk_status(checkout_request_id: str) -> dict:
    """Ask Daraja for the authoritative outcome of an STK push.

    Returns {"state": "success" | "failed" | "pending", "result_code", "desc"}.
    "pending" means not settled yet (or Daraja couldn't tell us) — try later.
    Raises MpesaError only for transport/credential problems.
    """
    timestamp = _timestamp()
    body = {
        "BusinessShortCode": settings.MPESA_SHORTCODE,
        "Password": _stk_password(timestamp),
        "Timestamp": timestamp,
        "CheckoutRequestID": checkout_request_id,
    }
    url = f"{settings.mpesa_base_url}/mpesa/stkpushquery/v1/query"
    data = _http(
        "POST",
        url,
        headers={
            "Authorization": f"Bearer {_access_token()}",
            "Content-Type": "application/json",
        },
        data=json.dumps(body).encode(),
    )
    if data.get("errorCode"):
        # e.g. 500.001.1001 "The transaction is being processed", or rate limit.
        return {
            "state": "pending",
            "result_code": data.get("errorCode"),
            "desc": data.get("errorMessage", ""),
        }
    result_code = data.get("ResultCode")
    if result_code is None:
        return {"state": "pending", "result_code": None, "desc": "no result yet"}
    return {
        "state": "success" if str(result_code) == "0" else "failed",
        "result_code": str(result_code),
        "desc": data.get("ResultDesc", ""),
    }


def parse_callback(body: dict) -> dict:
    """Extract result from a Daraja STK callback payload."""
    stk = (body.get("Body") or {}).get("stkCallback") or {}
    result_code = stk.get("ResultCode")
    checkout_request_id = stk.get("CheckoutRequestID")
    receipt = None
    for item in (stk.get("CallbackMetadata") or {}).get("Item") or []:
        if item.get("Name") == "MpesaReceiptNumber":
            receipt = item.get("Value")
    return {
        "checkout_request_id": checkout_request_id,
        "success": result_code in (0, "0"),
        "result_code": result_code,
        "receipt": receipt,
    }
