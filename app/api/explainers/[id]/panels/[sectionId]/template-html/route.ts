import { NextResponse } from "next/server";
import { isExportFormat } from "@/lib/export/dimensions";
import { getBrandKit, getExplainer } from "@/lib/store";
import { getOrCreateUser } from "@/lib/supabase/server";
import { getTemplate } from "@/lib/templates/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the template-rendered HTML for a single panel — the same HTML
 * the export pipeline would screenshot. The explainer page embeds this
 * in a sandboxed iframe so the in-page preview matches the export, so
 * picking a template gives instant visual feedback.
 *
 * Defaults to square format because the in-page panel cards are
 * roughly 1:1. Callers can request a different aspect via ?format=.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string; sectionId: string } }
) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "square";
  if (!isExportFormat(format)) {
    return NextResponse.json({ error: "Invalid format." }, { status: 400 });
  }

  const explainer = await getExplainer(params.id);
  if (!explainer) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const panelIndex = explainer.panels.findIndex(
    (p) => p.sectionId === params.sectionId
  );
  if (panelIndex === -1) {
    return NextResponse.json({ error: "Panel not found." }, { status: 404 });
  }

  // Brand lookup is best-effort — anonymous viewers just get default styling.
  let brand = null;
  try {
    const { userId, isAnonymous } = await getOrCreateUser();
    if (!isAnonymous) brand = await getBrandKit(userId);
  } catch {
    // ignore — render with default brand
  }

  const template = getTemplate(explainer.template);
  const html = await template.renderPanel({
    explainer,
    panel: explainer.panels[panelIndex],
    format,
    panelIndex: panelIndex + 1,
    totalPanels: explainer.panels.length,
    brand,
  });

  // Return as HTML so iframes can drop it in via srcDoc, and so view-source
  // works for debugging without a JSON unwrap step.
  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
