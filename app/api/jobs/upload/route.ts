import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { isApiKeyConfigured } from "@/lib/anthropic";
import { extractPdfArticle } from "@/lib/pdf/extract";
import { runJob } from "@/lib/pipeline/orchestrator";
import { stashPreIngested } from "@/lib/pipeline/preIngested";
import { ANON_FREE_LIMIT, quotaFor } from "@/lib/quota";
import { AudienceLevelSchema } from "@/lib/shared/schemas";
import {
  completeJob,
  createJob,
  findCachedExplainer,
} from "@/lib/store";
import { getOrCreateUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

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

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing `file` field." },
      { status: 400 }
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      {
        error: `File is too large (${(file.size / 1_000_000).toFixed(1)} MB). Limit is ${MAX_FILE_BYTES / 1_000_000} MB.`,
      },
      { status: 413 }
    );
  }
  const isPdf =
    file.type === "application/pdf" ||
    /\.pdf$/i.test(file.name || "");
  if (!isPdf) {
    return NextResponse.json(
      { error: "Only PDF files are supported right now." },
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

  const arrayBuf = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuf);
  const hash = createHash("sha256").update(buf).digest("hex").slice(0, 24);
  const filename = file.name || "upload.pdf";
  const fakeUrl = `upload://${filename}`;
  // Cache key is file-content based, so re-uploading the same PDF at the same
  // audience level hits the cache regardless of filename.
  const cacheKey = `pdf:${hash}:${audience.data}`;

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

  const job = createJob({
    url: fakeUrl,
    audienceLevel: audience.data,
    userId,
    cacheKey,
  });

  if (cached) {
    await completeJob(job.id, cached);
    return NextResponse.json({ jobId: job.id, cached: true }, { status: 201 });
  }

  // Extract before kicking off the pipeline so failures surface immediately
  // (rather than in the orchestrator's background job).
  let article;
  try {
    article = await extractPdfArticle({
      buffer: buf,
      filename,
      jobId: job.id,
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Failed to read PDF." },
      { status: 422 }
    );
  }

  stashPreIngested(job.id, article);
  void runJob(job.id);

  return NextResponse.json({ jobId: job.id, cached: false }, { status: 201 });
}
