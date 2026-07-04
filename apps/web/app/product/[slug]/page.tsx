import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGet, Product } from "@/lib/api";
import { BuyBox } from "@/components/buy-box";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let product: Product;
  try {
    product = await apiGet<Product>(`/catalog/products/${slug}`);
  } catch {
    notFound();
  }

  const img = product.images[0]?.url;
  const attributes = product.attributes;

  return (
    <div className="shell py-8">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-2 font-mono text-xs text-ink-400">
        <Link href="/" className="hover:text-royal-600">Home</Link>
        <span>/</span>
        <Link href="/catalog" className="hover:text-royal-600">Catalog</Link>
        {product.category && (
          <>
            <span>/</span>
            <Link
              href={`/catalog?category=${product.category.slug}`}
              className="hover:text-royal-600"
            >
              {product.category.name}
            </Link>
          </>
        )}
      </nav>

      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Gallery */}
        <div>
          <div className="aspect-square border-2 border-ink-900 bg-ink-50">
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt={product.name} className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <span className="font-display text-9xl font-black text-ink-200">
                  {product.name.charAt(0)}
                </span>
              </div>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-3">
              {product.images.slice(0, 5).map((im, i) => (
                <div key={i} className="aspect-square border-2 border-ink-900 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im.url} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          {product.brand && (
            <Link
              href={`/catalog?brand=${product.brand.slug}`}
              className="eyebrow text-royal-600 hover:text-signal-600"
            >
              {product.brand.name}
            </Link>
          )}
          <h1 className="mt-2 text-3xl font-black uppercase leading-none text-ink-900 sm:text-4xl">
            {product.name}
          </h1>

          {product.standards.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {product.standards.map((s) => (
                <span
                  key={s}
                  className="border-2 border-ink-900 bg-white px-2.5 py-1 font-mono text-xs font-semibold text-ink-800"
                >
                  {s}
                </span>
              ))}
            </div>
          )}

          {product.summary && (
            <p className="mt-5 text-lg text-ink-600">{product.summary}</p>
          )}

          <div className="mt-6">
            <BuyBox product={product} />
          </div>
        </div>
      </div>

      {/* Description + spec sheet */}
      <div className="mt-14 grid grid-cols-1 gap-10 border-t-2 border-ink-900 pt-10 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-black uppercase">Description</h2>
          <p className="mt-4 whitespace-pre-line text-ink-600">
            {product.description || product.summary || "No description provided."}
          </p>
        </div>
        <div>
          <h2 className="text-2xl font-black uppercase">Specifications</h2>
          <table className="mt-4 w-full border-2 border-ink-900 font-mono text-sm">
            <tbody>
              <SpecRow label="Brand" value={product.brand?.name || "—"} />
              <SpecRow label="Category" value={product.category?.name || "—"} />
              <SpecRow
                label="Standards"
                value={product.standards.join(", ") || "—"}
              />
              {attributes &&
                Object.entries(attributes).map(([k, v]) => (
                  <SpecRow key={k} label={k} value={String(v)} />
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-ink-200 last:border-0">
      <td className="w-2/5 border-r-2 border-ink-900 bg-ink-50 px-4 py-2.5 font-semibold uppercase text-ink-700">
        {label}
      </td>
      <td className="px-4 py-2.5 text-ink-800">{value}</td>
    </tr>
  );
}
