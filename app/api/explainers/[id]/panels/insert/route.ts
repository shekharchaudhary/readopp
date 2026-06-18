import { NextResponse } from "next/server";
import { z } from "zod";
import { insertBlankPanel } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  afterSectionId: z.string().min(1).optional(),
});

/**
 * Insert a blank panel after the given sectionId (or at the end when
 * the field is omitted / the id isn't present). Returns the updated
 * explainer + the newly created panel's sectionId so the client can
 * scroll to it or auto-open the editor.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }
  const result = await insertBlankPanel(params.id, parsed.data.afterSectionId);
  if (!result) {
    return NextResponse.json(
      { error: "Explainer not found or not owned." },
      { status: 404 }
    );
  }
  return NextResponse.json({
    explainer: result.explainer,
    sectionId: result.sectionId,
  });
}
