import { NextResponse } from "next/server";
import { z } from "zod";
import { reorderPanels } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  order: z.array(z.string().min(1)).min(1),
});

/**
 * Reorder the panels of an explainer. `order` is the full list of
 * sectionIds in the desired order — must be a permutation of the
 * existing panel ids (the store rejects any add/drop).
 */
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
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }
  const updated = await reorderPanels(params.id, parsed.data.order);
  if (!updated) {
    return NextResponse.json(
      {
        error:
          "Could not reorder — explainer not found, not owned, or order doesn't match current panels.",
      },
      { status: 400 }
    );
  }
  return NextResponse.json({ explainer: updated });
}
