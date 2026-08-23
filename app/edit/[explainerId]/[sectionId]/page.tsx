import { notFound } from "next/navigation";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import {
  getExplainer,
  getExplainerOwner,
  getPanelScene,
} from "@/lib/store";
import { getCurrentUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: { explainerId: string; sectionId: string };
}

/**
 * Server entry for the full-canvas panel editor. Loads the explainer, finds
 * the requested panel, and reads any previously saved Excalidraw scene. The
 * heavy Excalidraw lifting happens inside EditorCanvas (dynamic-imported on
 * the client) so the editor route is the only one that pays the ~1 MB bundle
 * cost — marketing and explainer pages stay lean.
 */
export default async function EditPanelPage({ params }: PageProps) {
  const { explainerId, sectionId } = params;
  const explainer = await getExplainer(explainerId);
  if (!explainer) return notFound();

  const [viewerId, ownerId] = await Promise.all([
    getCurrentUserId(),
    getExplainerOwner(explainerId),
  ]);
  if (!viewerId || !ownerId || viewerId !== ownerId) return notFound();

  const panel = explainer.panels.find((p) => p.sectionId === sectionId);
  if (!panel) return notFound();

  const saved = await getPanelScene(explainerId, sectionId);

  return (
    <div className="flex h-screen w-screen flex-col bg-paper text-ink">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-paper-line bg-surface px-4 py-3 sm:gap-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <a
            href={`/e/${explainerId}`}
            className="max-w-[48vw] truncate text-sm font-medium text-ink-soft hover:text-ink sm:max-w-none"
          >
            ← {explainer.title || "Explainer"}
          </a>
          <span aria-hidden className="text-ink-faint">·</span>
          <span className="text-sm font-medium tracking-tight text-ink">
            {panel.heading || "Editing panel"}
          </span>
        </div>
        <div className="hidden text-xs text-ink-muted sm:block">
          {saved
            ? `Last saved ${new Date(saved.updatedAt).toLocaleString()}`
            : "Fresh canvas"}
        </div>
      </header>

      <div className="flex-1">
        <EditorCanvas
          explainerId={explainerId}
          sectionId={sectionId}
          heading={panel.heading || ""}
          panelContent={panel.content}
          panelFormat={panel.format}
          initialScene={saved?.scene ?? null}
          returnHref={`/e/${explainerId}`}
        />
      </div>
    </div>
  );
}
