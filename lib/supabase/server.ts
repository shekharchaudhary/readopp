import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAnonKey, supabaseServiceRoleKey, supabaseUrl } from "./env";
import { createClient } from "@supabase/supabase-js";

/**
 * Per-request Supabase client bound to the user's auth cookie. Use this from
 * Server Components, route handlers, and Server Actions — it lets RLS enforce
 * "user owns row" automatically because every query carries the session.
 *
 * Read-only contexts (Server Components) can't set cookies. We swallow the
 * write error there; the user's session is still readable.
 */
export function getServerSupabase() {
  const cookieStore = cookies();
  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Server Component — cookie writes deferred to middleware.
        }
      },
      remove(name: string, options: Record<string, unknown>) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // ignore for the same reason.
        }
      },
    },
  });
}

/**
 * Admin client that bypasses RLS. Use only in trusted server-side code paths
 * where ownership is enforced manually, never from the browser.
 */
let _admin: ReturnType<typeof createClient> | null = null;
export function getAdminSupabase() {
  if (_admin) return _admin;
  _admin = createClient(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

/**
 * Resolve the current auth.uid() — anonymous or permanent — creating an
 * anonymous user on first contact so every action has an owner. Returns
 * the user id; the session cookie is set as a side-effect.
 */
export async function getOrCreateUserId(): Promise<string> {
  const supabase = getServerSupabase();
  const { data: existing } = await supabase.auth.getUser();
  if (existing.user) return existing.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error(
      `Anonymous sign-in failed: ${error?.message ?? "no user returned"}`
    );
  }
  return data.user.id;
}
