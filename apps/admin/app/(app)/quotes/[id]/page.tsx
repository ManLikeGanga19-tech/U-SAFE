"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, formatKES, Quote, QuoteStatus } from "@/lib/api";
import { Button, PageHead, SelectField, Toast, inputCls } from "@/components/ui";

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<QuoteStatus>("requested");
  const [toast, setToast] = useState<{ msg: string; kind?: "ok" | "err" } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const q = await api.quotes.get(id);
    setQuote(q);
    setStatus(q.status);
    setPrices(
      Object.fromEntries(q.items.map((i) => [i.id, i.unit_price_kes != null ? String(i.unit_price_kes) : ""])),
    );
  }, [id]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  function notify(msg: string, kind: "ok" | "err" = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2200);
  }

  async function savePrices() {
    if (!quote) return;
    setBusy("price");
    try {
      const lines = quote.items
        .filter((i) => prices[i.id] !== "" && prices[i.id] != null)
        .map((i) => ({ item_id: i.id, unit_price_kes: Number(prices[i.id]) }));
      const q = await api.quotes.price(id, lines);
      setQuote(q);
      notify("Prices saved");
    } finally {
      setBusy(null);
    }
  }

  async function genPdf() {
    setBusy("pdf");
    try {
      const q = await api.quotes.generatePdf(id);
      setQuote(q);
      notify("PDF generated");
    } catch (e) {
      notify(e instanceof Error ? e.message : "PDF failed", "err");
    } finally {
      setBusy(null);
    }
  }

  async function saveStatus() {
    setBusy("status");
    try {
      const q = await api.quotes.setStatus(id, status);
      setQuote(q);
      notify("Status updated");
    } finally {
      setBusy(null);
    }
  }

  if (!quote) return <p className="font-mono text-sm text-ink-400">Loading…</p>;

  const liveTotal = quote.items.reduce((sum, i) => {
    const p = Number(prices[i.id]);
    return sum + (isNaN(p) ? 0 : p * i.quantity);
  }, 0);

  return (
    <div className="space-y-6">
      <PageHead eyebrow="B2B / quote" title={quote.number} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Line pricing */}
        <div className="border-2 border-ink-900 bg-white">
          <div className="border-b-2 border-ink-900 p-5">
            <h2 className="font-display text-lg font-black uppercase">Price the lines</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-ink-900 text-left font-display text-xs uppercase tracking-wideCaps">
                <th className="px-5 py-2.5">Item</th>
                <th className="px-5 py-2.5 text-right">Qty</th>
                <th className="px-5 py-2.5 text-right">Unit (KES)</th>
                <th className="px-5 py-2.5 text-right">Line total</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((it) => {
                const p = Number(prices[it.id]);
                const lineTotal = isNaN(p) ? null : p * it.quantity;
                return (
                  <tr key={it.id} className="border-b border-ink-200 last:border-0">
                    <td className="px-5 py-2.5">
                      <span className="font-semibold">{it.description}</span>
                      {it.sku && <span className="ml-2 font-mono text-xs text-ink-400">{it.sku}</span>}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono">{it.quantity}</td>
                    <td className="px-5 py-2.5 text-right">
                      <input
                        aria-label={`Unit price for ${it.description}`}
                        type="number"
                        min="0"
                        className={`${inputCls} w-28 text-right`}
                        value={prices[it.id] ?? ""}
                        onChange={(e) => setPrices((pr) => ({ ...pr, [it.id]: e.target.value }))}
                      />
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono font-bold">
                      {lineTotal != null ? formatKES(lineTotal) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t-2 border-ink-900 p-5">
            <span className="font-display uppercase tracking-wideCaps">Total</span>
            <span className="font-display text-2xl font-black">{formatKES(liveTotal)}</span>
          </div>
          <div className="border-t-2 border-ink-100 p-5">
            <Button onClick={savePrices} disabled={busy === "price"}>
              {busy === "price" ? "Saving…" : "Save prices"}
            </Button>
          </div>
        </div>

        {/* Side */}
        <div className="space-y-6">
          <div className="border-2 border-ink-900 bg-white p-5">
            <h3 className="font-display text-xs font-bold uppercase tracking-wideCaps text-royal-600">Quotation PDF</h3>
            <div className="mt-3 space-y-3">
              <Button variant="ghost" className="w-full" onClick={genPdf} disabled={busy === "pdf"}>
                {busy === "pdf" ? "Generating…" : quote.pdf_url ? "Regenerate PDF" : "Generate PDF"}
              </Button>
              {quote.pdf_url && (
                <a href={quote.pdf_url} target="_blank" rel="noopener noreferrer" className="block border-2 border-ink-900 bg-signal-500 px-4 py-2.5 text-center font-display text-sm font-bold uppercase tracking-wideCaps text-ink-900 hover:bg-signal-400">
                  ↓ Download PDF
                </a>
              )}
            </div>
          </div>

          <div className="border-2 border-ink-900 bg-white p-5">
            <h3 className="font-display text-xs font-bold uppercase tracking-wideCaps text-royal-600">Status</h3>
            <div className="mt-3 space-y-3">
              <SelectField label="Quote status" value={status} onChange={(e) => setStatus(e.target.value as QuoteStatus)}>
                {["requested", "priced", "accepted", "expired", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
              </SelectField>
              <Button className="w-full" onClick={saveStatus} disabled={busy === "status"}>Update status</Button>
            </div>
          </div>

          <div className="border-2 border-ink-900 bg-white p-5">
            <h3 className="font-display text-xs font-bold uppercase tracking-wideCaps text-royal-600">Requester</h3>
            <dl className="mt-3 space-y-1.5 font-mono text-xs">
              <Row k="Company" v={quote.company_name || "—"} />
              <Row k="Name" v={quote.contact_name || "—"} />
              <Row k="Email" v={quote.contact_email || "—"} />
              <Row k="Phone" v={quote.contact_phone || "—"} />
            </dl>
            {quote.message && (
              <p className="mt-3 border-t-2 border-ink-100 pt-3 text-sm text-ink-600">{quote.message}</p>
            )}
          </div>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} kind={toast.kind} />}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="uppercase text-ink-400">{k}</dt>
      <dd className="text-right text-ink-800">{v}</dd>
    </div>
  );
}
