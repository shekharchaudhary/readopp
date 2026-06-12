"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/marketing/Nav";
import type { BrandFont, BrandKit } from "@/lib/shared/schemas";

const FONT_OPTIONS: { value: BrandFont; label: string; preview: string }[] = [
  { value: "sans", label: "Sans", preview: "Aa" },
  { value: "serif", label: "Serif", preview: "Aa" },
  { value: "mono", label: "Mono", preview: "Aa" },
  { value: "display", label: "Display", preview: "Aa" },
];

const PRESET_COLORS = [
  "#1F97DC", // Readopp blue (default)
  "#0F6E56", // teal
  "#854F0B", // amber
  "#534AB7", // purple
  "#C04A2B", // rust
  "#A23B73", // magenta
  "#1a1a1a", // ink
];

const FONT_FAMILY: Record<BrandFont, string> = {
  sans: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif",
  serif: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  display:
    "ui-sans-serif, system-ui, 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
};

interface DraftKit {
  color: string;
  font: BrandFont;
  logoUrl: string;
  authorName: string;
  authorHeadline: string;
}

const EMPTY_DRAFT: DraftKit = {
  color: "#1F97DC",
  font: "sans",
  logoUrl: "",
  authorName: "",
  authorHeadline: "",
};

function kitToDraft(kit: BrandKit | null): DraftKit {
  if (!kit) return { ...EMPTY_DRAFT };
  return {
    color: kit.color ?? "#1F97DC",
    font: kit.font ?? "sans",
    logoUrl: kit.logoUrl ?? "",
    authorName: kit.authorName ?? "",
    authorHeadline: kit.authorHeadline ?? "",
  };
}

export default function BrandPage() {
  const [loading, setLoading] = useState(true);
  const [anonymous, setAnonymous] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<DraftKit>(EMPTY_DRAFT);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/brand-kit", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (data.anonymous) {
          setAnonymous(true);
        } else if (data.brandKit) {
          setDraft(kitToDraft(data.brandKit as BrandKit));
          setSavedAt(
            (data.brandKit as BrandKit).updatedAt ?? new Date().toISOString()
          );
        }
      } catch {
        // Treat as a fresh kit on failure.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/brand-kit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          color: draft.color || undefined,
          font: draft.font || undefined,
          logoUrl: draft.logoUrl || undefined,
          authorName: draft.authorName || undefined,
          authorHeadline: draft.authorHeadline || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Save failed (${res.status})`);
      setSavedAt(new Date().toISOString());
    } catch (e) {
      setError((e as Error).message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (anonymous) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-3xl px-6 py-20">
          <h1 className="text-3xl font-medium tracking-tight text-ink sm:text-4xl">
            Brand kit
          </h1>
          <p className="mt-4 text-base text-ink-soft">
            Sign in to set a brand kit so every export carries your color,
            font, logo, and headline.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <header className="mb-10">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
            Settings
          </p>
          <h1 className="mt-3 text-3xl font-medium tracking-tight text-ink sm:text-4xl">
            Brand kit
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-soft">
            Pin your color, font, logo, and headline. Every export carousel
            you generate from now on uses them automatically — your posts
            look like yours, not like Readopp&rsquo;s.
          </p>
        </header>

        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-start">
          {/* Form */}
          <div className="space-y-8 rounded-xl border border-paper-line bg-surface p-7">
            <Field label="Brand color">
              <div className="flex items-center gap-2">
                <span
                  className="h-9 w-9 rounded-md border border-paper-line"
                  style={{ background: draft.color }}
                  aria-hidden
                />
                <input
                  type="text"
                  value={draft.color}
                  onChange={(e) =>
                    setDraft({ ...draft, color: e.target.value })
                  }
                  placeholder="#1F97DC"
                  className="w-32 rounded-md border border-paper-line bg-surface px-2 py-1.5 font-mono text-sm uppercase text-ink focus:border-ink focus:outline-none"
                />
                <div className="ml-2 flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setDraft({ ...draft, color: c })}
                      title={c}
                      aria-label={c}
                      className={
                        "h-6 w-6 rounded-md border transition-transform " +
                        (draft.color.toLowerCase() === c.toLowerCase()
                          ? "scale-110 border-ink"
                          : "border-paper-line hover:scale-105")
                      }
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </Field>

            <Field label="Font family">
              <div className="grid grid-cols-4 gap-2">
                {FONT_OPTIONS.map((f) => {
                  const active = draft.font === f.value;
                  return (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setDraft({ ...draft, font: f.value })}
                      className={
                        "rounded-md border px-3 py-3 transition-colors " +
                        (active
                          ? "border-ink bg-ink text-paper"
                          : "border-paper-line bg-surface text-ink-soft hover:border-ink-muted")
                      }
                    >
                      <div
                        className="text-xl"
                        style={{ fontFamily: FONT_FAMILY[f.value] }}
                      >
                        {f.preview}
                      </div>
                      <div className="mt-1 text-xs">{f.label}</div>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field
              label="Logo URL"
              hint="Paste an https URL for your logo (PNG/SVG). Square works best."
            >
              <input
                type="url"
                value={draft.logoUrl}
                onChange={(e) =>
                  setDraft({ ...draft, logoUrl: e.target.value })
                }
                placeholder="https://example.com/your-logo.png"
                className="w-full rounded-md border border-paper-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ink focus:outline-none"
              />
            </Field>

            <Field label="Author name">
              <input
                type="text"
                value={draft.authorName}
                onChange={(e) =>
                  setDraft({ ...draft, authorName: e.target.value })
                }
                placeholder="Sarah Bennett"
                className="w-full rounded-md border border-paper-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ink focus:outline-none"
              />
            </Field>

            <Field
              label="Headline"
              hint="One line. Shown under your name on the source-attribution slide."
            >
              <input
                type="text"
                value={draft.authorHeadline}
                onChange={(e) =>
                  setDraft({ ...draft, authorHeadline: e.target.value })
                }
                placeholder="Indie founder · writes weekly"
                maxLength={120}
                className="w-full rounded-md border border-paper-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ink focus:outline-none"
              />
            </Field>

            <div className="flex flex-wrap items-center gap-3 border-t border-paper-line pt-5">
              <button
                type="button"
                onClick={save}
                disabled={loading || saving}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save brand kit"}
              </button>
              {savedAt && !saving && !error && (
                <span className="text-xs text-ink-muted">
                  Saved. Used on your next export.
                </span>
              )}
              {error && (
                <span className="text-xs text-red-600" role="alert">
                  {error}
                </span>
              )}
            </div>
          </div>

          {/* Live preview */}
          <div className="lg:sticky lg:top-24">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
              Preview
            </p>
            <PreviewCard draft={draft} />
            <p className="mt-3 text-[12px] text-ink-muted">
              Roughly how the source-attribution slide will look at the end of
              your next carousel. Panel content itself stays in the metaphor
              palette by design.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

function PreviewCard({ draft }: { draft: DraftKit }) {
  const accent = draft.color || "#1F97DC";
  const fontFamily = FONT_FAMILY[draft.font];
  return (
    <div
      className="aspect-square overflow-hidden rounded-lg border border-paper-line bg-paper shadow-sm"
      style={{ fontFamily }}
    >
      <div className="flex h-full flex-col p-6">
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-muted">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: accent }}
          />
          Source
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p
            className="text-[10px] font-medium uppercase tracking-[0.2em]"
            style={{ color: "#6b6b6b" }}
          >
            Read the original
          </p>
          <h3 className="max-w-xs text-xl font-medium leading-tight text-ink">
            What it really takes to ship
          </h3>
          <p className="text-sm font-medium text-ink-soft">stripe.com</p>
          <div
            className="mt-2 flex h-20 w-20 items-center justify-center rounded-md border border-paper-line bg-white"
            style={{ borderColor: accent + "55" }}
          >
            <div
              className="h-12 w-12 rounded-sm"
              style={{
                background: `repeating-conic-gradient(${accent} 0% 25%, transparent 0% 50%) 50% / 6px 6px`,
              }}
            />
          </div>
          <p className="text-xs" style={{ color: accent }}>
            Scan to read
          </p>
        </div>
        <div className="flex items-center justify-between border-t border-paper-line pt-3 text-[11px]">
          <div className="flex items-center gap-2">
            {draft.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={draft.logoUrl}
                alt="logo"
                className="h-5 w-5 rounded-sm object-contain"
                onError={(e) =>
                  ((e.currentTarget as HTMLImageElement).style.display = "none")
                }
              />
            ) : (
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: accent }}
              />
            )}
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-ink">
                {draft.authorName || "Made with Readopp"}
              </span>
              {draft.authorHeadline && (
                <span className="text-[10px] text-ink-muted">
                  {draft.authorHeadline}
                </span>
              )}
            </div>
          </div>
          <span className="text-[10px] text-ink-muted">made with Readopp</span>
        </div>
      </div>
    </div>
  );
}
