"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatKES } from "@/lib/cart";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface QuoteLine {
  id: string;
  description: string;
  sku: string | null;
  quantity: number;
  unit_price_kes: number | null;
  line_total_kes: number | null;
}
interface Quote {
  number: string;
  status: string;
  company_name: string | null;
  contact_name: string | null;
  message: string | null;
  items: QuoteLine[];
  total_kes: number | null;
  pdf_url: string | null;
}

export default function QuoteViewPage() {
  const { number } = useParams<{ number: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`${API}/api/v1/quotes/${number}`);
    if (res.status === 404) return setNotFound(true);
    setQuote(await res.json());
  }, [number]);

  useEffect(() => {
    load().catch(() => {});
    const t = setInterval(() => load().catch(() => {}), 10000);
    return () => clearInterval(t);
  }, [load]);

  async function accept() {
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/v1/quotes/${number}/accept`, { method: "POST" });
      if (res.ok) setQuote(await res.json());
    } finally {
      setBusy(false);
    }
  }

  if (notFound) {
    return (
      <div className="shell py-20 text-center">
        <h1 className="text-4xl font-black uppercase">Quote not found</h1>
        <Link href="/quote" className="btn-signal mt-8 inline-flex">Request a new quote</Link>
      </div>
    );
  }
  if (!quote) return <div className="shell py-16 font-mono text-sm text-ink-400">Loading quote…</div>;

  const priced = quote.status === "priced";
  const accepted = quote.status === "accepted";

  return (
    <div className="shell max-w-3xl py-12">
      <div className={`border-2 border-ink-900 ${accepted ? "bg-signal-500" : priced ? "bg-white" : "bg-ink-900 text-white"}`}>
        <div className="p-6">
          <span className="font-mono text-xs uppercase tracking-wideCaps">Quote {quote.number}</span>
          <h1 className="mt-2 text-4xl font-black uppercase md:text-5xl">
            {accepted ? "Quote accepted ✓" : priced ? "Your quotation" : "Request received"}
          </h1>
          <p className={`mt-2 ${priced ? "text-ink-600" : accepted ? "text-ink-900" : "text-ink-300"}`}>
            {accepted
              ? "Thank you — our team will reach out to arrange supply and delivery."
              : priced
                ? "We've priced your requirements below. Review, download the formal PDF, and accept when ready."
                : "Our team is preparing your quotation. This page updates automatically."}
          </p>
        </div>
      </div>

      <div className="mt-6 border-2 border-ink-900 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-ink-900 text-left font-display text-xs uppercase tracking-wideCaps">
              <th className="px-5 py-2.5">Item</th>
              <th className="px-5 py-2.5 text-right">Qty</th>
              <th className="px-5 py-2.5 text-right">Unit</th>
              <th className="px-5 py-2.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((it) => (
              <tr key={it.id} className="border-b border-ink-200 last:border-0">
                <td className="px-5 py-2.5">
                  <span className="font-semibold">{it.description}</span>
                  {it.sku && <span className="ml-2 font-mono text-xs text-ink-400">{it.sku}</span>}
                </td>
                <td className="px-5 py-2.5 text-right font-mono">{it.quantity}</td>
                <td className="px-5 py-2.5 text-right font-mono">{it.unit_price_kes != null ? formatKES(it.unit_price_kes) : "—"}</td>
                <td className="px-5 py-2.5 text-right font-mono font-bold">{it.line_total_kes != null ? formatKES(it.line_total_kes) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {quote.total_kes != null && (
          <div className="flex items-center justify-between border-t-2 border-ink-900 p-5">
            <span className="font-display uppercase tracking-wideCaps">Total</span>
            <span className="font-display text-2xl font-black">{formatKES(quote.total_kes)}</span>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {quote.pdf_url && (
          <a href={quote.pdf_url} target="_blank" rel="noopener noreferrer" className="btn-ghost">
            ↓ Download PDF
          </a>
        )}
        {priced && (
          <button type="button" onClick={accept} disabled={busy} className="btn-signal disabled:opacity-60">
            {busy ? "Accepting…" : "Accept quote →"}
          </button>
        )}
        <Link href="/catalog" className="btn-ghost">Continue browsing</Link>
      </div>
    </div>
  );
}
