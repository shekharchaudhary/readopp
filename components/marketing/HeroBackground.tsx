"use client";

import { useEffect, useRef } from "react";

/**
 * Two-layer animated background for the landing-page hero:
 *
 *   1. Editorial column grid — 6 vertical rule lines + 4 baselines, the
 *      bones of a magazine spread. Drifts with parallax on scroll so the
 *      grid feels deeper than the foreground.
 *   2. Reading artifacts — paragraph fragments, highlighter swipes,
 *      sticky note, squiggle, asterisk, check mark, margin marker. They
 *      drift on individual loops and visualise the brand promise
 *      (turning what you READ into a post).
 *
 * All layers are pointer-events-none and aria-hidden; nothing here is
 * interactive. prefers-reduced-motion halts every animation; static
 * decoration remains so the hero is never a blank rectangle.
 */

interface Drift {
  top: string;
  left?: string;
  right?: string;
  duration: string;
  delay: string;
  rotate: string;
  opacity: string;
  variant:
    | "paragraph"
    | "highlight"
    | "squiggle"
    | "stickie"
    | "asterisk"
    | "check"
    | "pullquote"
    | "marker";
  text?: string;
}

const DRIFTERS: Drift[] = [
  {
    top: "6%",
    left: "3%",
    duration: "22s",
    delay: "-2s",
    rotate: "-3deg",
    opacity: "0.28",
    variant: "paragraph",
    text:
      "The reader scrolls past 80% of what they meant to finish. Attention is the scarce input, not information.",
  },
  {
    top: "60%",
    left: "1%",
    duration: "24s",
    delay: "-4s",
    rotate: "-2deg",
    opacity: "0.32",
    variant: "pullquote",
    text: "“",
  },
  {
    top: "34%",
    right: "2%",
    duration: "18s",
    delay: "-12s",
    rotate: "-4deg",
    opacity: "0.34",
    variant: "stickie",
    text: "share this",
  },
  {
    top: "72%",
    right: "18%",
    duration: "20s",
    delay: "-6s",
    rotate: "1deg",
    opacity: "0.35",
    variant: "squiggle",
  },
  {
    top: "10%",
    left: "42%",
    duration: "16s",
    delay: "-3s",
    rotate: "-1deg",
    opacity: "0.26",
    variant: "asterisk",
  },
  {
    top: "82%",
    left: "28%",
    duration: "21s",
    delay: "-11s",
    rotate: "3deg",
    opacity: "0.32",
    variant: "check",
  },
  {
    top: "28%",
    left: "16%",
    duration: "23s",
    delay: "-15s",
    rotate: "1deg",
    opacity: "0.30",
    variant: "marker",
  },
  // Bonus deep-page paragraph for the lower-right corner.
  {
    top: "76%",
    right: "4%",
    duration: "26s",
    delay: "-8s",
    rotate: "2deg",
    opacity: "0.22",
    variant: "paragraph",
    text:
      "A 4,000-word piece becomes a 7-slide carousel — same idea, finished in 22 seconds.",
  },
];

export function HeroBackground() {
  const wrapRef = useRef<HTMLDivElement>(null);

  // Scroll-coupled parallax: write the scroll offset into a CSS variable
  // every animation frame. Grid + ripples consume it via calc(); other
  // artifacts ignore it. rAF-throttled so scroll handler is cheap.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      wrap.style.setProperty("--hero-scroll", `${window.scrollY}`);
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <EditorialGrid />
      {DRIFTERS.map((d, i) => (
        <span
          key={i}
          className="absolute motion-safe:animate-hero-drift"
          style={{
            top: d.top,
            left: d.left,
            right: d.right,
            ["--rot" as string]: d.rotate,
            animationDuration: d.duration,
            animationDelay: d.delay,
            opacity: d.opacity,
            transform: `rotate(${d.rotate})`,
          }}
        >
          {renderArtifact(d)}
        </span>
      ))}
    </div>
  );
}

/**
 * Editorial column grid. Six column rules + four baselines stretching
 * across the section. Drawn as inline SVG so colors thread through the
 * Tailwind palette. Parallax via translateY tied to --hero-scroll.
 */
function EditorialGrid() {
  return (
    <div
      className="absolute inset-0 hero-grid-parallax"
    >
      <svg
        viewBox="0 0 1200 720"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        {/* Six column rules */}
        {[200, 400, 600, 800, 1000].map((x) => (
          <line
            key={x}
            x1={x}
            x2={x}
            y1={0}
            y2={720}
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="2 6"
            className="text-ink/15 dark:text-ink/25"
          />
        ))}
        {/* Edge column rules */}
        <line x1={60} x2={60} y1={0} y2={720} stroke="currentColor" strokeWidth="1" className="text-ink/12 dark:text-ink/20" />
        <line x1={1140} x2={1140} y1={0} y2={720} stroke="currentColor" strokeWidth="1" className="text-ink/12 dark:text-ink/20" />
        {/* Horizontal baselines */}
        {[140, 320, 500, 660].map((y) => (
          <line
            key={y}
            x1={40}
            x2={1160}
            y1={y}
            y2={y}
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="3 8"
            className="text-ink/10 dark:text-ink/18"
          />
        ))}
      </svg>
    </div>
  );
}

function renderArtifact(d: Drift) {
  switch (d.variant) {
    case "paragraph":
      return (
        <span
          className="block w-[260px] font-serif text-[13px] leading-snug text-ink"
          style={{ filter: "blur(0.2px)" }}
        >
          {d.text}
        </span>
      );
    case "highlight":
      return (
        <span
          className="block h-7 w-[220px] rounded-[2px] bg-accent"
          style={{ boxShadow: "0 0 24px 6px rgba(199,97,61,0.35)" }}
        />
      );
    case "pullquote":
      return (
        <span className="block font-serif text-[140px] leading-none text-accent">
          {d.text}
        </span>
      );
    case "stickie":
      return (
        <span
          className="block rounded-[3px] bg-paper-soft px-3 py-2 text-[14px] text-ink-soft shadow-sm"
          style={{
            fontFamily: "'Caveat', 'Reenie Beanie', cursive",
          }}
        >
          {d.text}
        </span>
      );
    case "squiggle":
      return (
        <svg width="200" height="24" viewBox="0 0 200 24" fill="none">
          <path
            d="M2 13 C 18 3, 28 23, 44 13 S 78 3, 92 13 S 126 23, 140 13 S 168 3, 198 11"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent"
            fill="none"
          />
        </svg>
      );
    case "asterisk":
      return (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <line x1="16" y1="2" x2="16" y2="30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-accent" />
          <line x1="3" y1="11" x2="29" y2="21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-accent" />
          <line x1="3" y1="21" x2="29" y2="11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-accent" />
        </svg>
      );
    case "check":
      return (
        <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
          <path
            d="M4 18 L 13 27 L 30 6"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-emerald-700 dark:text-emerald-400"
            fill="none"
          />
        </svg>
      );
    case "marker":
      return (
        <svg width="52" height="14" viewBox="0 0 52 14" fill="none">
          <rect x="0" y="5" width="12" height="3" rx="1.5" className="fill-accent" />
          <rect x="16" y="5" width="16" height="3" rx="1.5" className="fill-accent" />
          <rect x="36" y="5" width="16" height="3" rx="1.5" className="fill-accent" />
        </svg>
      );
  }
}
