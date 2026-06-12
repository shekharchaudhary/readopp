"use client";

import { useEffect, useState } from "react";
import type { AgentName } from "@/lib/events";
import {
  AGENT_KEYS,
  AGENT_LABEL,
  type AgentNodeView,
  type PanelSlot,
  type SceneState,
} from "@/lib/scene/reducer";

/** What each agent is doing, in the user's language — shown on the active card. */
const AGENT_DESC: Record<AgentName, string> = {
  ingest: "Fetching the source and stripping it down to clean text",
  comprehension: "Reading like an editor — claims, numbers, what actually matters",
  structure: "Deciding what deserves a panel, and in what order",
  planner: "Designing each panel: layout, copy, visual idea",
  render: "Drawing every panel as crisp vector art",
  assembly: "Stitching the panels into one shareable explainer",
  social: "Writing the caption, hashtags, and alt text for your post",
};

interface Props {
  scene: SceneState;
}

/**
 * The orchestration board. Agents cascade vertically: each one appears as a
 * live card while it works (its own progress notes streaming in), then
 * collapses into a permanent receipt — what it produced and how long it took.
 * A pulse runs down the connector into the active agent so the handoff
 * between agents is visible, not implied.
 */
export function WorkingScene({ scene }: Props) {
  const doneCount = AGENT_KEYS.filter(
    (k) => scene.agents[k].state === "done"
  ).length;
  const stepIndex = scene.activeAgent
    ? AGENT_KEYS.indexOf(scene.activeAgent) + 1
    : Math.min(doneCount + 1, AGENT_KEYS.length);
  const firstStart = AGENT_KEYS.map((k) => scene.agents[k].startedAt)
    .filter(Boolean)
    .sort()[0];

  return (
    <section
      aria-label="Pipeline progress"
      className="overflow-hidden rounded-xl border border-paper-line bg-surface shadow-[0_1px_0_rgba(0,0,0,0.02)]"
    >
      <header className="flex items-baseline justify-between border-b border-paper-line bg-paper-soft/40 px-5 py-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">
          {scene.status === "failed"
            ? "Stopped"
            : `Agent ${stepIndex} of ${AGENT_KEYS.length}`}
          <span className="mx-2 text-ink-faint">·</span>
          <span className="normal-case tracking-normal">
            {doneCount} done
          </span>
        </p>
        <Elapsed startedAt={firstStart} />
      </header>

      <ol role="list" className="px-5 py-4 sm:px-6">
        {AGENT_KEYS.map((key, i) => (
          <TimelineRow key={key} agent={key} index={i} scene={scene} />
        ))}
      </ol>
    </section>
  );
}

function TimelineRow({
  agent,
  index,
  scene,
}: {
  agent: AgentName;
  index: number;
  scene: SceneState;
}) {
  const node = scene.agents[agent];
  const isLast = index === AGENT_KEYS.length - 1;
  const next = AGENT_KEYS[index + 1];
  const handoffActive = Boolean(
    next && node.state === "done" && scene.agents[next].state === "active"
  );

  return (
    <li className="flex gap-3 sm:gap-4">
      {/* Gutter: marker + connector down to the next agent. */}
      <div className="flex w-7 shrink-0 flex-col items-center">
        <Marker index={index} state={node.state} />
        {!isLast && (
          <span className="relative my-1 w-[3px] flex-1 overflow-hidden">
            <span
              className={
                "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors duration-500 " +
                (node.state === "done" ? "bg-accent/50" : "bg-paper-line")
              }
            />
            {handoffActive && (
              <span
                aria-hidden
                className="absolute left-1/2 h-3 w-[3px] -translate-x-1/2 rounded-full bg-accent motion-safe:animate-drip"
              />
            )}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 pb-4">
        {node.state === "active" ? (
          <ActiveCard agent={agent} node={node} scene={scene} />
        ) : node.state === "done" ? (
          <DoneReceipt agent={agent} node={node} />
        ) : (
          <PendingRow agent={agent} firstPending={isFirstPending(scene, agent)} />
        )}
      </div>
    </li>
  );
}

/** True when this is the next agent up — it gets a "queued" hint. */
function isFirstPending(scene: SceneState, agent: AgentName): boolean {
  const firstPending = AGENT_KEYS.find(
    (k) => scene.agents[k].state === "pending"
  );
  return firstPending === agent && scene.status !== "failed";
}

function Marker({
  index,
  state,
}: {
  index: number;
  state: AgentNodeView["state"];
}) {
  if (state === "done") {
    return (
      <span
        aria-hidden
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-accent/50 bg-paper text-accent-deep motion-safe:animate-fade-up"
      >
        <CheckGlyph />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="relative inline-flex shrink-0 items-center justify-center">
        <span
          aria-hidden
          className="absolute -inset-1 rounded-full border border-accent/40 motion-safe:animate-breathe"
        />
        <span
          aria-hidden
          className="relative inline-flex h-7 w-7 items-center justify-center rounded-full border border-accent bg-accent text-xs font-medium text-white"
        >
          {index + 1}
        </span>
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-paper-line bg-paper text-xs font-medium text-ink-faint"
    >
      {index + 1}
    </span>
  );
}

function ActiveCard({
  agent,
  node,
  scene,
}: {
  agent: AgentName;
  node: AgentNodeView;
  scene: SceneState;
}) {
  // This agent's own progress notes — the live trace of what it's doing.
  const notes = scene.log
    .filter((e) => e.agent === agent && e.kind === "progress")
    .slice(-3);

  return (
    <div className="rounded-lg border border-accent/30 bg-paper px-4 py-3.5 motion-safe:animate-fade-up">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-medium text-ink sm:text-lg">
          {AGENT_LABEL[agent]}
        </h2>
        <Elapsed startedAt={node.startedAt} />
      </div>
      <p className="mt-0.5 text-xs text-ink-muted">{AGENT_DESC[agent]}</p>

      <div aria-live="polite" aria-atomic="true" className="mt-3 space-y-1">
        {notes.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <BouncingDots />
            <span>{statusFallback(scene)}</span>
            <Caret />
          </p>
        ) : (
          notes.map((e, i) => {
            const latest = i === notes.length - 1;
            return latest ? (
              <p
                key={`${e.ts}-${i}`}
                className="flex items-center gap-2 text-sm text-ink-soft"
              >
                <BouncingDots />
                <span className="min-w-0 truncate">{e.note}</span>
                <Caret />
              </p>
            ) : (
              <p
                key={`${e.ts}-${i}`}
                className="truncate pl-6 font-mono text-[12px] text-ink-faint"
              >
                {e.note}
              </p>
            );
          })
        )}
      </div>

      {agent === "render" && <RenderCounter slots={scene.panels} />}
    </div>
  );
}

function DoneReceipt({
  agent,
  node,
}: {
  agent: AgentName;
  node: AgentNodeView;
}) {
  const took = durationLabel(node);
  return (
    <div
      className="flex items-baseline gap-3 py-1 motion-safe:animate-fade-up"
      title={node.summary}
    >
      <span className="shrink-0 text-sm font-medium text-ink-soft">
        {AGENT_LABEL[agent]}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">
        {node.summary || "Done"}
      </span>
      {took && (
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-faint">
          {took}
        </span>
      )}
    </div>
  );
}

function PendingRow({
  agent,
  firstPending,
}: {
  agent: AgentName;
  firstPending: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3 py-1">
      <span className="text-sm text-ink-faint">{AGENT_LABEL[agent]}</span>
      {firstPending && (
        <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint/80">
          up next
        </span>
      )}
    </div>
  );
}

function durationLabel(node: AgentNodeView): string | null {
  if (!node.startedAt || !node.completedAt) return null;
  const ms =
    new Date(node.completedAt).getTime() - new Date(node.startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const s = Math.round(ms / 1000);
  if (s < 1) return "<1s";
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${(s % 60).toString().padStart(2, "0")}s`;
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
      className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] shrink-0 bg-ink motion-safe:animate-blink"
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
    <div className="mt-3 flex items-center gap-3">
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
                  ? "bg-accent"
                  : inFlight
                  ? "bg-accent/30 motion-safe:animate-pulse"
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
      return "Working…";
  }
}
