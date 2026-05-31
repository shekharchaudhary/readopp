import { NextResponse } from "next/server";
import { listRecentExplainers } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const recent = listRecentExplainers(6).map((e) => {
    const first = e.panels[0];
    return {
      id: e.id,
      title: e.title,
      summary: e.summary,
      url: e.url,
      audienceLevel: e.audienceLevel,
      panelCount: e.panels.length,
      createdAt: e.createdAt,
      // Lightweight first-panel payload for the home hero preview.
      panel: first
        ? {
            sectionId: first.sectionId,
            heading: first.heading,
            content: first.content,
            format: first.format,
          }
        : null,
    };
  });
  return NextResponse.json({ explainers: recent });
}
