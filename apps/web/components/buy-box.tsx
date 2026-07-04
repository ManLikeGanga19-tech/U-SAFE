"use client";

import { useState } from "react";
import { Product, Variant } from "@/lib/api";
import { formatKES, useCart } from "@/lib/cart";

// Variant selection + add to the server cart (Phase 2).
export function BuyBox({ product }: { product: Product }) {
  const variants = product.variants;
  const { addItem } = useCart();
  const [variantId, setVariantId] = useState(variants[0]?.id);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);

  const variant: Variant | undefined =
    variants.find((v) => v.id === variantId) || variants[0];

  async function addToCart() {
    if (!variant) return;
    setBusy(true);
    try {
      await addItem(variant.id, qty);
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-2 border-ink-900 bg-white">
      <div className="border-b-2 border-ink-900 bg-ink-900 p-5">
        <div className="font-display text-4xl font-black text-white">
          {variant ? formatKES(variant.price_kes) : "—"}
        </div>
        {variant?.compare_at_kes ? (
          <div className="mt-1 font-mono text-sm text-ink-400 line-through">
            {formatKES(variant.compare_at_kes)}
          </div>
        ) : null}
      </div>

      <div className="space-y-5 p-5">
        {variants.length > 1 && (
          <div>
            <label className="mb-1.5 block font-display text-xs font-bold uppercase tracking-wideCaps text-ink-700">
              Variant
            </label>
            <select
              aria-label="Select variant"
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              className="w-full border-2 border-ink-900 bg-white px-3 py-2.5 text-sm focus:outline-none focus:shadow-focus"
            >
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name || v.sku} — {formatKES(v.price_kes)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-end gap-4">
          <div>
            <label className="mb-1.5 block font-display text-xs font-bold uppercase tracking-wideCaps text-ink-700">
              Qty
            </label>
            <div className="flex border-2 border-ink-900">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-10 bg-ink-100 font-display text-lg font-bold hover:bg-ink-200"
                aria-label="Decrease"
              >
                −
              </button>
              <span className="flex w-12 items-center justify-center font-display font-bold">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="w-10 bg-ink-100 font-display text-lg font-bold hover:bg-ink-200"
                aria-label="Increase"
              >
                +
              </button>
            </div>
          </div>
          {variant && (
            <div className="pb-1 font-mono text-xs text-ink-400">SKU {variant.sku}</div>
          )}
        </div>

        <button
          type="button"
          onClick={addToCart}
          disabled={busy}
          className="w-full bg-signal-500 px-6 py-3.5 font-display font-bold uppercase tracking-wideCaps text-ink-900 border-2 border-ink-900 transition-colors hover:bg-signal-400 disabled:opacity-60"
        >
          {added ? "✓ Added to cart" : busy ? "Adding…" : "Add to cart"}
        </button>
        <a
          href="/quote"
          className="block w-full border-2 border-ink-900 px-6 py-3 text-center font-display font-bold uppercase tracking-wideCaps text-ink-900 hover:bg-ink-900 hover:text-white"
        >
          Request bulk quote
        </a>
      </div>
    </div>
  );
}
