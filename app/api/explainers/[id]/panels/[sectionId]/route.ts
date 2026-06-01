import { NextResponse } from "next/server";
import { z } from "zod";
import { updatePanel } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_HEADING = 140;
const MAX_CAPTION = 600;

const PatchSchema = z
  .object({
    heading: z.string().trim().min(1).max(MAX_HEADING).optional(),
    caption: z.string().trim().max(MAX_CAPTION).optional(),
  })
  .refine(
    (v) => v.heading !== undefined || v.caption !== undefined,
    "Provide at least one of heading or caption."
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

  const updated = updatePanel(params.id, params.sectionId, parsed.data);
  if (!updated) {
    return NextResponse.json(
      { error: "Explainer or panel not found." },
      { status: 404 }
    );
  }
  return NextResponse.json({ explainer: updated });
}
