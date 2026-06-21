import { runAssembly } from "../agents/assembly";
import { runComprehension, summarizeComprehension } from "../agents/comprehension";
import { IngestError, runIngest } from "../agents/ingest";
import { runPlanner } from "../agents/planner";
import { runRenderPanel } from "../agents/render";
import { runSocialPack } from "../agents/socialPack";
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
import { drainPendingPdf, drainPreIngested } from "./preIngested";
import { extractPdfArticle } from "../pdf/extract";
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

async function emitStatus(jobId: string, status: JobStatus) {
  await setJobStatus(jobId, status);
  await emitEvent(jobId, { type: "job.status", data: { status } });
}

async function emitAgentStart(jobId: string, agent: AgentName) {
  await emitEvent(jobId, {
    type: "agent.start",
    data: { agent, index: agentIndex(agent) },
  });
}

async function emitAgentProgress(jobId: string, agent: AgentName, note: string) {
  await appendProgress(jobId, note);
  await emitEvent(jobId, { type: "agent.progress", data: { agent, note } });
}

async function emitAgentDone(jobId: string, agent: AgentName, summary: string) {
  await emitEvent(jobId, {
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
  const job = await getJob(jobId);
  if (!job) return;

  // Cache hit shortcut (per-user — RLS scoping happens inside the store)
  if (!job.userId) {
    await failJob(jobId, { reason: "unknown", message: "Job has no owner." });
    return;
  }
  const cached = await findCachedExplainer(job.userId, job.cacheKey);
  if (cached) {
    await completeJob(jobId, cached);
    await emitEvent(jobId, {
      type: "job.completed",
      data: { explainer: cached },
    });
    return;
  }

  try {
    // 1. Ingest
    await emitStatus(jobId, "ingesting");
    await emitAgentStart(jobId, "ingest");
    const preIngested = drainPreIngested(jobId);
    const pendingPdf = preIngested ? null : drainPendingPdf(jobId);
    let article;
    if (preIngested) {
      // Article was already extracted before the orchestrator started.
      await emitAgentProgress(jobId, "ingest", "Reading prepared document…");
      article = preIngested;
    } else if (pendingPdf) {
      // PDF upload path — extraction runs HERE, not in the upload route,
      // so the user sees the job stream + progress UI instead of waiting
      // 30–60s on an "Uploading…" spinner.
      await emitAgentProgress(
        jobId,
        "ingest",
        `Reading PDF "${pendingPdf.filename}"…`
      );
      article = await extractPdfArticle({
        buffer: pendingPdf.buffer,
        filename: pendingPdf.filename,
        jobId,
      });
      await emitAgentProgress(
        jobId,
        "ingest",
        `Extracted ${article.wordCount.toLocaleString()} words from PDF`
      );
    } else {
      // Pipe ingest's internal stage messages straight into the agent's
      // progress channel. Without this the UI shows "Fetching article…"
      // for 60–90s whenever a site falls into the Playwright fallback
      // (cold Chromium launch + networkidle wait), leaving the user
      // thinking the pipeline froze.
      article = await runIngest(job.url, {
        onProgress: (msg) => {
          void emitAgentProgress(jobId, "ingest", msg);
        },
      });
      await emitAgentProgress(
        jobId,
        "ingest",
        `Stripped nav & ads, ${article.wordCount.toLocaleString()} words`
      );
    }
    await emitAgentDone(
      jobId,
      "ingest",
      `Read “${article.title}” — ${article.wordCount.toLocaleString()} words`
    );

    // 2. Comprehension
    await emitStatus(jobId, "comprehending");
    await emitAgentStart(jobId, "comprehension");
    await emitAgentProgress(jobId, "comprehension", "Reading for the core idea…");
    const comprehension = await runComprehension(
      article,
      job.audienceLevel,
      jobId
    );
    await emitAgentDone(
      jobId,
      "comprehension",
      summarizeComprehension(comprehension)
    );

    // 3. Structure
    await emitStatus(jobId, "structuring");
    await emitAgentStart(jobId, "structure");
    await emitAgentProgress(jobId, "structure", "Choosing panel types…");
    const outline = await runStructure(comprehension, jobId);
    await emitAgentDone(jobId, "structure", summarizeOutline(outline));

    // 4. Planner — one call per section, sequential is fine and cheaper to debug.
    // If one section's planner fails after retries we skip it and continue, so
    // a single bad panel can't kill the whole explainer.
    await emitStatus(jobId, "planning");
    await emitAgentStart(jobId, "planner");
    const plans = [];
    let skipped = 0;
    for (let i = 0; i < outline.sections.length; i++) {
      const section = outline.sections[i];
      await emitAgentProgress(
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
        await emitAgentProgress(
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
    await emitAgentDone(jobId, "planner", doneNote);

    // 5. Render — fan out per panel; emit panel.start / panel.done
    await emitStatus(jobId, "rendering");
    await emitAgentStart(jobId, "render");
    const panels: RenderedPanel[] = await renderAllPanelsStreaming({
      jobId,
      plans,
      audience: job.audienceLevel,
      sourceUrl: job.url,
      // Genre is one of the strongest signals for reference retrieval —
      // a tech-essay reference shouldn't surface against a research-paper
      // query even when the captions look similar.
      genre: comprehension.genre,
      headings: Object.fromEntries(
        outline.sections.map((s) => [s.id, s.heading])
      ),
    });
    await emitAgentDone(jobId, "render", `Rendered ${panels.length} panels`);

    // 6. Assembly
    await emitStatus(jobId, "assembling");
    await emitAgentStart(jobId, "assembly");
    const baseExplainer: Explainer = runAssembly({
      jobId,
      url: job.url,
      audienceLevel: job.audienceLevel,
      outline,
      comprehension,
      panels,
    });
    await emitAgentDone(jobId, "assembly", "Assembled explainer");

    // 7. Social pack — caption + hashtags + alt-texts, so the explainer
    //    is ready to actually POST, not just look at. Failure here is
    //    non-fatal: we ship the explainer without a pack and the user
    //    can regenerate from the export sheet.
    await emitAgentStart(jobId, "social");
    await emitAgentProgress(jobId, "social", "Writing your post caption…");
    let explainer: Explainer = baseExplainer;
    try {
      const socialPack = await runSocialPack(
        baseExplainer,
        comprehension,
        jobId
      );
      explainer = { ...baseExplainer, socialPack };
      await emitAgentDone(
        jobId,
        "social",
        `Caption + ${socialPack.hashtags.length} hashtag${socialPack.hashtags.length === 1 ? "" : "s"}`
      );
    } catch (e) {
      const msg = (e as Error).message?.slice(0, 160) ?? "unknown";
      await emitAgentProgress(jobId, "social", `Skipped — ${msg}`);
      await emitAgentDone(
        jobId,
        "social",
        "Skipped — refresh from the export sheet"
      );
      // eslint-disable-next-line no-console
      console.warn("[readopp] socialPack failed", { jobId, error: e });
    }

    await completeJob(jobId, explainer);
    await emitEvent(jobId, { type: "job.completed", data: { explainer } });
  } catch (e) {
    const err = toJobError(e);
    await appendProgress(jobId, `Failed: ${err.message}`);
    await failJob(jobId, err);
    await emitEvent(jobId, { type: "job.failed", data: { error: err } });
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
  /** Source URL of the explainer; used to derive the host label that
   *  Tier C templates print in their footer. */
  sourceUrl?: string;
  /** Comprehension.genre — threaded into renderPanel so reference-RAG
   *  retrieval can score on it. */
  genre?: string;
}): Promise<RenderedPanel[]> {
  const { jobId, plans, audience, headings, sourceUrl, genre } = input;
  const total = plans.length;
  const out: RenderedPanel[] = new Array(total);
  let cursor = 0;
  const { sourceLabel } = await import("../shared/source");
  const source = sourceUrl ? sourceLabel(sourceUrl) : undefined;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= total) return;
      const plan = plans[i];
      await emitEvent(jobId, {
        type: "panel.start",
        data: { sectionId: plan.sectionId, index: i + 1, total },
      });
      let panel: RenderedPanel;
      try {
        panel = await runRenderPanel(
          plan,
          audience,
          headings[plan.sectionId] || `Panel ${i + 1}`,
          jobId,
          { source, slide: { index: i + 1, total } },
          { genre }
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
      await emitEvent(jobId, {
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
