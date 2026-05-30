"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PanelCard } from "@/components/PanelCard";
import { StatusStrip } from "@/components/StatusStrip";
import type { Job } from "@/lib/shared/schemas";

const POLL_INTERVAL_MS = 1200;

function useJob(jobId: string) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        if (!res.ok) {
          if (res.status === 404) {
            setError("Job not found.");
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data: { job: Job } = await res.json();
        if (cancelled) return;
        setJob(data.job);
        if (
          data.job.status !== "completed" &&
          data.job.status !== "failed"
        ) {
          timer = setTimeout(tick, POLL_INTERVAL_MS);
        }
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
        timer = setTimeout(tick, POLL_INTERVAL_MS * 2);
      }
    }
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  return { job, error };
}

function sourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function JobPage({ params }: { params: { jobId: string } }) {
  const { job, error } = useJob(params.jobId);

  const explainer = job?.explainer;

  const headerTitle = useMemo(() => {
    if (explainer) return explainer.title;
    if (job?.status === "failed") return "Couldn’t build an explainer";
    return "Building your explainer";
  }, [explainer, job?.status]);

  return (
    <main className="space-y-8">
      <Link
        href="/"
        className="inline-block text-sm text-ink-muted hover:text-ink"
      >
        ← New explainer
      </Link>

      <header className="space-y-2">
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
        {explainer?.summary && (
          <p className="max-w-2xl text-base text-ink-soft">
            {explainer.summary}
          </p>
        )}
      </header>

      {!job && !error && (
        <p className="text-sm text-ink-muted">Loading job…</p>
      )}

      {error && (
        <div className="rounded-md border border-paper-line bg-paper-soft px-4 py-3 text-sm text-ink-soft">
          {error}
        </div>
      )}

      {job && !explainer && (
        <section className="rounded-lg border border-paper-line bg-white px-4 py-4">
          <StatusStrip job={job} />
        </section>
      )}

      {job?.status === "failed" && job.error && (
        <section className="rounded-lg border border-paper-line bg-paper-soft px-4 py-4 text-sm text-ink-soft">
          <p className="font-medium text-ink">
            {failureTitle(job.error.reason)}
          </p>
          <p className="mt-1">{job.error.message}</p>
          <p className="mt-3 text-xs text-ink-muted">
            Try a different article — clean technical blog posts work best.
          </p>
        </section>
      )}

      {explainer && (
        <section className="space-y-6">
          {explainer.panels.map((panel, i) => (
            <PanelCard key={panel.sectionId} panel={panel} index={i} />
          ))}
        </section>
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
