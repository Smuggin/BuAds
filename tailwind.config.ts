import type { Config } from "tailwindcss";

/**
 * Design tokens — DESIGN.md §2. Single source of truth for color/typography/shape.
 * Do not hardcode hex in components; reference these tokens.
 * Accent is re-themeable at runtime via the `--accent` CSS var (see globals.css).
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#16181d", 2: "#3a3f47" },
        slate: "#5b6068",
        muted: { DEFAULT: "#838992", 2: "#9aa0a8" },
        faint: { DEFAULT: "#aeb3bb", 2: "#b3b8c0" },
        // accent is driven by the --accent CSS var so it can be re-themed
        accent: "rgb(var(--accent-rgb) / <alpha-value>)",
        success: "#1f8a5b",
        warn: "#c98a16",
        danger: "#d6453d",
        violet: "#6E56CF",
        "page-bg": "#f5f6f8",
        card: "#ffffff",
        border: { DEFAULT: "#e9ebef", 2: "#eef0f3", 3: "#f1f2f5" },
        "field-bg": "#fafbfc",
        // dark sidebar chrome (prototype-specific shades, not in the public palette)
        nav: {
          bg: "#16181d",
          line: "#25282f",
          active: "#262a33",
          text: "#aeb3bd",
          dim: "#71767f",
          muted: "#7d828c",
          dot: "#4a4f59",
          "en-active": "#8fa6e8",
        },
      },
      fontFamily: {
        // Plex Sans Thai for all UI text; Plex Mono for every number.
        sans: ["var(--font-plex-thai)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        // DESIGN.md §2 typographic scale (px)
        "page-title": ["17px", { fontWeight: "600", letterSpacing: "-0.01em" }],
        "section-title": ["14.5px", { fontWeight: "600" }],
        "card-metric": ["22px", { fontWeight: "600", letterSpacing: "-0.03em" }],
        body: "13px",
        "body-sm": "12.5px",
        label: "11px",
        caption: "10.5px",
        "table-head": ["10.5px", { letterSpacing: "0.04em" }],
      },
      borderRadius: {
        card: "12px",
        control: "9px",
        input: "8px",
        pill: "20px",
        thumb: "11px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,18,29,.04)",
        modal: "0 24px 60px rgba(16,18,29,.35)",
        dropdown: "0 18px 50px rgba(16,18,29,.22)",
      },
      transitionDuration: {
        // subtle motion only (DESIGN §6)
        bg: "120ms",
        opacity: "150ms",
      },
    },
  },
  plugins: [],
};

export default config;
