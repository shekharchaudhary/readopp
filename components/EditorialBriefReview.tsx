"use client";

import { useId, useState } from "react";
import type { EditorialBrief } from "@/lib/shared/schemas";
import { panelCountRangeLabel } from "@/lib/storyLength";

export function EditorialBriefReview({
  jobId,
  initialBrief,
}: {
  jobId: string;
  initialBrief: EditorialBrief;
}) {
  const [brief, setBrief] = useState(initialBrief);
  const [customizing, setCustomizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const directionOptionsId = useId();
  const storyLengthOptionsId = useId();
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
    try {
      const res = await fetch(`/api/jobs/${jobId}/brief`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, approve: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not approve the brief.");
        setSaving(false);
      }
      // On success, keep the button locked while the existing SSE connection
      // moves the job into production and replaces this review.
    } catch {
      setError("Could not start production. Check your connection and try again.");
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-paper-line bg-surface p-5 shadow-sm sm:p-7">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Recommended story
        </p>
        <h2 className="mt-2 text-2xl font-medium tracking-tight text-ink">
          We found the strongest angle
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          Readopp chose a clear direction from your source. Create it now, or open the options below to compare and refine.
        </p>
      </div>

      {brief.storyLength ? (
        <fieldset
          id={storyLengthOptionsId}
          className="mt-6 rounded-2xl border border-paper-line bg-paper-soft p-4 sm:p-5"
        >
          <legend className="px-1 text-sm font-semibold text-ink">
            Story length
          </legend>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <p className="text-sm leading-6 text-ink-soft">
                We recommend {panelCountRangeLabel(brief.storyLength)}. {brief.storyLength.reason}
              </p>
              <p className="mt-1 text-xs leading-5 text-ink-muted">
                Keep the recommendation, or choose an exact length for this story.
              </p>
            </div>
            <div
              role="group"
              aria-label="Choose story length"
              className="grid grid-cols-6 gap-1.5 rounded-xl bg-surface p-1.5 shadow-sm ring-1 ring-paper-line"
            >
              <button
                type="button"
                aria-pressed={brief.storyLength.target === undefined}
                onClick={() =>
                  setBrief((current) => ({
                    ...current,
                    storyLength: current.storyLength
                      ? { ...current.storyLength, target: undefined }
                      : current.storyLength,
                  }))
                }
                className={`min-h-10 rounded-lg px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                  brief.storyLength.target === undefined
                    ? "bg-ink text-paper shadow-sm"
                    : "text-ink-soft hover:bg-paper"
                }`}
              >
                Auto
              </button>
              {[1, 2, 3, 4, 5].map((count) => {
                const active = brief.storyLength?.target === count;
                return (
                  <button
                    key={count}
                    type="button"
                    aria-label={`${count} panel${count === 1 ? "" : "s"}`}
                    aria-pressed={active}
                    onClick={() =>
                      setBrief((current) => ({
                        ...current,
                        storyLength: current.storyLength
                          ? { ...current.storyLength, target: count }
                          : current.storyLength,
                      }))
                    }
                    className={`min-h-10 min-w-10 rounded-lg text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                      active
                        ? "bg-ink text-paper shadow-sm"
                        : "text-ink-soft hover:bg-paper"
                    }`}
                  >
                    {count}
                  </button>
                );
              })}
            </div>
          </div>
        </fieldset>
      ) : null}

      {selected && !customizing ? (
        <article
          data-testid="selected-story-direction"
          className="mt-6 rounded-2xl border border-accent/40 bg-accent/5 p-5"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              {selected.name}
            </span>
            <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-muted">
              Selected
            </span>
          </div>
          <p className="mt-3 max-w-3xl text-lg font-medium leading-7 text-ink">
            {selected.hook}
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-muted">
            {selected.outcome}
          </p>
        </article>
      ) : null}

      <div className="mt-5 border-t border-paper-line pt-4">
        <button
          type="button"
          aria-expanded={customizing}
          aria-controls={directionOptionsId}
          onClick={() => setCustomizing((current) => !current)}
          className="flex w-full items-center justify-between gap-4 text-left text-sm font-medium text-ink-soft"
        >
          <span>
            {customizing
              ? "Done comparing"
              : "Compare other angles or edit the wording"}
          </span>
          <span
            aria-hidden
            className={`text-lg text-ink-muted transition-transform ${
              customizing ? "rotate-45" : ""
            }`}
          >
            +
          </span>
        </button>

        {customizing ? (
          <div id={directionOptionsId} className="mt-5">
            <p className="mb-3 text-sm leading-6 text-ink-muted">
              Choose the way your story should open and unfold.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {brief.directions.map((direction) => {
                const active = direction.id === brief.selectedDirectionId;
                return (
                  <button
                    key={direction.id}
                    type="button"
                    aria-label={`Choose ${direction.name} direction`}
                    aria-pressed={active}
                    onClick={() =>
                      setBrief((current) => ({
                        ...current,
                        selectedDirectionId: direction.id,
                      }))
                    }
                    className={`rounded-xl border p-4 text-left transition ${
                      active
                        ? "border-accent bg-accent/5 ring-1 ring-accent"
                        : "border-paper-line bg-paper-soft hover:border-ink-muted"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-ink">
                        {direction.name}
                      </span>
                      {active ? (
                        <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-muted">
                          Selected
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-3 block text-sm font-medium leading-5 text-ink">
                      {direction.hook}
                    </span>
                    <span className="mt-2 line-clamp-3 block text-xs leading-5 text-ink-muted">
                      {direction.angle}
                    </span>
                    <span className="mt-3 block border-t border-paper-line pt-3 text-[11px] leading-4 text-ink-muted">
                      <span className="font-semibold uppercase tracking-wider text-ink-soft">
                        Best for
                      </span>{" "}
                      {direction.outcome}
                    </span>
                  </button>
                );
              })}
            </div>

            {selected ? (
              <div className="mt-5 grid gap-4">
                <label className="grid gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-muted">
                  Opening hook
                  <textarea
                    value={selected.hook}
                    maxLength={220}
                    rows={2}
                    onChange={(event) =>
                      updateSelected({ hook: event.target.value })
                    }
                    className="rounded-lg border border-paper-line bg-paper px-3 py-2 text-sm normal-case tracking-normal text-ink outline-none focus:border-accent"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-muted">
                  Narrative angle
                  <textarea
                    value={selected.angle}
                    maxLength={500}
                    rows={3}
                    onChange={(event) =>
                      updateSelected({ angle: event.target.value })
                    }
                    className="rounded-lg border border-paper-line bg-paper px-3 py-2 text-sm normal-case tracking-normal text-ink outline-none focus:border-accent"
                  />
                </label>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          disabled={saving || !selected?.hook.trim() || !selected?.angle.trim()}
          onClick={approve}
          className="w-full rounded-xl bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {saving ? "Starting production…" : "Create this story →"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}
