"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TemplateId } from "@/lib/shared/schemas";

/** Snapshot of one template the picker shows on its card. */
export interface TemplateOption {
  id: TemplateId;
  name: string;
  category: string;
  tagline: string;
  audience: string;
  preview: {
    background: string;
    foreground: string;
    accent: string;
    sampleHeading: string;
    fontFamily: string;
  };
  available: boolean;
  locked?: boolean;
  recommendation?: {
    reason: string;
    signal: string;
    outcome: string;
    rank: number;
    score: number;
  } | null;
}

interface Props {
  explainerId: string;
  current: TemplateId | undefined;
  onChange?: (next: TemplateId) => void;
}

/**
 * Inline picker that opens a modal of template preview cards. Selecting
 * one PATCHes the explainer and notifies the parent so the cache-busted
 * export URL refreshes.
 */
export function TemplatePicker({ explainerId, current, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<TemplateId | null>(null);
  const [options, setOptions] = useState<TemplateOption[] | null>(null);
  const [previewSectionId, setPreviewSectionId] = useState<string | null>(null);
  const [customPanelCount, setCustomPanelCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("All");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  function closePicker({ restoreFocus = true } = {}) {
    setOpen(false);
    setCategory("All");
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      // Sticky controls remain visible at any scroll position, so focusing the
      // close button alone does not reset a browser-restored scroll offset.
      // Always enter on the ranked recommendations instead of a card near the
      // bottom of the picker.
      dialog.scrollTop = 0;
      dialog
        .querySelector<HTMLElement>("[data-template-picker-close]")
        ?.focus({ preventScroll: true });
    });
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        setCategory("All");
        window.requestAnimationFrame(() => triggerRef.current?.focus());
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
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
    document.addEventListener("keydown", handleDialogKeys);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleDialogKeys);
    };
  }, [open]);

  useEffect(() => {
    if (!open || options) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/templates?explainerId=${encodeURIComponent(explainerId)}`);
        if (!res.ok) throw new Error(`Template list failed (${res.status})`);
        const json = await res.json();
        if (!cancelled) {
          setOptions(json.templates ?? []);
          setPreviewSectionId(json.previewSectionId ?? null);
          setCustomPanelCount(json.customPanelCount ?? 0);
        }
      } catch {
        if (!cancelled) setError("Couldn't load templates.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, options]);

  async function pick(id: TemplateId) {
    if (saving) return;
    setSaving(id);
    setError(null);
    try {
      const res = await fetch(`/api/explainers/${explainerId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ template: id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to switch template.");
        return;
      }
      onChange?.(id);
      closePicker();
    } catch {
      setError("Could not switch the visual direction. Try again.");
    } finally {
      setSaving(null);
    }
  }

  const currentLabel =
    options?.find((o) => o.id === current)?.name ??
    (current ? humanizeTemplateId(current) : "Swiss Social");
  const visible = useMemo(
    () =>
      options
        ?.filter((option) => category === "All" || option.category === category)
        .sort((a, b) => (a.recommendation?.rank ?? 99) - (b.recommendation?.rank ?? 99)) ?? [],
    [category, options]
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="template-picker-dialog"
        className="group inline-flex items-center gap-2 rounded-full border border-paper-line bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition hover:border-sky hover:text-sky-deep"
      >
        <span className="grid h-5 w-5 place-items-center rounded-full bg-sky-soft text-[10px] text-sky-deep">✦</span>
        {currentLabel}
        <span className="text-[10px] transition-transform group-hover:translate-y-0.5">↓</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#080d18]/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={() => closePicker()}
        >
          <div
            ref={dialogRef}
            id="template-picker-dialog"
            role="dialog"
      data-motion-dialog
            aria-modal="true"
            aria-labelledby="template-picker-title"
            tabIndex={-1}
            data-testid="template-picker-scroll"
            className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-t-[28px] border border-paper-line bg-paper shadow-[0_40px_120px_rgba(0,0,0,.35)] sm:max-h-[88vh] sm:rounded-[28px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 border-b border-paper-line bg-paper/95 px-4 py-4 backdrop-blur-xl sm:px-8 sm:py-6">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-deep">Design direction</div>
                  <h2 id="template-picker-title" className="font-display text-[28px] font-medium leading-[.98] tracking-[-0.03em] text-ink sm:text-4xl">Choose a mature visual direction.</h2>
                  <p className="mt-2 max-w-2xl text-[13px] leading-5 text-ink-soft sm:text-sm sm:leading-6">Preview your first panel, see why each direction fits, then choose one. Readopp composes every panel around its idea.</p>
                  {customPanelCount > 0 ? (
                    <p className="mt-2.5 inline-flex rounded-2xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] leading-4 text-amber-900 sm:text-[11px]">
                      {customPanelCount} canvas-customized panel{customPanelCount === 1 ? "" : "s"} will stay exactly as designed; the remaining panels adopt the new direction.
                    </p>
                  ) : null}
                </div>
              <button
                data-template-picker-close
                type="button"
                onClick={() => closePicker()}
                aria-label="Close template picker"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-paper-line bg-surface text-lg text-ink-soft transition hover:border-ink hover:text-ink"
              >
                ×
              </button>
              </div>
              {options && (
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1 sm:mt-5">
                  {["All", ...CATEGORY_ORDER.filter((c) => options.some((o) => o.category === c))].map((cat) => (
                    <button key={cat} type="button" onClick={() => setCategory(cat)} className={"shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition " + (category === cat ? "border-sky bg-sky text-white" : "border-paper-line bg-surface text-ink-muted hover:border-ink-muted hover:text-ink")}>
                      {cat}{cat === "All" ? ` · ${options.length}` : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="mx-5 mt-5 rounded-xl border border-coral/30 bg-coral-soft px-4 py-3 text-sm text-coral-deep sm:mx-8">
                {error}
              </div>
            )}

            {!options ? (
              <div className="py-24 text-center font-mono text-xs uppercase tracking-widest text-ink-muted">
                Loading…
              </div>
            ) : (
              <div className="p-5 sm:p-8">
                {category === "All" ? (
                  <div className="space-y-10">
                    <TemplateSection
                      title="Recommended for this story"
                      note="Ranked from your argument, evidence, audience, and publishing goal"
                      options={visible.filter((option) => option.recommendation)}
                      explainerId={explainerId}
                      previewSectionId={previewSectionId}
                      current={current}
                      saving={saving}
                      onPick={pick}
                    />
                    <TemplateSection
                      title="More visual directions"
                      note="Distinct systems you can still choose at any time"
                      options={visible.filter((option) => !option.recommendation)}
                      explainerId={explainerId}
                      previewSectionId={previewSectionId}
                      current={current}
                      saving={saving}
                      onPick={pick}
                    />
                  </div>
                ) : (
                  <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
                    {visible.map((opt) => (
                        <TemplateCard
                          key={opt.id}
                          option={opt}
                          explainerId={explainerId}
                          previewSectionId={previewSectionId}
                          isCurrent={opt.id === (current ?? "swiss-poster")}
                          isSaving={saving === opt.id}
                          onPick={() => opt.locked ? window.alert("This identity is part of Readopp Pro. Checkout will be connected in the billing phase.") : opt.available && pick(opt.id)}
                        />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function humanizeTemplateId(id: TemplateId): string {
  return id
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function TemplateSection({
  title,
  note,
  options,
  explainerId,
  previewSectionId,
  current,
  saving,
  onPick,
}: {
  title: string;
  note: string;
  options: TemplateOption[];
  explainerId: string;
  previewSectionId: string | null;
  current: TemplateId | undefined;
  saving: TemplateId | null;
  onPick: (id: TemplateId) => Promise<void>;
}) {
  if (!options.length) return null;
  return (
    <section>
      <div className="mb-4 flex flex-col gap-1 border-b border-paper-line pb-3 sm:flex-row sm:items-end sm:justify-between">
        <h3 className="font-display text-xl font-medium text-ink">{title}</h3>
        <span className="max-w-xl text-[11px] leading-relaxed text-ink-muted sm:text-right">{note}</span>
      </div>
      <div
        data-testid="template-card-rail"
        className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3"
      >
        {options.map((option) => (
          <TemplateCard
            key={option.id}
            option={option}
            explainerId={explainerId}
            previewSectionId={previewSectionId}
            isCurrent={option.id === (current ?? "swiss-poster")}
            isSaving={saving === option.id}
            onPick={() =>
              option.locked
                ? window.alert("This identity is part of Readopp Pro. Checkout will be connected in the billing phase.")
                : option.available && onPick(option.id)
            }
          />
        ))}
      </div>
    </section>
  );
}

/** Bucket templates into stable display order — Default first so the user
 *  can always fall back to Tachyon, then Editorial · Reader · Technical ·
 *  Document · Bold. Anything unknown lands at the end. */
const CATEGORY_ORDER: string[] = [
  "Default",
  "Modern",
  "Editorial",
  "Reader",
  "Technical",
  "Document",
  "Bold",
];

function TemplateCard({
  option,
  explainerId,
  previewSectionId,
  isCurrent,
  isSaving,
  onPick,
}: {
  option: TemplateOption;
  explainerId: string;
  previewSectionId: string | null;
  isCurrent: boolean;
  isSaving: boolean;
  onPick: () => void;
}) {
  const disabled = !option.available || isSaving || isCurrent;
  return (
    <article
      data-template-card-id={option.id}
      className={
        "group relative min-w-[70vw] max-w-[280px] snap-start overflow-hidden rounded-[20px] border bg-surface text-left transition duration-300 sm:min-w-0 sm:max-w-none " +
        (isCurrent
          ? "border-sky ring-2 ring-sky/20"
          : "border-paper-line hover:-translate-y-1 hover:border-sky/50 hover:shadow-[0_20px_50px_-30px_rgba(20,40,80,.45)]") +
        (!option.available ? " opacity-60" : "")
      }
    >
      <div
        className={"template-specimen template-specimen--" + option.category.toLowerCase() + " relative aspect-square overflow-hidden"}
        style={{
          background: option.preview.background,
          color: option.preview.foreground,
          fontFamily: option.preview.fontFamily,
        }}
      >
        {previewSectionId ? (
          <LiveTemplatePreview
            explainerId={explainerId}
            sectionId={previewSectionId}
            templateId={option.id}
            eager={Boolean(option.recommendation)}
          />
        ) : (
          <FallbackSpecimen option={option} />
        )}
      </div>
      <div className="space-y-2 border-t border-paper-line bg-surface p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="text-sm font-semibold text-ink">{option.name}</div>
            <div className="flex flex-wrap gap-1.5">
              {option.recommendation ? (
                <span className="rounded-full bg-ink px-2 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wider text-paper">
                  {option.recommendation.rank === 1
                    ? "Best fit"
                    : `Also fits · ${option.recommendation.rank}`}
                </span>
              ) : null}
              {isCurrent ? (
                <span className="rounded-full bg-sky px-2 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wider text-white">
                  ✓ Current
                </span>
              ) : null}
              {option.locked ? (
                <span className="rounded-full border border-paper-line bg-paper px-2 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wider text-ink-soft">
                  Pro
                </span>
              ) : null}
            </div>
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[.14em] text-ink-muted">
            {option.category}
          </div>
        </div>
        <button
          type="button"
          data-template-id={option.id}
          disabled={disabled}
          aria-pressed={isCurrent}
          onClick={onPick}
          className={
            "min-h-10 w-full rounded-xl border px-3 py-2 text-center text-xs font-semibold transition " +
            (isCurrent
              ? "border-sky/25 bg-sky-soft text-sky-deep"
              : "border-ink bg-ink text-paper hover:bg-ink-soft") +
            (disabled ? " cursor-default opacity-70" : "")
          }
        >
          {isSaving
            ? "Applying…"
            : isCurrent
              ? "Current direction"
              : option.available
                ? `Use ${option.name}`
                : "Coming soon"}
        </button>
        <div className="min-h-10 text-xs leading-5 text-ink-soft line-clamp-2">{option.tagline}</div>
        {option.recommendation && (
          <div className="space-y-2 rounded-xl bg-sky-soft px-3 py-2.5 text-[10px] leading-4 text-sky-deep">
            <p>
              <span className="mr-1 font-mono text-[8px] font-bold uppercase tracking-[.12em] text-sky-deep/70">Why</span>
              <span data-testid="template-recommendation-signal">
                {option.recommendation.signal}
              </span>
            </p>
            <p className="border-t border-sky/15 pt-2">
              <span className="mr-1 font-mono text-[8px] font-bold uppercase tracking-[.12em] text-sky-deep/70">Result</span>
              <span data-testid="template-recommendation-outcome">
                {option.recommendation.outcome}
              </span>
            </p>
          </div>
        )}
        <div className="border-t border-paper-line pt-2 text-[10px] text-ink-muted line-clamp-1">
          {option.audience}
        </div>
      </div>
    </article>
  );
}

function LiveTemplatePreview({
  explainerId,
  sectionId,
  templateId,
  eager,
}: {
  explainerId: string;
  sectionId: string;
  templateId: TemplateId;
  eager: boolean;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.25);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const update = () => setScale(element.clientWidth / 1080);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const src = `/api/explainers/${encodeURIComponent(explainerId)}/panels/${encodeURIComponent(sectionId)}/template-html?format=square&template=${encodeURIComponent(templateId)}`;
  return (
    <div
      ref={frameRef}
      data-template-preview-state={loaded ? "ready" : "loading"}
      className="absolute inset-0 bg-paper-soft"
    >
      {!loaded ? (
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[.14em] text-ink-faint">
            Building preview…
          </span>
        </div>
      ) : null}
      <iframe
        sandbox=""
        loading={eager ? "eager" : "lazy"}
        tabIndex={-1}
        title={`${templateId} preview using your first panel`}
        src={src}
        onLoad={() =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => setLoaded(true))
          )
        }
        className={
          "pointer-events-none absolute left-0 top-0 h-[1080px] w-[1080px] origin-top-left border-0 " +
          (loaded ? "opacity-100" : "opacity-0")
        }
        style={{ transform: `scale(${scale})` }}
      />
    </div>
  );
}

function FallbackSpecimen({ option }: { option: TemplateOption }) {
  return (
    <div className="absolute inset-0 flex items-end overflow-hidden p-5">
      <div aria-hidden className="absolute inset-0 opacity-80" style={{ background: `linear-gradient(135deg, transparent 48%, ${option.preview.accent}22 48%, ${option.preview.accent}22 52%, transparent 52%)` }} />
      <div aria-hidden className="absolute right-5 top-5 font-mono text-[9px] uppercase tracking-[.18em] opacity-60">{specimenLabel(option.category)}</div>
      <div className="relative max-w-[90%] space-y-3">
        <div className="inline-flex h-1.5 w-9 rounded-full" style={{ background: option.preview.accent }} />
        <div className="line-clamp-3 text-xl font-semibold leading-[1.05] tracking-[-0.025em]">
          {option.preview.sampleHeading}
        </div>
      </div>
    </div>
  );
}

function specimenLabel(category: string): string {
  const labels: Record<string, string> = {
    Default: "Readopp original",
    Modern: "Digital system",
    Editorial: "Print edition",
    Reader: "Reading artifact",
    Technical: "Technical document",
    Document: "Paper object",
    Bold: "Display series",
  };
  return labels[category] ?? "Visual system";
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute("hidden") && element.offsetParent !== null);
}
