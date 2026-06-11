"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!open || options) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/templates");
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-paper-line bg-white px-3 py-2 text-sm text-ink-soft hover:border-ink-muted"
      >
        Template: {currentLabel} ▾
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-baseline justify-between">
              <div>
                <h2 className="text-lg font-medium text-ink">Pick a template</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  Each look mimics a real medium — pick the one your audience
                  already trusts.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-paper-line bg-white px-3 py-1 text-sm text-ink-soft"
              >
                Close
              </button>
            </div>

            {error && (
              <div className="mb-3 rounded-md border border-paper-line bg-paper-soft px-3 py-2 text-sm text-ink-soft">
                {error}
              </div>
            )}

            {!options ? (
              <div className="py-10 text-center text-sm text-ink-soft">
                Loading…
              </div>
            ) : (
              <div className="space-y-6">
                {groupByCategory(options).map(({ category, items }) => (
                  <section key={category}>
                    <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">
                      {category}
                    </h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {items.map((opt) => (
                        <TemplateCard
                          key={opt.id}
                          option={opt}
                          isCurrent={opt.id === current}
                          isSaving={saving === opt.id}
                          onPick={() => opt.available && pick(opt.id)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
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
        "group relative overflow-hidden rounded-lg border text-left transition " +
        (isCurrent
          ? "border-ink ring-1 ring-ink"
          : "border-paper-line hover:border-ink-muted") +
        (disabled ? " cursor-not-allowed opacity-60" : "")
      }
    >
      <div
        className="flex h-32 items-end p-4"
        style={{
          background: option.preview.background,
          color: option.preview.foreground,
          fontFamily: option.preview.fontFamily,
        }}
      >
        <div className="space-y-1.5">
          <div
            className="inline-flex h-1.5 w-6 rounded-full"
            style={{ background: option.preview.accent }}
          />
          <div className="text-base font-semibold leading-tight line-clamp-2">
            {option.preview.sampleHeading}
          </div>
        </div>
      </div>
      <div className="space-y-1 bg-white p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-ink">{option.name}</div>
          <div className="text-[11px] uppercase tracking-wider text-ink-soft">
            {option.category}
          </div>
        </div>
        <div className="text-xs text-ink-soft line-clamp-2">{option.tagline}</div>
        <div className="text-[11px] text-ink-soft/80 line-clamp-1">
          {option.audience}
        </div>
        {!option.available && (
          <div className="mt-1 inline-flex rounded-sm bg-paper-soft px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-soft">
            Coming soon
          </div>
        )}
        {isCurrent && (
          <div className="mt-1 inline-flex rounded-sm bg-ink px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white">
            Current
          </div>
        )}
      </div>
    </button>
  );
}
