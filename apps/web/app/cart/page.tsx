"use client";

import Link from "next/link";
import { formatKES, useCart } from "@/lib/cart";

export default function CartPage() {
  const { cart, loading, updateItem, removeItem } = useCart();

  if (loading) {
    return <div className="shell py-16 font-mono text-sm text-ink-400">Loading cart…</div>;
  }

  if (cart.items.length === 0) {
    return (
      <div className="shell py-20 text-center">
        <h1 className="text-4xl font-black uppercase">Your cart is empty</h1>
        <p className="mt-3 text-ink-500">Add some protective equipment to get started.</p>
        <Link href="/catalog" className="btn-signal mt-8 inline-flex">
          Browse catalog →
        </Link>
      </div>
    );
  }

  return (
    <div className="shell py-10">
      <div className="border-b-2 border-ink-900 pb-4">
        <span className="eyebrow text-royal-600">Your cart</span>
        <h1 className="mt-1 text-4xl font-black uppercase md:text-5xl">
          {cart.item_count} item{cart.item_count === 1 ? "" : "s"}
        </h1>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        {/* Lines */}
        <div className="border-2 border-ink-900 bg-white">
          {cart.items.map((line, i) => (
            <div
              key={line.id}
              className={`flex gap-4 p-4 ${i > 0 ? "border-t-2 border-ink-100" : ""}`}
            >
              <div className="h-20 w-20 shrink-0 border-2 border-ink-900 bg-ink-50 sm:h-24 sm:w-24">
                {line.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={line.image_url} alt={line.product_name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center font-display text-3xl font-black text-ink-200">
                    {line.product_name.charAt(0)}
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/product/${line.product_slug}`} className="min-w-0 font-display text-base font-bold uppercase leading-tight hover:text-royal-600 sm:text-lg">
                    {line.product_name}
                  </Link>
                  <span className="shrink-0 font-display text-base font-black sm:text-lg">
                    {formatKES(line.line_total_kes)}
                  </span>
                </div>
                <span className="font-mono text-xs text-ink-400">
                  {line.sku}{line.variant_name ? ` · ${line.variant_name}` : ""}
                </span>
                {line.quantity > line.available && (
                  <span className="mt-1 font-mono text-xs text-hivis-700">
                    Only {line.available} in stock
                  </span>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-1">
                  <div className="flex border-2 border-ink-900">
                    <button
                      type="button"
                      aria-label="Decrease"
                      onClick={() => updateItem(line.id, Math.max(1, line.quantity - 1))}
                      className="w-9 bg-ink-100 font-display font-bold hover:bg-ink-200"
                    >
                      −
                    </button>
                    <span className="flex w-10 items-center justify-center font-display font-bold">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase"
                      onClick={() => updateItem(line.id, line.quantity + 1)}
                      className="w-9 bg-ink-100 font-display font-bold hover:bg-ink-200"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(line.id)}
                    className="font-mono text-xs uppercase text-ink-400 hover:text-hivis-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <aside className="h-fit border-2 border-ink-900 bg-white">
          <div className="border-b-2 border-ink-900 bg-ink-900 p-5 text-white">
            <div className="flex items-center justify-between">
              <span className="font-display uppercase tracking-wideCaps">Subtotal</span>
              <span className="font-display text-2xl font-black">{formatKES(cart.subtotal_kes)}</span>
            </div>
          </div>
          <div className="p-5">
            <p className="font-mono text-xs text-ink-400">
              Shipping calculated at fulfilment. Pay securely with M-Pesa.
            </p>
            <Link href="/checkout" className="btn-signal mt-4 w-full">
              Checkout →
            </Link>
            <Link href="/catalog" className="mt-3 block text-center font-mono text-xs text-royal-600 hover:underline">
              ← Continue shopping
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
