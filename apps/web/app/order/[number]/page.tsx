"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatKES } from "@/lib/cart";
import { apiErrorMessage, isSafaricomNumber, PaymentMethod } from "@/lib/checkout";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface OrderLine {
  sku: string;
  name: string;
  unit_price_kes: number;
  quantity: number;
  line_total_kes: number;
}
interface Instructions {
  method: PaymentMethod;
  amount_kes: number;
  reference: string;
  paybill: string | null;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  branch: string | null;
  swift: string | null;
  due_at: string | null;
}
interface Order {
  number: string;
  status: string;
  subtotal_kes: number;
  vat_kes: number;
  vat_rate: number;
  total_kes: number;
  fulfilment: "pickup" | "delivery";
  payment_method: PaymentMethod;
  payment_reference: string | null;
  payment_instructions: Instructions | null;
  pickup_address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  company_name: string | null;
  kra_pin: string | null;
  po_number: string | null;
  shipping_address: Record<string, string>;
  items: OrderLine[];
  payment: { status: string; mpesa_receipt: string | null } | null;
  can_retry_payment: boolean;
}

const field =
  "min-w-[200px] flex-1 border-2 border-ink-900 bg-white px-3 py-2.5 text-sm focus:outline-none focus:shadow-focus";

export default function OrderPage() {
  const { number } = useParams<{ number: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`${API}/api/v1/orders/${number}`);
    if (res.status === 404) {
      setNotFound(true);
      return null;
    }
    if (!res.ok) return null;
    const data: Order = await res.json();
    setOrder(data);
    return data;
  }, [number]);

  // Poll quickly while an M-Pesa prompt is in flight, slowly while waiting for
  // staff to confirm a manual payment, and stop once the order is settled.
  const stkInFlight = order?.status === "pending" && order.payment?.status === "pending";
  const manualWaiting = order?.status === "pending" && !!order.payment_instructions;
  const interval = !order ? 2500 : stkInFlight ? 2500 : manualWaiting ? 20000 : 0;

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function tick() {
      try {
        await load();
      } catch {
        /* keep polling */
      }
      if (alive && interval) timer = setTimeout(tick, interval);
    }
    if (interval || !order) tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, interval]);

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

  const paid = ["paid", "processing", "fulfilled"].includes(order.status);
  const cancelled = order.status === "cancelled" || order.status === "refunded";
  const stkFailed = order.status === "pending" && order.payment?.status === "failed";
  const manual = !!order.payment_instructions;

  let tone = "bg-ink-900 text-white";
  let heading = "Awaiting M-Pesa…";
  let sub = "Check your phone and enter your M-Pesa PIN to complete payment.";
  if (paid) {
    tone = "bg-signal-500";
    heading = "Payment received ✓";
    sub =
      order.fulfilment === "pickup"
        ? "Thank you. We'll call you when your order is ready to collect."
        : "Thank you. We'll call you to confirm delivery cost and timing.";
  } else if (cancelled) {
    tone = "bg-ink-200";
    heading = order.status === "refunded" ? "Order refunded" : "Order cancelled";
    sub = "This order is closed. Contact us if you have questions.";
  } else if (stkFailed) {
    tone = "bg-hivis-400";
    heading = "Payment didn't go through";
    sub = "Your order is saved. Try the M-Pesa prompt again below.";
  } else if (manual && order.payment_reference) {
    tone = "bg-royal-600 text-white";
    heading = "Verifying your payment";
    sub = `Thanks! We're matching transaction ${order.payment_reference}. We'll confirm shortly.`;
  } else if (manual) {
    tone = "bg-royal-600 text-white";
    heading = "Order placed: complete payment";
    sub = "Use the details below. Your items are reserved while we wait.";
  }

  const addr = order.shipping_address || {};
  const vatPct = Math.round((order.vat_rate || 0) * 100);

  return (
    <div className="shell max-w-3xl py-12">
      <div className={`border-2 border-ink-900 ${tone}`}>
        <div className="p-6">
          <span className="font-mono text-xs uppercase tracking-wideCaps opacity-80">Order {order.number}</span>
          <h1 className="mt-2 text-3xl font-black uppercase md:text-5xl">{heading}</h1>
          <p className="mt-2 opacity-90">{sub}</p>
          {stkInFlight && (
            <div className="mt-4 flex items-center gap-2 font-mono text-xs opacity-80">
              <span className="inline-block h-2 w-2 animate-pulse bg-signal-500" />
              Waiting for confirmation…
            </div>
          )}
          {paid && order.payment?.mpesa_receipt && (
            <p className="mt-3 font-mono text-xs">Receipt / reference: {order.payment.mpesa_receipt}</p>
          )}
        </div>
      </div>

      {manual && order.payment_instructions && (
        <ManualPayment order={order} ins={order.payment_instructions} onChange={setOrder} />
      )}

      {order.status === "pending" && order.can_retry_payment && (
        <RetryStk
          number={order.number}
          defaultPhone={order.contact_phone || ""}
          title={manual ? "Prefer the M-Pesa prompt?" : "Try the payment again"}
          onSent={() => load()}
        />
      )}

      {/* Items + totals */}
      <div className="mt-6 border-2 border-ink-900 bg-white">
        <div className="border-b-2 border-ink-900 p-5">
          <h2 className="font-display text-lg font-black uppercase">Items</h2>
        </div>
        <ul className="divide-y divide-ink-100">
          {order.items.map((it) => (
            <li key={it.sku} className="flex justify-between gap-3 px-5 py-3 text-sm">
              <span className="text-ink-700">{it.quantity} × {it.name}</span>
              <span className="font-mono">{formatKES(it.line_total_kes)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1.5 border-t-2 border-ink-900 p-5 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-500">Subtotal{order.vat_kes ? " (excl. VAT)" : ""}</dt>
            <dd className="font-mono">{formatKES(order.subtotal_kes)}</dd>
          </div>
          {order.vat_kes > 0 && (
            <div className="flex justify-between">
              <dt className="text-ink-500">VAT {vatPct}%</dt>
              <dd className="font-mono">{formatKES(order.vat_kes)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-ink-500">{order.fulfilment === "pickup" ? "Pickup" : "Delivery"}</dt>
            <dd className="font-mono">{order.fulfilment === "pickup" ? "Free" : "Quoted by phone"}</dd>
          </div>
        </dl>
        <div className="flex items-center justify-between border-t-2 border-ink-900 p-5">
          <span className="font-display uppercase tracking-wideCaps">Total</span>
          <span className="font-display text-2xl font-black">{formatKES(order.total_kes)}</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <InfoCard title={order.fulfilment === "pickup" ? "Pickup" : "Delivery"}>
          {order.fulfilment === "pickup" ? (
            <p>{order.pickup_address}</p>
          ) : (
            <p>{[addr.address, addr.city].filter(Boolean).join(", ") || "—"}</p>
          )}
          {addr.notes && <p className="mt-1 text-ink-500">Note: {addr.notes}</p>}
        </InfoCard>
        <InfoCard title="Contact">
          <p>{order.contact_name}</p>
          <p className="text-ink-500">{order.contact_phone}</p>
          {order.company_name && (
            <p className="mt-2">
              {order.company_name}
              {order.kra_pin && <span className="block font-mono text-xs text-ink-500">KRA PIN {order.kra_pin}</span>}
              {order.po_number && <span className="block font-mono text-xs text-ink-500">PO {order.po_number}</span>}
            </p>
          )}
        </InfoCard>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/catalog" className="btn-ghost">Continue shopping</Link>
        <button type="button" onClick={() => window.print()} className="btn-ghost">Print</button>
      </div>
    </div>
  );
}

function ManualPayment({
  order,
  ins,
  onChange,
}: {
  order: Order;
  ins: Instructions;
  onChange: (o: Order) => void;
}) {
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const paybill = ins.method === "mpesa_paybill";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${API}/api/v1/orders/${order.number}/payment-reference`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: ref }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiErrorMessage(data, "Couldn't save the code"));
      onChange(data as Order);
      setRef("");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Couldn't save the code");
    } finally {
      setBusy(false);
    }
  }

  const rows: [string, string | null][] = paybill
    ? [
        ["Paybill number", ins.paybill],
        ["Account number", ins.reference],
        ["Amount", formatKES(ins.amount_kes)],
      ]
    : [
        ["Bank", ins.bank_name],
        ["Account name", ins.account_name],
        ["Account number", ins.account_number],
        ["Branch", ins.branch],
        ["SWIFT", ins.swift],
        ["Reference", ins.reference],
        ["Amount", formatKES(ins.amount_kes)],
      ];

  return (
    <div className="mt-6 border-2 border-ink-900 bg-white">
      <div className="border-b-2 border-ink-900 p-5">
        <h2 className="font-display text-lg font-black uppercase">
          {paybill ? "Pay with M-Pesa Paybill" : "Pay by bank transfer"}
        </h2>
        {paybill && (
          <p className="mt-1 text-sm text-ink-500">M-Pesa → Lipa na M-Pesa → Pay Bill, then enter:</p>
        )}
      </div>
      <dl className="divide-y divide-ink-100">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 px-5 py-3">
              <dt className="font-mono text-xs uppercase text-ink-500">{k}</dt>
              <dd className="flex items-center gap-3">
                <span className="font-display text-lg font-black">{v}</span>
                <CopyButton value={k === "Amount" ? String(Math.ceil(ins.amount_kes)) : (v as string)} />
              </dd>
            </div>
          ))}
      </dl>
      {ins.due_at && (
        <p className="border-t-2 border-ink-100 px-5 py-3 font-mono text-xs text-ink-500">
          Items reserved until{" "}
          {new Date(ins.due_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}.
          Unpaid orders are cancelled after that.
        </p>
      )}
      <form onSubmit={submit} className="border-t-2 border-ink-900 p-5">
        <label className="block font-display text-xs font-bold uppercase tracking-wideCaps text-ink-700">
          {order.payment_reference ? "Update transaction code" : "Paid? Enter the transaction code"}
        </label>
        <div className="mt-2 flex flex-wrap gap-3">
          <input
            className={`${field} uppercase`}
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder={paybill ? "e.g. SJK1ABC2DE" : "Bank reference"}
            aria-label="Transaction code"
            required
            minLength={6}
          />
          <button type="submit" disabled={busy} className="btn-signal disabled:opacity-60">
            {busy ? "Saving…" : "Send →"}
          </button>
        </div>
        {err && <p className="mt-2 text-sm font-medium text-hivis-700">{err}</p>}
        <p className="mt-2 font-mono text-[11px] text-ink-400">
          This helps us match your payment faster. We confirm it before dispatch.
        </p>
      </form>
    </div>
  );
}

function RetryStk({
  number,
  defaultPhone,
  title,
  onSent,
}: {
  number: string;
  defaultPhone: string;
  title: string;
  onSent: () => void;
}) {
  const [phone, setPhone] = useState(defaultPhone);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function retry(e: React.FormEvent) {
    e.preventDefault();
    if (!isSafaricomNumber(phone)) {
      setErr("Enter a Safaricom number, e.g. 0712 345 678");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${API}/api/v1/orders/${number}/retry-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mpesa_phone: phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiErrorMessage(data, "Couldn't send the M-Pesa prompt"));
      onSent();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Retry failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={retry} className="mt-6 border-2 border-ink-900 bg-white p-5">
      <h2 className="font-display text-lg font-black uppercase">{title}</h2>
      <p className="mt-1 text-sm text-ink-500">We&apos;ll send a payment request to this number.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <input
          type="tel"
          inputMode="tel"
          className={field}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="07XX XXX XXX"
          aria-label="M-Pesa phone number"
          required
        />
        <button type="submit" disabled={busy} className="btn-signal disabled:opacity-60">
          {busy ? "Sending…" : "Send M-Pesa prompt →"}
        </button>
      </div>
      {err && <p className="mt-2 text-sm font-medium text-hivis-700">{err}</p>}
    </form>
  );
}

function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
      className="border-2 border-ink-900 px-2 py-0.5 font-mono text-[10px] uppercase hover:bg-ink-900 hover:text-white"
      aria-label={`Copy ${value}`}
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-2 border-ink-900 bg-white p-5 text-sm">
      <h3 className="mb-2 font-display text-xs font-bold uppercase tracking-wideCaps text-royal-600">{title}</h3>
      {children}
    </div>
  );
}
