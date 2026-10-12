import { NextResponse } from "next/server";
import { isExportFormat } from "@/lib/export/dimensions";
import { TemplateIdSchema } from "@/lib/shared/schemas";
import { getBrandKit, getExplainer, getExplainerOwner } from "@/lib/store";
import { getTemplate } from "@/lib/templates/registry";
import { renderPanelWithCanvasOverride } from "@/lib/templates/canvasOverride";
import {
  panelLayoutCompatibility,
  PANEL_LAYOUT_IDS,
  templateSupportsPanelLayouts,
  type PanelLayoutId,
} from "@/lib/templates/panelLayouts";

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
  const requestedLayout = url.searchParams.get("layout");
  const requestedTemplate = url.searchParams.get("template");
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

  // A shared story must retain its author's visual identity. Resolve the
  // owner's brand directly instead of applying the viewer's kit (or minting
  // an anonymous auth user on this public read path).
  let brand = null;
  try {
    const ownerId = await getExplainerOwner(params.id);
    if (ownerId) brand = await getBrandKit(ownerId);
  } catch {
    // ignore — render with default brand
  }

  const parsedTemplate = requestedTemplate
    ? TemplateIdSchema.safeParse(requestedTemplate)
    : null;
  if (parsedTemplate && !parsedTemplate.success) {
    return NextResponse.json({ error: "Invalid template preview." }, { status: 400 });
  }
  const template = getTemplate(
    parsedTemplate?.success ? parsedTemplate.data : explainer.template
  );
  const storedPanel = explainer.panels[panelIndex];
  let panel = storedPanel;
  if (requestedLayout) {
    if (
      !templateSupportsPanelLayouts(template.id) ||
      !PANEL_LAYOUT_IDS.includes(requestedLayout as PanelLayoutId)
    ) {
      return NextResponse.json({ error: "Invalid layout preview." }, { status: 400 });
    }
    const layout = requestedLayout as PanelLayoutId;
    const compatibility = panelLayoutCompatibility(storedPanel, layout);
    if (!compatibility.compatible) {
      return NextResponse.json(
        { error: compatibility.reason ?? "Layout is not compatible with this panel." },
        { status: 422 }
      );
    }
    panel = { ...storedPanel, layoutVariant: layout };
  }
  const html = await renderPanelWithCanvasOverride(template, {
    explainer,
    panel,
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
      "content-security-policy": "sandbox; default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; img-src data:; font-src data: https://fonts.gstatic.com; base-uri 'none'; form-action 'none'",
      "x-content-type-options": "nosniff",
    },
  });
}
