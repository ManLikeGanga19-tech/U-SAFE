// U-SAFE brand logo (sourced from the company profile, served from /public/brand).
export function Logo({ className = "h-16 w-auto" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/usafe-logo.jpg"
      alt="U-SAFE KE — Ensuring you are safe"
      className={className}
    />
  );
}
