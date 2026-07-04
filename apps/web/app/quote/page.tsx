"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface Line {
  variant_id?: string;
  description: string;
  quantity: number;
}

export default function QuotePage() {
  const { cart } = useCart();
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [lines, setLines] = useState<Line[]>([{ description: "", quantity: 1 }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Prefill line items from the cart, if any.
  useEffect(() => {
    if (cart.items.length > 0) {
      setLines(
        cart.items.map((i) => ({
          variant_id: i.variant_id,
          description: i.product_name + (i.variant_name ? ` — ${i.variant_name}` : ""),
          quantity: i.quantity,
        })),
      );
    }
  }, [cart.items]);

  function setLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const items = lines
        .filter((l) => l.description.trim())
        .map((l) => ({ variant_id: l.variant_id, description: l.description, quantity: Number(l.quantity) || 1 }));
      if (items.length === 0) throw new Error("Add at least one item");
      const res = await fetch(`${API}/api/v1/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: company || null,
          contact: { name, email, phone: phone || null },
          message: message || null,
          items,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not submit");
      router.replace(`/quote/${data.number}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
      setBusy(false);
    }
  }

  const field = "w-full border-2 border-ink-900 bg-white px-3 py-2.5 text-sm focus:outline-none focus:shadow-focus";
  const lbl = "mb-1.5 block font-display text-xs font-bold uppercase tracking-wideCaps text-ink-700";

  return (
    <div className="shell max-w-4xl py-10">
      <div className="border-b-2 border-ink-900 pb-4">
        <span className="eyebrow text-royal-600">Bulk & corporate supply</span>
        <h1 className="mt-1 text-4xl font-black uppercase md:text-5xl">Request a quote</h1>
        <p className="mt-3 max-w-2xl text-ink-600">
          Tell us what your team needs. We&apos;ll price it up — volume PPE, custom-branded
          workwear, compliance kits — and send a formal quotation.
        </p>
      </div>

      <form onSubmit={submit} className="mt-8 space-y-8">
        {error && (
          <div className="border-2 border-hivis-500 bg-hivis-50 px-4 py-3 text-sm font-medium text-hivis-700">
            {error}
          </div>
        )}

        <section className="border-2 border-ink-900 bg-white p-6">
          <h2 className="mb-4 font-display text-lg font-black uppercase">Your details</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label><span className={lbl}>Company (optional)</span><input className={field} value={company} onChange={(e) => setCompany(e.target.value)} /></label>
            <label><span className={lbl}>Contact name</span><input className={field} value={name} onChange={(e) => setName(e.target.value)} required /></label>
            <label><span className={lbl}>Email</span><input type="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <label><span className={lbl}>Phone</span><input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" /></label>
          </div>
        </section>

        <section className="border-2 border-ink-900 bg-white">
          <div className="flex items-center justify-between border-b-2 border-ink-900 p-4">
            <h2 className="font-display text-lg font-black uppercase">Items</h2>
            <button type="button" onClick={() => setLines((l) => [...l, { description: "", quantity: 1 }])} className="btn-ghost !px-4 !py-2">+ Add item</button>
          </div>
          <div className="divide-y-2 divide-ink-100">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-[1fr_110px_44px] sm:items-end">
                <label><span className={lbl}>Description</span><input className={field} value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="e.g. Nitrile gloves, size L" /></label>
                <label><span className={lbl}>Quantity</span><input type="number" min="1" className={field} value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} /></label>
                {lines.length > 1 && (
                  <button type="button" aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} className="h-[42px] border-2 border-hivis-500 font-display text-sm font-bold text-hivis-700 hover:bg-hivis-500 hover:text-white">×</button>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="border-2 border-ink-900 bg-white p-6">
          <label><span className={lbl}>Notes / requirements</span>
            <textarea className={`${field} min-h-[100px]`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Delivery location, timelines, branding, certifications needed…" />
          </label>
        </section>

        <div className="flex items-center gap-4">
          <button type="submit" disabled={busy} className="btn-signal disabled:opacity-60">
            {busy ? "Submitting…" : "Request quote →"}
          </button>
          <Link href="/catalog" className="font-mono text-xs text-royal-600 hover:underline">← Back to catalog</Link>
        </div>
      </form>
    </div>
  );
}
