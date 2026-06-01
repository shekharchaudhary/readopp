import { runAssembly } from "../agents/assembly";
import { runComprehension, summarizeComprehension } from "../agents/comprehension";
import { IngestError, runIngest } from "../agents/ingest";
import { runPlanner } from "../agents/planner";
import { runRenderPanel } from "../agents/render";
import { runStructure, summarizeOutline } from "../agents/structure";
import { agentIndex, type AgentName } from "../events";
import { buildFallbackPanel } from "../render/fallbackPanel";
import {
  appendProgress,
  completeJob,
  emitEvent,
  failJob,
  findCachedExplainer,
  getJob,
  setJobStatus,
} from "../store";
import type {
  Explainer,
  JobError,
  JobStatus,
  RenderedPanel,
} from "../shared/schemas";

function toJobError(e: unknown): JobError {
  if (e instanceof IngestError) return e.error;
  const msg = e instanceof Error ? e.message : String(e);
  if (/ANTHROPIC_API_KEY/.test(msg)) {
    return {
      reason: "unknown",
      message:
        "The server is missing ANTHROPIC_API_KEY — add it to .env.local and restart.",
    };
  }
  if (/comprehension failed/i.test(msg)) {
    return { reason: "comprehension_failed", message: msg };
  }
  if (/structure failed|planner\[/i.test(msg)) {
    return { reason: "comprehension_failed", message: msg };
  }
  if (/timeout|aborted/i.test(msg)) {
    return { reason: "timeout", message: "The pipeline timed out." };
  }
  return {
    reason: "unknown",
    message: `Something went wrong: ${msg.slice(0, 240)}`,
  };
}

function emitStatus(jobId: string, status: JobStatus) {
  setJobStatus(jobId, status);
  emitEvent(jobId, { type: "job.status", data: { status } });
}

function emitAgentStart(jobId: string, agent: AgentName) {
  emitEvent(jobId, {
    type: "agent.start",
    data: { agent, index: agentIndex(agent) },
  });
}

function emitAgentProgress(jobId: string, agent: AgentName, note: string) {
  appendProgress(jobId, note);
  emitEvent(jobId, { type: "agent.progress", data: { agent, note } });
}

function emitAgentDone(jobId: string, agent: AgentName, summary: string) {
  emitEvent(jobId, {
    type: "agent.done",
    data: { agent, index: agentIndex(agent), summary },
  });
}

const RENDER_CONCURRENCY = 4;

/**
 * Drives the full 6-agent pipeline for a job. Mutates the in-memory store and
 * pushes SSE events via emitEvent. Errors are caught and recorded on the job.
 */
export async function runJob(jobId: string): Promise<void> {
  const job = getJob(jobId);
  if (!job) return;

  // Cache hit shortcut
  const cached = findCachedExplainer(job.cacheKey);
  if (cached) {
    completeJob(jobId, cached);
    emitEvent(jobId, {
      type: "job.completed",
      data: { explainer: cached },
    });
    return;
  }

  try {
    // 1. Ingest
    emitStatus(jobId, "ingesting");
    emitAgentStart(jobId, "ingest");
    emitAgentProgress(jobId, "ingest", "Fetching article…");
    const article = await runIngest(job.url);
    emitAgentProgress(
      jobId,
      "ingest",
      `Stripped nav & ads, ${article.wordCount.toLocaleString()} words`
    );
    emitAgentDone(
      jobId,
      "ingest",
      `Read “${article.title}” — ${article.wordCount.toLocaleString()} words`
    );

    // 2. Comprehension
    emitStatus(jobId, "comprehending");
    emitAgentStart(jobId, "comprehension");
    emitAgentProgress(jobId, "comprehension", "Reading for the core idea…");
    const comprehension = await runComprehension(
      article,
      job.audienceLevel,
      jobId
    );
    emitAgentDone(
      jobId,
      "comprehension",
      summarizeComprehension(comprehension)
    );

    // 3. Structure
    emitStatus(jobId, "structuring");
    emitAgentStart(jobId, "structure");
    emitAgentProgress(jobId, "structure", "Choosing panel types…");
    const outline = await runStructure(comprehension, jobId);
    emitAgentDone(jobId, "structure", summarizeOutline(outline));

    // 4. Planner — one call per section, sequential is fine and cheaper to debug.
    // If one section's planner fails after retries we skip it and continue, so
    // a single bad panel can't kill the whole explainer.
    emitStatus(jobId, "planning");
    emitAgentStart(jobId, "planner");
    const plans = [];
    let skipped = 0;
    for (let i = 0; i < outline.sections.length; i++) {
      const section = outline.sections[i];
      emitAgentProgress(
        jobId,
        "planner",
        `Designing panel ${i + 1} of ${outline.sections.length}…`
      );
      try {
        const plan = await runPlanner(
          section,
          comprehension,
          job.audienceLevel,
          jobId
        );
        plans.push(plan);
      } catch (e) {
        skipped++;
        const msg = (e as Error).message?.slice(0, 200) ?? "unknown";
        emitAgentProgress(
          jobId,
          "planner",
          `Skipped panel ${i + 1} (${section.heading}) — ${msg}`
        );
        // eslint-disable-next-line no-console
        console.warn("[readopp] planner skipped section", {
          jobId,
          sectionId: section.id,
          error: e,
        });
      }
    }
    if (plans.length === 0) {
      throw new Error(
        "planner produced no valid panels for any section of the outline"
      );
    }
    const doneNote =
      skipped > 0
        ? `Designed ${plans.length} panel${plans.length === 1 ? "" : "s"} (skipped ${skipped})`
        : `Designed layouts for ${plans.length} panel${plans.length === 1 ? "" : "s"}`;
    emitAgentDone(jobId, "planner", doneNote);

    // 5. Render — fan out per panel; emit panel.start / panel.done
    emitStatus(jobId, "rendering");
    emitAgentStart(jobId, "render");
    const panels: RenderedPanel[] = await renderAllPanelsStreaming({
      jobId,
      plans,
      audience: job.audienceLevel,
      headings: Object.fromEntries(
        outline.sections.map((s) => [s.id, s.heading])
      ),
    });
    emitAgentDone(jobId, "render", `Rendered ${panels.length} panels`);

    // 6. Assembly
    emitStatus(jobId, "assembling");
    emitAgentStart(jobId, "assembly");
    const explainer: Explainer = runAssembly({
      jobId,
      url: job.url,
      audienceLevel: job.audienceLevel,
      outline,
      comprehension,
      panels,
    });
    completeJob(jobId, explainer);
    emitAgentDone(jobId, "assembly", "Assembled explainer");
    emitEvent(jobId, { type: "job.completed", data: { explainer } });
  } catch (e) {
    const err = toJobError(e);
    appendProgress(jobId, `Failed: ${err.message}`);
    failJob(jobId, err);
    emitEvent(jobId, { type: "job.failed", data: { error: err } });
    // eslint-disable-next-line no-console
    console.error("[readopp] job failed", { jobId, error: e });
  }
}

/**
 * Per-panel render with streaming events. Capped concurrency.
 * Each panel emits panel.start before its render begins and panel.done when it lands.
 */
async function renderAllPanelsStreaming(input: {
  jobId: string;
  plans: import("../shared/schemas").PanelPlan[];
  audience: import("../shared/schemas").AudienceLevel;
  headings: Record<string, string>;
}): Promise<RenderedPanel[]> {
  const { jobId, plans, audience, headings } = input;
  const total = plans.length;
  const out: RenderedPanel[] = new Array(total);
  let cursor = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= total) return;
      const plan = plans[i];
      emitEvent(jobId, {
        type: "panel.start",
        data: { sectionId: plan.sectionId, index: i + 1, total },
      });
      let panel: RenderedPanel;
      try {
        panel = await runRenderPanel(
          plan,
          audience,
          headings[plan.sectionId] || `Panel ${i + 1}`,
          jobId
        );
      } catch (e) {
        // Never propagate — fall back so the rest of the explainer survives
        panel = buildFallbackPanel(
          plan.sectionId,
          headings[plan.sectionId] || `Panel ${i + 1}`,
          plan.caption || ""
        );
      }
      out[i] = panel;
      emitEvent(jobId, {
        type: "panel.done",
        data: { panel, index: i + 1, total },
      });
    }
  }

  const workers = Array.from(
    { length: Math.min(RENDER_CONCURRENCY, total) },
    worker
  );
  await Promise.all(workers);
  return out;
}
