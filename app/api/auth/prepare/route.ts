import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { CLAIM_COOKIE, issueDraftClaim } from "@/lib/supabase/draftClaim";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const { data, error } = await getServerSupabase().auth.getUser();
  if (error || !data.user?.is_anonymous) {
    return NextResponse.json({ error: "Could not verify your draft session. Please retry." }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(CLAIM_COOKIE, issueDraftClaim(data.user.id), {
    httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/", maxAge: 600,
  });
  return response;
}
