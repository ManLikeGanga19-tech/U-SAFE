"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/lib/auth";

const NAV = [
  { label: "Overview", href: "/" },
  { label: "Orders", href: "/orders" },
  { label: "Quotes", href: "/quotes" },
  { label: "Products", href: "/products" },
  { label: "Inventory", href: "/inventory" },
  { label: "Categories", href: "/categories" },
  { label: "Brands", href: "/brands" },
  { label: "Content", href: "/content" },
];

const STOREFRONT = process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000";

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {NAV.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`mb-1 block px-3 py-2.5 font-display text-sm font-bold uppercase tracking-wideCaps transition-colors ${
              active ? "bg-signal-500 text-ink-900" : "text-ink-300 hover:bg-ink-700 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { me, ready, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (ready && !me) router.replace("/login");
  }, [ready, me, router]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (!ready || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center font-mono text-sm text-ink-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[240px_1fr]">
      {/* Desktop sidebar (sticky) */}
      <aside className="sticky top-0 hidden h-screen flex-col self-start overflow-y-auto border-r-2 border-ink-900 bg-ink-900 text-white lg:flex">
        <div className="border-b-2 border-ink-700 p-5 font-display text-xl font-black tracking-tightest">
          U-SAFE<span className="text-signal-500">.</span>
        </div>
        <nav className="flex-1 p-3">
          <NavLinks pathname={pathname} />
        </nav>
        <div className="border-t-2 border-ink-700 p-3">
          <a
            href={STOREFRONT}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-3 py-2 font-mono text-xs text-ink-400 hover:text-signal-500"
          >
            ↗ View storefront
          </a>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b-2 border-ink-900 bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="flex h-9 w-9 items-center justify-center border-2 border-ink-900 lg:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
            <span className="font-display text-lg font-black tracking-tightest lg:hidden">
              U-SAFE<span className="text-signal-500">.</span>
            </span>
            <span className="hidden font-display text-xs font-bold uppercase tracking-wideCaps text-ink-400 lg:inline">
              Control plane
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <div className="truncate text-sm font-semibold">{me.full_name || me.email}</div>
              <div className="font-mono text-xs uppercase text-ink-400">{me.role}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                signOut();
                router.replace("/login");
              }}
              className="shrink-0 border-2 border-ink-900 px-3 py-2 font-display text-xs font-bold uppercase tracking-wideCaps hover:bg-ink-900 hover:text-white sm:px-4"
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="min-w-0 flex-1 bg-ink-50 p-4 sm:p-6">{children}</main>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-40 bg-ink-900/60 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col border-r-2 border-ink-900 bg-ink-900 text-white lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center justify-between border-b-2 border-ink-700 p-5">
                <span className="font-display text-xl font-black tracking-tightest">
                  U-SAFE<span className="text-signal-500">.</span>
                </span>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                  className="flex h-8 w-8 items-center justify-center border-2 border-ink-700 text-ink-300 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-3">
                <NavLinks pathname={pathname} onNavigate={() => setMenuOpen(false)} />
              </nav>
              <div className="border-t-2 border-ink-700 p-3">
                <div className="px-3 pb-2">
                  <div className="truncate text-sm font-semibold">{me.full_name || me.email}</div>
                  <div className="font-mono text-xs uppercase text-ink-400">{me.role}</div>
                </div>
                <a
                  href={STOREFRONT}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-3 py-2 font-mono text-xs text-ink-400 hover:text-signal-500"
                >
                  ↗ View storefront
                </a>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
