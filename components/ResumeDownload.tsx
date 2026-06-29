"use client";

import { useState } from "react";
import {
  RESUME_PAGE_TEMPLATES,
  type ResumePageTemplateId,
} from "@/lib/render/resumePage";

/**
 * Resume document download: pick one of the single-page templates and
 * build a print-ready, selectable-text PDF via the resume export route.
 * Only mounted when the explainer carries a structured `resumeDoc`.
 */
export function ResumeDownload({ explainerId }: { explainerId: string }) {
  const [template, setTemplate] = useState<ResumePageTemplateId>("classic");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = RESUME_PAGE_TEMPLATES.find((t) => t.id === template);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/explainers/${explainerId}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data?.error || `Build failed (${res.status})`);
      }
      // Open in a new tab — the export route serves the PDF inline, so the
      // browser shows it and the user can save from there.
      window.open(data.url as string, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't build the résumé PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-paper-line bg-paper-soft px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h2 className="text-sm font-medium text-ink">Download as a résumé</h2>
          <p className="max-w-md text-xs text-ink-muted">
            A real one-page PDF with selectable text — stays parseable by
            applicant tracking systems.
          </p>
        </div>
        <button
          type="button"
          onClick={download}
          disabled={busy}
          className="shrink-0 rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Building…" : "Download PDF"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {RESUME_PAGE_TEMPLATES.map((t) => {
          const selected = t.id === template;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplate(t.id)}
              aria-pressed={selected}
              className={
                "rounded-md border px-3 py-1.5 text-xs transition-colors " +
                (selected
                  ? "border-accent bg-surface text-ink"
                  : "border-paper-line bg-surface text-ink-soft hover:border-ink-muted")
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {active && <p className="mt-2 text-xs text-ink-faint">{active.blurb}</p>}
      {error && <p className="mt-2 text-xs text-coral">{error}</p>}
    </section>
  );
}
