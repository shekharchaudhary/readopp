"use client";

import { useDemoTick } from "./demoPrim";
import { DemoFrame } from "./demoPrim";

const CYCLE_MS = 8500;

interface AgentStep {
  name: string;
  working: string; // progress text while running
  done: string;    // summary line once done
}

const AGENTS: AgentStep[] = [
  { name: "Read",       working: "Fetching article…",                   done: "Read 4,230 words" },
  { name: "Understand", working: "Extracting core idea…",                done: "Found 7 key claims" },
  { name: "Outline",    working: "Choosing panel types…",                done: "5 panels planned" },
  { name: "Plan",       working: "Designing panel 3 of 5…",              done: "Designed 5 panels" },
  { name: "Draw",       working: "Rendering metaphor templates…",        done: "Rendered 5 panels" },
  { name: "Assemble",   working: "Stitching the explainer…",             done: "Done" },
];

// Each agent takes ~1100ms (start → done). After the last completes, hold ~1000ms.
const PER_AGENT_MS = 1100;
const HOLD_MS = 1000;

/** Compute state for each agent at time t. */
function agentState(t: number, i: number): "idle" | "working" | "done" {
  const startedAt = i * PER_AGENT_MS;
  const doneAt = startedAt + PER_AGENT_MS;
  if (t < startedAt) return "idle";
  if (t < doneAt) return "working";
  return "done";
}

export function Demo2AgentsWork() {
  const t = useDemoTick(CYCLE_MS);

  // Pick the active agent (the one currently "working"); otherwise the most
  // recently completed for the transcript line.
  let currentIndex = 0;
  for (let i = 0; i < AGENTS.length; i++) {
    if (agentState(t, i) === "working") {
      currentIndex = i;
      break;
    }
    if (agentState(t, i) === "done") currentIndex = i;
  }
  const current = AGENTS[currentIndex];
  const currentState = agentState(t, currentIndex);
  const transcript =
    currentState === "working" ? current.working : current.done;

  return (
    <DemoFrame label="Working">
      <div className="flex flex-col gap-3 p-5 sm:p-6">
        <div className="space-y-1.5">
          {AGENTS.map((a, i) => (
            <AgentRow
              key={a.name}
              index={i}
              name={a.name}
              state={agentState(t, i)}
            />
          ))}
        </div>

        {/* Live transcript */}
        <div className="mt-2 flex items-start gap-2 rounded-md border border-paper-line bg-surface px-3 py-2">
          <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-sky motion-safe:animate-pulse" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-medium uppercase tracking-wider text-ink-faint">
              {current.name}
            </div>
            <div className="truncate font-mono text-[11px] text-ink-soft sm:text-xs">
              {transcript}
            </div>
          </div>
        </div>
      </div>
    </DemoFrame>
  );
}

function AgentRow({
  index,
  name,
  state,
}: {
  index: number;
  name: string;
  state: "idle" | "working" | "done";
}) {
  return (
    <div
      className={
        "flex items-center gap-3 rounded-md border px-2.5 py-1.5 transition-colors duration-200 " +
        (state === "working"
          ? "border-sky bg-sky-soft"
          : state === "done"
          ? "border-paper-line bg-surface"
          : "border-paper-line bg-paper-soft/50")
      }
    >
      {/* Indicator */}
      <div className="flex h-6 w-6 shrink-0 items-center justify-center">
        {state === "done" ? (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-sky text-white">
            <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
              <path
                d="M2.5 6.5 L5 9 L9.5 3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        ) : state === "working" ? (
          <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-sky">
            <div className="h-1.5 w-1.5 rounded-full bg-sky motion-safe:animate-pulse" />
          </div>
        ) : (
          <div className="h-5 w-5 rounded-full border-2 border-paper-line" />
        )}
      </div>

      <span
        className={
          "font-mono text-[10px] font-medium tabular-nums " +
          (state === "idle" ? "text-ink-faint" : "text-sky-deep")
        }
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      <span
        className={
          "flex-1 text-sm " +
          (state === "idle"
            ? "text-ink-faint"
            : state === "working"
            ? "font-medium text-ink"
            : "text-ink-soft")
        }
      >
        {name}
      </span>

      <span
        className={
          "text-[10px] font-medium uppercase tracking-wider " +
          (state === "working"
            ? "text-sky-deep"
            : state === "done"
            ? "text-ink-muted"
            : "text-ink-faint")
        }
      >
        {state === "working" ? "Working" : state === "done" ? "Done" : "Idle"}
      </span>
    </div>
  );
}
