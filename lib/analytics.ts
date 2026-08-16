import { getAdminSupabase } from "./supabase/server";

export type ProductEventName =
  | "job_started" | "job_completed" | "job_failed"
  | "template_selected" | "panel_regenerated"
  | "image_exported" | "video_exported";

type SafeValue = string | number | boolean | null;

/** Best-effort first-party telemetry. Never pass URLs, source text, captions, or panel content. */
export async function trackProductEvent(input: {
  userId?: string | null;
  name: ProductEventName;
  properties?: Record<string, SafeValue>;
}): Promise<void> {
  const properties = Object.fromEntries(Object.entries(input.properties ?? {}).slice(0, 12).map(([key, value]) => [key.slice(0, 40), typeof value === "string" ? value.slice(0, 100) : value]));
  const { error } = await getAdminSupabase().from("product_events").insert({ user_id: input.userId ?? null, event_name: input.name, properties } as never);
  // Analytics must never break the product. Missing migration is tolerated.
  if (error && process.env.NODE_ENV === "development") console.warn(`[readopp] analytics skipped: ${error.message}`);
}
