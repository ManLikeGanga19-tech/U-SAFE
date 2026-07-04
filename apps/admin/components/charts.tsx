"use client";

import { motion } from "framer-motion";
import { useId, useRef, useState } from "react";

// Hard-edged, dependency-free charts tuned to the U-SAFE palette.
const SIGNAL = "#00E000";
const ROYAL = "#123FB5";
const INK = "#0B0B0C";

export type Point = { label: string; value: number; sub?: string };

// ── Area / line chart (revenue over time) ──────────────────
export function AreaChart({
  points,
  height = 200,
  accent = SIGNAL,
  format = (n: number) => String(n),
}: {
  points: Point[];
  height?: number;
  accent?: string;
  format?: (n: number) => string;
}) {
  const gid = useId().replace(/:/g, "");
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const W = 640;
  const H = 220;
  const padX = 8;
  const padTop = 18;
  const padBottom = 26;
  const max = Math.max(1, ...points.map((p) => p.value));
  const n = points.length;
  const stepX = (W - padX * 2) / Math.max(1, n - 1);
  const x = (i: number) => padX + i * stepX;
  const y = (v: number) => padTop + (1 - v / max) * (H - padTop - padBottom);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ");
  const area = `${line} L${x(n - 1)},${H - padBottom} L${x(0)},${H - padBottom} Z`;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const rel = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round((rel - padX) / stepX);
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* horizontal gridlines */}
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={padX}
            x2={W - padX}
            y1={padTop + t * (H - padTop - padBottom)}
            y2={padTop + t * (H - padTop - padBottom)}
            stroke={INK}
            strokeOpacity="0.08"
            strokeWidth="1"
          />
        ))}

        {/* area + animated line */}
        <motion.path
          d={area}
          fill={`url(#fill-${gid})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        />
        <motion.path
          d={line}
          fill="none"
          stroke={accent}
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* hover guide + marker */}
        {hover !== null && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={padTop}
              y2={H - padBottom}
              stroke={INK}
              strokeOpacity="0.35"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <rect
              x={x(hover) - 4}
              y={y(points[hover].value) - 4}
              width="8"
              height="8"
              fill={INK}
              stroke={accent}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}
      </svg>

      {/* axis labels */}
      <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-400">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>

      {/* floating tooltip (clamped so it never overflows the card edge) */}
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 border-2 border-ink-900 bg-white px-2 py-1 text-center shadow-hard"
          style={{ left: `${Math.min(88, Math.max(12, (hover / Math.max(1, n - 1)) * 100))}%` }}
        >
          <div className="font-mono text-[10px] uppercase text-ink-400">{points[hover].label}</div>
          <div className="font-display text-sm font-black text-ink-900">
            {format(points[hover].value)}
          </div>
          {points[hover].sub && (
            <div className="font-mono text-[10px] text-ink-500">{points[hover].sub}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Vertical bar chart (orders by status) ──────────────────
export function BarChart({
  bars,
  height = 200,
}: {
  bars: { label: string; value: number; color?: string }[];
  height?: number;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="flex items-end gap-3" style={{ height }}>
      {bars.map((b, i) => (
        <div key={b.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
          <span className="font-mono text-xs font-bold text-ink-700">{b.value}</span>
          <div className="flex w-full items-end justify-center" style={{ height: height - 46 }}>
            <motion.div
              className="w-full border-2 border-ink-900"
              style={{ background: b.color ?? ROYAL }}
              initial={{ height: 0 }}
              animate={{ height: `${(b.value / max) * 100}%` }}
              transition={{ duration: 0.6, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <span className="w-full truncate text-center font-display text-[10px] font-bold uppercase tracking-wideCaps text-ink-500">
            {b.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Sparkline (tiny inline trend) ──────────────────────────
export function Sparkline({
  values,
  color = SIGNAL,
  className = "",
}: {
  values: number[];
  color?: string;
  className?: string;
}) {
  const W = 120;
  const H = 32;
  const max = Math.max(1, ...values);
  const n = values.length;
  const pts = values
    .map((v, i) => `${(i / Math.max(1, n - 1)) * W},${H - (v / max) * (H - 4) - 2}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
