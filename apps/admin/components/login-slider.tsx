"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { AnimatedHazard } from "@/components/animated-hazard";

// Same product imagery as the storefront hero, running as an ambient slider
// behind the admin sign-in panel.
const SLIDES = [
  { src: "/hero/helmet.png", label: "Head Protection" },
  { src: "/hero/eyewear.png", label: "Eyewear Protection" },
  { src: "/hero/respirator.png", label: "Respiratory" },
  { src: "/hero/workwear.png", label: "General Workwear" },
  { src: "/hero/welding.png", label: "Welding Protection" },
  { src: "/hero/ppe-kit.png", label: "Complete PPE Kits" },
];

const EASE = [0.22, 1, 0.36, 1] as const;

export function LoginSlider() {
  const [i, setI] = useState(0);
  const next = useCallback(() => setI((p) => (p + 1) % SLIDES.length), []);

  useEffect(() => {
    const t = setInterval(next, 3800);
    return () => clearInterval(t);
  }, [next]);

  const slide = SLIDES[i];

  return (
    <div className="relative flex h-full min-h-[420px] flex-col overflow-hidden bg-ink-900 text-white">
      {/* Animated hazard stripe at the top */}
      <AnimatedHazard className="h-3 shrink-0" bgClass="bg-hazard-signal" />

      {/* Brand + tagline */}
      <div className="z-20 flex items-start justify-between p-10">
        <div className="font-display text-2xl font-black tracking-tightest">
          U-SAFE<span className="text-signal-500">.</span> ADMIN
        </div>
        <div className="font-mono text-xs text-ink-500">
          {String(i + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
        </div>
      </div>

      {/* Faint blueprint grid + big index number */}
      <div className="blueprint-grid-light pointer-events-none absolute inset-0 opacity-[0.06]" />
      <span className="pointer-events-none absolute -left-2 bottom-16 z-0 select-none font-display text-[13rem] font-black leading-none text-white/[0.03]">
        {String(i + 1).padStart(2, "0")}
      </span>

      {/* Slider image */}
      <div className="relative flex-1">
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
              className="max-h-[62%] max-w-[78%] object-contain drop-shadow-[0_24px_48px_rgba(0,0,0,0.6)]"
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Headline + label + dots */}
      <div className="z-20 p-10">
        <h1 className="text-5xl font-black uppercase leading-none">
          Control
          <br />
          <span className="text-signal-500">plane.</span>
        </h1>
        <p className="mt-3 max-w-sm text-sm text-ink-300">
          Regulate stock, catalog and everything the storefront shows.
        </p>

        <div className="mt-6 flex items-end justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <span className="font-display text-xs font-bold uppercase tracking-wideCaps text-signal-500">
                In stock
              </span>
              <span className="mt-1 block font-display text-xl font-black uppercase leading-none">
                {slide.label}
              </span>
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
                  idx === i
                    ? "border-signal-500 bg-signal-500"
                    : "border-white/50 bg-transparent hover:border-white"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
