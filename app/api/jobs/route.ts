import { NextResponse } from "next/server";
import { CreateJobRequestSchema } from "@/lib/shared/schemas";
import { createJob, findCachedExplainer, cacheKeyFor, completeJob } from "@/lib/store";
import { enqueueJob } from "@/lib/pipeline/runner";
import "@/lib/pipeline/registerRunner";
import { isApiKeyConfigured } from "@/lib/anthropic";
import { getOrCreateUser } from "@/lib/supabase/server";
import { ANON_FREE_LIMIT, quotaFor } from "@/lib/quota";
import { trackProductEvent } from "@/lib/analytics";

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

  const { url, audienceLevel, style, publishingGoal, voiceProfileId } = parsed.data;

  // Anonymous sign-in if needed. Every job has an owner from this point on,
  // even before the user signs in with a real identity.
  let userId: string;
  let isAnonymous: boolean;
  try {
    ({ userId, isAnonymous } = await getOrCreateUser());
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }

  // Cache-key short-circuit (per-user): if this user has already generated
  // this exact (url + audience), reuse it without counting against the
  // free-tier quota.
  const key = cacheKeyFor(url, audienceLevel, style, publishingGoal, voiceProfileId);
  const cached = await findCachedExplainer(userId, key);

  if (!cached) {
    // Block anonymous users who have already used their free generations.
    // Cache hits are exempt — re-pasting the same URL doesn't burn a credit.
    const quota = await quotaFor(userId, isAnonymous);
    if (quota.blocked) {
      return NextResponse.json(
        {
          error: "free_limit_reached",
          message: `You've used your ${ANON_FREE_LIMIT} free generations. Sign in to keep generating.`,
          quota,
        },
        { status: 402 }
      );
    }
  }

  const job = await createJob({ url, audienceLevel, style, publishingGoal, voiceProfileId, userId });
  void trackProductEvent({ userId, name: "job_started", properties: { audienceLevel, style, publishingGoal, cached: Boolean(cached), sourceType: "url" } });

  if (cached) {
    await completeJob(job.id, cached);
    return NextResponse.json({ jobId: job.id, cached: true }, { status: 201 });
  }

  enqueueJob(job.id);

  return NextResponse.json({ jobId: job.id, cached: false }, { status: 201 });
}
