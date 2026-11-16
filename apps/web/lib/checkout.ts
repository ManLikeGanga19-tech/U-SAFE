"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export type PaymentMethod = "mpesa_stk" | "mpesa_paybill" | "bank_transfer";
export type Fulfilment = "pickup" | "delivery";

export interface CheckoutOptions {
  vat_rate: number;
  pickup_address: string;
  pickup_hours: string | null;
  manual_hold_days: number;
  payment_methods: { id: PaymentMethod; label: string; description: string }[];
}

// Used until /checkout/options answers (and if it can't be reached).
export const DEFAULT_OPTIONS: CheckoutOptions = {
  vat_rate: 0.16,
  pickup_address: "Ashray Industrial Park, Nairobi",
  pickup_hours: null,
  manual_hold_days: 3,
  payment_methods: [
    {
      id: "mpesa_stk",
      label: "M-Pesa (prompt on your phone)",
      description: "We send a payment request to your phone. Enter your PIN to confirm.",
    },
  ],
};

export function useCheckoutOptions(): CheckoutOptions {
  const [opts, setOpts] = useState<CheckoutOptions>(DEFAULT_OPTIONS);
  useEffect(() => {
    let alive = true;
    fetch(`${API}/api/v1/checkout/options`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) setOpts(d as CheckoutOptions);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return opts;
}

/** Same rounding as the server: 2 dp, half up. */
export function vatFor(subtotal: number, rate: number): number {
  return Math.round(subtotal * rate * 100 + Number.EPSILON) / 100;
}

/** FastAPI returns `detail` as a string, or a list of field errors on 422. */
export function apiErrorMessage(data: unknown, fallback: string): string {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as { msg?: string };
    if (first?.msg) return first.msg.replace(/^Value error, /, "");
  }
  return fallback;
}

/** Kenyan mobile: 07XX… / 01XX… / 2547… / +2547… */
export function isSafaricomNumber(phone: string): boolean {
  let p = phone.replace(/[\s\-()+]/g, "");
  if (p.startsWith("0") && p.length === 10) p = "254" + p.slice(1);
  else if (p.length === 9 && /^[71]/.test(p)) p = "254" + p;
  return /^254[71]\d{8}$/.test(p);
}

export const KRA_PIN_RE = /^[AP]\d{9}[A-Z]$/;

// Remember the shopper's details on this device so repeat orders are quick.
const SAVED_KEY = "usafe_checkout_details";

export interface SavedDetails {
  name: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  companyName: string;
  kraPin: string;
}

export function loadSavedDetails(): Partial<SavedDetails> {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? (JSON.parse(raw) as Partial<SavedDetails>) : {};
  } catch {
    return {};
  }
}

export function saveDetails(d: SavedDetails) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(d));
  } catch {
    /* private mode etc. */
  }
}

export function forgetDetails() {
  try {
    localStorage.removeItem(SAVED_KEY);
  } catch {
    /* ignore */
  }
}
