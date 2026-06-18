import { NextResponse } from "next/server";
import { z } from "zod";
import { validateHtmlPanel, validateUserSvg } from "@/lib/render/validate";
import { deletePanel, getExplainer, updatePanel } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_HEADING = 140;
const MAX_CAPTION = 600;
const MAX_CONTENT = 50_000; // 50 KB cap on inline SVG / HTML edits

const PatchSchema = z
  .object({
    heading: z.string().trim().min(1).max(MAX_HEADING).optional(),
    caption: z.string().trim().max(MAX_CAPTION).optional(),
    content: z.string().max(MAX_CONTENT).optional(),
  })
  .refine(
    (v) =>
      v.heading !== undefined ||
      v.caption !== undefined ||
      v.content !== undefined,
    "Provide at least one of heading, caption, or content."
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
  if (parsed.data.content !== undefined) {
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
