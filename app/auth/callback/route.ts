import { NextResponse, type NextRequest } from "next/server";
import { getAdminSupabase, getServerSupabase } from "@/lib/supabase/server";

import { CLAIM_COOKIE, verifyDraftClaim, safeNextPath } from "@/lib/supabase/draftClaim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

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

  const claimFrom = verifyDraftClaim(request.cookies.get(CLAIM_COOKIE)?.value);
  const newUserId = session.user?.id;
  if (
    claimFrom &&
    newUserId &&
    claimFrom !== newUserId &&
    session.user?.is_anonymous !== true
  ) {
    try {
      const admin = getAdminSupabase();
      const { data: source, error: sourceError } = await admin.auth.admin.getUserById(claimFrom);
      if (sourceError || !source.user?.is_anonymous) {
        response.cookies.set({ name: CLAIM_COOKIE, value: "", maxAge: 0, path: "/" });
        return response;
      }
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
  response.cookies.set({ name: "readopp_claim_from", value: "", maxAge: 0, path: "/" });
  return response;
}
