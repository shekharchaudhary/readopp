"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExportSheet } from "@/components/ExportSheet";
import { PanelStream } from "@/components/PanelStream";
import { WorkingScene } from "@/components/WorkingScene";
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
 * One-shot fetch of the persisted job record. We use this just to get the
 * URL + audienceLevel for the header before any events have arrived (and as
 * an existence check — 404s render a clean "not found" state).
 */
function useJobMeta(jobId: string) {
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
  }, [jobId]);
  return { job, notFound };
}

export default function JobPage({ params }: { params: { jobId: string } }) {
  const { job, notFound } = useJobMeta(params.jobId);
  const { scene, error: streamError } = useJobStream(params.jobId);

  const completed = scene.status === "completed";
  const failed = scene.status === "failed";

  const [exportOpen, setExportOpen] = useState(false);
  const [exportPanelId, setExportPanelId] = useState<string | undefined>(
    undefined
  );

  function openExportAll() {
    setExportPanelId(undefined);
    setExportOpen(true);
  }
  function openExportPanel(sectionId: string) {
    setExportPanelId(sectionId);
    setExportOpen(true);
  }

  const headerTitle = scene.explainer?.title
    ? scene.explainer.title
    : failed
    ? "Couldn’t build an explainer"
    : "Building your explainer";

  if (notFound) {
    return (
      <main className="space-y-6">
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
    <main className="space-y-8">
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
          <div className="shrink-0">
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

      <WorkingScene scene={scene} collapsed={completed} />

      {failed && scene.error && (
        <section className="rounded-lg border border-paper-line bg-paper-soft px-4 py-4 text-sm text-ink-soft">
          <p className="font-medium text-ink">
            {failureTitle(scene.error.reason)}
          </p>
          <p className="mt-1">{scene.error.message}</p>
          <p className="mt-3 text-xs text-ink-muted">
            Try a different article — clean technical blog posts work best.
          </p>
        </section>
      )}

      <PanelStream
        slots={scene.panels}
        onExportPanel={completed ? openExportPanel : undefined}
      />

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

function failureTitle(reason: string): string {
  switch (reason) {
    case "invalid_url":
      return "That URL didn’t look right.";
    case "fetch_failed":
      return "The page couldn’t be fetched.";
    case "paywalled":
      return "This article is behind a paywall.";
    case "login_required":
      return "This page needs a login.";
    case "empty_content":
      return "There wasn’t enough text to explain.";
    case "timeout":
      return "It took too long.";
    case "comprehension_failed":
      return "The pipeline couldn’t understand the article.";
    case "render_failed":
      return "The pipeline couldn’t render the panels.";
    default:
      return "Something went wrong.";
  }
}
