import Link from "next/link";
import { apiGet, Brand, Category, Page, Product } from "@/lib/api";
import { ProductCard } from "@/components/product-card";
import { FilterPanel } from "@/components/filter-panel";

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

type SP = {
  category?: string;
  brand?: string;
  q?: string;
  sort?: string;
  page?: string;
};

function qs(base: SP, override: Partial<SP>): string {
  const merged = { ...base, ...override };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `/catalog?${s}` : "/catalog";
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const query = new URLSearchParams();
  if (sp.category) query.set("category", sp.category);
  if (sp.brand) query.set("brand", sp.brand);
  if (sp.q) query.set("q", sp.q);
  if (sp.sort) query.set("sort", sp.sort);
  query.set("page", String(page));
  query.set("page_size", "12");

  const [data, categories, brands] = await Promise.all([
    safe(apiGet<Page<Product>>(`/catalog/products?${query.toString()}`), {
      items: [],
      total: 0,
      page: 1,
      page_size: 12,
      pages: 0,
    }),
    safe(apiGet<Category[]>("/catalog/categories"), []),
    safe(apiGet<Brand[]>("/catalog/brands"), []),
  ]);

  return (
    <div className="shell py-10">
      {/* Header */}
      <div className="border-b-2 border-ink-900 pb-5">
        <span className="eyebrow text-royal-600">Equipment catalog</span>
        <h1 className="mt-1 text-4xl font-black uppercase text-ink-900 md:text-5xl">
          {sp.q
            ? `Search: “${sp.q}”`
            : sp.category
              ? categories.find((c) => c.slug === sp.category)?.name || "Catalog"
              : "All equipment"}
        </h1>
        <p className="mt-2 font-mono text-sm text-ink-500">
          {data.total} product{data.total === 1 ? "" : "s"}
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr]">
        {/* Filters */}
        <aside className="space-y-4 lg:space-y-8">
          <form action="/catalog" className="flex border-2 border-ink-900">
            <input
              name="q"
              aria-label="Search catalog"
              defaultValue={sp.q}
              placeholder="Search…"
              className="w-full bg-white px-3 py-2.5 text-sm focus:outline-none"
            />
            <button type="submit" className="bg-ink-900 px-4 text-white" aria-label="Search">
              →
            </button>
          </form>

          <FilterPanel>
            <div className="space-y-8">
              <FilterGroup
                title="Category"
                items={[
                  { label: "All", href: qs(sp, { category: undefined, page: undefined }), active: !sp.category },
                  ...categories.map((c) => ({
                    label: c.name,
                    href: qs(sp, { category: c.slug, page: undefined }),
                    active: sp.category === c.slug,
                  })),
                ]}
              />
              <FilterGroup
                title="Brand"
                items={[
                  { label: "All", href: qs(sp, { brand: undefined, page: undefined }), active: !sp.brand },
                  ...brands.map((b) => ({
                    label: b.name,
                    href: qs(sp, { brand: b.slug, page: undefined }),
                    active: sp.brand === b.slug,
                  })),
                ]}
              />
            </div>
          </FilterPanel>
        </aside>

        {/* Results */}
        <div>
          {data.items.length === 0 ? (
            <div className="border-2 border-ink-900 p-12 text-center">
              <p className="font-display text-xl font-bold uppercase">No products found</p>
              <Link href="/catalog" className="mt-3 inline-block font-mono text-sm text-royal-600">
                ← Clear filters
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {data.items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          {data.pages > 1 && (
            <div className="mt-10 flex items-center justify-between border-t-2 border-ink-900 pt-5">
              <PagerLink
                href={qs(sp, { page: String(page - 1) })}
                disabled={page <= 1}
                label="← Prev"
              />
              <span className="font-mono text-sm text-ink-500">
                Page {data.page} / {data.pages}
              </span>
              <PagerLink
                href={qs(sp, { page: String(page + 1) })}
                disabled={page >= data.pages}
                label="Next →"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({
  title,
  items,
}: {
  title: string;
  items: { label: string; href: string; active: boolean }[];
}) {
  return (
    <div>
      <h3 className="border-b-2 border-ink-900 pb-2 font-display text-xs font-bold uppercase tracking-wideCaps text-ink-900">
        {title}
      </h3>
      <ul className="mt-3 space-y-1">
        {items.map((it) => (
          <li key={it.href}>
            <Link
              href={it.href}
              className={`block px-2 py-1.5 text-sm transition-colors ${
                it.active
                  ? "bg-signal-500 font-bold text-ink-900"
                  : "text-ink-600 hover:bg-ink-100"
              }`}
            >
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PagerLink({
  href,
  disabled,
  label,
}: {
  href: string;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="border-2 border-ink-200 px-5 py-2 font-display text-sm font-bold uppercase tracking-wideCaps text-ink-300">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="border-2 border-ink-900 px-5 py-2 font-display text-sm font-bold uppercase tracking-wideCaps hover:bg-ink-900 hover:text-white"
    >
      {label}
    </Link>
  );
}
