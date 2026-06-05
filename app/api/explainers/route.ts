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
    // The hero post mockup prefers the second panel — first is usually a
    // hero stat callout which doesn't show off Readopp's visual range.
    const second = e.panels[1];
    const trim = (p: typeof first) =>
      p
        ? {
            sectionId: p.sectionId,
            heading: p.heading,
            content: p.content,
            format: p.format,
          }
        : null;
    return {
      id: e.id,
      title: e.title,
      summary: e.summary,
      url: e.url,
      audienceLevel: e.audienceLevel,
      panelCount: e.panels.length,
      createdAt: e.createdAt,
      panel: trim(first),
      secondPanel: trim(second),
    };
  });
  return NextResponse.json({ explainers: recent });
}
