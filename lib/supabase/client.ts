"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";

let _browser: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Singleton browser-side Supabase client. Reads/writes the auth cookie via
 * document.cookie so server middleware sees session changes immediately.
 */
export function getBrowserSupabase() {
  if (_browser) return _browser;
  _browser = createBrowserClient(supabaseUrl(), supabaseAnonKey());
  return _browser;
}
