"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentName } from "@/lib/events";
import {
  AGENT_KEYS,
  AGENT_LABEL,
  type AgentNodeView,
  type LogEntry,
  type PanelSlot,
  type SceneState,
} from "@/lib/scene/reducer";

interface Props {
  scene: SceneState;
  collapsed?: boolean;
}

export function WorkingScene({ scene, collapsed }: Props) {
  if (collapsed) return <CollapsedStrip scene={scene} />;

  return (
    <section
      aria-label="Pipeline progress"
      className="overflow-hidden rounded-xl border border-paper-line bg-surface shadow-[0_1px_0_rgba(0,0,0,0.02)]"
    >
      <StepStrip scene={scene} />
      <Spotlight scene={scene} />
      <Transcript log={scene.log} />
    </section>
  );
}

function CollapsedStrip({ scene }: { scene: SceneState }) {
  return (
    <section
      aria-label="Pipeline progress"
      className="rounded-lg border border-paper-line bg-surface px-4 py-3"
    >
      <ol className="grid grid-cols-6 gap-x-2" role="list">
        {AGENT_KEYS.map((key, i) => (
          <MiniStep
            key={key}
            index={i + 1}
            agent={key}
            node={scene.agents[key]}
          />
        ))}
      </ol>
    </section>
  );
}

function MiniStep({
  index,
  agent,
  node,
}: {
  index: number;
  agent: AgentName;
  node: AgentNodeView;
}) {
  const isActive = node.state === "active";
  const isDone = node.state === "done";
  const markerColor = isActive
    ? "border-accent bg-accent text-paper"
    : isDone
    ? "border-accent bg-paper text-accent-deep"
    : "border-paper-line bg-paper text-ink-faint";
  return (
    <li className="flex min-w-0 items-center gap-2" title={node.summary}>
      <span
        aria-hidden
        className={
          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium " +
          markerColor
        }
      >
        {isDone ? <CheckGlyph size={9} /> : index}
      </span>
      <span
        className={
          "truncate text-xs " +
          (node.state === "pending"
            ? "text-ink-faint"
            : isActive
            ? "text-ink"
            : "text-ink-soft")
        }
      >
        {AGENT_LABEL[agent]}
      </span>
    </li>
  );
}

function StepStrip({ scene }: { scene: SceneState }) {
  return (
    <ol
      role="list"
      className="flex items-center gap-2 border-b border-paper-line bg-paper-soft/40 px-4 py-4 sm:gap-3 sm:px-5"
    >
      {AGENT_KEYS.map((key, i) => {
        const node = scene.agents[key];
        const isLast = i === AGENT_KEYS.length - 1;
        const isActive = node.state === "active";
        const isDone = node.state === "done";

        const next = AGENT_KEYS[i + 1];
        const connectorFilled = Boolean(
          next && scene.agents[next].state !== "pending"
        );

        const markerColor = isActive
          ? "border-ink bg-ink text-paper"
          : isDone
          ? "border-ink bg-paper text-ink"
          : "border-paper-line bg-paper text-ink-faint";

        const labelColor =
          node.state === "pending"
            ? "text-ink-faint"
            : isActive
            ? "text-ink"
            : "text-ink-soft";

        return (
          <li
            key={key}
            className="flex min-w-0 flex-1 items-center gap-2"
            title={node.summary}
          >
            <span className="relative inline-flex shrink-0 items-center justify-center">
              {isActive && (
                <span
                  aria-hidden
                  className="absolute -inset-1 rounded-full border border-accent/40 motion-safe:animate-breathe"
                />
              )}
              <span
                aria-hidden
                className={
                  "relative inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium transition-colors " +
                  markerColor
                }
              >
                {isDone ? <CheckGlyph /> : i + 1}
              </span>
            </span>
            <span
              className={
                "truncate text-xs sm:text-sm " + labelColor
              }
            >
              {AGENT_LABEL[key]}
            </span>
            {!isLast && (
              <span
                aria-hidden
                className={
                  "mx-1 hidden h-px flex-1 transition-colors sm:block " +
                  (connectorFilled ? "bg-accent/50" : "bg-paper-line")
                }
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Spotlight({ scene }: { scene: SceneState }) {
  const active = scene.activeAgent;

  if (!active) {
    return (
      <div className="border-b border-paper-line px-5 py-6">
        <p className="text-sm text-ink-muted">{statusFallback(scene)}</p>
      </div>
    );
  }

  const node = scene.agents[active];
  const stepIndex = AGENT_KEYS.indexOf(active) + 1;
  const note = node.lastNote ?? statusFallback(scene);

  return (
    <div className="relative overflow-hidden border-b border-paper-line px-5 py-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">
          Step {stepIndex} of {AGENT_KEYS.length}
        </p>
        <Elapsed startedAt={node.startedAt} />
      </div>

      <h2 className="mt-1 text-xl font-medium text-ink sm:text-2xl">
        {AGENT_LABEL[active]}
      </h2>

      <p
        aria-live="polite"
        aria-atomic="true"
        className="mt-3 flex items-center gap-2 text-sm text-ink-soft"
      >
        <BouncingDots />
        <span>{note}</span>
        <Caret />
      </p>

      {active === "render" && <RenderCounter slots={scene.panels} />}

      <ScannerBar />
    </div>
  );
}

function ScannerBar() {
  return (
    <div
      aria-hidden
      className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden bg-paper-soft"
    >
      <span className="block h-full w-1/3 bg-accent/70 motion-safe:animate-scan" />
    </div>
  );
}

function BouncingDots() {
  return (
    <span aria-hidden className="inline-flex h-3 items-end gap-[3px] pr-1">
      <span className="block h-1.5 w-1.5 rounded-full bg-ink motion-safe:animate-dot-bounce [animation-delay:-0.32s]" />
      <span className="block h-1.5 w-1.5 rounded-full bg-ink motion-safe:animate-dot-bounce [animation-delay:-0.16s]" />
      <span className="block h-1.5 w-1.5 rounded-full bg-ink motion-safe:animate-dot-bounce" />
    </span>
  );
}

function Caret() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-ink motion-safe:animate-blink"
    />
  );
}

function Elapsed({ startedAt }: { startedAt?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!startedAt) return null;
  const ms = Math.max(0, now - new Date(startedAt).getTime());
  const s = Math.floor(ms / 1000);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  const text = mm > 0 ? `${mm}m ${ss.toString().padStart(2, "0")}s` : `${ss}s`;
  return (
    <span className="font-mono text-xs tabular-nums text-ink-muted">
      {text}
    </span>
  );
}

function RenderCounter({ slots }: { slots: PanelSlot[] }) {
  const total = slots.length;
  if (total === 0) return null;
  const done = slots.filter((s) => s.panel).length;
  return (
    <div className="mt-4 flex items-center gap-3">
      <div className="flex gap-1">
        {slots.map((s) => {
          const filled = Boolean(s.panel);
          const inFlight = !filled && s.pending;
          return (
            <span
              key={s.index}
              className={
                "h-1.5 w-6 rounded-sm transition-colors " +
                (filled
                  ? "bg-ink"
                  : inFlight
                  ? "bg-ink/30 motion-safe:animate-pulse"
                  : "bg-paper-line")
              }
            />
          );
        })}
      </div>
      <span className="font-mono text-xs tabular-nums text-ink-muted">
        {done} / {total} panels
      </span>
    </div>
  );
}

const TRANSCRIPT_TAIL = 6;

function Transcript({ log }: { log: LogEntry[] }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const tail = log.slice(-TRANSCRIPT_TAIL);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [tail.length]);

  return (
    <div
      ref={scrollerRef}
      className="max-h-44 overflow-y-auto px-5 py-3"
      aria-label="Activity log"
    >
      {tail.length === 0 ? (
        <p className="font-mono text-[12px] text-ink-faint">
          Waiting for the first agent…
        </p>
      ) : (
        <ul className="space-y-1.5">
          {tail.map((e, i) => (
            <LogRow key={`${e.ts}-${i}-${e.kind}`} entry={e} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const isDone = entry.kind === "done";
  const isStart = entry.kind === "start";
  const noteColor = isDone
    ? "text-ink"
    : isStart
    ? "text-ink-muted"
    : "text-ink-soft";
  const labelColor = isDone ? "text-ink" : "text-ink-muted";
  return (
    <li className="flex items-baseline gap-3 font-mono text-[12px] leading-snug motion-safe:animate-fade-up">
      <span className="shrink-0 tabular-nums text-ink-faint">
        {shortTime(entry.ts)}
      </span>
      <span className={"w-[5.5rem] shrink-0 truncate " + labelColor}>
        {AGENT_LABEL[entry.agent]}
      </span>
      <span className={"min-w-0 truncate " + noteColor}>
        {isDone ? "→ " : isStart ? "» " : ""}
        {entry.note}
      </span>
    </li>
  );
}

function shortTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour12: false,
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

function CheckGlyph({ size = 11 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width={size}
      height={size}
      aria-hidden
      role="presentation"
    >
      <path
        d="M2.5 6.5 L5 9 L9.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function statusFallback(scene: SceneState): string {
  switch (scene.status) {
    case "queued":
      return "Queued…";
    case "ingesting":
      return "Fetching the article…";
    case "comprehending":
      return "Reading and understanding the article…";
    case "structuring":
      return "Choosing panel types…";
    case "planning":
      return "Planning each panel…";
    case "rendering":
      return "Drawing the panels…";
    case "assembling":
      return "Assembling…";
    case "completed":
      return "Done.";
    case "failed":
      return "Failed.";
    default:
      return "";
  }
}
