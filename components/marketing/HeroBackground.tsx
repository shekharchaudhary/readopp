"use client";

/**
 * Animated background for the landing-page hero: drifting reading
 * artifacts — pull quote, sticky note, squiggle, asterisk, check mark,
 * margin marker, geometric glyphs. They drift on individual loops and
 * visualise the brand promise (turning what you READ into a post).
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
    | "squiggle"
    | "stickie"
    | "asterisk"
    | "check"
    | "pullquote"
    | "marker"
    | "triangle"
    | "diamond"
    | "concentric"
    | "dotgrid"
    | "hexagon";
  text?: string;
}

const DRIFTERS: Drift[] = [
  {
    top: "8%",
    left: "4%",
    duration: "22s",
    delay: "-2s",
    rotate: "-6deg",
    opacity: "0.32",
    variant: "concentric",
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
  {
    top: "76%",
    right: "4%",
    duration: "26s",
    delay: "-8s",
    rotate: "12deg",
    opacity: "0.30",
    variant: "diamond",
  },
  {
    top: "20%",
    left: "26%",
    duration: "19s",
    delay: "-7s",
    rotate: "0deg",
    opacity: "0.28",
    variant: "triangle",
  },
  {
    top: "50%",
    right: "32%",
    duration: "17s",
    delay: "-10s",
    rotate: "0deg",
    opacity: "0.28",
    variant: "dotgrid",
  },
  {
    top: "44%",
    left: "8%",
    duration: "25s",
    delay: "-13s",
    rotate: "8deg",
    opacity: "0.24",
    variant: "hexagon",
  },
];

export function HeroBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
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

function renderArtifact(d: Drift) {
  switch (d.variant) {
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
    case "concentric":
      return (
        <svg width="96" height="96" viewBox="0 0 96 96" fill="none">
          <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="1.5" className="text-accent" />
          <circle cx="48" cy="48" r="30" stroke="currentColor" strokeWidth="1.5" className="text-accent" />
          <circle cx="48" cy="48" r="16" stroke="currentColor" strokeWidth="1.5" className="text-accent" />
          <circle cx="48" cy="48" r="3" fill="currentColor" className="text-accent" />
        </svg>
      );
    case "diamond":
      return (
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
          <path
            d="M 36 4 L 68 36 L 36 68 L 4 36 Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            className="text-accent"
            fill="none"
          />
          <path
            d="M 36 20 L 52 36 L 36 52 L 20 36 Z"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinejoin="round"
            className="text-accent"
            fill="none"
          />
        </svg>
      );
    case "triangle":
      return (
        <svg width="64" height="60" viewBox="0 0 64 60" fill="none">
          <path
            d="M 32 4 L 60 56 L 4 56 Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            className="text-ink dark:text-paper"
            fill="none"
          />
        </svg>
      );
    case "dotgrid":
      return (
        <svg width="58" height="58" viewBox="0 0 58 58" fill="none">
          {[6, 29, 52].flatMap((cy) =>
            [6, 29, 52].map((cx) => (
              <circle
                key={`${cx}-${cy}`}
                cx={cx}
                cy={cy}
                r="3.2"
                className="fill-accent"
              />
            ))
          )}
        </svg>
      );
    case "hexagon":
      return (
        <svg width="72" height="64" viewBox="0 0 72 64" fill="none">
          <path
            d="M 18 4 L 54 4 L 68 32 L 54 60 L 18 60 L 4 32 Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            className="text-ink dark:text-paper"
            fill="none"
          />
        </svg>
      );
  }
}
