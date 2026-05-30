"use client";

import type { AgentName } from "@/lib/events";
import {
  AGENT_KEYS,
  AGENT_LABEL,
  type AgentNodeView,
  type SceneState,
} from "@/lib/scene/reducer";

interface Props {
  scene: SceneState;
  collapsed?: boolean;
}

export function WorkingScene({ scene, collapsed }: Props) {
  const activeAgent = scene.activeAgent;
  const activeNote =
    activeAgent && scene.agents[activeAgent].lastNote
      ? scene.agents[activeAgent].lastNote
      : findLatestNote(scene);

  return (
    <section
      aria-label="Pipeline progress"
      className={
        "rounded-lg border border-paper-line bg-white " +
        (collapsed ? "px-4 py-3" : "px-4 py-5")
      }
    >
      <ol
        className={
          "grid gap-y-2 " +
          (collapsed
            ? "grid-cols-6 gap-x-2"
            : "grid-cols-3 gap-x-3 sm:grid-cols-6")
        }
        role="list"
      >
        {AGENT_KEYS.map((key, i) => {
          const node = scene.agents[key];
          return (
            <AgentNode
              key={key}
              index={i + 1}
              agent={key}
              node={node}
              isLast={i === AGENT_KEYS.length - 1}
              collapsed={Boolean(collapsed)}
            />
          );
        })}
      </ol>

      {!collapsed && (
        <div
          className="mt-4 h-5 text-sm text-ink-muted"
          aria-live="polite"
          aria-atomic="true"
        >
          {activeNote ?? renderStatusFallback(scene)}
        </div>
      )}
    </section>
  );
}

function AgentNode({
  index,
  agent,
  node,
  isLast,
  collapsed,
}: {
  index: number;
  agent: AgentName;
  node: AgentNodeView;
  isLast: boolean;
  collapsed: boolean;
}) {
  const labelText = AGENT_LABEL[agent];
  const state = node.state;

  // Marker visual: numbered circle. No icons. Color via classes.
  const markerColor =
    state === "active"
      ? "border-ink bg-ink text-paper"
      : state === "done"
      ? "border-ink bg-paper text-ink"
      : "border-paper-line bg-paper text-ink-faint";

  const labelColor =
    state === "pending"
      ? "text-ink-faint"
      : state === "active"
      ? "text-ink"
      : "text-ink-soft";

  return (
    <li className="relative flex items-center gap-2 min-w-0" title={node.summary}>
      <span
        aria-hidden
        className={
          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors " +
          markerColor +
          (state === "active" ? " motion-safe:animate-pulse" : "")
        }
      >
        {state === "done" ? <CheckGlyph /> : index}
      </span>
      <span
        className={
          "truncate text-xs " + labelColor + (collapsed ? "" : " sm:text-sm")
        }
      >
        {labelText}
      </span>
      {!isLast && !collapsed && (
        <span
          aria-hidden
          className="mx-1 hidden h-px flex-1 bg-paper-line sm:block"
        />
      )}
    </li>
  );
}

function CheckGlyph() {
  return (
    <svg
      viewBox="0 0 12 12"
      width="11"
      height="11"
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

function findLatestNote(scene: SceneState): string | undefined {
  for (let i = scene.log.length - 1; i >= 0; i--) return scene.log[i].note;
  return undefined;
}

function renderStatusFallback(scene: SceneState): string {
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
