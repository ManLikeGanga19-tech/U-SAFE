import Link from "next/link";
import { apiGet, Brand, Category, ContentBlock, Page, Product } from "@/lib/api";
import { ProductCard } from "@/components/product-card";
import { BrandMarquee } from "@/components/brand-marquee";
import { HeroSlider } from "@/components/hero-slider";
import { CategoryCard } from "@/components/category-card";
import { FeaturedTabs } from "@/components/featured-tabs";
import { AnimatedHazard } from "@/components/animated-hazard";

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

const emptyPage: Page<Product> = { items: [], total: 0, page: 1, page_size: 6, pages: 0 };

export default async function HomePage() {
  const [categories, featuredPage, kitsPage, bestsellersPage, brands, hero] =
    await Promise.all([
      safe(apiGet<Category[]>("/catalog/categories"), []),
      safe(apiGet<Page<Product>>("/catalog/products?featured=true&page_size=6"), emptyPage),
      safe(apiGet<Page<Product>>("/catalog/products?tag=kit&page_size=6"), emptyPage),
      safe(apiGet<Page<Product>>("/catalog/products?sort=bestselling&page_size=6"), emptyPage),
      safe(apiGet<Brand[]>("/catalog/brands"), []),
      safe(apiGet<ContentBlock>("/content/home_hero"), null),
    ]);

  return (
    <>
      <Hero hero={hero} />
      <IndustriesBand />
      <Categories categories={categories} />
      <Featured
        featured={featuredPage.items}
        kits={kitsPage.items}
        bestsellers={bestsellersPage.items}
      />
      <Brands brands={brands} />
      <QuoteCta />
    </>
  );
}

function Hero({ hero }: { hero: ContentBlock | null }) {
  const eyebrow = hero?.data?.eyebrow || "Certified PPE distribution · Est. 2020";
  const title = hero?.title || "Ensuring you are safe.";
  const body =
    hero?.body ||
    "Multi-brand distributor of quality personal protective equipment and safety gear — protecting workers across mining, construction, petroleum, medical and manufacturing throughout Kenya and Africa.";
  const ctaLabel = hero?.data?.cta_label || "Shop equipment";
  const ctaHref = hero?.data?.cta_href || "/catalog";
  return (
    <section className="relative overflow-hidden border-b-2 border-ink-900 bg-white">
      {/* Subtle industrial blueprint grid */}
      <div className="blueprint-grid pointer-events-none absolute inset-0 opacity-[0.04]" />
      {/* Corner registration marks */}
      <div className="pointer-events-none absolute left-4 top-4 h-6 w-6 border-l-2 border-t-2 border-ink-900/30" />
      <div className="pointer-events-none absolute right-4 top-4 h-6 w-6 border-r-2 border-t-2 border-ink-900/30" />

      <div className="shell relative grid grid-cols-1 items-center gap-10 py-12 sm:py-16 lg:min-h-[82vh] lg:grid-cols-2 lg:gap-14 lg:py-24">
        {/* Left: message */}
        <div>
          <span className="eyebrow inline-block bg-ink-900 px-3 py-1.5 text-signal-500">
            {eyebrow}
          </span>
          <h1 className="mt-5 text-4xl font-black uppercase leading-[0.95] text-ink-900 sm:text-5xl sm:leading-[0.92] md:text-7xl xl:text-8xl">
            {title}
          </h1>
          <p className="mt-5 max-w-xl text-base text-ink-600 sm:text-lg md:text-xl">{body}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
            <Link href={ctaHref} className="btn-signal w-full justify-center !px-8 !py-4 text-base sm:w-auto">
              {ctaLabel} →
            </Link>
            <Link href="/quote" className="btn-ghost w-full justify-center !px-8 !py-4 text-base sm:w-auto">
              Request a bulk quote
            </Link>
          </div>
          {/* Trust line */}
          <div className="mt-8 flex flex-col gap-1 border-t-2 border-ink-900 pt-6 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 lg:mt-10">
            <span className="font-display text-xs font-bold uppercase tracking-wideCaps text-ink-400 sm:text-sm">
              Authorised distributor
            </span>
            <span className="font-display text-xs font-bold uppercase tracking-wideCaps text-ink-900 sm:text-sm">
              3M · Ansell · Portwest · Uvex · Honeywell
            </span>
          </div>
        </div>

        {/* Right: framer-motion product slider */}
        <div className="h-full min-h-[360px] sm:min-h-[440px] lg:min-h-[560px]">
          <HeroSlider />
        </div>
      </div>

      {/* Full-width animated hazard stripe base — orange/black, opposite direction to the footer */}
      <AnimatedHazard className="h-3" bgClass="bg-hazard" reverse />
    </section>
  );
}

function IndustriesBand() {
  const items = [
    "Mining",
    "Construction",
    "Petroleum",
    "Manufacturing",
    "Agriculture",
    "Medical",
    "Hospitality",
    "Security",
  ];
  return (
    <div className="bg-royal-600 text-white">
      <div className="shell flex flex-wrap items-center gap-x-8 gap-y-2 py-4 font-display text-sm font-bold uppercase tracking-wideCaps">
        <span className="text-signal-500">Trusted in:</span>
        {items.map((i) => (
          <span key={i}>{i}</span>
        ))}
      </div>
    </div>
  );
}

function Categories({ categories }: { categories: Category[] }) {
  return (
    <section className="shell py-16 lg:py-20">
      <SectionHead
        eyebrow="Shop by protection"
        title="Every hazard, covered."
        href="/catalog"
      />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((c, i) => (
          <CategoryCard key={c.id} category={c} index={i} />
        ))}
        {categories.length === 0 && (
          <div className="border-2 border-ink-900 bg-white p-8 font-mono text-sm text-ink-400">
            Catalog loading…
          </div>
        )}
      </div>
    </section>
  );
}

function Featured({
  featured,
  kits,
  bestsellers,
}: {
  featured: Product[];
  kits: Product[];
  bestsellers: Product[];
}) {
  if (featured.length === 0 && kits.length === 0 && bestsellers.length === 0) return null;
  return (
    <section className="border-y-2 border-ink-900 bg-ink-50">
      <div className="shell py-16 lg:py-20">
        <SectionHead
          eyebrow="In stock now"
          title="Featured equipment."
          href="/catalog"
        />
        <FeaturedTabs featured={featured} kits={kits} bestsellers={bestsellers} />
      </div>
    </section>
  );
}

function Brands({ brands }: { brands: Brand[] }) {
  if (brands.length === 0) return null;
  return (
    <section className="py-16">
      <div className="shell">
        <SectionHead eyebrow="Authorised distribution · tap a logo to shop" title="Our brands." />
      </div>
      <div className="mt-8">
        <BrandMarquee brands={brands} />
      </div>
    </section>
  );
}

function QuoteCta() {
  return (
    <section className="bg-ink-900 text-white">
      <div className="shell grid grid-cols-1 items-center gap-8 py-16 md:grid-cols-2">
        <div>
          <span className="eyebrow text-signal-500">Bulk & corporate supply</span>
          <h2 className="mt-3 text-4xl font-black uppercase md:text-5xl">
            Kitting out a whole workforce?
          </h2>
          <p className="mt-4 max-w-lg text-ink-300">
            Get tailored pricing on volume PPE orders, custom-branded workwear and
            compliance-ready kits. We&apos;ll match the right protection to your
            work environment.
          </p>
        </div>
        <div className="flex md:justify-end">
          <Link href="/quote" className="btn-signal">
            Request a quote →
          </Link>
        </div>
      </div>
    </section>
  );
}

function SectionHead({
  eyebrow,
  title,
  href,
}: {
  eyebrow: string;
  title: string;
  href?: string;
}) {
  return (
    <div className="flex items-end justify-between border-b-2 border-ink-900 pb-4">
      <div>
        <span className="eyebrow text-royal-600">{eyebrow}</span>
        <h2 className="mt-1 text-3xl font-black uppercase text-ink-900 md:text-4xl">
          {title}
        </h2>
      </div>
      {href && (
        <Link
          href={href}
          className="hidden font-display text-sm font-bold uppercase tracking-wideCaps text-ink-700 hover:text-signal-600 sm:block"
        >
          View all →
        </Link>
      )}
    </div>
  );
}
