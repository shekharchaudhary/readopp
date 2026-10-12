"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RenderedPanel, TemplateId } from "@/lib/shared/schemas";
import {
  PANEL_LAYOUTS,
  chooseTemplatePanelLayout,
  panelLayoutCompatibility,
  panelLayoutIdentityLabel,
  panelLayoutRecommendationReason,
  panelLayoutSignalLabels,
  suggestedTemplatePanelLayouts,
  type PanelLayoutId,
} from "@/lib/templates/panelLayouts";

type LayoutVariant = NonNullable<RenderedPanel["layoutVariant"]>;

export function PanelLayoutPicker({
  explainerId,
  panel,
  index,
  busy,
  allPanels,
  currentIsCustom = false,
  template,
  onChange,
  onRestoreCustom,
}: {
  explainerId: string;
  panel: RenderedPanel;
  index: number;
  busy?: boolean;
  allPanels?: readonly RenderedPanel[];
  /** The panel currently displays a complete canvas-authored override. */
  currentIsCustom?: boolean;
  /** The story identity whose automatic composition is currently rendered. */
  template: TemplateId;
  onChange: (layout: LayoutVariant) => Promise<void>;
  /** Restore the exact canvas override that existed before a layout switch. */
  onRestoreCustom?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedLayout, setAppliedLayout] = useState<PanelLayoutId | null>(null);
  const [canUndoCustom, setCanUndoCustom] = useState(false);
  const [undoBusy, setUndoBusy] = useState(false);
  const [pendingLayout, setPendingLayout] = useState<LayoutVariant | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const replaceCancelRef = useRef<HTMLButtonElement>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialogId = useMemo(
    () =>
      `panel-layout-picker-${panel.sectionId.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
    [panel.sectionId]
  );
  const titleId = `${dialogId}-title`;
  const automaticPanel = useMemo(
    () => ({ ...panel, layoutVariant: "auto" as const }),
    [panel]
  );
  const automaticPanels = useMemo(
    () =>
      allPanels?.map((candidate) =>
        candidate.sectionId === panel.sectionId
          ? { ...candidate, layoutVariant: "auto" as const }
          : candidate
      ),
    [allPanels, panel.sectionId]
  );
  const automaticLayout = chooseTemplatePanelLayout(
    automaticPanels ?? [automaticPanel],
    index + 1,
    automaticPanel,
    template
  );
  const activeLayout = allPanels
    ? chooseTemplatePanelLayout(allPanels, index + 1, panel, template)
    : panel.layoutVariant && panel.layoutVariant !== "auto"
      ? panel.layoutVariant
      : automaticLayout;
  const choices = useMemo(() => {
    const ranked = suggestedTemplatePanelLayouts(
      panel,
      index + 1,
      template,
      allPanels
    );
    // Always keep the visible panel's current layout in the first row. An
    // explicit choice may not be the AI's top recommendation, but hiding it
    // in "Explore more" makes the picker look out of sync with the canvas.
    if (activeLayout !== ranked[0]?.id) {
      const active = ranked.find((choice) => choice.id === activeLayout);
      return active
        ? [active, ...ranked.filter((choice) => choice.id !== activeLayout)]
        : ranked;
    }
    return ranked;
  }, [activeLayout, allPanels, index, panel, template]);
  const primaryChoices = choices.slice(0, 3);
  const secondaryChoices = choices.slice(3);
  const contentSignals = useMemo(
    () => [
      ...panelLayoutSignalLabels(panel).slice(0, 2),
      `${panelLayoutIdentityLabel(template)} direction`,
    ],
    [panel, template]
  );
  const identityLabel = panelLayoutIdentityLabel(template);
  const usesAutomatic =
    !currentIsCustom &&
    (!panel.layoutVariant || panel.layoutVariant === "auto");
  const activeLayoutName = PANEL_LAYOUTS[activeLayout].name;

  useEffect(
    () => () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    const lockPage = window.matchMedia("(max-width: 639px)").matches;
    const priorOverflow = document.body.style.overflow;
    if (lockPage) document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      const sheet = sheetRef.current;
      if (!sheet) return;
      // Preview iframes finish at different times. Starting from a stable
      // scroll origin keeps their late layout from pushing the chooser past
      // its title and context on narrow screens.
      sheet.scrollTop = 0;
      sheet
        .querySelector<HTMLElement>("[data-layout-picker-close]")
        ?.focus({ preventScroll: true });
    });
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setShowAll(false);
        setPendingLayout(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        setShowAll(false);
        setPendingLayout(null);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
        return;
      }
      if (event.key !== "Tab" || !sheetRef.current) return;
      const focusable = getFocusableElements(sheetRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        sheetRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      if (lockPage) document.body.style.overflow = priorOverflow;
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !pendingLayout) return;
    const focusFrame = window.requestAnimationFrame(() =>
      replaceCancelRef.current?.focus()
    );
    return () => window.cancelAnimationFrame(focusFrame);
  }, [open, pendingLayout]);

  async function apply(layout: LayoutVariant) {
    setError(null);
    if (currentIsCustom) {
      setPendingLayout(layout);
      return;
    }
    await commitLayout(layout);
  }

  async function commitLayout(layout: LayoutVariant) {
    setError(null);
    const replacedCustomCanvas = currentIsCustom;
    try {
      await onChange(layout);
      const resolvedLayout = layout === "auto" ? automaticLayout : layout;
      setAppliedLayout(resolvedLayout);
      setCanUndoCustom(replacedCustomCanvas && Boolean(onRestoreCustom));
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => {
        setAppliedLayout(null);
        setCanUndoCustom(false);
        feedbackTimerRef.current = null;
      }, replacedCustomCanvas ? 7000 : 2200);
      setOpen(false);
      setShowAll(false);
      setPendingLayout(null);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    } catch (reason) {
      setError((reason as Error).message || "Could not apply this layout.");
    }
  }

  async function undoCustomReplacement() {
    if (!onRestoreCustom || undoBusy) return;
    // Keep recovery available through a slow request and after a failed one.
    // The ordinary success timer must not remove Undo while it is in flight.
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = null;
    setUndoBusy(true);
    setError(null);
    try {
      await onRestoreCustom();
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
      setAppliedLayout(null);
      setCanUndoCustom(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    } catch (reason) {
      setError((reason as Error).message || "Could not restore your custom canvas.");
    } finally {
      setUndoBusy(false);
    }
  }

  return (
    <div ref={pickerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setError(null);
          setAppliedLayout(null);
          setCanUndoCustom(false);
          setOpen((value) => !value);
          if (open) {
            setShowAll(false);
            setPendingLayout(null);
          }
        }}
        disabled={busy || undoBusy}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={dialogId}
        aria-label={`Change panel layout. Current layout: ${activeLayoutName}`}
        className={
          "min-h-8 rounded-md border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 sm:min-h-0 " +
          (open
            ? "border-accent bg-accent-soft text-accent-deep"
            : "border-paper-line bg-paper text-ink-soft hover:border-ink-muted")
        }
      >
        {busy
          ? "Applying…"
          : appliedLayout
            ? canUndoCustom
              ? `Layout · ${PANEL_LAYOUTS[appliedLayout].name}`
              : `✓ ${PANEL_LAYOUTS[appliedLayout].name}`
            : currentIsCustom
              ? "Canvas custom · Change layout"
              : `Layout · ${activeLayoutName}`}
      </button>
      {appliedLayout && !open ? (
        <span
          role="status"
          data-testid="layout-applied-status"
          className="ml-1 inline-flex min-h-8 items-center gap-1.5 rounded-md border border-sage/35 bg-sage-soft px-2 py-1 text-[10px] text-sage-deep sm:min-h-0"
        >
          <span>✓ {PANEL_LAYOUTS[appliedLayout].name} applied</span>
          {canUndoCustom ? (
            <button
              type="button"
              data-testid="undo-custom-layout-replacement"
              disabled={undoBusy}
              onClick={() => void undoCustomReplacement()}
              className="font-semibold underline underline-offset-2 hover:text-ink disabled:opacity-50"
            >
              {undoBusy ? "Restoring…" : "Undo"}
            </button>
          ) : null}
        </span>
      ) : null}
      {error && !open ? (
        <p
          role="alert"
          className="mt-2 rounded-md border border-coral/30 bg-coral-soft px-3 py-2 text-xs text-coral-deep"
        >
          {error}
        </p>
      ) : null}
      {open && (
        <>
          <button
            type="button"
            tabIndex={-1}
            data-testid="layout-picker-backdrop"
            aria-label="Close layout suggestions"
            onClick={() => {
              setOpen(false);
              setShowAll(false);
              setPendingLayout(null);
              window.requestAnimationFrame(() => triggerRef.current?.focus());
            }}
            className="fixed inset-0 z-40 bg-ink/35 backdrop-blur-[1px] sm:hidden"
          />
          <div
            ref={sheetRef}
            id={dialogId}
            data-testid="layout-picker-sheet"
            role="dialog"
      data-motion-dialog
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="fixed inset-x-4 top-[10vh] z-50 max-h-[80vh] w-auto overflow-y-auto overscroll-contain rounded-xl border border-paper-line bg-surface p-3 shadow-[0_18px_50px_rgba(15,23,42,.16)] [overflow-anchor:none] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:z-30 sm:mt-2 sm:max-h-[78vh] sm:w-[620px] sm:max-w-[calc(100vw-2rem)]"
          >
          <div className="sticky -top-3 z-10 -mx-3 -mt-3 mb-3 flex items-start justify-between gap-3 border-b border-paper-line bg-surface/95 px-4 pb-3 pt-3 shadow-[0_8px_18px_rgba(15,23,42,.05)] backdrop-blur-sm">
            <div>
              <p id={titleId} className="font-mono text-[10px] uppercase tracking-[.16em] text-accent">
                Choose a layout for this panel
              </p>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-ink-muted">
                Ranked from this panel's content and the {identityLabel} direction. Choose one, then edit the exact result in canvas.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[8px] uppercase tracking-[.14em] text-ink-faint">
                  Matched from
                </span>
                {contentSignals.map((signal) => (
                  <span
                    key={signal}
                    className="rounded-full border border-paper-line bg-paper px-2 py-0.5 text-[9px] text-ink-soft"
                  >
                    {signal}
                  </span>
                ))}
              </div>
              {currentIsCustom && (
                <p className="mt-2 max-w-md rounded-md bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-900">
                  This panel currently uses your custom canvas. Choosing a layout replaces that design with a fresh, fully editable composition.
                </p>
              )}
            </div>
            <button
              data-layout-picker-close
              type="button"
              onClick={() => {
                setOpen(false);
                setShowAll(false);
                setPendingLayout(null);
                window.requestAnimationFrame(() => triggerRef.current?.focus());
              }}
              aria-label="Close layout suggestions"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-paper-line bg-paper text-lg leading-none text-ink-muted transition hover:border-ink-muted hover:text-ink"
            >
              ×
            </button>
          </div>

          {error && (
            <p role="alert" className="mb-3 rounded-md border border-coral/30 bg-coral-soft px-3 py-2 text-xs text-coral-deep">
              {error}
            </p>
          )}

          {pendingLayout && (
            <div
              data-testid="layout-replace-confirmation"
              role="group"
              aria-label="Replace custom canvas"
              className="mb-3 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-amber-950 shadow-sm"
            >
              <p className="text-xs font-semibold">
                Replace your custom canvas with {pendingLayout === "auto"
                  ? PANEL_LAYOUTS[automaticLayout].name
                  : PANEL_LAYOUTS[pendingLayout].name}?
              </p>
              <p className="mt-1 text-[11px] leading-5 text-amber-900">
                The selected layout becomes a fresh editable canvas for this panel. Your other panels stay unchanged.
              </p>
              <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  ref={replaceCancelRef}
                  type="button"
                  onClick={() => setPendingLayout(null)}
                  className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:border-amber-500"
                >
                  Keep custom canvas
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void commitLayout(pendingLayout)}
                  className="rounded-full bg-amber-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-900 disabled:opacity-50"
                >
                  Use {pendingLayout === "auto"
                    ? PANEL_LAYOUTS[automaticLayout].name
                    : PANEL_LAYOUTS[pendingLayout].name}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <LayoutChoiceGrid
              label="Best options for this panel"
              choices={primaryChoices}
              explainerId={explainerId}
              panel={panel}
              index={index}
              activeLayout={activeLayout}
              automaticLayout={automaticLayout}
              currentIsCustom={currentIsCustom}
              identityLabel={identityLabel}
              busy={busy}
              onApply={apply}
            />

            {secondaryChoices.length > 0 && !showAll && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="w-full rounded-md border border-dashed border-paper-line px-3 py-2 text-xs text-ink-muted transition hover:border-ink-muted hover:text-ink"
              >
                Explore {secondaryChoices.length} more layouts
              </button>
            )}

            {showAll && secondaryChoices.length > 0 && (
              <LayoutChoiceGrid
                label="More ways to tell it"
                choices={secondaryChoices}
                explainerId={explainerId}
                panel={panel}
                index={index}
                activeLayout={activeLayout}
                automaticLayout={automaticLayout}
                currentIsCustom={currentIsCustom}
                identityLabel={identityLabel}
                busy={busy}
                onApply={apply}
              />
            )}
          </div>

          {usesAutomatic ? (
            <p
              data-testid="layout-automatic-state"
              className="mt-3 rounded-md border border-accent/25 bg-accent-soft/40 px-2 py-1.5 text-center text-xs text-accent-deep"
            >
              Automatic is on · {PANEL_LAYOUTS[automaticLayout].name}
            </p>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void apply("auto")}
              className="mt-3 w-full rounded-md border border-paper-line px-2 py-1.5 text-xs text-ink-muted hover:border-ink-muted hover:text-ink"
            >
              Return to automatic · {PANEL_LAYOUTS[automaticLayout].name}
            </button>
          )}
          </div>
        </>
      )}
    </div>
  );
}

function LayoutChoiceGrid({
  label,
  choices,
  explainerId,
  panel,
  index,
  activeLayout,
  automaticLayout,
  currentIsCustom,
  identityLabel,
  busy,
  onApply,
}: {
  label: string;
  choices: ReturnType<typeof suggestedTemplatePanelLayouts>;
  explainerId: string;
  panel: RenderedPanel;
  index: number;
  activeLayout: LayoutVariant;
  automaticLayout: LayoutVariant;
  currentIsCustom: boolean;
  identityLabel: string;
  busy?: boolean;
  onApply: (layout: LayoutVariant) => Promise<void>;
}) {
  return (
    <section>
      <p className="mb-2 px-1 font-mono text-[9px] uppercase tracking-[.14em] text-ink-faint">
        {label}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {choices.map((choice) => {
          const compatibility = panelLayoutCompatibility(panel, choice.id);
          const selected = !currentIsCustom && activeLayout === choice.id;
          const recommended = automaticLayout === choice.id;
          return (
            <button
              key={choice.id}
              type="button"
              data-layout-id={choice.id}
              disabled={busy || !compatibility.compatible}
              aria-pressed={selected}
              onClick={() => void onApply(choice.id)}
              className={
                "group rounded-lg border p-2 text-left transition disabled:cursor-not-allowed " +
                (selected
                  ? "border-accent bg-accent-soft/40"
                  : compatibility.compatible
                    ? "border-paper-line bg-paper hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-sm"
                    : "border-paper-line bg-paper opacity-50")
              }
            >
              <PanelLayoutPreview
                explainerId={explainerId}
                sectionId={panel.sectionId}
                layout={choice.id}
                enabled={compatibility.compatible}
              />
              <strong className="mt-2 block text-[11px] leading-tight text-ink">
                {choice.name}
              </strong>
              {compatibility.compatible && (selected || recommended) && (
                <span className="mt-1 block font-mono text-[8px] uppercase tracking-wider text-accent">
                  {selected && recommended
                    ? "Current · Best fit"
                    : selected
                      ? "Current"
                      : "Best fit"}
                </span>
              )}
              <span className="mt-1 block min-h-7 text-[9px] leading-tight text-ink-muted">
                {compatibility.compatible
                  ? selected && !recommended
                    ? "Your selected layout for this panel"
                    : recommended && activeLayout !== automaticLayout
                      ? "Readopp's strongest content-aware match"
                      : recommended
                        ? `Matches this content and the ${identityLabel} direction`
                      : panelLayoutRecommendationReason(
                          panel,
                          choice.id,
                          index + 1
                        )
                  : compatibility.reason}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PanelLayoutPreview({
  explainerId,
  sectionId,
  layout,
  enabled,
}: {
  explainerId: string;
  sectionId: string;
  layout: PanelLayoutId;
  enabled: boolean;
}) {
  const frameRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(0.125);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = frameRef.current;
    if (!element || !enabled) return;
    const update = () => setScale(element.clientWidth / 1080);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled]);

  useEffect(() => {
    setReady(false);
  }, [explainerId, sectionId, layout]);

  if (!enabled) {
    return (
      <span
        aria-hidden
        className="grid aspect-square w-full place-items-center overflow-hidden rounded border border-paper-line bg-paper-soft"
      >
        <span className="font-mono text-[9px] uppercase tracking-wider text-ink-faint">
          Not a fit
        </span>
      </span>
    );
  }

  const src = `/api/explainers/${encodeURIComponent(explainerId)}/panels/${encodeURIComponent(sectionId)}/template-html?format=square&layout=${encodeURIComponent(layout)}`;
  return (
    <span
      ref={frameRef}
      aria-hidden
      data-layout-preview-state={ready ? "ready" : "loading"}
      className="relative block aspect-square w-full overflow-hidden rounded border border-paper-line bg-paper-soft"
    >
      <span
        className={
          "absolute inset-0 z-10 overflow-hidden bg-paper p-[9%] transition-opacity " +
          (ready ? "opacity-0" : "opacity-100")
        }
      >
        <span className="block h-[5%] w-[34%] animate-pulse rounded-full bg-accent/45" />
        <span className="mt-[10%] block h-[8%] w-[82%] animate-pulse rounded-sm bg-ink/20" />
        <span className="mt-[4%] block h-[8%] w-[62%] animate-pulse rounded-sm bg-ink/15" />
        <span className="mt-[15%] grid grid-cols-[18%_1fr] gap-[7%]">
          <span className="aspect-square animate-pulse rounded-full border-2 border-ink/15" />
          <span className="space-y-[7%] pt-[4%]">
            <span className="block h-2 w-[72%] animate-pulse rounded-full bg-ink/15" />
            <span className="block h-1.5 w-full animate-pulse rounded-full bg-ink/10" />
            <span className="block h-1.5 w-[86%] animate-pulse rounded-full bg-ink/10" />
          </span>
        </span>
        <span className="absolute inset-x-[9%] bottom-[8%] border-t border-paper-line pt-[6%]">
          <span className="block font-mono text-[7px] uppercase tracking-[.1em] text-ink-faint">
            Preparing {PANEL_LAYOUTS[layout].name}
          </span>
        </span>
      </span>
      <iframe
        sandbox=""
        loading="lazy"
        tabIndex={-1}
        title={`${layout} layout preview`}
        src={src}
        onLoad={() => {
          requestAnimationFrame(() =>
            requestAnimationFrame(() => setReady(true))
          );
        }}
        className={
          "pointer-events-none absolute left-0 top-0 block h-[1080px] w-[1080px] origin-top-left border-0 transition-opacity duration-200 " +
          (ready ? "opacity-100" : "opacity-0")
        }
        style={{ transform: `scale(${scale})` }}
      />
    </span>
  );
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute("hidden") && element.offsetParent !== null);
}
