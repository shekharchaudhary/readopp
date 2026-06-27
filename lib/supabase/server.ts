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
    global: {
      // Next patches the global fetch in route handlers to cache GET responses.
      // Supabase-js issues its REST reads through that fetch, so without this a
      // job-status poll would keep returning the FIRST cached row — e.g. a job
      // stuck at "comprehending" long after it actually completed. Force every
      // admin query uncached; job/explainer rows must always read live.
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
  return _admin;
}

export interface ResolvedUser {
  userId: string;
  isAnonymous: boolean;
}

/**
 * Resolve the current auth user, creating an anonymous one on first contact
 * so every action has an owner. Returns the user id + whether it's
 * anonymous; the session cookie is set as a side-effect.
 */
export async function getOrCreateUser(): Promise<ResolvedUser> {
  const supabase = getServerSupabase();
  const { data: existing } = await supabase.auth.getUser();
  if (existing.user) {
    return {
      userId: existing.user.id,
      isAnonymous: existing.user.is_anonymous === true,
    };
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error(
      `Anonymous sign-in failed: ${error?.message ?? "no user returned"}`
    );
  }
  return { userId: data.user.id, isAnonymous: true };
}

/**
 * Convenience wrapper for callers that only need the id (e.g. cache lookups,
 * gallery scoping). Kept for backwards compatibility with the Phase 3a code.
 */
export async function getOrCreateUserId(): Promise<string> {
  return (await getOrCreateUser()).userId;
}

/**
 * Read-only variant: return the current user's id when they already have
 * a session, otherwise null. Does NOT create an anonymous session as a
 * side effect — use this from public read paths (permalinks, OG images,
 * gallery previews) where minting an anon user just to check ownership
 * would pollute auth.users with one row per visit.
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    // Outside a request scope (tsx scripts, static-build prerender) the
    // cookies() call throws — treat that as "no session" rather than
    // 500ing the caller.
    return null;
  }
}
