"use client";

import { useState } from "react";
import type { EditorialBrief } from "@/lib/shared/schemas";

export function EditorialBriefReview({
  jobId,
  initialBrief,
}: {
  jobId: string;
  initialBrief: EditorialBrief;
}) {
  const [brief, setBrief] = useState(initialBrief);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = brief.directions.find((d) => d.id === brief.selectedDirectionId) ?? brief.directions[0];

  function updateSelected(patch: { hook?: string; angle?: string }) {
    setBrief((current) => ({
      ...current,
      directions: current.directions.map((direction) =>
        direction.id === current.selectedDirectionId ? { ...direction, ...patch } : direction
      ),
    }));
  }

  async function approve() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/jobs/${jobId}/brief`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief, approve: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not approve the brief.");
      setSaving(false);
      return;
    }
    // The existing SSE connection receives the queued/production events.
  }

  return (
    <section className="rounded-2xl border border-paper-line bg-surface p-5 shadow-sm sm:p-7">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Editorial checkpoint</p>
        <h2 className="mt-2 text-2xl font-medium tracking-tight text-ink">Choose the story before we design it</h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">We read the source and prepared three viable directions. Pick one, sharpen the language if needed, then approve production.</p>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {brief.directions.map((direction) => {
          const active = direction.id === brief.selectedDirectionId;
          return (
            <button
              key={direction.id}
              type="button"
              onClick={() => setBrief((current) => ({ ...current, selectedDirectionId: direction.id }))}
              className={`rounded-xl border p-4 text-left transition ${active ? "border-accent bg-accent/5 ring-1 ring-accent" : "border-paper-line bg-paper-soft hover:border-ink-muted"}`}
            >
              <span className="text-sm font-semibold text-ink">{direction.name}</span>
              <span className="mt-2 block text-sm leading-5 text-ink-soft">{direction.hook}</span>
              <span className="mt-3 block text-xs leading-5 text-ink-muted">{direction.outcome}</span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-6 grid gap-4">
          <label className="grid gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-muted">
            Opening hook
            <textarea value={selected.hook} maxLength={220} rows={2} onChange={(e) => updateSelected({ hook: e.target.value })} className="rounded-lg border border-paper-line bg-paper px-3 py-2 text-sm normal-case tracking-normal text-ink outline-none focus:border-accent" />
          </label>
          <label className="grid gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-muted">
            Narrative angle
            <textarea value={selected.angle} maxLength={500} rows={3} onChange={(e) => updateSelected({ angle: e.target.value })} className="rounded-lg border border-paper-line bg-paper px-3 py-2 text-sm normal-case tracking-normal text-ink outline-none focus:border-accent" />
          </label>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-xs text-ink-muted">Approval resumes the outline, design, and publishing stages.</p>
        <button type="button" disabled={saving || !selected?.hook.trim() || !selected?.angle.trim()} onClick={approve} className="rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-50">
          {saving ? "Starting production…" : "Approve & create"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}
