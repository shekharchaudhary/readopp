"use client";

import { getBrowserSupabase } from "./client";

const CLAIM_COOKIE = "readopp_claim_from";

/**
 * Start a Google sign-in flow. If the current session is anonymous, we drop
 * a short-lived cookie with the anonymous user_id so the /auth/callback
 * route can reattach that user's explainers to the new permanent account
 * after Supabase has issued the new session.
 *
 * (We used to use Supabase's `linkIdentity` to keep the same user row, but
 * that requires a project-level "Allow manual linking" setting that isn't
 * exposed in the hosted dashboard. The server-side claim works without it.)
 */
export async function signInWithGoogle(nextPath: string = "/"): Promise<void> {
  const supabase = getBrowserSupabase();
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

  const { data: existing } = await supabase.auth.getUser();
  if (existing.user?.is_anonymous) {
    // SameSite=Lax so it survives the cross-origin OAuth redirect chain.
    document.cookie = `${CLAIM_COOKIE}=${existing.user.id}; path=/; max-age=600; SameSite=Lax`;
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const supabase = getBrowserSupabase();
  await supabase.auth.signOut();
  // Hard reload so server components re-fetch with the cleared session and
  // anonymous sign-in fires fresh on the next action.
  window.location.assign("/");
}
