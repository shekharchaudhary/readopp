import type { AgentName, StreamEvent } from "@/lib/events";
import type {
  Explainer,
  JobError,
  JobStatus,
  RenderedPanel,
} from "@/lib/shared/schemas";

export type AgentNodeState = "pending" | "active" | "done";

export interface AgentNodeView {
  state: AgentNodeState;
  summary?: string;
  lastNote?: string;
}

export interface PanelSlot {
  index: number;
  total: number;
  sectionId?: string;
  panel?: RenderedPanel;
  pending: boolean;
}

export interface SceneState {
  status: JobStatus;
  agents: Record<AgentName, AgentNodeView>;
  activeAgent: AgentName | null;
  panels: PanelSlot[];
  explainer?: Explainer;
  error?: JobError;
  lastSeq: number;
  log: { ts: string; agent: AgentName; note: string }[];
}

export const AGENT_KEYS: AgentName[] = [
  "ingest",
  "comprehension",
  "structure",
  "planner",
  "render",
  "assembly",
];

export const AGENT_LABEL: Record<AgentName, string> = {
  ingest: "Read",
  comprehension: "Understand",
  structure: "Outline",
  planner: "Plan",
  render: "Draw",
  assembly: "Assemble",
};

export function initialScene(): SceneState {
  const agents = {} as Record<AgentName, AgentNodeView>;
  for (const k of AGENT_KEYS) agents[k] = { state: "pending" };
  return {
    status: "queued",
    agents,
    activeAgent: null,
    panels: [],
    lastSeq: 0,
    log: [],
  };
}

/**
 * Apply one StreamEvent to the scene. Pure + idempotent: re-applying the same
 * event by seq is a no-op.
 */
export function applyEvent(prev: SceneState, ev: StreamEvent): SceneState {
  if (ev.seq <= prev.lastSeq) return prev;
  const next: SceneState = {
    ...prev,
    agents: { ...prev.agents },
    panels: prev.panels.slice(),
    log: prev.log,
    lastSeq: ev.seq,
  };

  switch (ev.type) {
    case "job.status": {
      next.status = ev.data.status;
      return next;
    }
    case "agent.start": {
      const a = ev.data.agent;
      // mark prior agents as done if still pending
      for (const k of AGENT_KEYS) {
        if (k === a) break;
        if (next.agents[k].state === "pending") {
          next.agents[k] = { ...next.agents[k], state: "done" };
        }
      }
      next.agents[a] = { ...next.agents[a], state: "active" };
      next.activeAgent = a;
      return next;
    }
    case "agent.progress": {
      const a = ev.data.agent;
      next.agents[a] = { ...next.agents[a], lastNote: ev.data.note };
      next.log = [...next.log, { ts: ev.ts, agent: a, note: ev.data.note }];
      return next;
    }
    case "agent.done": {
      const a = ev.data.agent;
      next.agents[a] = {
        ...next.agents[a],
        state: "done",
        summary: ev.data.summary,
      };
      if (next.activeAgent === a) next.activeAgent = null;
      return next;
    }
    case "panel.start": {
      const { index, total, sectionId } = ev.data;
      const panels = ensurePanelSlots(next.panels, total);
      panels[index - 1] = {
        ...panels[index - 1],
        index,
        total,
        sectionId,
        pending: true,
      };
      next.panels = panels;
      return next;
    }
    case "panel.done": {
      const { index, total, panel } = ev.data;
      const panels = ensurePanelSlots(next.panels, total);
      panels[index - 1] = {
        index,
        total,
        sectionId: panel.sectionId,
        panel,
        pending: false,
      };
      next.panels = panels;
      return next;
    }
    case "job.completed": {
      next.status = "completed";
      next.explainer = ev.data.explainer;
      // ensure all agent nodes are marked done
      for (const k of AGENT_KEYS) {
        if (next.agents[k].state !== "done") {
          next.agents[k] = { ...next.agents[k], state: "done" };
        }
      }
      next.activeAgent = null;
      return next;
    }
    case "job.failed": {
      next.status = "failed";
      next.error = ev.data.error;
      next.activeAgent = null;
      return next;
    }
    default:
      return prev;
  }
}

function ensurePanelSlots(curr: PanelSlot[], total: number): PanelSlot[] {
  if (curr.length >= total) return curr.slice();
  const out = curr.slice();
  for (let i = out.length; i < total; i++) {
    out.push({ index: i + 1, total, pending: true });
  }
  return out;
}
