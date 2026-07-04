"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, formatKES, OrderListItem, Page } from "@/lib/api";
import { Button, PageHead, inputCls } from "@/components/ui";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-ink-200 text-ink-700",
  paid: "bg-signal-500 text-ink-900",
  processing: "bg-sky-400 text-ink-900",
  fulfilled: "bg-ink-900 text-white",
  cancelled: "bg-hivis-400 text-ink-900",
  refunded: "bg-ink-300 text-ink-800",
};

function Badge({ status }: { status: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-wideCaps ${STATUS_STYLE[status] || "bg-ink-200"}`}>
      {status}
    </span>
  );
}

export default function OrdersPage() {
  const [data, setData] = useState<Page<OrderListItem> | null>(null);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    const q = new URLSearchParams({ page: String(page), page_size: "20" });
    if (status) q.set("status", status);
    setData(await api.orders.list(q));
  }, [status, page]);

  useEffect(() => {
    load().catch(() => {});
    const t = setInterval(() => load().catch(() => {}), 8000); // live-ish
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHead eyebrow="Commerce" title="Orders" />

      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Filter by status"
          className={`${inputCls} max-w-[200px]`}
          value={status}
          onChange={(e) => { setPage(1); setStatus(e.target.value); }}
        >
          <option value="">All statuses</option>
          {["pending", "paid", "processing", "fulfilled", "cancelled", "refunded"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {data && <span className="font-mono text-xs text-ink-500">{data.total} total</span>}
      </div>

      <div className="overflow-x-auto border-2 border-ink-900 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b-2 border-ink-900 text-left font-display text-xs uppercase tracking-wideCaps">
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3 text-right">Items</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Placed</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((o) => (
              <tr key={o.id} className="border-b border-ink-200 last:border-0 hover:bg-ink-50">
                <td className="px-4 py-3">
                  <Link href={`/orders/${o.id}`} className="font-mono font-semibold hover:text-royal-600">
                    {o.number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-700">{o.contact_name || "—"}</td>
                <td className="px-4 py-3"><Badge status={o.status} /></td>
                <td className="px-4 py-3">{o.payment_status ? <Badge status={o.payment_status} /> : "—"}</td>
                <td className="px-4 py-3 text-right font-mono">{o.item_count}</td>
                <td className="px-4 py-3 text-right font-mono font-bold">{formatKES(o.total_kes)}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink-400">
                  {new Date(o.created_at).toLocaleString("en-KE")}
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center font-mono text-sm text-ink-400">No orders yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</Button>
          <span className="font-mono text-sm text-ink-500">Page {data.page} / {data.pages}</span>
          <Button variant="ghost" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next →</Button>
        </div>
      )}
    </div>
  );
}
