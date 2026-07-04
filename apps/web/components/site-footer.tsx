import Link from "next/link";
import { Logo } from "./logo";
import { AnimatedHazard } from "./animated-hazard";

export function SiteFooter() {
  return (
    <footer className="border-t-2 border-ink-900 bg-ink-900 text-white">
      <AnimatedHazard className="h-3" />
      <div className="shell-fluid grid grid-cols-2 gap-10 py-14 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <div className="bg-white inline-block p-4">
            <Logo className="h-24 w-auto" />
          </div>
          <p className="mt-4 max-w-xs text-sm text-ink-300">
            Multi-brand distributor of certified PPE, safety equipment and safety
            consultancy. Founded 2020.
          </p>
        </div>

        <FooterCol
          title="Shop"
          links={[
            ["All equipment", "/catalog"],
            ["Head protection", "/catalog?category=head-protection"],
            ["Hand protection", "/catalog?category=hand-protection"],
            ["Footwear", "/catalog?category=footwear-protection"],
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            ["About U-SAFE", "/about"],
            ["Shop by brand", "/catalog"],
            ["Safety consultancy", "/consultancy"],
            ["Request a quote", "/quote"],
          ]}
        />
        <FooterCol
          title="Contact"
          links={[
            ["info@usafeke.com", "mailto:info@usafeke.com"],
            ["+254 748 846635", "tel:+254748846635"],
            ["Ashray Industrial Park", "/contact"],
            ["Nairobi, Kenya", "/contact"],
          ]}
        />
      </div>

      {/* Physical location — full-bleed map */}
      <div className="relative border-y-2 border-ink-700">
        <iframe
          title="U-SAFE KE — Ashray Industrial Park, Nairobi"
          src="https://maps.google.com/maps?q=Ashray%20Industrial%20Park%2C%20Nairobi%2C%20Kenya&z=15&output=embed"
          className="block h-[320px] w-full grayscale-[35%]"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <div className="pointer-events-none absolute left-4 right-4 top-4 border-2 border-signal-500 bg-ink-900/95 p-4 shadow-hard md:right-auto md:left-8 md:top-8 md:max-w-xs">
          <span className="eyebrow text-signal-500">Visit us</span>
          <p className="mt-1 font-display text-lg font-bold uppercase leading-tight text-white">
            Ashray Industrial Park
          </p>
          <p className="mt-1 text-sm text-ink-300">
            P.O. Box 59553-00200
            <br />
            Nairobi, Kenya
          </p>
          <a
            href="https://maps.google.com/?q=Ashray+Industrial+Park+Nairobi+Kenya"
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto mt-3 inline-block font-mono text-xs text-signal-500 hover:underline"
          >
            Get directions →
          </a>
        </div>
      </div>

      <div className="border-t border-ink-700">
        <div className="shell-fluid flex flex-col gap-2 py-5 text-xs text-ink-400 md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} U-SAFE KE. All rights reserved.</span>
          <span className="font-mono uppercase tracking-wideCaps">
            Safety doesn&apos;t happen by accident.
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: [string, string][];
}) {
  return (
    <div>
      <h4 className="eyebrow text-signal-500">{title}</h4>
      <ul className="mt-4 space-y-2.5">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="text-sm text-ink-200 hover:text-white">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
