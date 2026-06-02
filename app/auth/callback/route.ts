import { NextResponse, type NextRequest } from "next/server";
import { getAdminSupabase, getServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLAIM_COOKIE = "readopp_claim_from";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * OAuth redirect target.
 *
 * 1. Exchange `?code=...` for a real session (Supabase writes the cookies).
 * 2. If a `readopp_claim_from=<anonymous_user_id>` cookie is present, the
 *    user was anonymous before this sign-in. Reattach their explainers to
 *    the new permanent user via the admin client (RLS would block the
 *    cross-user update otherwise).
 * 3. Clear the claim cookie and redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error?reason=missing_code`);
  }

  const supabase = getServerSupabase();
  const { data: session, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/error?reason=${encodeURIComponent(error.message)}`
    );
  }

  const response = NextResponse.redirect(`${origin}${next}`);

  const claimFrom = request.cookies.get(CLAIM_COOKIE)?.value;
  const newUserId = session.user?.id;
  if (
    claimFrom &&
    newUserId &&
    claimFrom !== newUserId &&
    UUID_RE.test(claimFrom)
  ) {
    try {
      const admin = getAdminSupabase();
      // Cast through unknown — we don't run supabase-gen-types so the
      // table-row type is inferred as `never`. Payload shape is verified
      // by the migration (user_id uuid).
      const payload = { user_id: newUserId } as unknown as never;
      await admin
        .from("explainers")
        .update(payload)
        .eq("user_id", claimFrom);
    } catch {
      // Claim is best-effort. The user is already signed in successfully;
      // any failure here just means a few explainer rows stay attached to
      // the orphan anonymous user. They can re-share via the /e/:id link.
    }
  }

  // Always clear the cookie so a stale value can't re-trigger a claim.
  response.cookies.set({ name: CLAIM_COOKIE, value: "", maxAge: 0, path: "/" });
  return response;
}
