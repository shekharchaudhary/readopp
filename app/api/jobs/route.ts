import { NextResponse } from "next/server";
import { CreateJobRequestSchema } from "@/lib/shared/schemas";
import { createJob, findCachedExplainer, cacheKeyFor, completeJob } from "@/lib/store";
import { runJob } from "@/lib/pipeline/orchestrator";
import { isApiKeyConfigured } from "@/lib/anthropic";
import { getOrCreateUserId } from "@/lib/supabase/server";

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

  // Anonymous sign-in if needed. Every job has an owner from this point on,
  // even before the user signs in with a real identity.
  let userId: string;
  try {
    userId = await getOrCreateUserId();
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }

  // Cache-key short-circuit (per-user): if this user has already generated
  // this exact (url + audience), reuse it.
  const key = cacheKeyFor(url, audienceLevel);
  const cached = await findCachedExplainer(userId, key);

  const job = createJob({ url, audienceLevel, userId });

  if (cached) {
    await completeJob(job.id, cached);
    return NextResponse.json({ jobId: job.id, cached: true }, { status: 201 });
  }

  void runJob(job.id);

  return NextResponse.json({ jobId: job.id, cached: false }, { status: 201 });
}
