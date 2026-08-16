import { NextResponse } from "next/server";
import { currentEntitlement, FREE_TEMPLATES } from "@/lib/entitlements";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json({ ...(await currentEntitlement()), freeTemplates: [...FREE_TEMPLATES] }); }
  catch { return NextResponse.json({ plan: "free", isAnonymous: true, freeTemplates: [...FREE_TEMPLATES] }); }
}
