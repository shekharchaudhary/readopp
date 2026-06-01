"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExportSheet } from "@/components/ExportSheet";
import { PanelStream } from "@/components/PanelStream";
import { WorkingScene } from "@/components/WorkingScene";
import { failureCopy } from "@/lib/errorMessages";
import { useJobStream } from "@/lib/scene/useJobStream";
import type { Job } from "@/lib/shared/schemas";

function sourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Re-fetches the persisted job record. Initial fetch gets URL + audienceLevel
 * for the header; a re-fetch after completion gets final usage counts.
 */
function useJobMeta(jobId: string, refetchKey: number) {
  const [job, setJob] = useState<Job | null>(null);
  const [notFound, setNotFound] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const data: { job: Job } = await res.json();
        if (!cancelled) setJob(data.job);
      } catch {
        // ignore — the stream will surface real failures
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, refetchKey]);
  return { job, notFound };
}

export default function JobPage({ params }: { params: { jobId: string } }) {
  const { scene, error: streamError } = useJobStream(params.jobId);
  const completed = scene.status === "completed";
  const failed = scene.status === "failed";
  // Re-fetch job meta once when terminal so we get the final usage tally.
  const { job, notFound } = useJobMeta(
    params.jobId,
    completed || failed ? 1 : 0
  );

  const [exportOpen, setExportOpen] = useState(false);
  const [exportPanelId, setExportPanelId] = useState<string | undefined>(
    undefined
  );
  // Local override layer for inline edits. Keyed by sectionId. Merged on top of
  // the streamed panel slots so edits show immediately and persist via API.
  const [edits, setEdits] = useState<
    Record<string, { heading?: string; caption?: string; content?: string }>
  >({});

  function openExportAll() {
    setExportPanelId(undefined);
    setExportOpen(true);
  }
  function openExportPanel(sectionId: string) {
    setExportPanelId(sectionId);
    setExportOpen(true);
  }

  async function patchPanel(
    sectionId: string,
    patch: { heading?: string; caption?: string; content?: string }
  ) {
    const explainerId = scene.explainer?.id;
    if (!explainerId) throw new Error("Explainer not ready yet.");
    const res = await fetch(
      `/api/explainers/${explainerId}/panels/${sectionId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `Save failed (${res.status})`);
    setEdits((prev) => ({
      ...prev,
      [sectionId]: { ...prev[sectionId], ...patch },
    }));
  }

  // Apply local edit overrides to the streamed slot panels.
  const slotsWithEdits = scene.panels.map((slot) => {
    if (!slot.panel) return slot;
    const o = edits[slot.panel.sectionId];
    if (!o) return slot;
    return {
      ...slot,
      panel: {
        ...slot.panel,
        heading: o.heading ?? slot.panel.heading,
        caption: o.caption ?? slot.panel.caption,
        content: o.content ?? slot.panel.content,
      },
    };
  });

  const headerTitle = scene.explainer?.title
    ? scene.explainer.title
    : failed
    ? "Couldn’t build an explainer"
    : "Building your explainer";

  if (notFound) {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <Link
          href="/"
          className="inline-block text-sm text-ink-muted hover:text-ink"
        >
          ← New explainer
        </Link>
        <p className="text-base text-ink-soft">
          That job ID doesn’t exist (or the dev server restarted — in-memory jobs
          don’t survive a restart).
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-10">
      <Link
        href="/"
        className="inline-block text-sm text-ink-muted hover:text-ink"
      >
        ← New explainer
      </Link>

      <header className="flex items-start justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-3xl">
            {headerTitle}
          </h1>
          {job && (
            <p className="text-sm text-ink-muted">
              <span>{sourceDomain(job.url)}</span>
              <span className="mx-2">·</span>
              <span>audience: {job.audienceLevel}</span>
            </p>
          )}
          {scene.explainer?.summary && (
            <p className="max-w-2xl text-base text-ink-soft">
              {scene.explainer.summary}
            </p>
          )}
        </div>
        {completed && scene.explainer && (
          <div className="flex shrink-0 flex-col items-end gap-2">
            <CopyLinkButton explainerId={scene.explainer.id} />
            <button
              type="button"
              onClick={openExportAll}
              className="rounded-md border border-paper-line bg-white px-3 py-2 text-sm text-ink-soft hover:border-ink-muted"
            >
              Export all
            </button>
          </div>
        )}
      </header>

      {streamError && (
        <div className="rounded-md border border-paper-line bg-paper-soft px-3 py-2 text-sm text-ink-soft">
          {streamError}
        </div>
      )}

      {!completed && <WorkingScene scene={scene} />}

      {failed && scene.error && (
        <FailureBlock
          reason={scene.error.reason}
          message={scene.error.message}
        />
      )}

      <PanelStream
        slots={slotsWithEdits}
        onExportPanel={completed ? openExportPanel : undefined}
        onEditPanel={completed ? patchPanel : undefined}
      />

      {completed && job?.usage && job.usage.calls > 0 && (
        <UsageFooter
          inputTokens={job.usage.inputTokens}
          outputTokens={job.usage.outputTokens}
          calls={job.usage.calls}
        />
      )}

      {scene.explainer && (
        <ExportSheet
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          explainerId={scene.explainer.id}
          panelId={exportPanelId}
        />
      )}
    </main>
  );
}

function UsageFooter({
  inputTokens,
  outputTokens,
  calls,
}: {
  inputTokens: number;
  outputTokens: number;
  calls: number;
}) {
  const total = inputTokens + outputTokens;
  return (
    <footer className="border-t border-paper-line pt-4 text-xs text-ink-muted">
      {calls} model call{calls === 1 ? "" : "s"} ·{" "}
      {inputTokens.toLocaleString()} in · {outputTokens.toLocaleString()} out ·{" "}
      {total.toLocaleString()} total tokens
    </footer>
  );
}

function CopyLinkButton({ explainerId }: { explainerId: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/e/${explainerId}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-md border border-paper-line bg-white px-3 py-2 text-sm text-ink-soft hover:border-ink-muted"
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

function FailureBlock({
  reason,
  message,
}: {
  reason: string;
  message: string;
}) {
  const copy = failureCopy(reason);
  return (
    <section className="rounded-lg border border-paper-line bg-paper-soft px-4 py-4 text-sm text-ink-soft">
      <p className="font-medium text-ink">{copy.title}</p>
      <p className="mt-1">{message}</p>
      <p className="mt-3 text-xs text-ink-muted">{copy.hint}</p>
    </section>
  );
}
