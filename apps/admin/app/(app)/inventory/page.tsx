"use client";

import { useEffect, useState } from "react";
import { api, Page, StockMovement } from "@/lib/api";
import { PageHead } from "@/components/ui";

export default function InventoryPage() {
  const [low, setLow] = useState<
    { variant_id: string; sku: string; product: string; on_hand: number; reorder_level: number }[]
  >([]);
  const [moves, setMoves] = useState<Page<StockMovement> | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.inventory.lowStock().then(setLow).catch(() => {});
  }, []);
  useEffect(() => {
    const q = new URLSearchParams({ page: String(page), page_size: "20" });
    api.inventory.movements(q).then(setMoves).catch(() => {});
  }, [page]);

  const reasonColor: Record<string, string> = {
    restock: "text-signal-700",
    sale: "text-hivis-700",
    return: "text-royal-600",
    adjustment: "text-ink-600",
  };

  return (
    <div className="space-y-8">
      <PageHead eyebrow="Operations" title="Inventory" />

      {/* Low stock */}
      <div className="border-2 border-ink-900 bg-white">
        <div className="flex items-center justify-between border-b-2 border-ink-900 bg-hivis-50 px-5 py-3">
          <h2 className="font-display text-lg font-black uppercase">Low stock</h2>
          <span className="font-mono text-xs text-ink-500">{low.length} items</span>
        </div>
        {low.length === 0 ? (
          <p className="p-5 font-mono text-sm text-ink-400">Everything above reorder level.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b-2 border-ink-900 text-left font-display text-xs uppercase tracking-wideCaps">
                <th className="px-5 py-2.5">Product</th>
                <th className="px-5 py-2.5">SKU</th>
                <th className="px-5 py-2.5 text-right">On hand</th>
                <th className="px-5 py-2.5 text-right">Reorder</th>
              </tr>
            </thead>
            <tbody>
              {low.map((r) => (
                <tr key={r.variant_id} className="border-b border-ink-200 last:border-0">
                  <td className="px-5 py-2.5 font-semibold">{r.product}</td>
                  <td className="px-5 py-2.5 font-mono text-ink-500">{r.sku}</td>
                  <td className="px-5 py-2.5 text-right font-mono font-bold text-hivis-700">{r.on_hand}</td>
                  <td className="px-5 py-2.5 text-right font-mono text-ink-500">{r.reorder_level}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Movement ledger */}
      <div className="border-2 border-ink-900 bg-white">
        <div className="flex items-center justify-between border-b-2 border-ink-900 px-5 py-3">
          <h2 className="font-display text-lg font-black uppercase">Stock movement ledger</h2>
          {moves && <span className="font-mono text-xs text-ink-500">{moves.total} events</span>}
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b-2 border-ink-900 text-left font-display text-xs uppercase tracking-wideCaps">
              <th className="px-5 py-2.5">When</th>
              <th className="px-5 py-2.5">Reason</th>
              <th className="px-5 py-2.5 text-right">Delta</th>
              <th className="px-5 py-2.5">Note</th>
            </tr>
          </thead>
          <tbody>
            {moves?.items.map((m) => (
              <tr key={m.id} className="border-b border-ink-200 last:border-0">
                <td className="px-5 py-2.5 font-mono text-xs text-ink-500">
                  {new Date(m.created_at).toLocaleString("en-KE")}
                </td>
                <td className={`px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wideCaps ${reasonColor[m.reason] || "text-ink-600"}`}>
                  {m.reason}
                </td>
                <td className={`px-5 py-2.5 text-right font-mono font-bold ${m.delta >= 0 ? "text-signal-700" : "text-hivis-700"}`}>
                  {m.delta >= 0 ? "+" : ""}{m.delta}
                </td>
                <td className="px-5 py-2.5 text-ink-500">{m.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {moves && moves.pages > 1 && (
          <div className="flex items-center justify-between border-t-2 border-ink-900 px-5 py-3">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="border-2 border-ink-900 px-4 py-1.5 font-display text-xs font-bold uppercase disabled:opacity-40 hover:bg-ink-900 hover:text-white">← Prev</button>
            <span className="font-mono text-xs text-ink-500">Page {moves.page} / {moves.pages}</span>
            <button disabled={page >= moves.pages} onClick={() => setPage((p) => p + 1)} className="border-2 border-ink-900 px-4 py-1.5 font-display text-xs font-bold uppercase disabled:opacity-40 hover:bg-ink-900 hover:text-white">Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
