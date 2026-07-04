/**
 * U-SAFE KE — shared Tailwind preset (design tokens).
 *
 * Design law:
 *  - ZERO border-radius. Every corner is 90°. Enforced here so it cannot
 *    creep in via `rounded-*` utilities — they all resolve to 0.
 *  - Industrial safety-signage system: hard grid, hi-vis accents, condensed
 *    display type. No soft SaaS look.
 *
 * Palette sampled from the U-SAFE logo + company profile.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    // ── HARD RULE: kill all radii ──────────────────────────────
    borderRadius: {
      none: "0px",
      DEFAULT: "0px",
      sm: "0px",
      md: "0px",
      lg: "0px",
      xl: "0px",
      "2xl": "0px",
      "3xl": "0px",
      full: "0px",
    },

    extend: {
      colors: {
        // Signal Green — the logo "U". Primary action / safety accent.
        signal: {
          50: "#EAFEE4",
          100: "#CFFCC0",
          200: "#9DF97F",
          300: "#63F23B",
          400: "#2CE800",
          500: "#00E000", // authentic logo green
          600: "#00B800",
          700: "#008C00",
          800: "#036200",
          900: "#053C00",
        },
        // Royal Blue — corporate / navigation / headings (profile headings).
        royal: {
          50: "#EAF0FB",
          100: "#CBD9F4",
          200: "#9CB6EA",
          300: "#6690DC",
          400: "#3866CB",
          500: "#123FB5",
          600: "#0E3396",
          700: "#0B2872",
          800: "#081D52",
          900: "#05132F",
        },
        // Sky / cyan — secondary support accent.
        sky: {
          50: "#E6F6FE",
          100: "#BEE8FC",
          200: "#7FD2F9",
          300: "#38B7F3",
          400: "#00A7F0",
          500: "#0089C7",
          600: "#006C9E",
          700: "#004E72",
          800: "#00344C",
          900: "#001B27",
        },
        // Hi-vis orange — alerts, sale, safety signage.
        hivis: {
          50: "#FEF3E2",
          100: "#FCE0B8",
          200: "#F9C377",
          300: "#F7AE45",
          400: "#F5A312",
          500: "#D9860A",
          600: "#AD6606",
          700: "#814B05",
          800: "#553103",
          900: "#2E1A01",
        },
        // Ink — cool near-black neutral scale (structure + text).
        ink: {
          50: "#F6F7F8",
          100: "#ECEEF0",
          200: "#D7DADE",
          300: "#B4B8BE",
          400: "#8B9096",
          500: "#666A70",
          600: "#45484D",
          700: "#2A2C2F",
          800: "#17181A",
          900: "#0B0B0C", // logo shield black
        },
      },

      fontFamily: {
        // Condensed grotesque for display; clean grotesque for body.
        // (Actual @font-face wired in app globals; these are the stacks.)
        display: ['"Archivo"', '"Arial Narrow"', "system-ui", "sans-serif"],
        sans: ['"Inter"', "system-ui", "Segoe UI", "Arial", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },

      letterSpacing: {
        tightest: "-0.04em",
        display: "-0.02em",
        wideCaps: "0.12em",
      },

      // Hard, directional shadows (no soft glow) + hi-vis focus ring.
      boxShadow: {
        hard: "6px 6px 0 0 #0B0B0C",
        "hard-sm": "3px 3px 0 0 #0B0B0C",
        "hard-signal": "6px 6px 0 0 #00E000",
        focus: "0 0 0 3px #00E000",
      },

      backgroundImage: {
        // Hazard-stripe motif (industrial texture).
        hazard:
          "repeating-linear-gradient(45deg, #0B0B0C 0 14px, #F5A312 14px 28px)",
        "hazard-signal":
          "repeating-linear-gradient(45deg, #0B0B0C 0 14px, #00E000 14px 28px)",
      },

      maxWidth: {
        shell: "1360px",
      },
    },
  },
  plugins: [],
};
