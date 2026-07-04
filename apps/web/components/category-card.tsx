import Link from "next/link";
import { Category } from "@/lib/api";

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
    </svg>
  );
}

export function CategoryCard({ category, index }: { category: Category; index: number }) {
  const num = String(index + 1).padStart(2, "0");
  const img = category.image_url || `/categories/${category.slug}.jpg`;

  return (
    <Link
      href={`/catalog?category=${category.slug}`}
      className="group relative block aspect-[4/5] overflow-hidden border-2 border-ink-900 bg-ink-900"
    >
      {/* Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img}
        alt={category.name}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-110"
      />

      {/* Dark scrim for label legibility (default state) */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink-900/90 via-ink-900/25 to-ink-900/10 transition-opacity duration-500 group-hover:opacity-0" />

      {/* Index number */}
      <span className="absolute left-4 top-3 z-20 font-mono text-xs text-white/70 transition-colors duration-300 group-hover:text-ink-900">
        {num}
      </span>

      {/* Default label */}
      <div className="absolute inset-x-0 bottom-0 z-10 p-4 transition-opacity duration-300 group-hover:opacity-0">
        <span className="font-display text-lg font-bold uppercase leading-tight text-white">
          {category.name}
        </span>
      </div>

      {/* GREEN reveal — fades and rises up from the bottom on hover */}
      <div className="absolute inset-0 z-10 flex translate-y-8 flex-col justify-end bg-gradient-to-t from-signal-500 from-45% via-signal-500/90 to-transparent p-4 opacity-0 transition-all duration-500 ease-out group-hover:translate-y-0 group-hover:opacity-100">
        <span className="font-display text-xl font-black uppercase leading-tight text-ink-900">
          {category.name}
        </span>
        <span className="mt-4 inline-flex w-fit items-center gap-2 border-2 border-ink-900 bg-ink-900 px-3 py-2 font-display text-xs font-bold uppercase tracking-wideCaps text-white">
          Go to shop <ArrowIcon />
        </span>
      </div>
    </Link>
  );
}
