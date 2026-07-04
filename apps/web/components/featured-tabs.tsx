"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Product } from "@/lib/api";
import { ProductCard } from "./product-card";

type TabKey = "featured" | "kits" | "bestsellers";

export function FeaturedTabs({
  featured,
  kits,
  bestsellers,
}: {
  featured: Product[];
  kits: Product[];
  bestsellers: Product[];
}) {
  const allTabs: { key: TabKey; label: string; data: Product[] }[] = [
    { key: "featured", label: "Featured", data: featured },
    { key: "kits", label: "Kits & Bundles", data: kits },
    { key: "bestsellers", label: "Bestsellers", data: bestsellers },
  ];
  const tabs = allTabs.filter((t) => t.data.length > 0);

  const [tab, setTab] = useState<TabKey>(tabs[0]?.key ?? "featured");
  const active = tabs.find((t) => t.key === tab) ?? tabs[0];

  return (
    <div className="mt-8">
      {/* Segmented tab bar (scrolls horizontally on very small screens) */}
      <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <div className="flex w-max border-2 border-ink-900">
          {tabs.map((t, i) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap px-3 py-2.5 font-display text-xs font-bold uppercase tracking-wideCaps transition-colors sm:px-5 sm:text-sm ${
                i > 0 ? "border-l-2 border-ink-900" : ""
              } ${
                tab === t.key
                  ? "bg-signal-500 text-ink-900"
                  : "bg-white text-ink-600 hover:bg-ink-100"
              }`}
            >
              {t.label}
              <span className="ml-2 font-mono text-[10px] text-ink-500">{t.data.length}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid with smooth tab transition */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {active?.data.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
