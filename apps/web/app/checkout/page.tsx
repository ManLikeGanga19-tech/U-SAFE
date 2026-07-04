"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatKES, useCart } from "@/lib/cart";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function CheckoutPage() {
  const { cart, loading, refresh } = useCart();
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    mpesa_phone: "",
    city: "",
    address: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState(false);

  useEffect(() => {
    // Send shoppers with an empty cart back — but NOT right after they placed an
    // order (checkout consumes the cart), otherwise we'd race the /order redirect.
    if (!loading && cart.items.length === 0 && !placed) router.replace("/cart");
  }, [loading, cart.items.length, router, placed]);

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const token = localStorage.getItem("usafe_cart_token");
      const res = await fetch(`${API}/api/v1/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Cart-Token": token || "" },
        body: JSON.stringify({
          contact: { name: form.name, email: form.email, phone: form.phone },
          shipping_address: { city: form.city, address: form.address },
          mpesa_phone: form.mpesa_phone || form.phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Checkout failed");
      setPlaced(true); // suppress the empty-cart guard before the cart refreshes
      router.replace(`/order/${data.order_number}`);
      refresh(); // update header count in the background (fire-and-forget)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setBusy(false);
    }
  }

  const field = "w-full border-2 border-ink-900 bg-white px-3 py-2.5 text-sm focus:outline-none focus:shadow-focus";
  const labelCls = "mb-1.5 block font-display text-xs font-bold uppercase tracking-wideCaps text-ink-700";

  return (
    <div className="shell py-10">
      <div className="border-b-2 border-ink-900 pb-4">
        <span className="eyebrow text-royal-600">Checkout</span>
        <h1 className="mt-1 text-4xl font-black uppercase md:text-5xl">Complete your order</h1>
      </div>

      <form onSubmit={submit} className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          {error && (
            <div className="border-2 border-hivis-500 bg-hivis-50 px-4 py-3 text-sm font-medium text-hivis-700">
              {error}
            </div>
          )}

          <section className="border-2 border-ink-900 bg-white p-6">
            <h2 className="mb-4 font-display text-lg font-black uppercase">Contact</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label>
                <span className={labelCls}>Full name</span>
                <input className={field} value={form.name} onChange={(e) => set("name", e.target.value)} required />
              </label>
              <label>
                <span className={labelCls}>Email</span>
                <input type="email" className={field} value={form.email} onChange={(e) => set("email", e.target.value)} required />
              </label>
              <label>
                <span className={labelCls}>Phone</span>
                <input className={field} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="07XX XXX XXX" required />
              </label>
            </div>
          </section>

          <section className="border-2 border-ink-900 bg-white p-6">
            <h2 className="mb-4 font-display text-lg font-black uppercase">Delivery</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label>
                <span className={labelCls}>Town / City</span>
                <input className={field} value={form.city} onChange={(e) => set("city", e.target.value)} required />
              </label>
              <label className="sm:col-span-2">
                <span className={labelCls}>Address / delivery notes</span>
                <input className={field} value={form.address} onChange={(e) => set("address", e.target.value)} />
              </label>
            </div>
          </section>

          <section className="border-2 border-ink-900 bg-white p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="bg-signal-500 px-2 py-1 font-display text-xs font-black uppercase text-ink-900">M-Pesa</span>
              <h2 className="font-display text-lg font-black uppercase">Payment</h2>
            </div>
            <label>
              <span className={labelCls}>M-Pesa phone number</span>
              <input className={field} value={form.mpesa_phone} onChange={(e) => set("mpesa_phone", e.target.value)} placeholder="07XX XXX XXX" required />
            </label>
            <p className="mt-2 font-mono text-xs text-ink-400">
              You&apos;ll receive an STK push prompt to enter your M-Pesa PIN.
            </p>
          </section>
        </div>

        {/* Summary */}
        <aside className="h-fit border-2 border-ink-900 bg-white">
          <div className="border-b-2 border-ink-900 p-5">
            <h2 className="font-display text-lg font-black uppercase">Order summary</h2>
          </div>
          <div className="divide-y divide-ink-100">
            {cart.items.map((l) => (
              <div key={l.id} className="flex justify-between gap-3 px-5 py-3 text-sm">
                <span className="text-ink-700">
                  {l.quantity} × {l.product_name}
                </span>
                <span className="font-mono">{formatKES(l.line_total_kes)}</span>
              </div>
            ))}
          </div>
          <div className="border-t-2 border-ink-900 bg-ink-900 p-5 text-white">
            <div className="flex items-center justify-between">
              <span className="font-display uppercase tracking-wideCaps">Total</span>
              <span className="font-display text-2xl font-black">{formatKES(cart.subtotal_kes)}</span>
            </div>
          </div>
          <div className="p-5">
            <button type="submit" disabled={busy} className="btn-signal w-full disabled:opacity-60">
              {busy ? "Sending STK push…" : "Pay with M-Pesa →"}
            </button>
            <Link href="/cart" className="mt-3 block text-center font-mono text-xs text-royal-600 hover:underline">
              ← Back to cart
            </Link>
          </div>
        </aside>
      </form>
    </div>
  );
}
