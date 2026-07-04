"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { me, ready, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !me) router.replace("/login");
  }, [ready, me, router]);

  if (!ready || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center font-mono text-sm text-ink-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[240px_1fr]">
      <aside className="border-r-2 border-ink-900 bg-ink-900 text-white">
        <div className="border-b-2 border-ink-700 p-5 font-display text-xl font-black tracking-tightest">
          U-SAFE<span className="text-signal-500">.</span>
        </div>
        <nav className="p-3">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mb-1 block px-3 py-2.5 font-display text-sm font-bold uppercase tracking-wideCaps transition-colors ${
                  active
                    ? "bg-signal-500 text-ink-900"
                    : "text-ink-300 hover:bg-ink-700 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3">
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noopener noreferrer"
            className="block px-3 py-2 font-mono text-xs text-ink-400 hover:text-signal-500"
          >
            ↗ View storefront
          </a>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between border-b-2 border-ink-900 bg-white px-6 py-4">
          <span className="font-display text-xs font-bold uppercase tracking-wideCaps text-ink-400">
            Control plane
          </span>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-semibold">{me.full_name || me.email}</div>
              <div className="font-mono text-xs uppercase text-ink-400">{me.role}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                signOut();
                router.replace("/login");
              }}
              className="border-2 border-ink-900 px-4 py-2 font-display text-xs font-bold uppercase tracking-wideCaps hover:bg-ink-900 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="min-w-0 flex-1 bg-ink-50 p-6">{children}</main>
      </div>
    </div>
  );
}
