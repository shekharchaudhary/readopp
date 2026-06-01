import { NextResponse } from "next/server";
import { z } from "zod";
import { buildVideoHtml, isVideoFormat } from "@/lib/export/buildVideoHtml";
import { htmlToMp4 } from "@/lib/export/videoExport";
import { getExplainer } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // record + transcode can take a minute

const RequestSchema = z.object({
  format: z.enum(["vertical", "square"]),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const { format } = parsed.data;
  if (!isVideoFormat(format)) {
    return NextResponse.json({ error: "Invalid format." }, { status: 400 });
  }

  const explainer = getExplainer(params.id);
  if (!explainer) {
    return NextResponse.json(
      { error: "Explainer not found." },
      { status: 404 }
    );
  }

  try {
    const { html, durationMs, panelsShown } = await buildVideoHtml({
      explainer,
      format,
    });
    const result = await htmlToMp4({
      html,
      format,
      durationMs,
      cacheKeyParts: [
        explainer.id,
        format,
        "v1",
        explainer.updatedAt ?? explainer.createdAt ?? "v0",
      ],
    });
    return NextResponse.json({
      url: result.url,
      format: result.format,
      width: result.width,
      height: result.height,
      durationMs: result.durationMs,
      panelsShown,
      cached: result.cached,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[readopp] video export failed", e);
    return NextResponse.json(
      {
        error:
          (e as Error)?.message?.slice(0, 300) ||
          "Video export failed. Check server logs.",
      },
      { status: 500 }
    );
  }
}
