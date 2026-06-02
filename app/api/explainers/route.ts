import { NextResponse } from "next/server";
import { listRecentExplainers } from "@/lib/store";
import { getOrCreateUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let userId: string;
  try {
    userId = await getOrCreateUserId();
  } catch {
    // Without a session we can't show "your" recent runs. Return empty.
    return NextResponse.json({ explainers: [] });
  }
  const list = await listRecentExplainers(userId, 6);
  const recent = list.map((e) => {
    const first = e.panels[0];
    return {
      id: e.id,
      title: e.title,
      summary: e.summary,
      url: e.url,
      audienceLevel: e.audienceLevel,
      panelCount: e.panels.length,
      createdAt: e.createdAt,
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
