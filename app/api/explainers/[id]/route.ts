import { NextResponse } from "next/server";
import { z } from "zod";
import { TemplateIdSchema } from "@/lib/shared/schemas";
import { deleteExplainer, setExplainerTemplate } from "@/lib/store";
import { templateExists } from "@/lib/templates/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ok = await deleteExplainer(params.id);
  if (!ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

const PatchSchema = z.object({
  template: TemplateIdSchema.optional(),
});

/**
 * Patch explainer-level metadata. Currently scoped to the template
 * picker — other surfaces (rename, audience swap) should go here too as
 * they ship rather than each owning their own one-off endpoint.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
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

  const { template } = parsed.data;
  if (template !== undefined) {
    if (!templateExists(template)) {
      return NextResponse.json(
        { error: `Template "${template}" isn't available yet.` },
        { status: 400 }
      );
    }
    const updated = await setExplainerTemplate(params.id, template);
    if (!updated) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ explainer: updated });
  }

  return NextResponse.json({ ok: true });
}
