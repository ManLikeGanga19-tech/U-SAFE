# U-SAFE KE — Design System

> Industrial safety-signage aesthetic. Sampled from the logo + company profile.
> **This is a design law document. It is not optional styling.**

## The three non-negotiable rules

1. **Zero border-radius.** Every corner is 90°. Enforced in `tailwind-preset.js`
   (all `rounded-*` utilities resolve to `0px`). Do not override.
2. **No generic AI/SaaS UI.** No soft drop-shadows-as-glow, no pastel gradient
   hero blobs, no floating rounded cards. We use hard edges, a strict modular
   grid, heavy rules/borders, and hi-vis accents used like real safety signage.
3. **The commercial storefront stays clean.** Restraint. Whitespace. One or two
   accents per view — not a rainbow. Hi-vis is a *signal*, used sparingly.

## Palette (exact, sampled)

| Token | Hex | Role |
|---|---|---|
| `signal-500` | `#00E000` | The logo "U". Primary action / CTA / safety highlight. |
| `royal-500` | `#123FB5` | Corporate, navigation, headings, links. |
| `sky-400` | `#00A7F0` | Secondary support accent. |
| `hivis-400` | `#F5A312` | Alerts, sale badges, hazard motif. |
| `ink-900` | `#0B0B0C` | Logo shield black. Structure + text. |
| `ink-50…300` | greys | Canvas, surfaces, borders, muted text. |
| `white` | `#FFFFFF` | Primary canvas. |

Each color ships as a full 50–900 scale (see `tailwind-preset.js`).

## Usage discipline

- **CTAs**: `signal-500` fill with **black** text (hi-vis convention — like a
  safety vest). Hover → `signal-600`. Never black text on royal, never white
  text on signal.
- **Headings**: `ink-900` or `royal-600`, condensed display face, tight tracking.
- **Structure**: hard `2px` `ink-900` borders instead of soft cards. Use
  `shadow-hard` (offset, not blurred) for lifted elements.
- **Hazard stripe** (`bg-hazard` / `bg-hazard-signal`): reserved for section
  dividers, sale ribbons, "out of stock" — industrial texture, use rarely.
- **Focus**: always the `shadow-focus` signal-green ring. Accessibility first.

## Type

- **Display**: Archivo / Arial Narrow — condensed, uppercase for section labels
  with `tracking-wideCaps`.
- **Body**: Inter.
- **Mono**: JetBrains Mono — SKUs, spec codes, order numbers (feels like a
  parts catalog).

## Motifs

- **Hazard stripes** — 45° black/orange (or black/green) for dividers & badges.
- **Corner brackets / rules** — thin registration marks framing hero blocks,
  evoking EN/ISO product datasheets.
- **Spec-sheet tables** — mono, ruled rows, standards codes (EN 388, EN 166…)
  surfaced on product pages. This is a genuine differentiator vs. generic stores.
