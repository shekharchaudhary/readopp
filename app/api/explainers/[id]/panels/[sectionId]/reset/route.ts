import { NextResponse } from "next/server";
import { renderPanel } from "@/lib/pipeline/render";
import { getExplainer } from "@/lib/store";
import { getOrCreateUser, getServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/explainers/[id]/panels/[sectionId]/reset
 *
 * Re-renders the panel from its stored PanelPlan, discarding any hand-edits
 * and clearing the `edited` lock. Requires the panel to carry a `plan` —
 * older explainers persisted before the plan field was added cannot be reset
 * (we'd need to re-run the whole pipeline, which is out of scope).
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string; sectionId: string } }
) {
  // Ownership check up-front. Without this, non-owners would still trigger a
  // full re-render (cost) before RLS denied the UPDATE — and would see a
  // generic 500 instead of a clean 403.
  let userId: string;
  try {
    ({ userId } = await getOrCreateUser());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const supabase = getServerSupabase();
  const { data: ownershipRow } = await supabase
    .from("explainers")
    .select("user_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!ownershipRow) {
    return NextResponse.json({ error: "Explainer not found." }, { status: 404 });
  }
  if ((ownershipRow as { user_id: string }).user_id !== userId) {
    return NextResponse.json(
      { error: "You don't own this explainer." },
      { status: 403 }
    );
  }

  const explainer = await getExplainer(params.id);
  if (!explainer) {
    return NextResponse.json({ error: "Explainer not found." }, { status: 404 });
  }
  const i = explainer.panels.findIndex((p) => p.sectionId === params.sectionId);
  if (i === -1) {
    return NextResponse.json(
      { error: "Panel not found in this explainer." },
      { status: 404 }
    );
  }
  const panel = explainer.panels[i];
  if (!panel.plan) {
    return NextResponse.json(
      {
        error:
          "This panel has no stored plan to re-render from. Reset isn't available for older panels.",
      },
      { status: 409 }
    );
  }

  let next;
  try {
    next = await renderPanel(
      panel.plan,
      explainer.audienceLevel,
      panel.heading || `Panel ${i + 1}`,
      // No jobId — reset is an ad-hoc operation; usage attribution skipped.
    );
  } catch (e) {
    return NextResponse.json(
      { error: `Re-render failed: ${(e as Error).message?.slice(0, 200)}` },
      { status: 500 }
    );
  }

  // Replace the panel content + clear edited lock. Read-modify-write the
  // panels array (jsonb column) — same shape as updatePanel.
  const nextPanels = explainer.panels.slice();
  nextPanels[i] = {
    ...panel,
    content: next.content,
    format: next.format,
    fallback: next.fallback,
    validated: next.validated,
    edited: false,
  };
  const { data: updatedRow, error } = await supabase
    .from("explainers")
    .update({ panels: nextPanels })
    .eq("id", params.id)
    .select("*")
    .maybeSingle();
  if (error || !updatedRow) {
    return NextResponse.json(
      { error: error?.message || "Failed to save reset panel." },
      { status: 500 }
    );
  }
  // Re-fetch to return a clean Explainer shape via the existing helper.
  const refreshed = await getExplainer(params.id);
  return NextResponse.json({ explainer: refreshed });
}
