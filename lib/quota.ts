import { countExplainersByUser } from "./store";

/**
 * Free generations granted to an anonymous user before they have to sign in.
 * Permanent users (logged in via Google etc.) get unlimited generations for
 * now — paid tiers can layer on later.
 */
export const ANON_FREE_LIMIT = 3;

export interface QuotaState {
  /** Whether the current user is anonymous (Supabase auth.users.is_anonymous). */
  isAnonymous: boolean;
  /** Generations this user has consumed. */
  used: number;
  /** Maximum for the user's current tier. `null` = unlimited. */
  max: number | null;
  /** `max - used`, clamped at 0. `null` = unlimited. */
  remaining: number | null;
  /** True iff the user has hit their cap and the next generation is blocked. */
  blocked: boolean;
}

/**
 * Resolve the quota state for the *current* request. Triggers an anonymous
 * sign-in if there's no session, so the result always has a real user.
 *
 * The caller passes `userId` (already resolved upstream) so we don't double
 * round-trip Supabase auth. Pass `isAnonymous` from the same auth call.
 */
export async function quotaFor(
  userId: string,
  isAnonymous: boolean
): Promise<QuotaState> {
  if (!isAnonymous) {
    return {
      isAnonymous: false,
      used: 0,
      max: null,
      remaining: null,
      blocked: false,
    };
  }
  const used = await countExplainersByUser(userId);
  const remaining = Math.max(0, ANON_FREE_LIMIT - used);
  return {
    isAnonymous: true,
    used,
    max: ANON_FREE_LIMIT,
    remaining,
    blocked: used >= ANON_FREE_LIMIT,
  };
}

