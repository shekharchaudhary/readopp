import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { isApiKeyConfigured } from "@/lib/anthropic";
import { extractUploadedDocument } from "@/lib/documents/extractUpload";
import {
  documentUploadType,
  MAX_UPLOAD_BYTES,
} from "@/lib/documents/uploadTypes";
import { enqueueJob } from "@/lib/pipeline/runner";
import "@/lib/pipeline/registerRunner";
import {
  stashPendingPdf,
  stashPreIngested,
} from "@/lib/pipeline/preIngested";
import { ANON_FREE_LIMIT, quotaFor } from "@/lib/quota";
import { AudienceLevelSchema, BrandStyleSchema, PublishingGoalSchema, VoiceProfileIdSchema } from "@/lib/shared/schemas";
import {
  completeJob,
  createJob,
  findCachedExplainer,
} from "@/lib/store";
import { getOrCreateUser } from "@/lib/supabase/server";
import { trackProductEvent } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isApiKeyConfigured()) {
    return NextResponse.json(
      {
        error:
          "Server is missing ANTHROPIC_API_KEY. Add it to .env.local and restart.",
      },
      { status: 500 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Request must be multipart/form-data." },
      { status: 400 }
    );
  }

  const file = form.get("file");
  const audienceRaw = (form.get("audienceLevel") as string | null) ?? "general";
  const styleRaw = (form.get("style") as string | null) ?? "editorial";
  const goalRaw = (form.get("publishingGoal") as string | null) ?? "teach";
  const voiceRaw = (form.get("voiceProfileId") as string | null) ?? "clear_expert";

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing `file` field." },
      { status: 400 }
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: `File is too large (${(file.size / 1_000_000).toFixed(1)} MB). Limit is ${MAX_UPLOAD_BYTES / 1_000_000} MB.`,
      },
      { status: 413 }
    );
  }
  const filename = file.name || "uploaded-document";
  const uploadType = documentUploadType(filename, file.type);
  if (!uploadType) {
    return NextResponse.json(
      { error: "Upload a PDF, Word (.docx), Markdown, or text document." },
      { status: 415 }
    );
  }

  const audience = AudienceLevelSchema.safeParse(audienceRaw);
  if (!audience.success) {
    return NextResponse.json(
      { error: "Invalid audienceLevel." },
      { status: 400 }
    );
  }

  const style = BrandStyleSchema.safeParse(styleRaw);
  if (!style.success) {
    return NextResponse.json({ error: "Invalid style." }, { status: 400 });
  }
  const goal = PublishingGoalSchema.safeParse(goalRaw);
  if (!goal.success) return NextResponse.json({ error: "Invalid publishingGoal." }, { status: 400 });
  const voice = VoiceProfileIdSchema.safeParse(voiceRaw);
  if (!voice.success) return NextResponse.json({ error: "Invalid voiceProfileId." }, { status: 400 });

  const arrayBuf = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuf);
  let preparedArticle: Awaited<
    ReturnType<typeof extractUploadedDocument>
  > | null = null;
  if (uploadType !== "pdf") {
    try {
      preparedArticle = await extractUploadedDocument({
        buffer: buf,
        filename,
        type: uploadType,
      });
    } catch (error) {
      return NextResponse.json(
        { error: (error as Error).message || "Could not read this document." },
        { status: 422 }
      );
    }
  }

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

  const hash = createHash("sha256").update(buf).digest("hex").slice(0, 24);
  const fakeUrl = `upload://${filename}`;
  // Cache key is file-content based, so re-uploading the same document at the same
  // audience level + style hits the cache regardless of filename.
  const cacheKey = `document:${uploadType}:${hash}:${audience.data}:${style.data}:${goal.data}:${voice.data}`;

  // Cache short-circuit (same per-user as URL flow).
  const cached = await findCachedExplainer(userId, cacheKey);

  if (!cached) {
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

  const job = await createJob({
    url: fakeUrl,
    audienceLevel: audience.data,
    style: style.data,
    publishingGoal: goal.data,
    voiceProfileId: voice.data,
    userId,
    cacheKey,
  });
  void trackProductEvent({ userId, name: "job_started", properties: { audienceLevel: audience.data, style: style.data, publishingGoal: goal.data, cached: Boolean(cached), sourceType: uploadType } });

  if (cached) {
    await completeJob(job.id, cached);
    return NextResponse.json({ jobId: job.id, cached: true }, { status: 201 });
  }

  // PDFs still use the vision-aware extraction stage. Word and text files
  // are already readable, so hand their normalized article directly to the
  // orchestrator and keep the same progress UI for every source type.
  if (preparedArticle) stashPreIngested(job.id, preparedArticle);
  else stashPendingPdf(job.id, { buffer: buf, filename });
  enqueueJob(job.id);

  return NextResponse.json({ jobId: job.id, cached: false }, { status: 201 });
}
