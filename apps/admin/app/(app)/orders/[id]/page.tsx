"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, formatKES, Order, OrderStatus } from "@/lib/api";
import { Button, PageHead, SelectField, Toast } from "@/components/ui";

const NEXT_STATUS: OrderStatus[] = ["pending", "paid", "processing", "fulfilled", "cancelled", "refunded"];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<OrderStatus>("pending");
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const o = await api.orders.get(id);
    setOrder(o);
    setStatus(o.status);
  }, [id]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      const o = await api.orders.setStatus(id, status);
      setOrder(o);
      setToast("Order updated");
      setTimeout(() => setToast(null), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (!order) return <p className="font-mono text-sm text-ink-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <PageHead eyebrow="Commerce / order" title={order.number} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Items */}
        <div className="border-2 border-ink-900 bg-white">
          <div className="border-b-2 border-ink-900 p-5">
            <h2 className="font-display text-lg font-black uppercase">Items</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-ink-900 text-left font-display text-xs uppercase tracking-wideCaps">
                <th className="px-5 py-2.5">Product</th>
                <th className="px-5 py-2.5 font-mono">SKU</th>
                <th className="px-5 py-2.5 text-right">Qty</th>
                <th className="px-5 py-2.5 text-right">Unit</th>
                <th className="px-5 py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it) => (
                <tr key={it.sku} className="border-b border-ink-200 last:border-0">
                  <td className="px-5 py-2.5 font-semibold">{it.name}</td>
                  <td className="px-5 py-2.5 font-mono text-ink-500">{it.sku}</td>
                  <td className="px-5 py-2.5 text-right font-mono">{it.quantity}</td>
                  <td className="px-5 py-2.5 text-right font-mono">{formatKES(it.unit_price_kes)}</td>
                  <td className="px-5 py-2.5 text-right font-mono font-bold">{formatKES(it.line_total_kes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t-2 border-ink-900 p-5">
            <span className="font-display uppercase tracking-wideCaps">Total</span>
            <span className="font-display text-2xl font-black">{formatKES(order.total_kes)}</span>
          </div>
        </div>

        {/* Side */}
        <div className="space-y-6">
          <div className="border-2 border-ink-900 bg-white p-5">
            <h3 className="font-display text-xs font-bold uppercase tracking-wideCaps text-royal-600">Fulfilment</h3>
            <div className="mt-3 space-y-3">
              <SelectField label="Order status" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
                {NEXT_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </SelectField>
              <Button onClick={save} disabled={saving} className="w-full">
                {saving ? "Saving…" : "Update status"}
              </Button>
            </div>
          </div>

          <div className="border-2 border-ink-900 bg-white p-5">
            <h3 className="font-display text-xs font-bold uppercase tracking-wideCaps text-royal-600">Payment</h3>
            <dl className="mt-3 space-y-1.5 font-mono text-xs">
              <Row k="Method" v={order.payment?.provider || "—"} />
              <Row k="Status" v={order.payment?.status || "—"} />
              <Row k="Amount" v={order.payment ? formatKES(order.payment.amount_kes) : "—"} />
              <Row k="Receipt" v={order.payment?.mpesa_receipt || "—"} />
            </dl>
          </div>

          <div className="border-2 border-ink-900 bg-white p-5">
            <h3 className="font-display text-xs font-bold uppercase tracking-wideCaps text-royal-600">Customer</h3>
            <dl className="mt-3 space-y-1.5 font-mono text-xs">
              <Row k="Name" v={order.contact_name || "—"} />
              <Row k="Email" v={order.contact_email || "—"} />
              <Row k="Phone" v={order.contact_phone || "—"} />
              <Row k="City" v={order.shipping_address?.city || "—"} />
              <Row k="Address" v={order.shipping_address?.address || "—"} />
            </dl>
          </div>
        </div>
      </div>

      {toast && <Toast msg={toast} />}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-400 uppercase">{k}</dt>
      <dd className="text-right text-ink-800">{v}</dd>
    </div>
  );
}
