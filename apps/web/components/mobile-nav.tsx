"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";

export function MobileNav({ items }: { items: { label: string; href: string }[] }) {
  const [open, setOpen] = useState(false);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center border-2 border-ink-900 bg-white text-ink-900"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="absolute inset-0 bg-ink-900/60" onClick={() => setOpen(false)} />
            <motion.aside
              className="absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col border-l-2 border-ink-900 bg-white"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", ease: [0.22, 1, 0.36, 1], duration: 0.35 }}
            >
              <div className="flex items-center justify-between border-b-2 border-ink-900 px-5 py-4">
                <span className="font-display text-lg font-black uppercase tracking-tightest">
                  Menu
                </span>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  className="flex h-10 w-10 items-center justify-center border-2 border-ink-900"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
                  </svg>
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto">
                {items.map((it) => (
                  <Link
                    key={it.href}
                    href={it.href}
                    onClick={() => setOpen(false)}
                    className="block border-b border-ink-100 px-5 py-4 font-display text-xl font-bold uppercase tracking-wideCaps text-ink-900 transition-colors hover:bg-signal-500"
                  >
                    {it.label}
                  </Link>
                ))}
              </nav>

              <div className="space-y-3 border-t-2 border-ink-900 p-5">
                <Link href="/quote" onClick={() => setOpen(false)} className="btn-ghost w-full">
                  Request a quote
                </Link>
                <div className="text-center font-mono text-xs text-ink-500">
                  <a href="tel:+254748846635" className="hover:text-ink-900">+254 748 846635</a>
                  <span className="mx-1">·</span>
                  <a href="mailto:info@usafeke.com" className="hover:text-ink-900">info@usafeke.com</a>
                </div>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
