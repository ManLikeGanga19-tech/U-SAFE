import Link from "next/link";
import { Logo } from "./logo";
import { CartLink } from "./cart-link";
import { MobileNav } from "./mobile-nav";

const NAV = [
  { label: "Catalog", href: "/catalog" },
  { label: "Industries", href: "/industries" },
  { label: "Consultancy", href: "/consultancy" },
  { label: "Contact", href: "/contact" },
];

export function SiteHeader() {
  return (
    <header className="border-b-2 border-ink-900 bg-white">
      {/* Utility strip */}
      <div className="bg-ink-900 text-white">
        <div className="shell-fluid flex h-9 items-center justify-between text-[11px] font-medium tracking-wide">
          <span className="uppercase tracking-wideCaps text-signal-500">
            Ensuring you are safe
          </span>
          <span className="hidden sm:block text-ink-200">
            Nairobi, Kenya · +254 748 846635 · info@usafeke.com
          </span>
        </div>
      </div>

      {/* Main bar */}
      <div className="shell-fluid flex h-20 items-center justify-between gap-3 md:h-24 md:gap-6">
        <Link href="/" aria-label="U-SAFE Kenya home" className="shrink-0">
          <Logo className="h-12 w-auto md:h-16" />
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-display text-sm font-bold uppercase tracking-wideCaps text-ink-700 hover:text-royal-600"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <Link href="/quote" className="btn-ghost hidden md:inline-flex">
            Request a quote
          </Link>
          <CartLink />
          <MobileNav items={NAV} />
        </div>
      </div>
    </header>
  );
}
