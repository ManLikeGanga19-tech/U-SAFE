"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Brand } from "@/lib/api";

// Super-smooth, seamless left→right marquee of brand logos.
// Two identical copies of the row sit side by side; translating the track by
// exactly one copy width (-50% → 0%) loops without any visible seam.
export function BrandMarquee({ brands }: { brands: Brand[] }) {
  if (brands.length === 0) return null;
  const loop = [...brands, ...brands];

  return (
    <div className="group relative overflow-hidden border-y-2 border-ink-900 bg-white">
      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-white to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-white to-transparent" />

      <motion.div
        className="flex w-max items-center"
        initial={{ x: "-50%" }}
        animate={{ x: "0%" }}
        transition={{ duration: 45, ease: "linear", repeat: Infinity }}
        style={{ willChange: "transform" }}
      >
        {loop.map((b, i) => (
          <Link
            key={`${b.id}-${i}`}
            href={`/catalog?brand=${b.slug}`}
            title={`Shop ${b.name}`}
            className="flex h-28 w-48 shrink-0 items-center justify-center border-r-2 border-ink-100 px-8 transition-colors hover:bg-ink-50"
          >
            {b.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={b.logo_url}
                alt={b.name}
                className="max-h-14 w-auto max-w-full object-contain"
                loading="lazy"
              />
            ) : (
              <span className="font-display text-xl font-black uppercase tracking-tight text-ink-400">
                {b.name}
              </span>
            )}
          </Link>
        ))}
      </motion.div>
    </div>
  );
}
