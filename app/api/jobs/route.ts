import { NextResponse } from "next/server";
import { CreateJobRequestSchema } from "@/lib/shared/schemas";
import { createJob, findCachedExplainer, cacheKeyFor, completeJob } from "@/lib/store";
import { runJob } from "@/lib/pipeline/orchestrator";
import { isApiKeyConfigured } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body must be valid JSON." },
      { status: 400 }
    );
  }

  const parsed = CreateJobRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  if (!isApiKeyConfigured()) {
    return NextResponse.json(
      {
        error:
          "Server is missing ANTHROPIC_API_KEY. Add it to .env.local and restart.",
      },
      { status: 500 }
    );
  }

  const { url, audienceLevel } = parsed.data;

  // Cache-key short-circuit: if we already have an explainer for this (url+audience),
  // create a "completed" job that points at it so the UI just renders.
  const key = cacheKeyFor(url, audienceLevel);
  const cached = findCachedExplainer(key);

  const job = createJob({ url, audienceLevel });

  if (cached) {
    completeJob(job.id, cached);
    return NextResponse.json({ jobId: job.id, cached: true }, { status: 201 });
  }

  // Fire-and-forget. The route returns immediately; the client polls /api/jobs/[id].
  // (Phase 1: no SSE yet.)
  void runJob(job.id);

  return NextResponse.json({ jobId: job.id, cached: false }, { status: 201 });
}
