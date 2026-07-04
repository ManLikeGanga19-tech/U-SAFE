"use client";

import { useState } from "react";

// Collapsible on mobile (toggle button), always shown from lg up.
export function FilterPanel({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between border-2 border-ink-900 bg-white px-4 py-3 font-display text-sm font-bold uppercase tracking-wideCaps lg:hidden"
      >
        Filters
        <span className="font-mono text-lg leading-none">{open ? "−" : "+"}</span>
      </button>
      <div className={`${open ? "mt-4 block" : "hidden"} lg:mt-0 lg:block`}>{children}</div>
    </div>
  );
}
