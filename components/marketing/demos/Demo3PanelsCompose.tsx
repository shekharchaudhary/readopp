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
          "relative aspect-[5/3] overflow-hidden rounded-md border bg-white transition-all duration-400 " +
          (phase === "missing"
            ? "border-dashed border-paper-line opacity-30"
            : "border-paper-line opacity-100")
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
            "absolute inset-0 p-1.5 transition-opacity duration-400 " +
            (phase === "content" ? "opacity-100" : "opacity-0")
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

function Visual({ index }: { index: number }) {
  if (index === 0) {
    // Iceberg
    return (
      <svg viewBox="0 0 100 60" className="h-full w-full" aria-hidden>
        <rect
          x="0"
          y="28"
          width="100"
          height="32"
          fill="#E6F1FB"
          opacity="0.6"
        />
        <line
          x1="0"
          y1="28"
          x2="100"
          y2="28"
          stroke="#185FA5"
          opacity="0.4"
        />
        <path
          d="M 42 28 L 50 10 L 58 28 Z"
          fill="#ffffff"
          stroke="#185FA5"
          strokeWidth="1"
        />
        <path
          d="M 32 28 L 22 52 L 68 54 L 65 28 Z"
          fill="#ffffff"
          stroke="#185FA5"
          strokeWidth="1"
          opacity="0.92"
        />
      </svg>
    );
  }
  if (index === 1) {
    // Mountain with camps
    return (
      <svg viewBox="0 0 100 60" className="h-full w-full" aria-hidden>
        <path
          d="M 0 54 L 30 26 L 50 40 L 70 16 L 100 54 Z"
          fill="#FAEEDA"
          stroke="#854F0B"
          strokeWidth="0.8"
        />
        <circle cx="50" cy="40" r="2" fill="#633806" />
        <circle cx="70" cy="16" r="2" fill="#633806" />
        <path
          d="M 30 50 L 50 40 L 70 16"
          fill="none"
          stroke="#633806"
          strokeWidth="0.6"
          strokeDasharray="2 2"
        />
      </svg>
    );
  }
  // Stat callout
  return (
    <svg viewBox="0 0 100 60" className="h-full w-full" aria-hidden>
      <line
        x1="38"
        y1="14"
        x2="62"
        y2="14"
        stroke="#185FA5"
        strokeWidth="0.8"
      />
      <text
        x="50"
        y="40"
        fontSize="22"
        fontWeight="500"
        fill="#185FA5"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        87%
      </text>
      <text
        x="50"
        y="52"
        fontSize="6"
        fill="#3a3a3a"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        of time saved
      </text>
    </svg>
  );
}

function PipelineHint({ t }: { t: number }) {
  const labels = [
    { from: 0, to: 1500, text: "Planning panel layouts…" },
    { from: 1500, to: 3200, text: "Rendering iceberg metaphor…" },
    { from: 3200, to: 4900, text: "Rendering mountain metaphor…" },
    { from: 4900, to: 7000, text: "Rendering stat callout…" },
    { from: 7000, to: CYCLE_MS, text: "Explainer ready" },
  ];
  const active = labels.find((l) => between(t, l.from, l.to)) ?? labels[0];
  return (
    <div className="flex items-center gap-2 rounded-md border border-paper-line bg-white px-3 py-2">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-pulse" />
      <span className="font-mono text-[11px] text-ink-soft sm:text-xs">
        {active.text}
      </span>
    </div>
  );
}
