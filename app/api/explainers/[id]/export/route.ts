import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildAttributionExportHtml,
  buildPanelExportHtml,
  buildStackedExportHtml,
} from "@/lib/export/buildExportHtml";
import { bundleAsZip } from "@/lib/export/bundleZip";
import { htmlToPng } from "@/lib/export/screenshot";
import { isExportFormat } from "@/lib/export/dimensions";
import { getBrandKit, getExplainer } from "@/lib/store";
import { getOrCreateUser } from "@/lib/supabase/server";
import type { BrandKit, Explainer } from "@/lib/shared/schemas";

/** Cache-buster token — bumps whenever a panel or the brand is edited. */
function versionTag(e: Explainer, brand?: BrandKit | null): string {
  return [e.updatedAt ?? e.createdAt ?? "v0", brand?.updatedAt ?? "no-brand"].join(":");
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Playwright screenshot can take a few seconds

const RequestSchema = z.object({
  format: z.enum(["square", "vertical", "landscape"]),
  panelId: z.string().optional(), // section id, or omit for whole-explainer
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

  const explainer = await getExplainer(params.id);
  if (!explainer) {
    return NextResponse.json(
      { error: "Explainer not found." },
      { status: 404 }
    );
  }

  // Resolve the requesting user's brand kit so exports carry their color,
  // font, logo, and headline. Anonymous users get the default Readopp look.
  let brand: BrandKit | null = null;
  try {
    const { userId, isAnonymous } = await getOrCreateUser();
    if (!isAnonymous) {
      brand = await getBrandKit(userId);
    }
  } catch {
    // Brand lookup is best-effort; fall back to default styling.
  }

  const { format, panelId } = parsed.data;
  if (!isExportFormat(format)) {
    return NextResponse.json({ error: "Invalid format." }, { status: 400 });
  }

  try {
    if (panelId) {
      const panelIndex = explainer.panels.findIndex(
        (p) => p.sectionId === panelId
      );
      if (panelIndex === -1) {
        return NextResponse.json(
          { error: "Panel not found in this explainer." },
          { status: 404 }
        );
      }
      const panel = explainer.panels[panelIndex];
      const html = await buildPanelExportHtml({
        explainer,
        panel,
        format,
        panelIndex: panelIndex + 1,
        totalPanels: explainer.panels.length,
        brand,
      });
      const result = await htmlToPng({
        html,
        format,
        cacheKeyParts: [explainer.id, panelId, format, versionTag(explainer, brand)],
      });
      return NextResponse.json({
        url: result.url,
        format: result.format,
        width: result.width,
        height: result.height,
        cached: result.cached,
      });
    }

    // Whole-explainer export.
    if (format === "vertical") {
      const html = await buildStackedExportHtml({ explainer, format, brand });
      const result = await htmlToPng({
        html,
        format,
        cacheKeyParts: [explainer.id, "all", format, versionTag(explainer, brand)],
      });
      return NextResponse.json({
        url: result.url,
        format: result.format,
        width: result.width,
        height: result.height,
        cached: result.cached,
        kind: "stacked",
      });
    }

    // square/landscape: return one image per panel as a set, PLUS one
    // attribution slide at the end pointing back to the source.
    const images = [] as {
      url: string;
      width: number;
      height: number;
      sectionId: string;
      panelIndex: number;
      kind: "panel" | "attribution";
    }[];
    // We keep on-disk paths for the ZIP step; clients only see URLs.
    const filePaths: string[] = [];
    const entryNames: string[] = [];
    const slug = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 60);
    for (let i = 0; i < explainer.panels.length; i++) {
      const panel = explainer.panels[i];
      const html = await buildPanelExportHtml({
        explainer,
        panel,
        format,
        panelIndex: i + 1,
        totalPanels: explainer.panels.length,
      });
      const result = await htmlToPng({
        html,
        format,
        cacheKeyParts: [explainer.id, panel.sectionId, format, versionTag(explainer, brand)],
      });
      images.push({
        url: result.url,
        width: result.width,
        height: result.height,
        sectionId: panel.sectionId,
        panelIndex: i + 1,
        kind: "panel",
      });
      filePaths.push(result.filePath);
      entryNames.push(
        `${String(i + 1).padStart(2, "0")}-${slug(panel.heading || panel.sectionId)}.png`
      );
    }
    // Source-attribution slide — viewers see this at the end of the
    // carousel and know exactly where to go for the original piece.
    const attrHtml = await buildAttributionExportHtml({
      explainer,
      format,
      brand,
    });
    const attrResult = await htmlToPng({
      html: attrHtml,
      format,
      cacheKeyParts: [
        explainer.id,
        "__attribution__",
        format,
        versionTag(explainer, brand),
      ],
    });
    images.push({
      url: attrResult.url,
      width: attrResult.width,
      height: attrResult.height,
      sectionId: "__attribution__",
      panelIndex: explainer.panels.length + 1,
      kind: "attribution",
    });
    filePaths.push(attrResult.filePath);
    entryNames.push(
      `${String(explainer.panels.length + 1).padStart(2, "0")}-source.png`
    );
    // Bundle everything into one zip the user can download in one click.
    const zip = await bundleAsZip({
      filePaths,
      entryNames,
      cacheKeyParts: [explainer.id, format, versionTag(explainer, brand)],
      baseName: `readopp-${slug(explainer.title || explainer.id)}-${format}`,
    });
    return NextResponse.json({
      format,
      images,
      kind: "set",
      zipUrl: zip.url,
      zipName: zip.filename,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[readopp] export failed", e);
    return NextResponse.json(
      {
        error:
          "Export failed. If this is the first run, Chromium may still be downloading.",
      },
      { status: 500 }
    );
  }
}
