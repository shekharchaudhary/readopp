import Link from "next/link";
import { notFound } from "next/navigation";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import { getExplainer, getPanelScene } from "@/lib/store";

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
  const panel = explainer.panels.find((p) => p.sectionId === sectionId);
  if (!panel) return notFound();

  const saved = await getPanelScene(explainerId, sectionId);

  return (
    <div className="flex h-screen w-screen flex-col bg-paper text-ink">
      <header className="flex items-center justify-between gap-4 border-b border-paper-line bg-surface px-5 py-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/e/${explainerId}`}
            className="text-sm font-medium text-ink-soft hover:text-ink"
          >
            ← {explainer.title || "Explainer"}
          </Link>
          <span aria-hidden className="text-ink-faint">·</span>
          <span className="text-sm font-medium tracking-tight text-ink">
            {panel.heading || "Editing panel"}
          </span>
        </div>
        <div className="text-xs text-ink-muted">
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
        />
      </div>
    </div>
  );
}
