import { NextResponse } from "next/server";
import { ANON_FREE_LIMIT, quotaFor } from "@/lib/quota";
import { getOrCreateUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the current user's generation quota so the form can render the
 * "N of 3 free generations used" indicator without re-deriving it.
 * Anonymous sign-in fires here on first visit, so subsequent calls (and
 * the eventual job submit) see a stable user_id.
 */
export async function GET() {
  try {
    const { userId, isAnonymous } = await getOrCreateUser();
    const quota = await quotaFor(userId, isAnonymous);
    return NextResponse.json(quota);
  } catch (e) {
    return NextResponse.json(
      {
        isAnonymous: true,
        used: 0,
        max: ANON_FREE_LIMIT,
        remaining: ANON_FREE_LIMIT,
        blocked: false,
        error: (e as Error).message,
      },
      { status: 200 }
    );
  }
}
