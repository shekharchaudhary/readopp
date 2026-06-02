import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Cookie-refresh middleware. Runs on every request and rotates the auth
 * cookie if Supabase has issued a new session token. We do NOT trigger
 * anonymous sign-ins here — those happen lazily on the first action that
 * needs a user_id (see getOrCreateUserId in lib/supabase/server.ts) so a
 * casual visit doesn't create an empty auth row.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: Record<string, unknown>) {
        request.cookies.set({ name, value: "", ...options });
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  // Side-effect: refresh the session if needed. Result is ignored — we just
  // care that the cookies on `response` are up to date.
  await supabase.auth.getUser();

  return response;
}
