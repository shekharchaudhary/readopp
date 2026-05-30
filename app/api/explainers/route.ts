import { NextResponse } from "next/server";
import { listRecentExplainers } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const recent = listRecentExplainers(6).map((e) => ({
    id: e.id,
    title: e.title,
    summary: e.summary,
    url: e.url,
    audienceLevel: e.audienceLevel,
    panelCount: e.panels.length,
    createdAt: e.createdAt,
  }));
  return NextResponse.json({ explainers: recent });
}
