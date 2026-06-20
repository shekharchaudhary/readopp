import { NextResponse } from "next/server";
import { z } from "zod";
import { runComprehension } from "@/lib/agents/comprehension";
import { runSocialPack } from "@/lib/agents/socialPack";
import { getExplainer } from "@/lib/store";
import { getOrCreateUser, getServerSupabase } from "@/lib/supabase/server";

const PostBodySchema = z
  .object({
    /** Optional free-text guidance the model should apply on top of
     *  the system rules ("shorter", "more skeptical", "lead with the
     *  stat"). Trimmed and length-capped before reaching the model. */
    hint: z.string().trim().max(280).optional(),
  })
  .default({});

const PatchBodySchema = z.object({
  caption: z.string().trim().min(1).max(1200),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/explainers/[id]/social-pack
 *
 * Re-runs the socialPack agent against the current explainer (after edits,
 * or for older explainers that were created before Phase 8 week 1 landed
 * and so don't have a pack yet). Persists and returns the refreshed
 * explainer.
 *
 * Ownership is enforced explicitly so non-owners get a clean 403.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  // Body is optional — older callers POST with no body, newer ones may
  // send { hint } to steer the regeneration.
  let body: unknown = {};
  try {
    const text = await req.text();
    if (text.trim().length > 0) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }
  const hint = parsed.data.hint;

  const ownership = await requireOwner(params.id);
  if ("error" in ownership) return ownership.error;
  const { explainer } = ownership;

  let comprehension;
  try {
    comprehension = await rebuildComprehensionFromExplainer(explainer);
  } catch (e) {
    return NextResponse.json(
      { error: `Could not re-comprehend source: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  let socialPack;
  try {
    socialPack = await runSocialPack(explainer, comprehension, undefined, {
      hint,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Caption agent failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  const nextExplainer = { ...explainer, socialPack };
  const supabase = getServerSupabase();
  const { error: writeError } = await supabase
    .from("explainers")
    .update({
      social_pack: socialPack,
      // Cache buster — the explainer view re-renders.
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id);
  if (writeError) {
    return NextResponse.json(
      { error: writeError.message || "Failed to persist socialPack." },
      { status: 500 }
    );
  }

  return NextResponse.json({ explainer: nextExplainer });
}

/**
 * PATCH /api/explainers/[id]/social-pack
 *
 * Direct overwrite of caption text — the in-place edit path. Skips the
 * caption agent entirely; hashtags / alt-texts / attribution stay
 * exactly as they were. Returns the refreshed explainer for parent
 * state sync.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const ownership = await requireOwner(params.id);
  if ("error" in ownership) return ownership.error;
  const { explainer } = ownership;
  if (!explainer.socialPack) {
    return NextResponse.json(
      { error: "No caption to edit yet — regenerate one first." },
      { status: 400 }
    );
  }

  const socialPack = {
    ...explainer.socialPack,
    caption: parsed.data.caption,
  };
  const nextExplainer = { ...explainer, socialPack };
  const supabase = getServerSupabase();
  const { error: writeError } = await supabase
    .from("explainers")
    .update({
      social_pack: socialPack,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id);
  if (writeError) {
    return NextResponse.json(
      { error: writeError.message || "Failed to persist caption." },
      { status: 500 }
    );
  }

  return NextResponse.json({ explainer: nextExplainer });
}

/**
 * Shared ownership gate for POST + PATCH. Returns either an
 * `{ explainer }` carrier on success or `{ error }` carrying a ready-
 * made NextResponse on failure so the caller can just `return` it.
 */
async function requireOwner(
  id: string
): Promise<
  | { explainer: NonNullable<Awaited<ReturnType<typeof getExplainer>>> }
  | { error: NextResponse }
> {
  let userId: string;
  try {
    ({ userId } = await getOrCreateUser());
  } catch (e) {
    return {
      error: NextResponse.json(
        { error: (e as Error).message },
        { status: 500 }
      ),
    };
  }
  const supabase = getServerSupabase();
  const { data: ownershipRow } = await supabase
    .from("explainers")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (!ownershipRow) {
    return {
      error: NextResponse.json(
        { error: "Explainer not found." },
        { status: 404 }
      ),
    };
  }
  if ((ownershipRow as { user_id: string }).user_id !== userId) {
    return {
      error: NextResponse.json(
        { error: "You don't own this explainer." },
        { status: 403 }
      ),
    };
  }
  const explainer = await getExplainer(id);
  if (!explainer) {
    return {
      error: NextResponse.json(
        { error: "Explainer not found." },
        { status: 404 }
      ),
    };
  }
  return { explainer };
}

/**
 * Rebuild a minimal Comprehension shape from a stored Explainer + a fast
 * re-comprehension call. This is only used by the regeneration endpoint;
 * the live pipeline already has the real Comprehension in memory.
 */
async function rebuildComprehensionFromExplainer(
  explainer: Awaited<ReturnType<typeof getExplainer>>
) {
  if (!explainer) throw new Error("explainer is null");
  // The cheapest path: synthesize a tiny CleanArticle from the explainer's
  // title + summary + panel headings, run the existing comprehension agent
  // against it. Genre + features get inferred from the available content.
  const fakeText = [
    explainer.title,
    explainer.summary,
    "",
    ...explainer.panels.map(
      (p) => `${p.heading}\n${p.caption || ""}`
    ),
  ].join("\n");
  return runComprehension(
    {
      url: explainer.url,
      title: explainer.title,
      text: fakeText,
      codeBlocks: [],
      imageUrls: [],
      wordCount: fakeText.split(/\s+/).length,
    },
    explainer.audienceLevel
  );
}
