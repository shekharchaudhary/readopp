import type { TemplateId } from "./shared/schemas";
import { getOrCreateUser, getServerSupabase } from "./supabase/server";
import { PRO_FEATURES_ENABLED } from "./featureFlags";

export type ProductPlan = "free" | "pro";
export interface Entitlement { plan: ProductPlan; isAnonymous: boolean; }

// The strongest social-native system must be available in the core product;
// visual quality is not an upsell. Legacy starter looks remain accessible for
// existing explainers and experimentation.
export const FREE_TEMPLATES = new Set<TemplateId>(["swiss-poster", "adaptive-editorial", "editorial-report", "modern-technical", "data-story", "bold-social", "tachyon", "sticky-notes", "highlighter-reader"]);

export async function currentEntitlement(): Promise<Entitlement> {
  const { userId, isAnonymous } = await getOrCreateUser();
  if (!PRO_FEATURES_ENABLED) return { plan: "pro", isAnonymous };
  if (isAnonymous) return { plan: "free", isAnonymous: true };
  const supabase = getServerSupabase();
  const { data } = await supabase.from("user_entitlements").select("plan, expires_at").eq("user_id", userId).maybeSingle();
  const row = data as { plan?: string; expires_at?: string | null } | null;
  const active = !row?.expires_at || new Date(row.expires_at).getTime() > Date.now();
  return { plan: row?.plan === "pro" && active ? "pro" : "free", isAnonymous: false };
}

export function canUseTemplate(plan: ProductPlan, template: TemplateId): boolean {
  return !PRO_FEATURES_ENABLED || plan === "pro" || FREE_TEMPLATES.has(template);
}

export const proRequired = (feature: string) => ({ error: "pro_required", message: `${feature} is included with Readopp Pro.` });
