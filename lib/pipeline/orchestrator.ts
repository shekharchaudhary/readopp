import { randomUUID } from "node:crypto";
import {
  appendProgress,
  completeJob,
  failJob,
  findCachedExplainer,
  getJob,
  setJobStatus,
  updateJob,
} from "../store";
import { IngestError, ingestUrl } from "../ingest";
import { planExplainer } from "./plan";
import { renderAllPanels } from "./render";
import type { Explainer, JobError, RenderedPanel } from "../shared/schemas";

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
  if (/timeout|aborted/i.test(msg)) {
    return { reason: "timeout", message: "The pipeline timed out." };
  }
  return {
    reason: "unknown",
    message: `Something went wrong: ${msg.slice(0, 240)}`,
  };
}

/**
 * Runs the full Phase 1 pipeline for a job:
 *  ingest -> single plan call -> parallel panel render -> assemble.
 * Mutates the in-memory store; the API exposes job state via polling.
 * Errors are caught and persisted onto the job as `failed`.
 */
export async function runJob(jobId: string): Promise<void> {
  const job = getJob(jobId);
  if (!job) return;

  // Cache hit shortcut
  const cached = findCachedExplainer(job.cacheKey);
  if (cached) {
    completeJob(jobId, cached);
    return;
  }

  try {
    // 1. Ingest
    setJobStatus(jobId, "ingesting");
    appendProgress(jobId, "Fetching article…");
    const article = await ingestUrl(job.url);
    appendProgress(
      jobId,
      `Read “${article.title}” — ${article.wordCount.toLocaleString()} words`
    );

    // 2. Plan (collapsed comprehension + structure + planner)
    setJobStatus(jobId, "planning");
    appendProgress(jobId, "Reading and planning the panels…");
    const plan = await planExplainer(article, job.audienceLevel);
    appendProgress(
      jobId,
      `Planned ${plan.panels.length} panel${plan.panels.length === 1 ? "" : "s"}`
    );

    // Persist plan metadata onto the job so the UI can show the title early
    updateJob(jobId, {
      explainerId: undefined,
    });

    // 3. Render (fan out, capped concurrency, with fallback per panel)
    setJobStatus(jobId, "rendering");
    appendProgress(jobId, "Rendering panels…");
    const headings: Record<string, string> = {};
    plan.panels.forEach((p, i) => {
      headings[p.sectionId] = `Panel ${i + 1}`;
    });
    const panels: RenderedPanel[] = await renderAllPanels(
      plan.panels,
      job.audienceLevel,
      headings
    );

    // 4. Assemble
    setJobStatus(jobId, "assembling");
    const explainer: Explainer = {
      id: randomUUID(),
      jobId,
      url: job.url,
      title: plan.title,
      summary: plan.summary,
      audienceLevel: job.audienceLevel,
      panels,
      createdAt: new Date().toISOString(),
    };

    completeJob(jobId, explainer);
    appendProgress(jobId, "Done.");
  } catch (e) {
    const err = toJobError(e);
    appendProgress(jobId, `Failed: ${err.message}`);
    failJob(jobId, err);
    // eslint-disable-next-line no-console
    console.error("[lucidread] job failed", { jobId, error: e });
  }
}
