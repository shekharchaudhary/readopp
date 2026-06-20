import { NextResponse } from "next/server";
import { SAMPLE_EXPLAINER_IDS } from "@/lib/samples";
import { getAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Curated showcase explainers for the home-page empty state — first-
 * time visitors with no past explainers see these as "What others have
 * made". Read via the admin client (no RLS) so they always load.
 *
 * The shape matches /api/explainers GET so ExampleGallery can render
 * either source without branching.
 */
export async function GET() {
  if (SAMPLE_EXPLAINER_IDS.length === 0) {
    return NextResponse.json({ explainers: [] });
  }
  const admin = getAdminSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin
    .from("explainers")
    .select("id, title, summary, url, audience_level, panels, created_at")
    .in("id", SAMPLE_EXPLAINER_IDS) as any);
  if (error || !data) return NextResponse.json({ explainers: [] });

  // Preserve the SAMPLE_EXPLAINER_IDS order so the curator's intent
  // (e.g. lead with Paul Graham) is honored even when the DB returns
  // rows in arbitrary order.
  const byId = new Map(
    (data as Array<Record<string, unknown>>).map((r) => [r.id as string, r])
  );

  const explainers = SAMPLE_EXPLAINER_IDS.map((id) => {
    const r = byId.get(id);
    if (!r) return null;
    const panels = Array.isArray(r.panels)
      ? (r.panels as Array<Record<string, unknown>>)
      : [];
    const trim = (p: Record<string, unknown> | undefined) =>
      p
        ? {
            sectionId: p.sectionId as string,
            heading: (p.heading as string) ?? "",
            content: (p.content as string) ?? "",
            format: (p.format as "svg" | "html") ?? "svg",
          }
        : null;
    return {
      id: r.id as string,
      title: (r.title as string) ?? "",
      summary: (r.summary as string) ?? "",
      url: (r.url as string) ?? "",
      audienceLevel: r.audience_level as string,
      panelCount: panels.length,
      createdAt: r.created_at as string,
      panel: trim(panels[0]),
      secondPanel: trim(panels[1]),
    };
  }).filter(Boolean);

  return NextResponse.json({ explainers });
}
