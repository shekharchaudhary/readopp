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
      colors: {
        ink: {
          DEFAULT: "#171717",
          soft: "#5F5A52",
          muted: "#857E72",
          faint: "#ABA395",
        },
        paper: {
          DEFAULT: "#F7F3EA",
          soft: "#EFE8DC",
          line: "#D8CEC0",
        },
        surface: "#FFFDF8",
        dark: "#101010",
        accent: {
          DEFAULT: "#E85D2A",
          soft: "#F9E5D9",
          deep: "#B23F14",
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
