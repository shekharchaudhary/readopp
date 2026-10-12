import { notFound } from "next/navigation";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import {
  getExplainer,
  getExplainerOwner,
  getPanelScene,
} from "@/lib/store";
import { getCurrentUserId } from "@/lib/supabase/server";
import {
  canvasSeedUrl,
  canvasSeedVersion,
  usesRenderedTemplateSeed,
} from "@/lib/editor/canvasSeed";
import { chooseTemplatePanelLayout } from "@/lib/templates/panelLayouts";
import { DEFAULT_TEMPLATE_ID } from "@/lib/templates/default";

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

  const panelIndex = explainer.panels.findIndex((p) => p.sectionId === sectionId);
  if (panelIndex === -1) return notFound();
  const panel = explainer.panels[panelIndex];
  const previousPanel = explainer.panels[panelIndex - 1];
  const nextPanel = explainer.panels[panelIndex + 1];
  const activeTemplate = explainer.template ?? DEFAULT_TEMPLATE_ID;
  const resolvedLayout = chooseTemplatePanelLayout(
    explainer.panels,
    panelIndex + 1,
    panel,
    activeTemplate
  );

  const saved = await getPanelScene(explainerId, sectionId);
  const renderedTemplateSeed = usesRenderedTemplateSeed(
    panel,
    activeTemplate
  );

  return (
    <div className="flex h-screen w-screen flex-col bg-paper text-ink">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-paper-line bg-surface px-4 py-3 sm:gap-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <a
            href={`/e/${explainerId}`}
            className="max-w-[48vw] truncate text-sm font-medium text-ink-soft hover:text-ink sm:max-w-none"
          >
            ← {explainer.title || "Story"}
          </a>
          <span aria-hidden className="text-ink-faint">·</span>
          <div className="min-w-0">
            <span className="block font-mono text-[9px] uppercase tracking-[.12em] text-ink-muted">
              Panel {panelIndex + 1} of {explainer.panels.length}
            </span>
            <span className="block max-w-[46vw] truncate text-sm font-medium tracking-tight text-ink sm:max-w-[58vw]">
              {panel.heading || "Editing panel"}
            </span>
          </div>
        </div>
        <div className="hidden text-xs text-ink-muted sm:block">
          {saved
            ? `Draft saved ${new Date(saved.updatedAt).toLocaleString()}`
            : "Ready to edit"}
        </div>
      </header>

      <div className="flex-1">
        <EditorCanvas
          explainerId={explainerId}
          sectionId={sectionId}
          heading={panel.heading || ""}
          panelContent={panel.content}
          panelFormat={panel.format}
          seedSceneUrl={
            renderedTemplateSeed
              ? canvasSeedUrl(explainerId, sectionId)
              : undefined
          }
          seedVersion={
            renderedTemplateSeed
              ? canvasSeedVersion(panel, activeTemplate, resolvedLayout)
              : undefined
          }
          initialScene={saved?.scene ?? null}
          // Return to the exact panel the user edited. This matters most on
          // mobile, where canvas opens as a dedicated full-screen route.
          returnHref={`/e/${explainerId}#panel-${encodeURIComponent(sectionId)}`}
          previousPanelHref={
            previousPanel
              ? `/edit/${explainerId}/${encodeURIComponent(previousPanel.sectionId)}`
              : undefined
          }
          nextPanelHref={
            nextPanel
              ? `/edit/${explainerId}/${encodeURIComponent(nextPanel.sectionId)}`
              : undefined
          }
          previousPanelLabel={previousPanel?.heading || undefined}
          nextPanelLabel={nextPanel?.heading || undefined}
          commitAsCanvasOverride={activeTemplate !== "tachyon"}
          promptForTitle={!saved && panel.heading === "Untitled panel"}
        />
      </div>
    </div>
  );
}
