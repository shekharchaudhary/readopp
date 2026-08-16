import { NextResponse } from "next/server";
import { z } from "zod";
import { EditorialBriefSchema } from "@/lib/shared/schemas";
import { getJob, updateJob } from "@/lib/store";
import { getOrCreateUser } from "@/lib/supabase/server";
import { enqueueJob } from "@/lib/pipeline/runner";
import "@/lib/pipeline/registerRunner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UpdateSchema = z.object({
  brief: EditorialBriefSchema,
  approve: z.boolean().default(false),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { userId } = await getOrCreateUser();
  const job = await getJob(params.id);
  if (!job || job.userId !== userId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (job.status !== "awaiting_approval") {
    return NextResponse.json({ error: "This brief is no longer awaiting approval." }, { status: 409 });
  }
  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid brief." }, { status: 400 });
  }
  const brief = parsed.data.approve
    ? { ...parsed.data.brief, approvedAt: new Date().toISOString() }
    : parsed.data.brief;
  const updated = await updateJob(params.id, {
    editorialBrief: brief,
    briefApproved: parsed.data.approve,
    status: parsed.data.approve ? "queued" : "awaiting_approval",
  });
  if (!updated) return NextResponse.json({ error: "Could not save brief." }, { status: 500 });
  if (parsed.data.approve) enqueueJob(params.id);
  return NextResponse.json({ job: updated });
}
