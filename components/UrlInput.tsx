"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { AudienceLevel } from "@/lib/shared/schemas";

const AUDIENCE_OPTIONS: {
  value: AudienceLevel;
  label: string;
  hint: string;
}[] = [
  {
    value: "general",
    label: "General",
    hint: "No background knowledge assumed",
  },
  {
    value: "student",
    label: "Student",
    hint: "Curious, basic literacy in the field",
  },
  {
    value: "professional",
    label: "Professional",
    hint: "Working knowledge of the domain",
  },
  {
    value: "technical",
    label: "Technical",
    hint: "Expert; precise component names",
  },
];

function looksLikeUrl(s: string): boolean {
  try {
    const u = new URL(s.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function UrlInput() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [audience, setAudience] = useState<AudienceLevel>("general");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = useMemo(() => looksLikeUrl(url), [url]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!valid) {
      setError("Please paste a valid http or https URL.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), audienceLevel: audience }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || `Request failed (${res.status})`);
        setSubmitting(false);
        return;
      }
      router.push(`/j/${data.jobId}`);
    } catch (e) {
      setError((e as Error).message || "Network error");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <label
          htmlFor="url"
          className="mb-2 block text-sm font-medium text-ink-soft"
        >
          Article URL
        </label>
        <input
          id="url"
          type="url"
          autoComplete="url"
          autoFocus
          placeholder="https://example.com/some-article"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={submitting}
          className="w-full rounded-md border border-paper-line bg-white px-4 py-3 text-base text-ink placeholder:text-ink-faint focus:border-ink focus:outline-none"
        />
      </div>

      <fieldset>
        <legend className="mb-3 block text-sm font-medium text-ink-soft">
          Audience level
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {AUDIENCE_OPTIONS.map((opt) => {
            const selected = audience === opt.value;
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => setAudience(opt.value)}
                disabled={submitting}
                title={opt.hint}
                className={
                  "rounded-md border px-3 py-2 text-sm transition-colors " +
                  (selected
                    ? "border-accent bg-accent text-paper"
                    : "border-paper-line bg-white text-ink-soft hover:border-ink-muted")
                }
                aria-pressed={selected}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          {AUDIENCE_OPTIONS.find((o) => o.value === audience)?.hint}
        </p>
      </fieldset>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-paper-line bg-paper-soft px-3 py-2 text-sm text-ink-soft"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!valid || submitting}
        className="w-full rounded-md bg-accent px-4 py-3 text-base font-medium text-paper shadow-[0_1px_0_rgba(8,80,65,0.3)] transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:bg-ink-faint disabled:shadow-none"
      >
        {submitting ? "Starting…" : "Explain"}
      </button>
    </form>
  );
}
