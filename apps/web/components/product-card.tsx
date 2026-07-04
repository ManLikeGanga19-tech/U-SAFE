import Link from "next/link";
import { Product, formatKES } from "@/lib/api";

export function ProductCard({ product }: { product: Product }) {
  const v = product.variants[0];
  const img = product.images[0]?.url;

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex flex-col border-2 border-ink-900 bg-white transition-shadow hover:shadow-hard"
    >
      {/* Media */}
      <div className="relative aspect-square border-b-2 border-ink-900 bg-ink-50">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-display text-6xl font-black text-ink-200">
              {product.name.charAt(0)}
            </span>
          </div>
        )}
        {product.is_featured && (
          <span className="absolute left-0 top-0 bg-signal-500 px-2 py-1 font-display text-[10px] font-bold uppercase tracking-wideCaps text-ink-900">
            Featured
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        {product.brand && (
          <span className="eyebrow text-royal-600">{product.brand.name}</span>
        )}
        <h3 className="mt-1 font-display text-lg font-bold leading-tight text-ink-900">
          {product.name}
        </h3>

        {product.standards.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {product.standards.map((s) => (
              <span
                key={s}
                className="border border-ink-300 px-1.5 py-0.5 font-mono text-[10px] text-ink-600"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-end justify-between border-t-2 border-ink-900 pt-3">
          <div>
            <div className="font-display text-xl font-black text-ink-900">
              {v ? formatKES(v.price_kes) : "—"}
            </div>
            {v && (
              <div className="font-mono text-[10px] text-ink-400">{v.sku}</div>
            )}
          </div>
          <span className="font-display text-xs font-bold uppercase tracking-wideCaps text-signal-600 group-hover:text-signal-500">
            View →
          </span>
        </div>
      </div>
    </Link>
  );
}
