"use client";

import type { Job, JobStatus } from "@/lib/shared/schemas";

const STAGES: { key: JobStatus; label: string }[] = [
  { key: "queued", label: "Queued" },
  { key: "ingesting", label: "Read" },
  { key: "planning", label: "Plan" },
  { key: "rendering", label: "Render" },
  { key: "assembling", label: "Assemble" },
  { key: "completed", label: "Done" },
];

const ORDER: Record<JobStatus, number> = {
  queued: 0,
  ingesting: 1,
  comprehending: 2,
  awaiting_approval: 2,
  structuring: 2,
  planning: 2,
  rendering: 3,
  assembling: 4,
  completed: 5,
  failed: -1,
};

export function StatusStrip({ job }: { job: Job }) {
  const current = ORDER[job.status] ?? 0;
  const failed = job.status === "failed";

  const lastNote = job.progress[job.progress.length - 1]?.note;

  return (
    <div className="space-y-3">
      <ol className="flex flex-wrap gap-x-3 gap-y-2 text-xs">
        {STAGES.map((s, i) => {
          const done = !failed && i < current;
          const active = !failed && i === current;
          return (
            <li key={s.key} className="flex items-center gap-2">
              <span
                aria-hidden
                className={
                  "inline-block h-1.5 w-1.5 rounded-full " +
                  (done
                    ? "bg-ink"
                    : active
                    ? "bg-ink animate-pulse"
                    : "bg-paper-line")
                }
              />
              <span
                className={
                  done || active ? "text-ink-soft" : "text-ink-faint"
                }
              >
                {s.label}
              </span>
            </li>
          );
        })}
        {failed && (
          <li className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full bg-ink"
            />
            <span className="text-ink-soft">Failed</span>
          </li>
        )}
      </ol>
      {lastNote && (
        <p className="text-sm text-ink-muted" aria-live="polite">
          {lastNote}
        </p>
      )}
    </div>
  );
}
