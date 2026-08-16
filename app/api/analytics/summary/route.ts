import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export async function GET() {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data, error } = await getAdminSupabase().from("product_events").select("event_name,user_id,created_at").gte("created_at", since).limit(10_000);
  if (error) return NextResponse.json({ events: 0, counts: {}, note: "Apply migration 0012_product_events.sql to enable analytics." });
  const rows = (data ?? []) as { event_name: string; user_id: string | null; created_at: string }[];
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.event_name] = (counts[row.event_name] ?? 0) + 1;
  const started = counts.job_started ?? 0, completed = counts.job_completed ?? 0, exported = (counts.image_exported ?? 0) + (counts.video_exported ?? 0);
  return NextResponse.json({ periodDays: 30, events: rows.length, uniqueUsers: new Set(rows.map((r) => r.user_id).filter(Boolean)).size, counts, rates: { completion: started ? completed / started : 0, exportPerCompletion: completed ? exported / completed : 0 } });
}
