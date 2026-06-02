"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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

interface Quota {
  isAnonymous: boolean;
  used: number;
  max: number | null;
  remaining: number | null;
  blocked: boolean;
}

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
  const [quota, setQuota] = useState<Quota | null>(null);

  const valid = useMemo(() => looksLikeUrl(url), [url]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/quota", { cache: "no-store" })
      .then((r) => r.json())
      .then((q: Quota) => {
        if (!cancelled) setQuota(q);
      })
      .catch(() => {
        // Quota is decorative — don't surface a network error here.
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      if (res.status === 402) {
        // Free-limit reached — flip into blocked state.
        setQuota(data?.quota ?? null);
        setSubmitting(false);
        return;
      }
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

  const blocked = quota?.blocked === true;

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
          disabled={submitting || blocked}
          className="w-full rounded-md border border-paper-line bg-white px-4 py-3 text-base text-ink placeholder:text-ink-faint focus:border-ink focus:outline-none disabled:cursor-not-allowed disabled:bg-paper-soft"
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
                disabled={submitting || blocked}
                title={opt.hint}
                className={
                  "rounded-md border px-3 py-2 text-sm transition-colors " +
                  (selected
                    ? "border-accent bg-accent text-paper"
                    : "border-paper-line bg-white text-ink-soft hover:border-ink-muted") +
                  " disabled:cursor-not-allowed disabled:opacity-60"
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

      {blocked && quota && <BlockedPanel quota={quota} />}

      {!blocked && (
        <button
          type="submit"
          disabled={!valid || submitting}
          className="w-full rounded-md bg-accent px-4 py-3 text-base font-medium text-paper shadow-[0_1px_0_rgba(13,87,134,0.3)] transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:bg-ink-faint disabled:shadow-none"
        >
          {submitting ? "Starting…" : "Explain"}
        </button>
      )}

      {!blocked && quota?.isAnonymous && quota.used > 0 && quota.max !== null && (
        <p className="text-center text-xs text-ink-muted">
          <span className="font-mono tabular-nums text-ink-soft">
            {quota.used} of {quota.max}
          </span>{" "}
          free generations used
        </p>
      )}
    </form>
  );
}

function BlockedPanel({ quota }: { quota: Quota }) {
  return (
    <div className="space-y-3 rounded-lg border border-paper-line bg-paper-soft p-4">
      <div>
        <p className="text-sm font-medium text-ink">
          You&rsquo;ve used your {quota.max} free generations.
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          Sign in to keep generating explainers — your existing work stays
          attached to your account.
        </p>
      </div>
      <button
        type="button"
        disabled
        title="Sign-in coming in the next release"
        className="w-full rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-paper transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
      >
        Sign in (coming soon)
      </button>
    </div>
  );
}
