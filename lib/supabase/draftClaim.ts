import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseServiceRoleKey } from "./env";

export const CLAIM_COOKIE = "readopp_draft_claim";
const lifetime = 600;
function signature(payload: string) {
  return createHmac("sha256", supabaseServiceRoleKey()).update(`readopp:draft-claim:v1:${payload}`).digest();
}
export function issueDraftClaim(userId: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ userId, expires: Math.floor(now / 1000) + lifetime })).toString("base64url");
  return `${payload}.${signature(payload).toString("base64url")}`;
}
export function verifyDraftClaim(token: string | undefined, now = Date.now()): string | null {
  if (!token || token.length > 1024) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payload, signed] = parts;
    const actual = Buffer.from(signed, "base64url");
    const expected = signature(payload);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const claim = JSON.parse(Buffer.from(payload, "base64url").toString());
    const current = Math.floor(now / 1000);
    if (!Number.isInteger(claim.expires) || claim.expires <= current || claim.expires > current + lifetime) return null;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claim.userId) ? claim.userId : null;
  } catch { return null; }
}
export function safeNextPath(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") && !/[\\\r\n]/.test(value) ? value : "/";
}
