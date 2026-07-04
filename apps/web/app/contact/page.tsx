import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Contact — U-SAFE KE",
  description:
    "Get in touch with U-SAFE KE — Ashray Industrial Park, Nairobi. Call +254 748 846635 or email info@usafeke.com.",
};

type IconKey = "facebook" | "instagram" | "x" | "linkedin" | "youtube";

const SOCIALS: { name: string; href: string; icon: IconKey }[] = [
  { name: "Facebook", href: "https://facebook.com/usafeke", icon: "facebook" },
  { name: "Instagram", href: "https://instagram.com/usafeke", icon: "instagram" },
  { name: "X", href: "https://x.com/usafeke", icon: "x" },
  { name: "LinkedIn", href: "https://www.linkedin.com/company/usafeke", icon: "linkedin" },
  { name: "YouTube", href: "https://www.youtube.com/@usafeke", icon: "youtube" },
];

function SocialIcon({ icon }: { icon: IconKey }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true } as const;
  switch (icon) {
    case "facebook":
      return (
        <svg {...common}>
          <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
        </svg>
      );
    case "instagram":
      return (
        <svg {...common}>
          <path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.35-2.62-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 100 12.32A6.16 6.16 0 0012 5.84zm0 10.16a4 4 0 110-8 4 4 0 010 8zm6.41-11.85a1.44 1.44 0 100 2.88 1.44 1.44 0 000-2.88z" />
        </svg>
      );
    case "x":
      return (
        <svg {...common}>
          <path d="M18.24 2.25h3.31l-7.23 8.26L22.85 21.75h-6.66l-5.21-6.82-5.97 6.82H1.7l7.73-8.84L1.15 2.25h6.83l4.71 6.23 5.55-6.23zm-1.16 17.52h1.83L7.01 4.12H5.05l12.03 15.65z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg {...common}>
          <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 110-4.13 2.06 2.06 0 010 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...common}>
          <path d="M23.5 6.19a3.02 3.02 0 00-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 00.5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 002.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 002.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z" />
        </svg>
      );
  }
}

export default function ContactPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Let's connect"
        title="Contact us"
        intro="Talk to us about equipment, bulk orders or a safety consultation — we're here to help you stay safe."
      />

      <section className="shell py-14 lg:py-20">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <ContactCard label="Call us" lines={[["+254 748 846635", "tel:+254748846635"]]} />
          <ContactCard
            label="Email us"
            lines={[
              ["info@usafeke.com", "mailto:info@usafeke.com"],
              ["usafekenya@gmail.com", "mailto:usafekenya@gmail.com"],
            ]}
          />
          <ContactCard
            label="Visit us"
            lines={[
              ["Ashray Industrial Park", null],
              ["P.O Box 59553-00200", null],
              ["Nairobi, Kenya", null],
            ]}
          />
        </div>

        {/* Socials */}
        <div className="mt-6 border-2 border-ink-900 bg-ink-50 p-6">
          <span className="eyebrow text-royal-600">Connect on social — @usafeke</span>
          <div className="mt-4 flex flex-wrap gap-3">
            {SOCIALS.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.name}
                title={s.name}
                className="flex h-12 w-12 items-center justify-center border-2 border-ink-900 bg-white text-ink-900 transition-colors hover:bg-signal-500"
              >
                <SocialIcon icon={s.icon} />
              </a>
            ))}
          </div>
        </div>

        {/* CTA row */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/quote" className="btn-signal w-full justify-center sm:w-auto">
            Request a quote →
          </Link>
          <Link href="/catalog" className="btn-ghost w-full justify-center sm:w-auto">
            Browse the catalog
          </Link>
        </div>
      </section>
    </div>
  );
}

function ContactCard({
  label,
  lines,
}: {
  label: string;
  lines: [string, string | null][];
}) {
  return (
    <div className="border-2 border-ink-900 bg-white p-6">
      <span className="eyebrow text-signal-600">{label}</span>
      <div className="mt-3 space-y-1">
        {lines.map(([text, href]) =>
          href ? (
            <a
              key={text}
              href={href}
              className="block font-display text-lg font-bold text-ink-900 hover:text-royal-600"
            >
              {text}
            </a>
          ) : (
            <p key={text} className="font-display text-lg font-bold text-ink-900">
              {text}
            </p>
          ),
        )}
      </div>
    </div>
  );
}
