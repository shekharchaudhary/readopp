"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { RenderedPanel, TemplateId } from "@/lib/shared/schemas";

// The Excalidraw bundle weighs in around 1 MB — keep it off the explainer
// page until the user actually clicks "Edit on canvas" on a panel.
const EditorCanvas = dynamic(
  () =>
    import("./editor/EditorCanvas").then((m) => ({ default: m.EditorCanvas })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[560px] items-center justify-center text-sm text-ink-muted">
        Loading canvas…
      </div>
    ),
  }
);
import { themeSvg } from "@/lib/svg/theme";
import { EditableHtmlTablePanel } from "./EditableHtmlTablePanel";
import { EditableSvgPanel } from "./EditableSvgPanel";
import { EditableText } from "./EditableText";
import { PanelThemePopover, type ColorTriple } from "./NodeEditPopover";
import { TemplatedPanelPreview } from "./TemplatedPanelPreview";

interface Props {
  panel: RenderedPanel;
  index: number;
  onExport?: (panelId: string) => void;
  /**
   * Called when the user commits an inline edit. Resolve with the patched
   * panel (or anything) — the caller is responsible for persisting and
   * refreshing parent state. Omit to disable editing.
   */
  onEdit?: (
    sectionId: string,
    patch: { heading?: string; caption?: string; content?: string }
  ) => Promise<void>;
  /**
   * Called when the user clicks "Reset" on an edited panel. Should hit the
   * server reset endpoint and refresh the explainer in parent state.
   */
  onReset?: (sectionId: string) => Promise<void>;
  onRegenerate?: (sectionId: string, hint: string) => Promise<void>;
  /**
   * Called when the user clicks the "Delete" button. Parent confirms +
   * persists. Omit to hide the button.
   */
  onDelete?: (sectionId: string) => Promise<void>;
  /**
   * When false (e.g. the explainer has only one panel left) the delete
   * button is hidden even if onDelete is provided.
   */
  canDelete?: boolean;
  /**
   * Move-up / move-down handlers — the keyboard parallel to mouse drag.
   * Each renders as a small arrow button in the panel header (only when
   * a move in that direction is actually possible). Omit either to hide
   * the corresponding button. Used by ExplainerView; no-op elsewhere.
   */
  onMoveUp?: (sectionId: string) => void;
  onMoveDown?: (sectionId: string) => void;
  /**
   * When set to a template other than "tachyon", the body switches from
   * the original SVG view to an iframe rendering the export HTML — so
   * the in-page preview matches the downloaded PNG. In that mode heading
   * + caption stay editable (the iframe re-fetches its srcDoc when those
   * change), but SVG body edits and theme swaps are disabled because
   * templates ignore the original SVG.
   */
  explainerId?: string;
  template?: TemplateId;
}

function HtmlPanel({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState<number>(120);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc =
      iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;padding:24px;background:#fafaf7;color:#1a1a1a;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;}
      *{box-sizing:border-box}
      table{border-collapse:collapse;width:100%}
      td,th{padding:8px 10px;font-size:14px;vertical-align:top;border-bottom:1px solid #e3e1d8}
      th{font-weight:500;background:#F1EFE8;text-align:left}
    </style></head><body>${html}</body></html>`);
    doc.close();
    const resize = () => {
      const h = doc.documentElement.scrollHeight;
      if (h && Math.abs(h - height) > 2) setHeight(h);
    };
    resize();
    const ro = new (iframe.contentWindow as Window & {
      ResizeObserver?: typeof ResizeObserver;
    })!.ResizeObserver!(resize);
    ro.observe(doc.documentElement);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      title="panel"
      sandbox="allow-same-origin"
      style={{ width: "100%", border: "0", height: `${height}px` }}
    />
  );
}

export function PanelCard({
  panel,
  index,
  onExport,
  onEdit,
  onReset,
  onRegenerate,
  onDelete,
  canDelete,
  onMoveUp,
  onMoveDown,
  explainerId,
  template,
}: Props) {
  const heading = panel.heading?.trim() || `Panel ${index + 1}`;
  // When a non-default template is active we render the export-HTML
  // preview instead of the SVG editor surface, so inline editing is off.
  const templatedPreview =
    Boolean(explainerId) && template !== undefined && template !== "tachyon";
  // Heading + caption are plain text fields the template reads at render
  // time, so they're safe to edit in any mode — TemplatedPanelPreview's
  // cacheKey includes both and refetches the iframe on change.
  const canEditText = Boolean(onEdit);
  // Body edits (raw SVG mutation, theme swap) only make sense when the
  // SVG editor is the surface — templates ignore the original SVG.
  const canEditContent = Boolean(onEdit) && !templatedPreview;
  const canTheme = canEditContent && panel.format === "svg";
  const canReset = Boolean(onReset && panel.edited && panel.plan);
  const [themeOpen, setThemeOpen] = useState(false);
  const [themeBusy, setThemeBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [regenerateBusy, setRegenerateBusy] = useState(false);
  const [editingCanvas, setEditingCanvas] = useState(false);

  async function handleReset() {
    if (!onReset) return;
    if (resetBusy) return;
    const ok = window.confirm(
      "Reset this panel to the original AI-generated version? All your edits to this panel will be lost."
    );
    if (!ok) return;
    setResetBusy(true);
    try {
      await onReset(panel.sectionId);
    } finally {
      setResetBusy(false);
    }
  }

  async function handleRegenerate() {
    if (!onRegenerate || regenerateBusy) return;
    const hint = window.prompt("How should this panel change?\n\nExamples: Make it simpler · Lead with the statistic · Use a comparison · Shorten the copy");
    if (!hint?.trim()) return;
    setRegenerateBusy(true);
    try { await onRegenerate(panel.sectionId, hint.trim()); }
    catch (e) { window.alert((e as Error).message); }
    finally { setRegenerateBusy(false); }
  }

  async function applyTheme(triple: ColorTriple) {
    if (!onEdit) return;
    const next = themeSvg(panel.content, triple);
    if (next === panel.content) return;
    setThemeBusy(true);
    try {
      await onEdit(panel.sectionId, { content: next });
    } finally {
      setThemeBusy(false);
    }
  }

  return (
    <article
      className="relative rounded-lg border border-paper-line bg-surface motion-safe:animate-rise-in"
      style={{ animationDelay: `${Math.min(index, 5) * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-4 border-b border-paper-line px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] text-ink-faint tabular-nums">
            <span>{String(index + 1).padStart(2, "0")}</span>
            {panel.fallback && (
              <span className="rounded-sm border border-paper-line bg-paper-soft px-1.5 py-0.5 text-[10px] text-ink-muted">
                fallback
              </span>
            )}
            {panel.edited && (
              <span className="inline-flex items-center gap-1.5 text-[10px] text-ink-muted">
                <span className="h-1 w-1 rounded-full bg-accent" />
                edited
                {canReset && (
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={resetBusy}
                    className="ml-1 text-accent transition-opacity hover:text-accent-deep disabled:cursor-not-allowed disabled:opacity-50"
                    title="Reset to AI-generated version"
                  >
                    {resetBusy ? "Resetting…" : "Reset"}
                  </button>
                )}
              </span>
            )}
          </div>
          <h2 className="mt-1 text-lg font-medium leading-snug tracking-tight text-ink sm:text-xl">
            {canEditText ? (
              <EditableText
                value={heading}
                onSave={(next) => onEdit!(panel.sectionId, { heading: next })}
                maxLength={140}
                ariaLabel="Panel heading"
                className="inline-block"
                editClassName="text-lg font-medium tracking-tight sm:text-xl"
              />
            ) : (
              heading
            )}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onRegenerate && panel.plan && (
            <button type="button" onClick={handleRegenerate} disabled={regenerateBusy} className="rounded-md border border-sky/40 bg-sky-soft px-2.5 py-1 text-xs font-medium text-sky-deep hover:border-sky disabled:opacity-50">
              {regenerateBusy ? "Reworking…" : "Regenerate"}
            </button>
          )}
          {canTheme && (
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setThemeOpen((v) => !v)}
              aria-expanded={themeOpen}
              aria-pressed={themeOpen}
              className={
                "rounded-md border px-2.5 py-1 text-xs transition-colors " +
                (themeOpen
                  ? "border-accent bg-accent-soft text-accent-deep"
                  : "border-paper-line bg-paper text-ink-soft hover:border-ink-muted")
              }
            >
              Theme
            </button>
          )}
          {explainerId && (
            <button
              type="button"
              onClick={() => setEditingCanvas((v) => !v)}
              aria-pressed={editingCanvas}
              className={
                "rounded-md border px-2.5 py-1 text-xs transition-colors " +
                (editingCanvas
                  ? "border-accent bg-accent-soft text-accent-deep"
                  : "border-paper-line bg-paper text-ink-soft hover:border-ink-muted")
              }
            >
              {editingCanvas ? "Close canvas" : "Edit on canvas"}
            </button>
          )}
          {onExport && (
            <button
              type="button"
              onClick={() => onExport(panel.sectionId)}
              className="rounded-md border border-paper-line bg-paper px-2.5 py-1 text-xs text-ink-soft hover:border-ink-muted"
            >
              Export
            </button>
          )}
          {onMoveUp && (
            <button
              type="button"
              onClick={() => onMoveUp(panel.sectionId)}
              aria-label="Move panel up"
              title="Move panel up"
              className="rounded-md border border-paper-line bg-paper px-2 py-1 text-xs text-ink-muted hover:border-ink-muted hover:text-ink"
            >
              ↑
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              onClick={() => onMoveDown(panel.sectionId)}
              aria-label="Move panel down"
              title="Move panel down"
              className="rounded-md border border-paper-line bg-paper px-2 py-1 text-xs text-ink-muted hover:border-ink-muted hover:text-ink"
            >
              ↓
            </button>
          )}
          {onDelete && canDelete && (
            <button
              type="button"
              onClick={() => void onDelete(panel.sectionId)}
              aria-label="Delete panel"
              title="Delete panel"
              className="rounded-md border border-paper-line bg-paper px-2 py-1 text-xs text-ink-muted hover:border-rose hover:text-rose-deep"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {themeOpen && canTheme && (
        <PanelThemePopover
          busy={themeBusy}
          onColorChange={applyTheme}
          onClose={() => setThemeOpen(false)}
        />
      )}

      {/* Panel artwork is authored against white — pin it light in dark mode.
          When the user toggles "Edit on canvas", the static body is swapped
          for the Excalidraw editor at the same width as the panel card. */}
      <div className="force-light bg-white p-4">
        {editingCanvas && explainerId ? (
          <div className="relative -m-4 h-[640px] overflow-hidden border-t border-paper-line">
            <EditorCanvas
              explainerId={explainerId}
              sectionId={panel.sectionId}
              heading={panel.heading || heading}
              panelContent={panel.content}
              panelFormat={panel.format}
              // undefined → EditorCanvas fetches any prior auto-saved scene
              // before showing the seed, so re-opens preserve user work.
              initialScene={undefined}
              height="100%"
              onDone={() => setEditingCanvas(false)}
              // Save/Done in the canvas commit the rendered SVG into the
              // panel content so the static explainer view shows the edits.
              onCommit={
                onEdit
                  ? async (svg) => {
                      await onEdit(panel.sectionId, { content: svg });
                    }
                  : undefined
              }
            />
          </div>
        ) : templatedPreview && explainerId && template ? (
          <TemplatedPanelPreview
            explainerId={explainerId}
            sectionId={panel.sectionId}
            templateId={template}
            // Re-fetch when content edits would change the rendered output.
            cacheKey={`${panel.heading ?? ""}::${panel.caption ?? ""}::${panel.content?.length ?? 0}`}
          />
        ) : panel.format === "svg" ? (
          canEditContent ? (
            <EditableSvgPanel
              content={panel.content}
              onSave={(next) => onEdit!(panel.sectionId, { content: next })}
            />
          ) : (
            <div
              className="panel-svg-wrap"
              // SVG comes from the model. We validated it parses + viewBox.
              // We also strip <script> via the validator. Rendering inline is
              // intentional so text is real vector text.
              dangerouslySetInnerHTML={{ __html: panel.content }}
            />
          )
        ) : canEditContent && /<table[\s>]/i.test(panel.content) ? (
          <EditableHtmlTablePanel
            content={panel.content}
            onSave={(next) => onEdit!(panel.sectionId, { content: next })}
          />
        ) : (
          <HtmlPanel html={panel.content} />
        )}
      </div>

      {(panel.caption || canEditText) && (
        <div className="border-t border-paper-line px-5 py-3 text-sm leading-relaxed text-ink-soft">
          {canEditText ? (
            <EditableText
              value={panel.caption || ""}
              onSave={(next) => onEdit!(panel.sectionId, { caption: next })}
              multiline
              maxLength={600}
              placeholder="Add a caption…"
              ariaLabel="Panel caption"
              className="block"
              editClassName="text-sm leading-relaxed"
            />
          ) : (
            panel.caption
          )}
        </div>
      )}
    </article>
  );
}
