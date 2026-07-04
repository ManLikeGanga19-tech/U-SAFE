import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "About — U-SAFE KE",
  description:
    "U-SAFE KE is a multi-brand distributor of PPE, safety equipment and safety consultancy, founded in 2020 in Nairobi, Kenya.",
};

const ACTIVITIES = [
  "Sourcing and distributing personal protective equipment to customers and their employees across the African continent.",
  "Monitoring the individual usage of PPE per employee based on specific job requirements, and maintaining documented proof of legislative compliance.",
  "Solving customers' PPE challenges by offering tailor-made and customer-specific solutions.",
];

const INDUSTRIES = [
  "Mining",
  "Manufacturing",
  "Agriculture",
  "Construction",
  "Petroleum",
  "Hospitality",
  "Medical",
  "Corporate",
  "Security",
];

export default function AboutPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Est. 2020 · Nairobi, Kenya"
        title="About U-SAFE KE"
        intro="A multi-brand distributor of personal protective equipment, safety equipment and safety consultancy — ensuring you are safe."
      />

      {/* About the company */}
      <section className="shell py-14 lg:py-20">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px] lg:gap-14">
          <div>
            <span className="eyebrow text-royal-600">Who we are</span>
            <p className="mt-4 text-lg text-ink-700 md:text-xl">
              U-SAFE KE is a company that deals with multi-brand distribution of
              personal protective equipment (PPE), safety equipment and safety
              consultancy, founded in 2020. We are leaders in the distribution of
              quality safety products that protect the people we serve, and we have
              evolved into an organization that serves many industries — including
              mining, manufacturing, agriculture, construction, petroleum,
              hospitality, medical, corporate and security.
            </p>
          </div>
          <div className="border-2 border-ink-900 bg-ink-50 p-6">
            <span className="eyebrow text-ink-500">Industries served</span>
            <ul className="mt-3 space-y-1.5">
              {INDUSTRIES.map((i) => (
                <li key={i} className="font-display text-sm font-bold uppercase tracking-wideCaps text-ink-900">
                  {i}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Vision + Mission */}
      <section className="border-y-2 border-ink-900 bg-ink-50">
        <div className="shell grid grid-cols-1 md:grid-cols-2">
          <div className="border-ink-900 py-12 md:border-r-2 md:pr-12">
            <span className="eyebrow text-royal-600">Vision</span>
            <p className="mt-4 font-display text-2xl font-black uppercase leading-tight text-ink-900 md:text-3xl">
              To be the leading PPE distributors in the world and provide the best
              quality safety equipment.
            </p>
          </div>
          <div className="py-12 md:pl-12">
            <span className="eyebrow text-royal-600">Mission</span>
            <p className="mt-4 font-display text-2xl font-black uppercase leading-tight text-ink-900 md:text-3xl">
              “Ensuring you are safe.”
            </p>
            <p className="mt-4 text-ink-600">
              Maintain a safe and healthy workplace for all employees in compliance
              with all applicable laws and regulations.
            </p>
          </div>
        </div>
      </section>

      {/* Primary activities */}
      <section className="shell py-14 lg:py-20">
        <span className="eyebrow text-royal-600">What we do</span>
        <h2 className="mt-1 text-3xl font-black uppercase text-ink-900 md:text-4xl">
          Our primary activities.
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {ACTIVITIES.map((a, i) => (
            <div key={i} className="border-2 border-ink-900 bg-white p-6">
              <span className="font-display text-5xl font-black text-signal-500">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="mt-3 text-ink-700">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Safety statement */}
      <section className="bg-ink-900 text-white">
        <div className="shell py-14 lg:py-16">
          <span className="eyebrow text-signal-500">Safety statement</span>
          <p className="mt-4 font-display text-3xl font-black uppercase leading-tight md:text-5xl">
            “Safety doesn&apos;t happen by accident.”
          </p>
          <p className="mt-3 font-display text-xl font-bold uppercase tracking-wideCaps text-ink-400">
            When safety is first, you last.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/catalog" className="btn-signal w-full justify-center sm:w-auto">
              Shop equipment →
            </Link>
            <Link href="/quote" className="btn-ghost w-full justify-center border-white text-white hover:bg-white hover:text-ink-900 sm:w-auto">
              Request a quote
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
