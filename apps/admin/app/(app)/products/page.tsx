"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ImportResult, Page, ProductListItem } from "@/lib/api";
import { Button, ConfirmDialog, PageHead, StatusBadge, Toast, inputCls } from "@/components/ui";

// Header + sample rows for the downloadable CSV template (kept in sync with the API importer).
const CSV_TEMPLATE =
  "name,category,brand,summary,description,standards,tags,status,is_featured,sku,variant_name,price_kes,stock,reorder_level,image_url\n" +
  "Nitrile Examination Gloves (Box of 100),Hand Protection,Ansell,Powder-free nitrile disposable gloves,Latex-free ambidextrous gloves,EN 455|EN 374,,published,true,,Medium,850,500,50,\n" +
  "Steel-Toe Rigger Boot S3,Footwear Protection,Safety Jogger,S3 boot with steel toecap,Water-resistant leather upper,EN ISO 20345|S3,bestseller,published,false,,UK 9,4200,120,20,\n";

export default function ProductsPage() {
  const [data, setData] = useState<Page<ProductListItem> | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProductListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "usafe-products-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function runImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setImportError("Choose a CSV file first.");
      return;
    }
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const result = await api.products.importCsv(file);
      setImportResult(result);
      load();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function closeImport() {
    setImportOpen(false);
    setImportResult(null);
    setImportError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

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
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setImportOpen(true)}>
              Import CSV
            </Button>
            <Link href="/products/new">
              <Button>+ New product</Button>
            </Link>
          </div>
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

      {/* CSV import modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4">
          <div className="w-full max-w-lg border-2 border-ink-900 bg-white">
            <div className="flex items-center justify-between border-b-2 border-ink-900 bg-ink-900 px-5 py-3 text-white">
              <h2 className="font-display text-sm font-bold uppercase tracking-wideCaps">
                Bulk import products
              </h2>
              <button
                type="button"
                onClick={closeImport}
                className="font-mono text-sm hover:text-signal-500"
                aria-label="Close import dialog"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-ink-600">
                Upload a CSV — one row per product. Unknown brands are created; the
                12 fixed categories must match by name. Re-importing skips products
                that already exist.
              </p>
              <button
                type="button"
                onClick={downloadTemplate}
                className="font-display text-xs font-bold uppercase tracking-wideCaps text-royal-600 underline hover:text-royal-700"
              >
                ↓ Download CSV template
              </button>

              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                aria-label="CSV file"
                className="block w-full border-2 border-ink-900 bg-white p-2 font-mono text-sm file:mr-3 file:border-0 file:bg-ink-900 file:px-3 file:py-1 file:font-display file:text-xs file:font-bold file:uppercase file:text-white"
              />

              {importError && (
                <p className="border-2 border-hivis-500 bg-hivis-50 px-3 py-2 font-mono text-xs text-hivis-700">
                  {importError}
                </p>
              )}

              {importResult && (
                <div className="border-2 border-ink-900 bg-ink-50 p-3 text-sm">
                  <p className="font-display font-bold uppercase">
                    <span className="text-signal-700">{importResult.created} created</span>
                    {" · "}
                    <span className="text-ink-500">{importResult.skipped} skipped</span>
                    {importResult.errors.length > 0 && (
                      <>
                        {" · "}
                        <span className="text-hivis-700">{importResult.errors.length} issues</span>
                      </>
                    )}
                  </p>
                  {importResult.errors.length > 0 && (
                    <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto font-mono text-xs text-ink-600">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>• {err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={closeImport}>
                  {importResult ? "Done" : "Cancel"}
                </Button>
                <Button onClick={runImport} disabled={importing}>
                  {importing ? "Importing…" : "Upload & import"}
                </Button>
              </div>
            </div>
          </div>
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
