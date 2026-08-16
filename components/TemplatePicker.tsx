"use client";

import { useEffect, useMemo, useState } from "react";
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
  recommendation?: { reason: string; rank: number } | null;
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
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("All");

  useEffect(() => {
    if (!open || options) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/templates?explainerId=${encodeURIComponent(explainerId)}`);
        const json = await res.json();
        if (!cancelled) setOptions(json.templates ?? []);
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
      setOpen(false);
    } finally {
      setSaving(null);
    }
  }

  const currentLabel =
    options?.find((o) => o.id === current)?.name ??
    (current ? current : "Tachyon");
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
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex items-center gap-2 rounded-full border border-paper-line bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition hover:border-sky hover:text-sky-deep"
      >
        <span className="grid h-5 w-5 place-items-center rounded-full bg-sky-soft text-[10px] text-sky-deep">✦</span>
        {currentLabel}
        <span className="text-[10px] transition-transform group-hover:translate-y-0.5">↓</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#080d18]/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-t-[28px] border border-paper-line bg-paper shadow-[0_40px_120px_rgba(0,0,0,.35)] sm:max-h-[88vh] sm:rounded-[28px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 border-b border-paper-line bg-paper/95 px-5 py-5 backdrop-blur-xl sm:px-8 sm:py-6">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-deep">Visual identity library</div>
                  <h2 className="font-display text-3xl font-medium tracking-[-0.03em] text-ink sm:text-4xl">Choose how the idea feels.</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">Every template is a complete publishing system—not a color filter. Pick a visual language your audience already understands.</p>
                </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close template picker"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-paper-line bg-surface text-lg text-ink-soft transition hover:border-ink hover:text-ink"
              >
                ×
              </button>
              </div>
              {options && (
                <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
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
                    {groupByCategory(visible).map(({ category: sectionCategory, items }) => (
                      <section key={sectionCategory}>
                        <div className="mb-4 flex items-end justify-between border-b border-paper-line pb-3">
                          <h3 className="font-display text-xl font-medium text-ink">{sectionCategory}</h3>
                          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">{items.length} identities</span>
                        </div>
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                          {items.map((opt) => (
                            <TemplateCard key={opt.id} option={opt} isCurrent={opt.id === (current ?? "tachyon")} isSaving={saving === opt.id} onPick={() => opt.locked ? window.alert("This identity is part of Readopp Pro. Checkout will be connected in the billing phase.") : opt.available && pick(opt.id)} />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {visible.map((opt) => (
                        <TemplateCard
                          key={opt.id}
                          option={opt}
                          isCurrent={opt.id === (current ?? "tachyon")}
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

function groupByCategory(
  options: TemplateOption[]
): { category: string; items: TemplateOption[] }[] {
  const byCat = new Map<string, TemplateOption[]>();
  for (const opt of options) {
    const arr = byCat.get(opt.category) ?? [];
    arr.push(opt);
    byCat.set(opt.category, arr);
  }
  const known = CATEGORY_ORDER.filter((c) => byCat.has(c)).map((c) => ({
    category: c,
    items: byCat.get(c)!,
  }));
  const extras = [...byCat.entries()]
    .filter(([c]) => !CATEGORY_ORDER.includes(c))
    .map(([category, items]) => ({ category, items }));
  return [...known, ...extras];
}

function TemplateCard({
  option,
  isCurrent,
  isSaving,
  onPick,
}: {
  option: TemplateOption;
  isCurrent: boolean;
  isSaving: boolean;
  onPick: () => void;
}) {
  const disabled = !option.available || isSaving;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      className={
        "group relative overflow-hidden rounded-[20px] border bg-surface text-left transition duration-300 " +
        (isCurrent
          ? "border-sky ring-2 ring-sky/20"
          : "border-paper-line hover:-translate-y-1 hover:border-sky/50 hover:shadow-[0_20px_50px_-30px_rgba(20,40,80,.45)]") +
        (disabled ? " cursor-not-allowed opacity-60" : "")
      }
    >
      <div
        className={"template-specimen template-specimen--" + option.category.toLowerCase() + " relative flex h-44 items-end overflow-hidden p-5"}
        style={{
          background: option.preview.background,
          color: option.preview.foreground,
          fontFamily: option.preview.fontFamily,
        }}
      >
        <div aria-hidden className="absolute inset-0 opacity-80" style={{ background: `linear-gradient(135deg, transparent 48%, ${option.preview.accent}22 48%, ${option.preview.accent}22 52%, transparent 52%)` }} />
        {option.recommendation && <div className="absolute left-4 top-4 z-[1] rounded-full bg-[#111827] px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-white">Recommended #{option.recommendation.rank}</div>}
        {option.locked && <div className="absolute right-4 top-4 z-[1] rounded-full bg-surface px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-ink shadow-sm">Pro</div>}
        <div aria-hidden className="absolute right-5 top-5 font-mono text-[9px] uppercase tracking-[.18em] opacity-60">{specimenLabel(option.category)}</div>
        <div className="relative max-w-[90%] space-y-3">
          <div
            className="inline-flex h-1.5 w-9 rounded-full"
            style={{ background: option.preview.accent }}
          />
          <div className="text-xl font-semibold leading-[1.05] tracking-[-0.025em] line-clamp-3">
            {option.preview.sampleHeading}
          </div>
        </div>
      </div>
      <div className="space-y-2 border-t border-paper-line bg-surface p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-ink">{option.name}</div>
          <div className="font-mono text-[9px] uppercase tracking-[.14em] text-ink-muted">
            {option.category}
          </div>
        </div>
        <div className="min-h-10 text-xs leading-5 text-ink-soft line-clamp-2">{option.tagline}</div>
        {option.recommendation && <div className="rounded-lg bg-sky-soft px-2.5 py-2 text-[10px] leading-4 text-sky-deep">{option.recommendation.reason}</div>}
        <div className="border-t border-paper-line pt-2 text-[10px] text-ink-muted line-clamp-1">
          {option.audience}
        </div>
        {!option.available && (
          <div className="mt-1 inline-flex rounded-sm bg-paper-soft px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-soft">
            Coming soon
          </div>
        )}
        {isCurrent && (
          <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-sky px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-white shadow-sm">
            <span>✓</span> Current
          </div>
        )}
      </div>
    </button>
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
