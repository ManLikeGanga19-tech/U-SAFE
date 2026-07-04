"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, DashboardStats, formatKES } from "@/lib/api";
import { PageHead } from "@/components/ui";
import { AreaChart, BarChart, Sparkline } from "@/components/charts";

const STATUS_COLORS: Record<string, string> = {
  pending: "#F5A312",
  paid: "#00E000",
  processing: "#123FB5",
  fulfilled: "#0B0B0C",
  cancelled: "#9CA3AF",
  refunded: "#DC2626",
};

type LowStock = {
  variant_id: string;
  sku: string;
  product: string;
  on_hand: number;
  reorder_level: number;
};

export default function OverviewPage() {
  const [s, setS] = useState<DashboardStats | null>(null);
  const [lowStock, setLowStock] = useState<LowStock[]>([]);

  useEffect(() => {
    (async () => {
      const [stats, low] = await Promise.all([api.stats.get(), api.inventory.lowStock()]);
      setS(stats);
      setLowStock(low);
    })().catch(() => {});
  }, []);

  const revenuePts =
    s?.revenue_series.map((d) => ({
      label: new Date(d.date).toLocaleDateString("en-KE", { day: "2-digit", month: "short" }),
      value: d.revenue_kes,
      sub: `${d.orders} order${d.orders === 1 ? "" : "s"}`,
    })) ?? [];

  const orderBars = s
    ? Object.entries(s.orders.by_status).map(([label, value]) => ({
        label,
        value,
        color: STATUS_COLORS[label] ?? "#123FB5",
      }))
    : [];

  const topMax = Math.max(1, ...(s?.top_products.map((t) => t.revenue_kes) ?? [1]));

  return (
    <div className="space-y-6">
      <PageHead eyebrow="Control plane" title="Overview" />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          label="Revenue"
          hint="Confirmed · 14d"
          value={s ? formatKES(s.revenue.total_kes) : "—"}
          accent="text-signal-700"
        >
          <div className="mt-3 flex items-end justify-between gap-3">
            <span className="font-mono text-xs text-ink-400">
              Avg {s ? formatKES(s.revenue.avg_order_kes) : "—"}
            </span>
            {revenuePts.length > 0 && (
              <Sparkline
                values={revenuePts.map((p) => p.value)}
                color="#00E000"
                className="h-8 w-28"
              />
            )}
          </div>
        </Card>

        <Card label="Orders" hint="All time" value={s?.orders.total ?? "—"} href="/orders">
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip color="#F5A312" text={`${s?.orders.by_status.pending ?? 0} pending`} />
            <Chip color="#00E000" text={`${s?.orders.by_status.paid ?? 0} paid`} />
          </div>
        </Card>

        <Card label="Products" hint="Catalog" value={s?.products.total ?? "—"} href="/products">
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip color="#00E000" text={`${s?.products.published ?? 0} live`} />
            <Chip color="#9CA3AF" text={`${s?.products.draft ?? 0} draft`} />
          </div>
        </Card>

        <Card
          label="Low stock"
          hint="At/below reorder"
          value={s?.low_stock_count ?? "—"}
          href="/inventory"
          accent={s && s.low_stock_count > 0 ? "text-hivis-700" : "text-ink-900"}
        >
          <div className="mt-3 font-mono text-xs text-ink-400">
            {s && s.low_stock_count > 0 ? "Needs restocking" : "All above reorder"}
          </div>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Revenue area chart */}
        <div className="border-2 border-ink-900 bg-white lg:col-span-2">
          <div className="flex items-center justify-between border-b-2 border-ink-900 px-5 py-3">
            <h2 className="font-display text-sm font-black uppercase tracking-wideCaps">
              Revenue — last 14 days
            </h2>
            <span className="font-mono text-xs text-ink-500">
              {s ? `${s.revenue.orders} confirmed orders` : ""}
            </span>
          </div>
          <div className="p-5">
            {revenuePts.length > 0 ? (
              <AreaChart points={revenuePts} format={(n) => formatKES(n)} />
            ) : (
              <Skeleton />
            )}
          </div>
        </div>

        {/* Orders by status */}
        <div className="border-2 border-ink-900 bg-white">
          <div className="border-b-2 border-ink-900 px-5 py-3">
            <h2 className="font-display text-sm font-black uppercase tracking-wideCaps">
              Orders by status
            </h2>
          </div>
          <div className="p-5">
            {orderBars.length > 0 ? <BarChart bars={orderBars} /> : <Skeleton />}
          </div>
        </div>
      </div>

      {/* Top products + quotes */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="border-2 border-ink-900 bg-white lg:col-span-2">
          <div className="border-b-2 border-ink-900 px-5 py-3">
            <h2 className="font-display text-sm font-black uppercase tracking-wideCaps">
              Top products by revenue
            </h2>
          </div>
          <div className="divide-y divide-ink-200">
            {s && s.top_products.length > 0 ? (
              s.top_products.map((t, i) => (
                <div key={t.name} className="flex items-center gap-4 px-5 py-3">
                  <span className="w-6 font-mono text-sm font-bold text-ink-300">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink-900">{t.name}</div>
                    <div className="mt-1 h-2 w-full bg-ink-100">
                      <div
                        className="h-2 bg-royal-600"
                        style={{ width: `${(t.revenue_kes / topMax) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-bold text-ink-900">
                      {formatKES(t.revenue_kes)}
                    </div>
                    <div className="font-mono text-xs text-ink-400">{t.qty} sold</div>
                  </div>
                </div>
              ))
            ) : (
              <p className="p-5 font-mono text-sm text-ink-400">No sales yet.</p>
            )}
          </div>
        </div>

        {/* Quotes breakdown */}
        <div className="border-2 border-ink-900 bg-white">
          <div className="flex items-center justify-between border-b-2 border-ink-900 px-5 py-3">
            <h2 className="font-display text-sm font-black uppercase tracking-wideCaps">Quotes</h2>
            <Link href="/quotes" className="font-mono text-xs text-royal-600 hover:underline">
              View →
            </Link>
          </div>
          <div className="divide-y divide-ink-200">
            {s ? (
              Object.entries(s.quotes.by_status).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between px-5 py-2.5">
                  <span className="font-display text-xs font-bold uppercase tracking-wideCaps text-ink-600">
                    {status}
                  </span>
                  <span className="font-mono text-sm font-bold text-ink-900">{count}</span>
                </div>
              ))
            ) : (
              <Skeleton />
            )}
          </div>
        </div>
      </div>

      {/* Low stock table */}
      <div className="border-2 border-ink-900 bg-white">
        <div className="flex items-center justify-between border-b-2 border-ink-900 bg-hivis-50 px-5 py-3">
          <h2 className="font-display text-sm font-black uppercase tracking-wideCaps">
            Low stock alerts
          </h2>
          <span className="font-mono text-xs text-ink-500">{lowStock.length} at/below reorder</span>
        </div>
        {lowStock.length === 0 ? (
          <p className="p-5 font-mono text-sm text-ink-400">All stock above reorder levels.</p>
        ) : (
          <div className="max-h-80 overflow-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b-2 border-ink-900 text-left font-display text-xs uppercase tracking-wideCaps">
                  <th className="px-5 py-2.5">Product</th>
                  <th className="px-5 py-2.5">SKU</th>
                  <th className="px-5 py-2.5 text-right">On hand</th>
                  <th className="px-5 py-2.5 text-right">Reorder</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((r) => (
                  <tr key={r.variant_id} className="border-b border-ink-200 last:border-0">
                    <td className="px-5 py-2.5 font-semibold">{r.product}</td>
                    <td className="px-5 py-2.5 font-mono text-ink-500">{r.sku}</td>
                    <td className="px-5 py-2.5 text-right font-mono font-bold text-hivis-700">
                      {r.on_hand}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-ink-500">
                      {r.reorder_level}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({
  label,
  hint,
  value,
  href,
  accent = "text-ink-900",
  children,
}: {
  label: string;
  hint?: string;
  value: React.ReactNode;
  href?: string;
  accent?: string;
  children?: React.ReactNode;
}) {
  const body = (
    <div className="h-full border-2 border-ink-900 bg-white p-5 transition-shadow hover:shadow-hard">
      <div className="flex items-center justify-between">
        <span className="font-display text-xs font-bold uppercase tracking-wideCaps text-ink-500">
          {label}
        </span>
        {hint && <span className="font-mono text-[10px] text-ink-400">{hint}</span>}
      </div>
      <div className={`mt-2 font-display text-4xl font-black ${accent}`}>{value}</div>
      {children}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function Chip({ color, text }: { color: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-ink-200 px-2 py-0.5 font-mono text-[11px] text-ink-600">
      <span className="h-2 w-2" style={{ background: color }} />
      {text}
    </span>
  );
}

function Skeleton() {
  return <div className="h-40 w-full animate-pulse bg-ink-100" />;
}
