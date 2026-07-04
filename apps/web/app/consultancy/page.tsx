import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Safety Consultancy — U-SAFE KE",
  description:
    "Beyond supply: U-SAFE KE helps you select the right PPE, monitor usage and maintain documented legislative compliance, with certified training.",
};

const SERVICES = [
  {
    title: "PPE selection & assessment",
    body: "We use a highly researched and tested proprietary tool to select the correct level of protection required — considering contaminants, concentrations, duration and potential exposure.",
  },
  {
    title: "Usage monitoring & compliance",
    body: "We monitor the individual usage of PPE per employee based on specific job requirements, and maintain documented proof of legislative compliance.",
  },
  {
    title: "Certified training",
    body: "Certified respiratory training on selected brands for your end users, plus fit-testing so individuals correctly select and fit their hearing protection.",
  },
  {
    title: "Tailor-made solutions",
    body: "We solve your PPE challenges with tailor-made, customer-specific solutions that properly fit each and every business's application.",
  },
  {
    title: "Customized branding",
    body: "Maintain your company image with customized branding on workwear — available in digital printing, transfer printing and embroidery.",
  },
  {
    title: "Standards assurance",
    body: "We strive to understand your work environment and help you meet the correct standards with the PPE we supply, to international EN and DIN specifications.",
  },
];

export default function ConsultancyPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Beyond supply"
        title="Safety consultancy"
        intro="We don't just distribute PPE — we help you choose the right protection, keep your people compliant, and train your teams to use it correctly."
      />

      <section className="shell py-14 lg:py-20">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <div key={s.title} className="flex flex-col border-2 border-ink-900 bg-white p-6">
              <div className="mb-4 h-2 w-12 bg-signal-500" />
              <h3 className="font-display text-xl font-black uppercase leading-tight text-ink-900">
                {s.title}
              </h3>
              <p className="mt-3 text-ink-600">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Compliance emphasis */}
      <section className="border-y-2 border-ink-900 bg-ink-50">
        <div className="shell grid grid-cols-1 items-center gap-8 py-14 lg:grid-cols-2 lg:py-16">
          <div>
            <span className="eyebrow text-royal-600">Documented compliance</span>
            <h2 className="mt-2 text-3xl font-black uppercase text-ink-900 md:text-4xl">
              Proof you can show the auditor.
            </h2>
          </div>
          <p className="text-lg text-ink-700">
            For industries where standards are non-negotiable, we maintain documented
            proof of legislative compliance per employee — so you always know the right
            protection is in the right hands, and can demonstrate it.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-ink-900 text-white">
        <div className="shell grid grid-cols-1 items-center gap-6 py-14 md:grid-cols-2">
          <h2 className="text-3xl font-black uppercase md:text-4xl">
            Let&apos;s assess your requirements.
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row md:justify-end">
            <Link href="/quote" className="btn-signal w-full justify-center sm:w-auto">
              Request a consultation →
            </Link>
            <Link href="/contact" className="btn-ghost w-full justify-center border-white text-white hover:bg-white hover:text-ink-900 sm:w-auto">
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
