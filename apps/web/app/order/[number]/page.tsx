"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatKES } from "@/lib/cart";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface OrderLine {
  sku: string;
  name: string;
  unit_price_kes: number;
  quantity: number;
  line_total_kes: number;
}
interface Order {
  number: string;
  status: string;
  total_kes: number;
  contact_name: string | null;
  items: OrderLine[];
  payment: { status: string; mpesa_receipt: string | null } | null;
  can_retry_payment: boolean;
}

export default function OrderPage() {
  const { number } = useParams<{ number: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [retryPhone, setRetryPhone] = useState("");
  const [retryBusy, setRetryBusy] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [pollKey, setPollKey] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function retry(e: React.FormEvent) {
    e.preventDefault();
    setRetryBusy(true);
    setRetryError(null);
    try {
      const res = await fetch(`${API}/api/v1/orders/${number}/retry-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mpesa_phone: retryPhone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { detail?: string }).detail || "Couldn't resend the M-Pesa prompt");
      setOrder((o) => (o ? { ...o, payment: { status: "pending", mpesa_receipt: null }, can_retry_payment: false } : o));
      setPollKey((k) => k + 1); // restart polling
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetryBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const res = await fetch(`${API}/api/v1/orders/${number}`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        const data: Order = await res.json();
        if (!active) return;
        setOrder(data);
        const settled =
          data.status !== "pending" || data.payment?.status === "failed";
        if (settled && timer.current) {
          clearInterval(timer.current);
          timer.current = null;
        }
      } catch {
        /* keep polling */
      }
    }
    poll();
    timer.current = setInterval(poll, 2500);
    return () => {
      active = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, [number, pollKey]);

  if (notFound) {
    return (
      <div className="shell py-20 text-center">
        <h1 className="text-4xl font-black uppercase">Order not found</h1>
        <Link href="/catalog" className="btn-signal mt-8 inline-flex">Back to catalog</Link>
      </div>
    );
  }
  if (!order) {
    return <div className="shell py-16 font-mono text-sm text-ink-400">Loading order…</div>;
  }

  const paid = order.status === "paid" || order.status === "fulfilled" || order.status === "processing";
  const failed = order.payment?.status === "failed";
  const awaiting = !paid && !failed;

  return (
    <div className="shell max-w-3xl py-12">
      {/* Status banner */}
      <div
        className={`border-2 border-ink-900 ${
          paid ? "bg-signal-500" : failed ? "bg-hivis-400" : "bg-ink-900 text-white"
        }`}
      >
        <div className="p-6">
          <span className="font-mono text-xs uppercase tracking-wideCaps">
            Order {order.number}
          </span>
          <h1 className="mt-2 text-4xl font-black uppercase md:text-5xl">
            {paid ? "Payment received ✓" : failed ? "Payment failed" : "Awaiting M-Pesa…"}
          </h1>
          <p className={`mt-2 ${paid || failed ? "text-ink-900" : "text-ink-300"}`}>
            {paid
              ? "Thank you — we're preparing your order for dispatch."
              : failed
                ? "The M-Pesa payment didn't go through. Please try again or contact us."
                : "Check your phone and enter your M-Pesa PIN to complete payment."}
          </p>
          {awaiting && (
            <div className="mt-4 flex items-center gap-2 font-mono text-xs text-ink-400">
              <span className="inline-block h-2 w-2 animate-pulse bg-signal-500" />
              Waiting for confirmation…
            </div>
          )}
          {paid && order.payment?.mpesa_receipt && (
            <p className="mt-3 font-mono text-xs text-ink-800">
              M-Pesa receipt: {order.payment.mpesa_receipt}
            </p>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="mt-6 border-2 border-ink-900 bg-white">
        <div className="border-b-2 border-ink-900 p-5">
          <h2 className="font-display text-lg font-black uppercase">Items</h2>
        </div>
        <div className="divide-y divide-ink-100">
          {order.items.map((it) => (
            <div key={it.sku} className="flex justify-between gap-3 px-5 py-3 text-sm">
              <span className="text-ink-700">{it.quantity} × {it.name}</span>
              <span className="font-mono">{formatKES(it.line_total_kes)}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t-2 border-ink-900 p-5">
          <span className="font-display uppercase tracking-wideCaps">Total</span>
          <span className="font-display text-2xl font-black">{formatKES(order.total_kes)}</span>
        </div>
      </div>

      {failed && order.can_retry_payment && (
        <form onSubmit={retry} className="mt-6 border-2 border-ink-900 bg-white p-5">
          <h2 className="font-display text-lg font-black uppercase">Try the payment again</h2>
          <p className="mt-1 text-sm text-ink-500">
            Your order is saved. We&apos;ll send a new M-Pesa prompt to this number.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <input
              className="min-w-[200px] flex-1 border-2 border-ink-900 bg-white px-3 py-2.5 text-sm focus:outline-none focus:shadow-focus"
              value={retryPhone}
              onChange={(e) => setRetryPhone(e.target.value)}
              placeholder="07XX XXX XXX"
              aria-label="M-Pesa phone number"
              required
            />
            <button type="submit" disabled={retryBusy} className="btn-signal disabled:opacity-60">
              {retryBusy ? "Sending…" : "Resend M-Pesa prompt →"}
            </button>
          </div>
          {retryError && <p className="mt-2 text-sm font-medium text-hivis-700">{retryError}</p>}
        </form>
      )}

      <div className="mt-6 flex gap-3">
        <Link href="/catalog" className="btn-ghost">Continue shopping</Link>
      </div>
    </div>
  );
}
