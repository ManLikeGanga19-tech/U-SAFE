"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const SLIDES = [
  { src: "/hero/helmet.png", label: "Head Protection", href: "/catalog?category=head-protection" },
  { src: "/hero/eyewear.png", label: "Eyewear Protection", href: "/catalog?category=eyewear-protection" },
  { src: "/hero/respirator.png", label: "Respiratory", href: "/catalog?category=respiratory-protection" },
  { src: "/hero/workwear.png", label: "General Workwear", href: "/catalog?category=general-workwear" },
  { src: "/hero/welding.png", label: "Welding Protection", href: "/catalog?category=welding-protection" },
  { src: "/hero/ppe-kit.png", label: "Complete PPE Kits", href: "/catalog" },
];

const EASE = [0.22, 1, 0.36, 1] as const;

export function HeroSlider() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => setI((p) => (p + 1) % SLIDES.length), []);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(next, 3800);
    return () => clearInterval(t);
  }, [next, paused]);

  const slide = SLIDES[i];

  return (
    <div
      className="relative h-full min-h-[420px] overflow-hidden border-2 border-ink-900 bg-ink-900"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Hazard accent + faint framing */}
      <div className="absolute inset-x-0 top-0 z-20 h-2 bg-hazard-signal" />
      <div className="absolute right-5 top-7 z-20 font-mono text-xs text-ink-500">
        {String(i + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
      </div>
      {/* Faint blueprint grid inside the panel */}
      <div className="blueprint-grid-light pointer-events-none absolute inset-0 opacity-[0.06]" />
      {/* Big faint index number */}
      <span className="pointer-events-none absolute -left-2 bottom-0 z-0 select-none font-display text-[11rem] font-black leading-none text-white/[0.03]">
        {String(i + 1).padStart(2, "0")}
      </span>

      {/* Image */}
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.9, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.05, y: -24 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="absolute inset-0 z-10 flex items-center justify-center p-12"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slide.src}
            alt={slide.label}
            className="hero-product-shadow max-h-[68%] max-w-[82%] object-contain"
          />
        </motion.div>
      </AnimatePresence>

      {/* Label + dots */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <span className="eyebrow text-signal-500">Now in stock</span>
            <Link
              href={slide.href}
              className="mt-1 block font-display text-2xl font-black uppercase leading-none text-white transition-colors hover:text-signal-500"
            >
              {slide.label} →
            </Link>
          </motion.div>
        </AnimatePresence>

        <div className="flex gap-1.5">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Go to slide ${idx + 1}`}
              onClick={() => setI(idx)}
              className={`h-2.5 w-2.5 border-2 transition-colors ${
                idx === i ? "border-signal-500 bg-signal-500" : "border-white/50 bg-transparent hover:border-white"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
