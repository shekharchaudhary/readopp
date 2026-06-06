import { NextResponse } from "next/server";
import { runComprehension } from "@/lib/agents/comprehension";
import { runSocialPack } from "@/lib/agents/socialPack";
import { getExplainer } from "@/lib/store";
import { getOrCreateUser, getServerSupabase } from "@/lib/supabase/server";

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
  _req: Request,
  { params }: { params: { id: string } }
) {
  let userId: string;
  try {
    ({ userId } = await getOrCreateUser());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const supabase = getServerSupabase();
  const { data: ownershipRow } = await supabase
    .from("explainers")
    .select("user_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!ownershipRow) {
    return NextResponse.json({ error: "Explainer not found." }, { status: 404 });
  }
  if ((ownershipRow as { user_id: string }).user_id !== userId) {
    return NextResponse.json(
      { error: "You don't own this explainer." },
      { status: 403 }
    );
  }

  const explainer = await getExplainer(params.id);
  if (!explainer) {
    return NextResponse.json({ error: "Explainer not found." }, { status: 404 });
  }

  // Comprehension isn't persisted with the explainer in v0.1; rebuild a
  // minimal one from the explainer fields so the socialPack agent has
  // enough context. Title + summary + audience are enough for a caption.
  // If the panels' plans carry richer comprehension later, we can pull
  // from there.
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
    socialPack = await runSocialPack(explainer, comprehension);
  } catch (e) {
    return NextResponse.json(
      { error: `Caption agent failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  const nextExplainer = { ...explainer, socialPack };
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
