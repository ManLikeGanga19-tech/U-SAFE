export function PageHeader({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
}) {
  return (
    <section className="relative overflow-hidden border-b-2 border-ink-900 bg-ink-900 text-white">
      <div
        className="blueprint-grid-light pointer-events-none absolute inset-0 opacity-[0.06]"
        aria-hidden
      />
      <div className="shell relative py-14 sm:py-16 lg:py-20">
        <span className="eyebrow text-signal-500">{eyebrow}</span>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] sm:text-5xl md:text-6xl">
          {title}
        </h1>
        {intro && <p className="mt-5 max-w-3xl text-base text-ink-300 sm:text-lg">{intro}</p>}
      </div>
      <div className="h-2 w-full bg-hazard-signal" />
    </section>
  );
}
