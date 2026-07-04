"use client";

import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useTransform,
} from "framer-motion";

// Moving green/black caution-tape stripe.
// We scroll the real 45° hazard gradient (bg-hazard-signal: 28px period) by its
// exact horizontal repeat distance and wrap there, so the loop is perfectly
// seamless with zero DOM. Height matches the original static stripe.
const PERIOD_X = 28 / Math.cos(Math.PI / 4); // ≈ 39.598px

export function AnimatedHazard({
  className = "h-3",
  speed = 44, // px per second
  bgClass = "bg-hazard-signal", // "bg-hazard" (orange/black) or "bg-hazard-signal" (green/black)
  reverse = false,
}: {
  className?: string;
  speed?: number;
  bgClass?: string;
  reverse?: boolean;
}) {
  const x = useMotionValue(0);
  const bgPos = useTransform(x, (v) => `${v}px 0px`);

  useAnimationFrame((_, delta) => {
    const dir = reverse ? -1 : 1;
    let next = (x.get() + (dir * speed * delta) / 1000) % PERIOD_X;
    if (next < 0) next += PERIOD_X;
    x.set(next);
  });

  return (
    <motion.div
      aria-hidden="true"
      className={`w-full ${bgClass} ${className}`}
      style={{ backgroundPosition: bgPos }}
    />
  );
}
