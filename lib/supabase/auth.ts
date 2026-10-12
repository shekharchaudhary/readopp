"use client";

import { getBrowserSupabase } from "./client";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";

export async function signInWithGoogle(nextPath: string = "/"): Promise<void> {
  const supabase = getBrowserSupabase();
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

  const { data: existing, error: sessionError } = await supabase.auth.getUser();
  if (isAuthRetryableFetchError(sessionError)) {
    throw new Error("The sign-in service is unavailable. Please try again shortly.");
  }

  // With no existing session, getUser does not contact Supabase. Check the
  // service before navigating away so an unavailable project produces an
  // actionable error here instead of a browser DNS error on the OAuth page.
  let health: Response;
  try {
    health = await fetch(`${supabase.supabaseUrl}/auth/v1/health`, {
      headers: { apikey: supabase.supabaseKey },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new Error("The sign-in service could not be reached. Check your connection and try again.");
  }
  if (!health.ok) {
    throw new Error("The sign-in service is unavailable. Please try again shortly.");
  }
  if (existing.user?.is_anonymous) {
    const prepared = await fetch("/api/auth/prepare", { method: "POST" });
    if (!prepared.ok) {
      throw new Error("Could not secure your existing drafts. Please retry sign-in.");
    }
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
