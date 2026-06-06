import { NextResponse } from "next/server";
import { BrandKitSchema } from "@/lib/shared/schemas";
import { getBrandKit, upsertBrandKit } from "@/lib/store";
import { getOrCreateUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let userId: string;
  let isAnonymous: boolean;
  try {
    ({ userId, isAnonymous } = await getOrCreateUser());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  // Anonymous users can't have a brand kit (it lives off their auth user_id);
  // return empty so the settings page renders the empty state.
  if (isAnonymous) {
    return NextResponse.json({ brandKit: null, anonymous: true });
  }
  const brandKit = await getBrandKit(userId);
  return NextResponse.json({ brandKit });
}

export async function PUT(req: Request) {
  let userId: string;
  let isAnonymous: boolean;
  try {
    ({ userId, isAnonymous } = await getOrCreateUser());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  if (isAnonymous) {
    return NextResponse.json(
      { error: "Sign in to save a brand kit." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  // Allow partial updates — coerce empty strings and "null" to undefined so
  // the schema's nullish() validators accept them as "clear this field".
  const normalized =
    body && typeof body === "object"
      ? Object.fromEntries(
          Object.entries(body as Record<string, unknown>).map(([k, v]) => [
            k,
            v === "" || v === null ? undefined : v,
          ])
        )
      : {};
  const parsed = BrandKitSchema.partial().safeParse(normalized);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid brand kit." },
      { status: 400 }
    );
  }

  const result = await upsertBrandKit(userId, parsed.data);
  if (!result.ok) {
    if (result.reason === "missing_table") {
      return NextResponse.json(
        {
          error:
            "Brand kit table doesn't exist yet. Apply the SQL from supabase/migrations/0003_brand_kits.sql in your Supabase SQL editor, then save again.",
          code: "missing_table",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: result.message || "Failed to save brand kit." },
      { status: 500 }
    );
  }
  return NextResponse.json({ brandKit: result.brandKit });
}
