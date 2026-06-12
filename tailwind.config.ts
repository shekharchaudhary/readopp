import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        display: [
          "var(--font-fraunces)",
          "ui-serif",
          "Georgia",
          "'Times New Roman'",
          "serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      // Semantic tokens resolve through CSS variables (RGB channels) so the
      // whole palette flips under `.dark` without per-class dark: variants.
      colors: {
        ink: {
          DEFAULT: "rgb(var(--c-ink) / <alpha-value>)",
          soft: "rgb(var(--c-ink-soft) / <alpha-value>)",
          muted: "rgb(var(--c-ink-muted) / <alpha-value>)",
          faint: "rgb(var(--c-ink-faint) / <alpha-value>)",
        },
        paper: {
          DEFAULT: "rgb(var(--c-paper) / <alpha-value>)",
          soft: "rgb(var(--c-paper-soft) / <alpha-value>)",
          line: "rgb(var(--c-paper-line) / <alpha-value>)",
        },
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        dark: "rgb(var(--c-dark) / <alpha-value>)",
        accent: {
          DEFAULT: "rgb(var(--c-accent) / <alpha-value>)",
          soft: "rgb(var(--c-accent-soft) / <alpha-value>)",
          deep: "rgb(var(--c-accent-deep) / <alpha-value>)",
        },
      },
      keyframes: {
        scan: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        breathe: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.85", transform: "scale(1.04)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "dot-bounce": {
          "0%, 80%, 100%": {
            transform: "translateY(0)",
            opacity: "0.4",
          },
          "40%": {
            transform: "translateY(-3px)",
            opacity: "1",
          },
        },
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "draw-in": {
          "0%": { opacity: "0", transform: "translateY(6px) scale(0.985)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        drip: {
          "0%": { top: "-12px", opacity: "0" },
          "15%": { opacity: "1" },
          "100%": { top: "100%", opacity: "0.6" },
        },
      },
      animation: {
        scan: "scan 1.8s ease-in-out infinite",
        breathe: "breathe 2.4s ease-in-out infinite",
        blink: "blink 1s steps(2, start) infinite",
        "fade-up": "fade-up 240ms ease-out both",
        "dot-bounce": "dot-bounce 1.2s ease-in-out infinite",
        "rise-in": "rise-in 520ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "draw-in": "draw-in 700ms cubic-bezier(0.22, 1, 0.36, 1) both",
        drip: "drip 1.2s ease-in infinite",
      },
    },
  },
  plugins: [],
};

export default config;
