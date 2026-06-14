import { NextResponse } from "next/server";
import {
  getExplainer,
  getExplainerOwner,
  getPanelScene,
  savePanelScene,
} from "@/lib/store";
import { getOrCreateUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SCENE_BYTES = 200_000;

interface RouteParams {
  params: { explainerId: string; sectionId: string };
}

/**
 * Read the user's saved Excalidraw scene for a given panel. Returns 200 with
 * `scene: null` when the panel has never been opened in the editor — the
 * client then seeds a fresh canvas instead of showing a 404.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  const { explainerId, sectionId } = params;
  const saved = await getPanelScene(explainerId, sectionId);
  return NextResponse.json({
    scene: saved?.scene ?? null,
    updatedAt: saved?.updatedAt ?? null,
  });
}

/**
 * Persist a scene. Verifies the caller actually owns the parent explainer
 * (RLS would block the write anyway, but a 403 with a clear message is
 * better UX than an opaque RLS-enforced empty-row response).
 */
export async function POST(req: Request, { params }: RouteParams) {
  const { explainerId, sectionId } = params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("scene" in body)) {
    return NextResponse.json(
      { error: "Body must be { scene: ExcalidrawScene }." },
      { status: 400 }
    );
  }
  const scene = (body as { scene: unknown }).scene;
  const size = JSON.stringify(scene).length;
  if (size > MAX_SCENE_BYTES) {
    return NextResponse.json(
      { error: `Scene too large (${size} bytes; cap ${MAX_SCENE_BYTES}).` },
      { status: 413 }
    );
  }

  const explainer = await getExplainer(explainerId);
  if (!explainer) {
    return NextResponse.json({ error: "Explainer not found." }, { status: 404 });
  }
  const panel = explainer.panels.find((p) => p.sectionId === sectionId);
  if (!panel) {
    return NextResponse.json(
      { error: "Section not found on this explainer." },
      { status: 404 }
    );
  }

  // Ownership check — getOrCreateUserId resolves to the anon user when the
  // visitor hasn't signed in, which is fine since explainers are created
  // under the anon identity.
  const userId = await getOrCreateUserId();
  const ownerId = await getExplainerOwner(explainerId);
  if (!ownerId || ownerId !== userId) {
    return NextResponse.json(
      { error: "Not allowed to edit this panel." },
      { status: 403 }
    );
  }

  await savePanelScene({ explainerId, sectionId, userId, scene });
  return NextResponse.json({ ok: true });
}
