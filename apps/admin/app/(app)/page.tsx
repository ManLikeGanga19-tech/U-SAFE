"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHead } from "@/components/ui";

export default function OverviewPage() {
  const [stats, setStats] = useState({ products: 0, categories: 0, brands: 0 });
  const [lowStock, setLowStock] = useState<
    { variant_id: string; sku: string; product: string; on_hand: number; reorder_level: number }[]
  >([]);

  useEffect(() => {
    (async () => {
      const q = new URLSearchParams({ page: "1", page_size: "1" });
      const [p, c, b, low] = await Promise.all([
        api.products.list(q),
        api.categories.list(),
        api.brands.list(),
        api.inventory.lowStock(),
      ]);
      setStats({ products: p.total, categories: c.length, brands: b.length });
      setLowStock(low);
    })().catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <PageHead eyebrow="Control plane" title="Overview" />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Metric label="Products" value={stats.products} href="/products" />
        <Metric label="Categories" value={stats.categories} href="/categories" />
        <Metric label="Brands" value={stats.brands} href="/brands" />
      </div>

      <div className="border-2 border-ink-900 bg-white">
        <div className="flex items-center justify-between border-b-2 border-ink-900 bg-hivis-50 px-5 py-3">
          <h2 className="font-display text-lg font-black uppercase">Low stock alerts</h2>
          <span className="font-mono text-xs text-ink-500">{lowStock.length} at/below reorder</span>
        </div>
        {lowStock.length === 0 ? (
          <p className="p-5 font-mono text-sm text-ink-400">All stock above reorder levels.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-ink-900 text-left font-display text-xs uppercase tracking-wideCaps">
                <th className="px-5 py-2.5">Product</th>
                <th className="px-5 py-2.5 font-mono">SKU</th>
                <th className="px-5 py-2.5 text-right">On hand</th>
                <th className="px-5 py-2.5 text-right">Reorder</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((r) => (
                <tr key={r.variant_id} className="border-b border-ink-200 last:border-0">
                  <td className="px-5 py-2.5 font-semibold">{r.product}</td>
                  <td className="px-5 py-2.5 font-mono text-ink-500">{r.sku}</td>
                  <td className="px-5 py-2.5 text-right font-mono font-bold text-hivis-700">{r.on_hand}</td>
                  <td className="px-5 py-2.5 text-right font-mono text-ink-500">{r.reorder_level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="block border-2 border-ink-900 bg-white p-6 transition-shadow hover:shadow-hard">
      <div className="font-display text-5xl font-black text-royal-600">{value}</div>
      <div className="mt-1 font-display text-sm font-bold uppercase tracking-wideCaps text-ink-500">
        {label}
      </div>
    </Link>
  );
}
