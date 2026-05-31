import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica",
          "Arial",
          "sans-serif",
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
      colors: {
        ink: {
          DEFAULT: "#1a1a1a",
          soft: "#3a3a3a",
          muted: "#6b6b6b",
          faint: "#a3a3a3",
        },
        paper: {
          DEFAULT: "#fafaf7",
          soft: "#f1efe8",
          line: "#e3e1d8",
        },
        accent: {
          DEFAULT: "#0F6E56",
          soft: "#E1F5EE",
          deep: "#085041",
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
      },
      animation: {
        scan: "scan 1.8s ease-in-out infinite",
        breathe: "breathe 2.4s ease-in-out infinite",
        blink: "blink 1s steps(2, start) infinite",
        "fade-up": "fade-up 240ms ease-out both",
        "dot-bounce": "dot-bounce 1.2s ease-in-out infinite",
        "rise-in": "rise-in 520ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "draw-in": "draw-in 700ms cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
