import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Industries — U-SAFE KE",
  description:
    "U-SAFE KE serves mining, manufacturing, petroleum, medical, construction and more — industries where quality and safety standards matter.",
};

// Industries drawn from the company profile (About + Our Customers).
const INDUSTRIES = [
  "Mining",
  "Manufacturing",
  "Agriculture",
  "Construction",
  "Petroleum",
  "Oil & Gas",
  "Petrochemical",
  "Chemical",
  "Pharmaceutical",
  "Medical",
  "Food Production",
  "Bottling",
  "Waste Management",
  "Explosives",
  "Hospitality",
  "Corporate & Security",
];

export default function IndustriesPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Our customers"
        title="Industries we serve"
        intro="Our customers are from a wide range of industries, where quality and standards are of importance."
      />

      {/* Narrative */}
      <section className="shell py-14 lg:py-20">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-14">
          <p className="text-lg text-ink-700 md:text-xl">
            The nature of our customers&apos; work requires comprehensive protection
            from various hazards and life-threatening scenarios. After several years
            of experience, we have harnessed our knowledge and combined it with our
            strong belief in maintaining close co-operative relationships with our
            clients — to provide solutions that properly fit each and every
            business&apos;s application.
          </p>
          <p className="text-lg text-ink-700 md:text-xl">
            If you want the assurance that you are getting the best product for the
            purpose, at a quality that can be trusted, then you want to deal with
            U-SAFE KE. We strive to understand your work environment, and to help you
            meet the correct standards with the PPE we supply.
          </p>
        </div>
      </section>

      {/* Industries grid */}
      <section className="border-t-2 border-ink-900 bg-ink-50">
        <div className="shell py-14 lg:py-20">
          <span className="eyebrow text-royal-600">Sectors we protect</span>
          <div className="mt-8 grid grid-cols-2 gap-px border-2 border-ink-900 bg-ink-900 sm:grid-cols-3 lg:grid-cols-4">
            {INDUSTRIES.map((name, i) => (
              <div
                key={name}
                className="flex min-h-[110px] flex-col justify-between gap-3 bg-white p-4 sm:p-5"
              >
                <span className="font-mono text-xs text-ink-400">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="hyphens-auto break-words font-display text-base font-bold uppercase leading-tight text-ink-900 sm:text-lg">
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-ink-900 text-white">
        <div className="shell grid grid-cols-1 items-center gap-6 py-14 md:grid-cols-2">
          <h2 className="text-3xl font-black uppercase md:text-4xl">
            Kitting out your workforce?
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row md:justify-end">
            <Link href="/quote" className="btn-signal w-full justify-center sm:w-auto">
              Request a quote →
            </Link>
            <Link href="/catalog" className="btn-ghost w-full justify-center border-white text-white hover:bg-white hover:text-ink-900 sm:w-auto">
              Browse equipment
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
