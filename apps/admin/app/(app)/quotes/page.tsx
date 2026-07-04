"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, formatKES, Page, QuoteListItem } from "@/lib/api";
import { Button, PageHead, inputCls } from "@/components/ui";

const STATUS_STYLE: Record<string, string> = {
  requested: "bg-hivis-400 text-ink-900",
  priced: "bg-sky-400 text-ink-900",
  accepted: "bg-signal-500 text-ink-900",
  expired: "bg-ink-300 text-ink-800",
  cancelled: "bg-ink-200 text-ink-700",
};
function Badge({ status }: { status: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-wideCaps ${STATUS_STYLE[status] || "bg-ink-200"}`}>
      {status}
    </span>
  );
}

export default function QuotesPage() {
  const [data, setData] = useState<Page<QuoteListItem> | null>(null);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    const q = new URLSearchParams({ page: String(page), page_size: "20" });
    if (status) q.set("status", status);
    setData(await api.quotes.list(q));
  }, [status, page]);

  useEffect(() => {
    load().catch(() => {});
    const t = setInterval(() => load().catch(() => {}), 10000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHead eyebrow="B2B" title="Quotes" />

      <div className="flex flex-wrap items-center gap-3">
        <select aria-label="Filter by status" className={`${inputCls} max-w-[200px]`} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">All statuses</option>
          {["requested", "priced", "accepted", "expired", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {data && <span className="font-mono text-xs text-ink-500">{data.total} total</span>}
      </div>

      <div className="overflow-x-auto border-2 border-ink-900 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b-2 border-ink-900 text-left font-display text-xs uppercase tracking-wideCaps">
              <th className="px-4 py-3">Quote</th>
              <th className="px-4 py-3">Company / contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Items</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Requested</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((q) => (
              <tr key={q.id} className="border-b border-ink-200 last:border-0 hover:bg-ink-50">
                <td className="px-4 py-3">
                  <Link href={`/quotes/${q.id}`} className="font-mono font-semibold hover:text-royal-600">{q.number}</Link>
                </td>
                <td className="px-4 py-3 text-ink-700">
                  {q.company_name || "—"}
                  <div className="font-mono text-xs text-ink-400">{q.contact_name}</div>
                </td>
                <td className="px-4 py-3"><Badge status={q.status} /></td>
                <td className="px-4 py-3 text-right font-mono">{q.item_count}</td>
                <td className="px-4 py-3 text-right font-mono font-bold">{q.total_kes != null ? formatKES(q.total_kes) : "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink-400">{new Date(q.created_at).toLocaleString("en-KE")}</td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center font-mono text-sm text-ink-400">No quotes yet.</td></tr>
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
