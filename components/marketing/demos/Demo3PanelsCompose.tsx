"use client";

import { DemoFrame, between, useDemoTick } from "./demoPrim";

const CYCLE_MS = 8500;

// Each panel goes through three phases:
//   missing  → off-screen, nothing rendered
//   skeleton → wireframe placeholder is visible
//   content  → real SVG visual is faded in
//
// Per-panel cadence:
//   appears (skeleton) at:  500, 2200, 3900 ms
//   skeleton → content at:  1500, 3200, 4900 ms

const PANEL_TIMINGS = [
  { skeletonAt: 500, contentAt: 1500 },
  { skeletonAt: 2200, contentAt: 3200 },
  { skeletonAt: 3900, contentAt: 4900 },
];

export function Demo3PanelsCompose() {
  const t = useDemoTick(CYCLE_MS);

  return (
    <DemoFrame label="Rendering">
      <div className="flex flex-col gap-3 p-5 sm:p-6">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {PANEL_TIMINGS.map((p, i) => {
            const phase: "missing" | "skeleton" | "content" =
              t < p.skeletonAt
                ? "missing"
                : t < p.contentAt
                ? "skeleton"
                : "content";
            return <PanelSlot key={i} index={i} phase={phase} />;
          })}
        </div>
        <PipelineHint t={t} />
      </div>
    </DemoFrame>
  );
}

function PanelSlot({
  index,
  phase,
}: {
  index: number;
  phase: "missing" | "skeleton" | "content";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={
          "relative aspect-[5/3] overflow-hidden rounded-md border bg-surface transition-all duration-500 " +
          (phase === "missing"
            ? "border-dashed border-paper-line opacity-30"
            : phase === "skeleton"
            ? "border-paper-line opacity-100"
            : "border-paper-line opacity-100 shadow-[0_8px_20px_-10px_rgba(23,23,23,0.25)] -translate-y-0.5")
        }
      >
        {/* Skeleton layer */}
        <div
          className={
            "absolute inset-0 transition-opacity duration-300 " +
            (phase === "skeleton" ? "opacity-100" : "opacity-0")
          }
        >
          <Skeleton />
        </div>
        {/* Content layer */}
        <div
          className={
            "absolute inset-0 transition-all duration-500 " +
            (phase === "content"
              ? "opacity-100 scale-100"
              : "opacity-0 scale-[0.96]")
          }
        >
          <Visual index={index} />
        </div>
      </div>
      {/* Mini caption strip */}
      <div className="flex flex-col gap-1 px-0.5">
        <div
          className={
            "h-1.5 rounded-sm transition-all duration-300 " +
            (phase === "missing"
              ? "w-1/3 bg-paper-soft"
              : phase === "skeleton"
              ? "w-1/2 bg-ink/15"
              : "w-3/4 bg-ink/40")
          }
        />
        <div
          className={
            "h-1 rounded-sm transition-all duration-300 " +
            (phase === "content" ? "w-2/3 bg-ink/20" : "w-1/3 bg-ink/10")
          }
        />
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="absolute inset-1.5 motion-safe:animate-pulse">
      <div className="h-full w-full rounded-sm bg-paper-soft" />
    </div>
  );
}

const SERIF = "ui-serif, Georgia, 'Times New Roman', serif";
const SANS = "ui-sans-serif, system-ui, sans-serif";

function Visual({ index }: { index: number }) {
  if (index === 0) {
    // Audience donut — warm editorial light panel
    return (
      <svg viewBox="0 0 100 60" className="h-full w-full" aria-hidden>
        <rect x="0" y="0" width="100" height="60" fill="#FFFDF8" />
        <g transform="rotate(-90 30 31)">
          <circle cx="30" cy="31" r="16" fill="none" stroke="#F9E5D9" strokeWidth="8" />
          <circle
            cx="30"
            cy="31"
            r="16"
            fill="none"
            stroke="#ECA77F"
            strokeWidth="8"
            strokeDasharray="24.1 100.6"
            strokeDashoffset="-62.3"
          />
          <circle
            cx="30"
            cy="31"
            r="16"
            fill="none"
            stroke="#E85D2A"
            strokeWidth="8"
            strokeDasharray="62.3 100.6"
          />
        </g>
        <text
          x="30"
          y="34"
          fontSize="9"
          fontWeight="600"
          fill="#171717"
          fontFamily={SERIF}
          textAnchor="middle"
        >
          62%
        </text>
        <rect x="58" y="15" width="4" height="4" rx="0.8" fill="#E85D2A" />
        <text x="65" y="18.6" fontSize="4.5" fill="#5F5A52" fontFamily={SANS}>
          Read it all
        </text>
        <rect x="58" y="27" width="4" height="4" rx="0.8" fill="#ECA77F" />
        <text x="65" y="30.6" fontSize="4.5" fill="#5F5A52" fontFamily={SANS}>
          Skimmed
        </text>
        <rect x="58" y="39" width="4" height="4" rx="0.8" fill="#F9E5D9" stroke="#D8CEC0" strokeWidth="0.3" />
        <text x="65" y="42.6" fontSize="4.5" fill="#5F5A52" fontFamily={SANS}>
          Bounced
        </text>
      </svg>
    );
  }
  if (index === 1) {
    // Stat callout — dark template card
    return (
      <svg viewBox="0 0 100 60" className="h-full w-full" aria-hidden>
        <rect x="0" y="0" width="100" height="60" fill="#101010" />
        <circle cx="86" cy="-6" r="26" fill="#E85D2A" opacity="0.18" />
        <rect x="14" y="12" width="14" height="2" rx="1" fill="#E85D2A" />
        <text
          x="14"
          y="40"
          fontSize="21"
          fontWeight="500"
          fill="#F7F3EA"
          fontFamily={SERIF}
        >
          3.2&#215;
        </text>
        <text x="14" y="50" fontSize="5.5" fill="#ABA395" fontFamily={SANS}>
          faster than writing it by hand
        </text>
      </svg>
    );
  }
  // Bar chart — accent data panel
  return (
    <svg viewBox="0 0 100 60" className="h-full w-full" aria-hidden>
      <rect x="0" y="0" width="100" height="60" fill="#FFFDF8" />
      {[20, 32, 44].map((y) => (
        <line key={y} x1="12" y1={y} x2="88" y2={y} stroke="#D8CEC0" strokeWidth="0.4" />
      ))}
      <rect x="16" y="38" width="11" height="12" rx="1" fill="#F9E5D9" />
      <rect x="34" y="32" width="11" height="18" rx="1" fill="#ECA77F" />
      <rect x="52" y="24" width="11" height="26" rx="1" fill="#E85D2A" />
      <rect x="70" y="14" width="11" height="36" rx="1" fill="#B23F14" />
      <line x1="12" y1="50" x2="88" y2="50" stroke="#171717" strokeWidth="0.7" />
      <text x="12" y="11" fontSize="6" fontWeight="600" fill="#171717" fontFamily={SANS}>
        +212%
      </text>
      <text x="36" y="11" fontSize="4.5" fill="#857E72" fontFamily={SANS}>
        reach per post
      </text>
    </svg>
  );
}

function PipelineHint({ t }: { t: number }) {
  const labels = [
    { from: 0, to: 1500, text: "Planning panel layouts…" },
    { from: 1500, to: 3200, text: "Rendering audience donut…" },
    { from: 3200, to: 4900, text: "Rendering stat callout…" },
    { from: 4900, to: 7000, text: "Rendering reach chart…" },
    { from: 7000, to: CYCLE_MS, text: "Explainer ready" },
  ];
  const active = labels.find((l) => between(t, l.from, l.to)) ?? labels[0];
  return (
    <div className="flex items-center gap-2 rounded-md border border-paper-line bg-surface px-3 py-2">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky motion-safe:animate-pulse" />
      <span className="font-mono text-[11px] text-ink-soft sm:text-xs">
        {active.text}
      </span>
    </div>
  );
}
