import type {
  Explainer,
  JobError,
  JobStatus,
  RenderedPanel,
} from "./shared/schemas";

export type AgentName =
  | "ingest"
  | "comprehension"
  | "structure"
  | "planner"
  | "render"
  | "assembly";

/**
 * Discriminated union of every event the orchestrator can emit.
 * The envelope (jobId, seq, ts) is filled in by store.emitEvent.
 */
export type StreamEventInput =
  | { type: "job.status"; data: { status: JobStatus } }
  | { type: "job.completed"; data: { explainer: Explainer } }
  | { type: "job.failed"; data: { error: JobError } }
  | {
      type: "agent.start";
      data: { agent: AgentName; index: number };
    }
  | {
      type: "agent.progress";
      data: { agent: AgentName; note: string };
    }
  | {
      type: "agent.done";
      data: { agent: AgentName; index: number; summary: string };
    }
  | {
      type: "panel.start";
      data: { sectionId: string; index: number; total: number };
    }
  | {
      type: "panel.done";
      data: { panel: RenderedPanel; index: number; total: number };
    };

export type StreamEvent = StreamEventInput & {
  jobId: string;
  seq: number;
  ts: string;
};

export const AGENT_ORDER: AgentName[] = [
  "ingest",
  "comprehension",
  "structure",
  "planner",
  "render",
  "assembly",
];

export function agentIndex(agent: AgentName): number {
  // 1-based to match the spec ("index 1..6")
  return AGENT_ORDER.indexOf(agent) + 1;
}
