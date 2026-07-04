"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, Page, ProductListItem } from "@/lib/api";
import { Button, ConfirmDialog, PageHead, StatusBadge, Toast, inputCls } from "@/components/ui";

export default function ProductsPage() {
  const [data, setData] = useState<Page<ProductListItem> | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProductListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), page_size: "15" });
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    setData(await api.products.list(params));
  }, [q, status, page]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.products.remove(pendingDelete.id);
      setToast("Product deleted");
      setTimeout(() => setToast(null), 2000);
      setPendingDelete(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHead
        eyebrow="Catalog"
        title="Products"
        action={
          <Link href="/products/new">
            <Button>+ New product</Button>
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          aria-label="Search products"
          className={`${inputCls} max-w-xs`}
          placeholder="Search products…"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
        <select
          aria-label="Filter by status"
          className={`${inputCls} max-w-[180px]`}
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        {data && (
          <span className="font-mono text-xs text-ink-500">{data.total} total</span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto border-2 border-ink-900 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b-2 border-ink-900 text-left font-display text-xs uppercase tracking-wideCaps">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Brand</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Variants</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((p) => (
              <tr key={p.id} className="border-b border-ink-200 last:border-0 hover:bg-ink-50">
                <td className="px-4 py-3">
                  <Link href={`/products/${p.id}`} className="font-semibold hover:text-royal-600">
                    {p.name}
                  </Link>
                  {p.is_featured && (
                    <span className="ml-2 bg-signal-500 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-ink-900">
                      ★
                    </span>
                  )}
                  <div className="font-mono text-xs text-ink-400">{p.slug}</div>
                </td>
                <td className="px-4 py-3 text-ink-600">{p.brand_name || "—"}</td>
                <td className="px-4 py-3 text-ink-600">{p.category_name || "—"}</td>
                <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                <td className="px-4 py-3 text-right font-mono">{p.variant_count}</td>
                <td className="px-4 py-3 text-right font-mono font-bold">{p.total_stock}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Link href={`/products/${p.id}`} className="border-2 border-ink-900 px-2.5 py-1 font-display text-xs font-bold uppercase hover:bg-ink-900 hover:text-white">
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(p)}
                      className="border-2 border-hivis-500 px-2.5 py-1 font-display text-xs font-bold uppercase text-hivis-700 hover:bg-hivis-500 hover:text-white"
                    >
                      Del
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center font-mono text-sm text-ink-400">
                  No products match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pager */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Prev
          </Button>
          <span className="font-mono text-sm text-ink-500">
            Page {data.page} / {data.pages}
          </span>
          <Button variant="ghost" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
            Next →
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete product"
        message={`“${pendingDelete?.name}” and its variants + stock history will be permanently removed. This cannot be undone.`}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      {toast && <Toast msg={toast} />}
    </div>
  );
}
