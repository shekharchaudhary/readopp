import { NextResponse } from "next/server";
import { getJob } from "@/lib/store";
import { getCurrentUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const [job, viewerId] = await Promise.all([
    getJob(params.id),
    getCurrentUserId(),
  ]);
  if (!job || !viewerId || job.userId !== viewerId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json({ job });
}
