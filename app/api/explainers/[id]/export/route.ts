import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildPanelExportHtml,
  buildStackedExportHtml,
} from "@/lib/export/buildExportHtml";
import { htmlToPng } from "@/lib/export/screenshot";
import { isExportFormat } from "@/lib/export/dimensions";
import { getExplainer } from "@/lib/store";
import type { Explainer } from "@/lib/shared/schemas";

/** Cache-buster token — bumps whenever a panel is edited. */
function versionTag(e: Explainer): string {
  return e.updatedAt ?? e.createdAt ?? "v0";
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

  const explainer = getExplainer(params.id);
  if (!explainer) {
    return NextResponse.json(
      { error: "Explainer not found." },
      { status: 404 }
    );
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
      });
      const result = await htmlToPng({
        html,
        format,
        cacheKeyParts: [explainer.id, panelId, format, versionTag(explainer)],
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
      const html = await buildStackedExportHtml({ explainer, format });
      const result = await htmlToPng({
        html,
        format,
        cacheKeyParts: [explainer.id, "all", format, versionTag(explainer)],
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

    // square/landscape: return one image per panel as a set
    const images = [] as {
      url: string;
      width: number;
      height: number;
      sectionId: string;
      panelIndex: number;
    }[];
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
        cacheKeyParts: [explainer.id, panel.sectionId, format, versionTag(explainer)],
      });
      images.push({
        url: result.url,
        width: result.width,
        height: result.height,
        sectionId: panel.sectionId,
        panelIndex: i + 1,
      });
    }
    return NextResponse.json({
      format,
      images,
      kind: "set",
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
