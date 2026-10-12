import { NextResponse } from "next/server";
import {
  getBrandKit,
  getExplainer,
  getExplainerOwner,
} from "@/lib/store";
import { getCurrentUserId } from "@/lib/supabase/server";
import { canvasSeedVersion } from "@/lib/editor/canvasSeed";
import { createEditableTemplateScene } from "@/lib/editor/templateScene";
import { DEFAULT_TEMPLATE_ID } from "@/lib/templates/default";
import { chooseTemplatePanelLayout } from "@/lib/templates/panelLayouts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Return the selected suggested layout as native Excalidraw elements.
 * Text, shapes, lines, diagrams, and chart bars remain independently
 * editable instead of being flattened into the former locked PNG base.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string; sectionId: string } }
) {
  const [explainer, viewerId, ownerId] = await Promise.all([
    getExplainer(params.id),
    getCurrentUserId(),
    getExplainerOwner(params.id),
  ]);
  if (!viewerId || !ownerId || viewerId !== ownerId) {
    return NextResponse.json(
      { error: "Not allowed to customize this panel." },
      { status: viewerId ? 403 : 401 }
    );
  }
  if (!explainer) {
    return NextResponse.json({ error: "Explainer not found." }, { status: 404 });
  }
  const panelIndex = explainer.panels.findIndex(
    (panel) => panel.sectionId === params.sectionId
  );
  if (panelIndex === -1) {
    return NextResponse.json({ error: "Panel not found." }, { status: 404 });
  }

  const brand = await getBrandKit(viewerId).catch(() => null);
  const panel = explainer.panels[panelIndex];
  const activeTemplate = explainer.template ?? DEFAULT_TEMPLATE_ID;
  const resolvedLayout = chooseTemplatePanelLayout(
    explainer.panels,
    panelIndex + 1,
    panel,
    activeTemplate
  );
  const scene = createEditableTemplateScene({
    explainer,
    panel,
    panelIndex: panelIndex + 1,
    totalPanels: explainer.panels.length,
    template: activeTemplate,
    brand,
  });

  return NextResponse.json({
    scene: {
      ...scene,
      readoppSeedVersion: canvasSeedVersion(
        panel,
        activeTemplate,
        resolvedLayout
      ),
    },
  }, {
    headers: { "cache-control": "private, no-store" },
  });
}
