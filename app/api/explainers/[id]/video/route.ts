import { NextResponse } from "next/server";
import { z } from "zod";
import { buildVideoHtml, isVideoFormat } from "@/lib/export/buildVideoHtml";
import { htmlToMp4 } from "@/lib/export/videoExport";
import { getBrandKit, getExplainer } from "@/lib/store";
import { getOrCreateUser } from "@/lib/supabase/server";
import { DEFAULT_TEMPLATE_ID, getTemplate } from "@/lib/templates/registry";
import type { BrandKit } from "@/lib/shared/schemas";

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

  const explainer = await getExplainer(params.id);
  if (!explainer) {
    return NextResponse.json(
      { error: "Explainer not found." },
      { status: 404 }
    );
  }

  // Resolve the requesting user's brand kit so the video carries their
  // colors and fonts. Anonymous users get the template's default look.
  let brand: BrandKit | null = null;
  try {
    const { userId, isAnonymous } = await getOrCreateUser();
    if (!isAnonymous) {
      brand = await getBrandKit(userId);
    }
  } catch {
    // Brand lookup is best-effort; fall back to default styling.
  }

  const template = getTemplate(explainer.template);

  try {
    const { html, durationMs, panelsShown } = await buildVideoHtml({
      explainer,
      format,
      template,
      brand,
    });
    const result = await htmlToMp4({
      html,
      format,
      durationMs,
      cacheKeyParts: [
        explainer.id,
        format,
        "v2",
        explainer.updatedAt ?? explainer.createdAt ?? "v0",
        brand?.updatedAt ?? "no-brand",
        explainer.template ?? DEFAULT_TEMPLATE_ID,
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
