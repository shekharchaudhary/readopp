"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type {
  PanelPatch,
  RenderedPanel,
  TemplateId,
} from "@/lib/shared/schemas";

import { themeSvg } from "@/lib/svg/theme";
import { EditableHtmlTablePanel } from "./EditableHtmlTablePanel";
import { EditableSvgPanel } from "./EditableSvgPanel";
import { PanelThemePopover, type ColorTriple } from "./NodeEditPopover";
import { TemplatedPanelPreview } from "./TemplatedPanelPreview";
import { PanelLayoutPicker } from "./PanelLayoutPicker";
import {
  clearCanvasOverride,
  isCanvasOverride,
  markCanvasOverride,
} from "@/lib/templates/canvasOverride";
import {
  templateSupportsPanelLayouts,
} from "@/lib/templates/panelLayouts";

interface Props {
  panel: RenderedPanel;
  allPanels?: readonly RenderedPanel[];
  index: number;
  onExport?: (panelId: string) => void;
  /**
   * Called when the user commits an inline edit. Resolve with the patched
   * panel (or anything) — the caller is responsible for persisting and
   * refreshing parent state. Omit to disable editing.
   */
  onEdit?: (
    sectionId: string,
    patch: PanelPatch
  ) => Promise<void>;
  /**
   * Called when the user clicks "Reset" on an edited panel. Should hit the
   * server reset endpoint and refresh the explainer in parent state.
   */
  onReset?: (sectionId: string) => Promise<void>;
  onRegenerate?: (sectionId: string, hint: string) => Promise<void>;
  /**
   * Called after the user confirms deleting this panel. Parent persists the
   * change and rejects on failure. Omit to hide the action.
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
   * the in-page preview matches the downloaded PNG. The exact rendered
   * result can then be opened as native elements in the canvas editor.
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
  allPanels,
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
  const canvasOverride = isCanvasOverride(panel.content);
  const hasVisualTemplate =
    Boolean(explainerId) && template !== undefined && template !== "tachyon";
  const templatedPreview = hasVisualTemplate && !canvasOverride;
  // Body edits (raw SVG mutation, theme swap) only make sense when the
  // SVG editor is the surface — templates ignore the original SVG.
  const canEditContent = Boolean(onEdit) && !templatedPreview;
  const canTheme = templatedPreview
    ? Boolean(onEdit)
    : canEditContent && panel.format === "svg";
  const canReset = Boolean(onReset && panel.edited && panel.plan);
  const [themeOpen, setThemeOpen] = useState(false);
  const [themeBusy, setThemeBusy] = useState(false);
  const restoreThemeFocusRef = useRef(false);
  const [layoutBusy, setLayoutBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"reset" | "delete" | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const resetTriggerRef = useRef<HTMLButtonElement>(null);
  const [regenerateBusy, setRegenerateBusy] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regenerateHint, setRegenerateHint] = useState("");
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const regenerateTriggerRef = useRef<HTMLButtonElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const restoreMoreFocusRef = useRef(false);
  const canCustomizeCanvas =
    Boolean(explainerId) &&
    Boolean(onEdit) &&
    panel.format === "svg";
  const canChooseLayout =
    hasVisualTemplate &&
    templateSupportsPanelLayouts(template) &&
    Boolean(panel.plan) &&
    Boolean(onEdit);
  const hasMoreActions = Boolean(
    canTheme || onExport || onMoveUp || onMoveDown || (onDelete && canDelete)
  );

  useEffect(() => {
    if (!moreOpen) return;
    moreMenuRef.current
      ?.querySelector<HTMLElement>('[role="menuitem"]')
      ?.focus({ preventScroll: true });
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        restoreMoreFocusRef.current = true;
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [moreOpen]);

  useEffect(() => {
    if (moreOpen || !restoreMoreFocusRef.current) return;
    restoreMoreFocusRef.current = false;
    const focusFrame = window.requestAnimationFrame(() => {
      moreTriggerRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [moreOpen]);

  useEffect(() => {
    if (themeOpen || !restoreThemeFocusRef.current) return;
    restoreThemeFocusRef.current = false;
    const focusFrame = window.requestAnimationFrame(() => {
      moreTriggerRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [themeOpen]);

  function handleMoreMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')
    );
    if (!items.length) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Home") items[0]?.focus();
    else if (event.key === "End") items.at(-1)?.focus();
    else if (event.key === "ArrowDown") items[(current + 1) % items.length]?.focus();
    else items[(current <= 0 ? items.length : current) - 1]?.focus();
  }

  async function applyLayout(layoutVariant: NonNullable<RenderedPanel["layoutVariant"]>) {
    if (!onEdit || layoutBusy) return;
    setLayoutBusy(true);
    try {
      await onEdit(panel.sectionId, {
        layoutVariant,
        // A custom canvas is a complete-slide override. Removing only its
        // marker returns this panel to the selected template while retaining
        // the SVG as recoverable panel data. The next canvas open receives a
        // new seed version and starts from the exact chosen layout.
        ...(canvasOverride
          ? { content: clearCanvasOverride(panel.content) }
          : {}),
      });
    } finally {
      setLayoutBusy(false);
    }
  }

  async function restoreCustomCanvas() {
    if (!onEdit || layoutBusy) return;
    setLayoutBusy(true);
    try {
      // Layout replacement only removes the override marker; the exact SVG
      // and its saved Excalidraw scene remain available for this short undo.
      // Re-applying the marker restores both the visible panel and its canvas.
      await onEdit(panel.sectionId, {
        content: markCanvasOverride(panel.content),
      });
    } finally {
      setLayoutBusy(false);
    }
  }

  function openPanelConfirmation(action: "reset" | "delete") {
    setConfirmError(null);
    setConfirmAction(action);
  }

  function closePanelConfirmation({ restoreFocus = true } = {}) {
    if (resetBusy || deleteBusy) return;
    const action = confirmAction;
    setConfirmAction(null);
    setConfirmError(null);
    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        if (action === "reset") resetTriggerRef.current?.focus();
        else moreTriggerRef.current?.focus();
      });
    }
  }

  async function confirmPanelAction() {
    if (!confirmAction || resetBusy || deleteBusy) return;
    setConfirmError(null);
    if (confirmAction === "reset") {
      if (!onReset) return;
      setResetBusy(true);
      try {
        await onReset(panel.sectionId);
        setConfirmAction(null);
        window.requestAnimationFrame(() => resetTriggerRef.current?.focus());
      } catch (error) {
        setConfirmError((error as Error).message || "This panel couldn't be reset.");
      } finally {
        setResetBusy(false);
      }
      return;
    }

    if (!onDelete) return;
    setDeleteBusy(true);
    try {
      await onDelete(panel.sectionId);
    } catch (error) {
      setConfirmError((error as Error).message || "This panel couldn't be deleted.");
      setDeleteBusy(false);
    }
  }

  function closeRegenerate({ restoreFocus = true } = {}) {
    if (regenerateBusy) return;
    setRegenerateOpen(false);
    setRegenerateError(null);
    if (restoreFocus) {
      window.requestAnimationFrame(() => regenerateTriggerRef.current?.focus());
    }
  }

  async function handleRegenerate() {
    if (!onRegenerate || regenerateBusy) return;
    const hint = regenerateHint.trim();
    if (hint.length < 3) {
      setRegenerateError("Add a little more direction so the rewrite is intentional.");
      return;
    }
    setRegenerateError(null);
    setRegenerateBusy(true);
    try {
      await onRegenerate(panel.sectionId, hint);
      setRegenerateOpen(false);
      setRegenerateHint("");
      window.requestAnimationFrame(() => regenerateTriggerRef.current?.focus());
    } catch (e) {
      setRegenerateError((e as Error).message || "This panel couldn't be regenerated.");
    } finally {
      setRegenerateBusy(false);
    }
  }

  async function applyTheme(triple: ColorTriple) {
    if (templatedPreview && onEdit) {
      setThemeBusy(true);
      try {
        await onEdit(panel.sectionId, { themeColor: triple.stroke });
      } finally {
        setThemeBusy(false);
      }
      return;
    }
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
    <>
      <article
        id={`panel-${panel.sectionId}`}
        data-testid={`panel-card-${panel.sectionId}`}
        className="relative scroll-mt-4 rounded-lg border border-paper-line bg-surface transition-shadow target:border-accent target:ring-2 target:ring-accent/20 motion-safe:animate-rise-in"
        style={{ animationDelay: `${Math.min(index, 5) * 60}ms` }}
      >
      <div className="flex flex-col gap-3 border-b border-paper-line px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-5">
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
                    ref={resetTriggerRef}
                    type="button"
                    onClick={() => openPanelConfirmation("reset")}
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
            {heading}
          </h2>
        </div>
        <div className="flex w-full flex-wrap items-center justify-start gap-1.5 sm:w-auto sm:shrink-0 sm:justify-end sm:gap-2">
          {canChooseLayout && (
            <PanelLayoutPicker
              explainerId={explainerId!}
              panel={panel}
              allPanels={allPanels}
              index={index}
              busy={layoutBusy}
              currentIsCustom={canvasOverride}
              template={template!}
              onChange={applyLayout}
              onRestoreCustom={restoreCustomCanvas}
            />
          )}
          {onRegenerate && panel.plan && (
            <button
              ref={regenerateTriggerRef}
              type="button"
              onClick={() => {
                setRegenerateHint("");
                setRegenerateError(null);
                setRegenerateOpen(true);
              }}
              disabled={regenerateBusy}
              aria-haspopup="dialog"
              aria-controls={`regenerate-panel-${panel.sectionId}`}
              className="min-h-8 rounded-md border border-sky/40 bg-sky-soft px-2.5 py-1 text-xs font-medium text-sky-deep hover:border-sky disabled:opacity-50 sm:min-h-0"
            >
              {regenerateBusy ? "Reworking…" : "Regenerate"}
            </button>
          )}
          {canCustomizeCanvas && explainerId ? (
            <Link
              href={`/edit/${encodeURIComponent(explainerId)}/${encodeURIComponent(panel.sectionId)}`}
              data-panel-primary-edit
              className="inline-flex min-h-8 items-center rounded-md border border-paper-line bg-paper px-2.5 py-1 text-xs text-ink-soft transition-colors hover:border-ink-muted sm:min-h-0"
            >
              Customize canvas
            </Link>
          ) : null}
          {hasMoreActions && (
            <div ref={moreRef} className="relative">
              <button
                ref={moreTriggerRef}
                type="button"
                onClick={() => setMoreOpen((value) => !value)}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                aria-label="More panel actions"
                className={
                  "min-h-8 rounded-md border px-2.5 py-1 text-xs transition-colors sm:min-h-0 " +
                  (moreOpen
                    ? "border-accent bg-accent-soft text-accent-deep"
                    : "border-paper-line bg-paper text-ink-soft hover:border-ink-muted")
                }
              >
                More ···
              </button>
              {moreOpen && (
                <div
                  ref={moreMenuRef}
                  role="menu"
                  aria-label={`Actions for ${heading}`}
                  onKeyDown={handleMoreMenuKeyDown}
                  className="absolute right-0 top-full z-30 mt-2 min-w-44 rounded-lg border border-paper-line bg-surface p-1.5 shadow-[0_14px_36px_rgba(15,23,42,.16)]"
                >
                  {canTheme && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMoreOpen(false);
                        setThemeOpen(true);
                      }}
                      className="block w-full rounded-md px-3 py-2 text-left text-xs text-ink-soft hover:bg-paper-soft hover:text-ink"
                    >
                      Change panel colors
                    </button>
                  )}
                  {onExport && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMoreOpen(false);
                        onExport(panel.sectionId);
                      }}
                      className="block w-full rounded-md px-3 py-2 text-left text-xs text-ink-soft hover:bg-paper-soft hover:text-ink"
                    >
                      Export this panel
                    </button>
                  )}
                  {onMoveUp && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMoreOpen(false);
                        onMoveUp(panel.sectionId);
                      }}
                      className="block w-full rounded-md px-3 py-2 text-left text-xs text-ink-soft hover:bg-paper-soft hover:text-ink"
                    >
                      Move panel up
                    </button>
                  )}
                  {onMoveDown && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMoreOpen(false);
                        onMoveDown(panel.sectionId);
                      }}
                      className="block w-full rounded-md px-3 py-2 text-left text-xs text-ink-soft hover:bg-paper-soft hover:text-ink"
                    >
                      Move panel down
                    </button>
                  )}
                  {onDelete && canDelete && (
                    <>
                      <div className="my-1 border-t border-paper-line" />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMoreOpen(false);
                          openPanelConfirmation("delete");
                        }}
                        className="block w-full rounded-md px-3 py-2 text-left text-xs text-rose-deep hover:bg-rose-soft"
                      >
                        Delete panel
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {themeOpen && canTheme && (
        <PanelThemePopover
          busy={themeBusy}
          onColorChange={applyTheme}
          onClose={(reason) => {
            if (reason !== "outside") restoreThemeFocusRef.current = true;
            setThemeOpen(false);
          }}
          description={
            templatedPreview
              ? "Choose the accent for this slide only. Other slides stay unchanged."
              : undefined
          }
        />
      )}

      {/* Panel artwork is authored against white — pin it light in dark mode. */}
      <div className="force-light bg-white p-4">
        {templatedPreview && explainerId && template ? (
          <TemplatedPanelPreview
            explainerId={explainerId}
            sectionId={panel.sectionId}
            templateId={template}
            // Re-fetch when content edits would change the rendered output.
            cacheKey={`${panel.heading ?? ""}::${panel.caption ?? ""}::${panel.content?.length ?? 0}::${panel.themeColor ?? "default"}::${panel.layoutVariant ?? "auto"}::${JSON.stringify(panel.copyOverrides ?? {})}`}
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

      {panel.caption && (
        <div className="border-t border-paper-line px-5 py-3 text-sm leading-relaxed text-ink-soft">
          {panel.caption}
        </div>
      )}

      </article>

      {regenerateOpen && onRegenerate && (
        <RegeneratePanelDialog
          id={`regenerate-panel-${panel.sectionId}`}
          heading={heading}
          hint={regenerateHint}
          busy={regenerateBusy}
          error={regenerateError}
          onHintChange={(next) => {
            setRegenerateHint(next);
            if (regenerateError) setRegenerateError(null);
          }}
          onClose={() => closeRegenerate()}
          onSubmit={() => void handleRegenerate()}
        />
      )}

      {confirmAction && (
        <PanelActionConfirmation
          action={confirmAction}
          heading={heading}
          busy={resetBusy || deleteBusy}
          error={confirmError}
          onClose={() => closePanelConfirmation()}
          onConfirm={() => void confirmPanelAction()}
        />
      )}
    </>
  );
}

const REGENERATE_PRESETS = [
  "Make the idea simpler and more visual",
  "Lead with the strongest evidence",
  "Turn this into a clear comparison",
  "Shorten the copy and sharpen the takeaway",
] as const;

function RegeneratePanelDialog({
  id,
  heading,
  hint,
  busy,
  error,
  onHintChange,
  onClose,
  onSubmit,
}: {
  id: string;
  heading: string;
  hint: string;
  busy: boolean;
  error: string | null;
  onHintChange: (next: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busyRef = useRef(busy);
  const onCloseRef = useRef(onClose);
  busyRef.current = busy;
  onCloseRef.current = onClose;
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => inputRef.current?.focus());
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = getFocusableElements(dialogRef.current);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeys);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeys);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-ink/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        id={id}
        data-testid="panel-regenerate-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-lg rounded-[24px] border border-paper-line bg-surface p-5 shadow-[0_30px_90px_rgba(0,0,0,.3)] sm:p-6"
      >
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[.16em] text-sky-deep">
          Rework one panel
        </p>
        <h2 id={titleId} className="mt-2 font-display text-2xl font-medium tracking-[-.025em] text-ink">
          How should this slide improve?
        </h2>
        <p id={descriptionId} className="mt-2 text-sm leading-6 text-ink-soft">
          Readopp will regenerate “{heading}” only. Your other panels and their
          layouts stay unchanged.
        </p>

        <div className="mt-5 flex flex-wrap gap-2" aria-label="Suggested directions">
          {REGENERATE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                onHintChange(preset);
                inputRef.current?.focus();
              }}
              disabled={busy}
              className="rounded-full border border-paper-line bg-paper px-3 py-1.5 text-left text-xs text-ink-soft transition hover:border-sky hover:text-ink disabled:opacity-50"
            >
              {preset}
            </button>
          ))}
        </div>

        <label htmlFor={`${id}-hint`} className="mt-5 block text-xs font-semibold text-ink">
          Direction for this panel
        </label>
        <textarea
          ref={inputRef}
          id={`${id}-hint`}
          value={hint}
          onChange={(event) => onHintChange(event.target.value)}
          maxLength={280}
          rows={4}
          disabled={busy}
          placeholder="For example: use three short steps and make the final takeaway unmistakable."
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : descriptionId}
          className="mt-2 w-full resize-none rounded-xl border border-paper-line bg-paper px-4 py-3 text-sm leading-6 text-ink outline-none transition placeholder:text-ink-faint focus:border-sky focus:ring-2 focus:ring-sky/15 disabled:opacity-60"
        />
        <div className="mt-1 flex items-start justify-between gap-3 text-[10px]">
          <p id={`${id}-error`} role={error ? "alert" : undefined} className="min-h-4 text-rose-deep">
            {error ?? " "}
          </p>
          <span className="shrink-0 text-ink-faint">{hint.length}/280</span>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full border border-paper-line bg-paper px-4 py-2 text-sm font-medium text-ink transition hover:border-ink-muted disabled:opacity-50"
          >
            Keep current panel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy || hint.trim().length < 3}
            className="rounded-full bg-sky-deep px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? "Reworking this panel…" : "Regenerate panel"}
          </button>
        </div>
      </div>
    </div>
  );
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => element.offsetParent !== null);
}

function PanelActionConfirmation({
  action,
  heading,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  action: "reset" | "delete";
  heading: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(busy);
  const onCloseRef = useRef(onClose);
  busyRef.current = busy;
  onCloseRef.current = onClose;
  const titleId = `panel-${action}-confirmation-title`;
  const descriptionId = `panel-${action}-confirmation-description`;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>("[data-panel-confirm-cancel]")
        ?.focus();
    });
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = getFocusableElements(dialogRef.current);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeys);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeys);
    };
  }, []);

  const deleting = action === "delete";
  return (
    <div
      className="fixed inset-0 z-[85] grid place-items-center bg-ink/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        data-testid="panel-action-confirmation"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-md rounded-[24px] border border-paper-line bg-surface p-5 shadow-[0_30px_90px_rgba(0,0,0,.3)] sm:p-6"
      >
        <p className={`font-mono text-[9px] font-semibold uppercase tracking-[.16em] ${deleting ? "text-rose-deep" : "text-coral-deep"}`}>
          {deleting ? "Remove one panel" : "Restore generated panel"}
        </p>
        <h2 id={titleId} className="mt-2 font-display text-2xl font-medium tracking-[-.025em] text-ink">
          {deleting ? "Delete this panel?" : "Reset this panel?"}
        </h2>
        <p id={descriptionId} className="mt-3 text-sm leading-6 text-ink-soft">
          {deleting
            ? `“${heading}” will be removed from this story. Your other panels stay unchanged.`
            : `“${heading}” will be rebuilt from its generated plan. Custom canvas and copy edits are removed; its selected layout and color stay.`}
        </p>
        {deleting && (
          <p className="mt-2 text-xs font-medium text-rose-deep">This cannot be undone.</p>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-soft px-3 py-2 text-xs leading-5 text-rose-deep">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            data-panel-confirm-cancel
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full border border-paper-line bg-paper px-4 py-2 text-sm font-medium text-ink transition hover:border-ink-muted disabled:opacity-50"
          >
            Keep panel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-full px-4 py-2 text-sm font-medium text-white transition disabled:cursor-wait disabled:opacity-55 ${deleting ? "bg-rose-deep hover:brightness-110" : "bg-coral-deep hover:brightness-110"}`}
          >
            {busy
              ? deleting
                ? "Deleting…"
                : "Resetting…"
              : deleting
                ? "Delete panel"
                : "Reset panel"}
          </button>
        </div>
      </div>
    </div>
  );
}
