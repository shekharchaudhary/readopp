import { NextResponse } from "next/server";
import { z } from "zod";
import { PanelCopyOverridesSchema } from "@/lib/shared/schemas";
import { validateHtmlPanel, validateUserSvg } from "@/lib/render/validate";
import { deletePanel, getExplainer, updatePanel } from "@/lib/store";
import {
  panelLayoutCompatibility,
  templateSupportsPanelLayouts,
} from "@/lib/templates/panelLayouts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_HEADING = 140;
const MAX_CAPTION = 600;
// Excalidraw exports can be larger than the original generated SVG because
// every editable element carries its own vector metadata. Keep the request
// bounded while leaving enough room for a genuinely customized panel.
const MAX_CONTENT = 2_000_000;

const PatchSchema = z
  .object({
    heading: z.string().trim().min(1).max(MAX_HEADING).optional(),
    caption: z.string().trim().max(MAX_CAPTION).optional(),
    content: z.string().max(MAX_CONTENT).optional(),
    themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    layoutVariant: z.enum(["auto", "cover", "hierarchy", "radial", "architecture", "chart", "diverging", "priorities", "report", "contents", "essay"]).optional(),
    copyOverrides: PanelCopyOverridesSchema.nullable().optional(),
  })
  .refine(
    (v) =>
      v.heading !== undefined ||
      v.caption !== undefined ||
      v.content !== undefined ||
      v.themeColor !== undefined ||
      v.layoutVariant !== undefined ||
      v.copyOverrides !== undefined,
    "Provide at least one editable panel field."
  );

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; sectionId: string } }
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  // If content was provided, validate it against the panel's existing format
  // — block <script>, malformed SVG, or wrong viewBox so a bad edit can't
  // corrupt the persisted panel.
  if (
    parsed.data.content !== undefined ||
    parsed.data.layoutVariant !== undefined
  ) {
    const explainer = await getExplainer(params.id);
    if (!explainer) {
      return NextResponse.json(
        { error: "Explainer not found." },
        { status: 404 }
      );
    }
    const panel = explainer.panels.find((p) => p.sectionId === params.sectionId);
    if (!panel) {
      return NextResponse.json(
        { error: "Panel not found in this explainer." },
        { status: 404 }
      );
    }
    if (parsed.data.content !== undefined) {
      // User edits use a lenient validator (parseable + no script/foreignObject +
      // sane viewBox). The strict design-system whitelist only applies to
      // pristine model output, never hand-edited panels.
      const v =
        panel.format === "svg"
          ? validateUserSvg(parsed.data.content)
          : validateHtmlPanel(parsed.data.content);
      if (!v.ok) {
        return NextResponse.json(
          { error: `Edited content rejected: ${v.reason}` },
          { status: 400 }
        );
      }
    }
    if (
      parsed.data.layoutVariant &&
      parsed.data.layoutVariant !== "auto" &&
      templateSupportsPanelLayouts(explainer.template)
    ) {
      const compatibility = panelLayoutCompatibility(
        panel,
        parsed.data.layoutVariant
      );
      if (!compatibility.compatible) {
        return NextResponse.json(
          { error: compatibility.reason ?? "Layout is not compatible with this panel." },
          { status: 422 }
        );
      }
    }
  }

  const updated = await updatePanel(params.id, params.sectionId, parsed.data);
  if (!updated) {
    return NextResponse.json(
      { error: "Explainer or panel not found." },
      { status: 404 }
    );
  }
  return NextResponse.json({ explainer: updated });
}

/**
 * Remove a panel from the explainer. The store refuses to remove the
 * last remaining panel (an explainer must have at least one).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; sectionId: string } }
) {
  const updated = await deletePanel(params.id, params.sectionId);
  if (!updated) {
    return NextResponse.json(
      {
        error:
          "Could not delete — explainer not found, panel not found, or it's the last panel.",
      },
      { status: 400 }
    );
  }
  return NextResponse.json({ explainer: updated });
}
