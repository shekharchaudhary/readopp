"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { signInWithGoogle } from "@/lib/supabase/auth";
import type { AudienceLevel } from "@/lib/shared/schemas";
import { GoogleLogo } from "./GoogleLogo";

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

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB — matches /api/jobs/upload cap

export function UrlInput() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [audience, setAudience] = useState<AudienceLevel>("general");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null); // filename being uploaded
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

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

  async function uploadFile(file: File) {
    setError(null);
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      setError("Only PDF files are supported.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(
        `File is too large (${(file.size / 1_000_000).toFixed(1)} MB). Limit is ${MAX_UPLOAD_BYTES / 1_000_000} MB.`
      );
      return;
    }
    setUploading(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("audienceLevel", audience);
      const res = await fetch("/api/jobs/upload", { method: "POST", body: form });
      const data = await res.json();
      if (res.status === 402) {
        setQuota(data?.quota ?? null);
        setUploading(null);
        return;
      }
      if (!res.ok) {
        setError(data?.error || `Upload failed (${res.status})`);
        setUploading(null);
        return;
      }
      router.push(`/j/${data.jobId}`);
    } catch (e) {
      setError((e as Error).message || "Network error");
      setUploading(null);
    }
  }

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
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <label htmlFor="url" className="block text-sm font-medium text-ink-soft">
            Article URL
          </label>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={submitting || !!uploading || blocked}
            className="text-xs font-medium text-accent transition-opacity hover:text-accent-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? `Uploading ${uploading}…` : "or upload a PDF →"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadFile(f);
              e.target.value = ""; // allow re-selecting the same file
            }}
          />
        </div>
        <input
          id="url"
          type="url"
          autoComplete="url"
          autoFocus
          placeholder="https://example.com/some-article"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={submitting || !!uploading || blocked}
          className="w-full rounded-md border border-paper-line bg-surface px-4 py-3 text-base text-ink placeholder:text-ink-faint focus:border-ink focus:outline-none disabled:cursor-not-allowed disabled:bg-paper-soft"
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
                disabled={submitting || !!uploading || blocked}
                title={opt.hint}
                className={
                  "rounded-md border px-3 py-2 text-sm transition-colors " +
                  (selected
                    ? "border-sky bg-sky text-white"
                    : "border-paper-line bg-surface text-ink-soft hover:border-ink-muted") +
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

      {!blocked && quota?.isAnonymous && approachingLimit(quota) && (
        <ApproachingLimitNudge quota={quota} />
      )}

      {!blocked && (
        <button
          type="submit"
          disabled={!valid || submitting || !!uploading}
          className="w-full rounded-md bg-sky px-4 py-3 text-base font-medium text-white shadow-[0_1px_0_rgba(13,87,134,0.3)] transition-[filter,background-color] hover:brightness-110 disabled:cursor-not-allowed disabled:bg-ink-faint disabled:shadow-none"
        >
          {submitting ? "Starting…" : "Explain"}
        </button>
      )}

      {!blocked && quota?.isAnonymous && quota.max !== null && (
        <p className="text-center text-xs text-ink-muted">
          {quota.used === 0 ? (
            <>
              <span className="font-mono tabular-nums text-ink-soft">
                {quota.max} free generations
              </span>{" "}
              available — no sign-in needed
            </>
          ) : (
            <>
              <span className="font-mono tabular-nums text-ink-soft">
                {quota.used} of {quota.max}
              </span>{" "}
              free generations used
            </>
          )}
        </p>
      )}
    </form>
  );
}

function BlockedPanel({ quota }: { quota: Quota }) {
  const [busy, setBusy] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  async function start() {
    if (busy) return;
    setBusy(true);
    setSignInError(null);
    try {
      await signInWithGoogle("/");
      // Browser navigates to Google; if it doesn't, fall back to clearing busy.
    } catch (e) {
      setSignInError((e as Error).message || "Sign-in failed.");
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3 rounded-lg border border-paper-line bg-paper-soft p-4">
      <div>
        <p className="text-sm font-medium text-ink">
          You&rsquo;ve used your {quota.max} free generations.
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          Sign in with Google to keep generating — your existing explainers
          stay attached to your account.
        </p>
      </div>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2.5 rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {!busy && <GoogleLogo size={16} />}
        {busy ? "Redirecting…" : "Sign in with Google"}
      </button>
      {signInError && (
        <p className="text-[11px] text-red-600" role="alert">
          {signInError}
        </p>
      )}
    </div>
  );
}

/**
 * True when the user is one generation away from hitting their free
 * limit — surfaces the sign-in nudge before they hit the hard wall, so
 * their already-generated explainers don't feel orphaned.
 */
function approachingLimit(q: Quota): boolean {
  if (q.max == null) return false;
  return q.used >= q.max - 1 && q.used < q.max;
}

function ApproachingLimitNudge({ quota }: { quota: Quota }) {
  const [busy, setBusy] = useState(false);
  const remaining = (quota.max ?? 0) - quota.used;
  async function start() {
    if (busy) return;
    setBusy(true);
    try {
      await signInWithGoogle("/");
    } catch {
      setBusy(false);
    }
  }
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-accent/30 bg-accent-soft px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-accent-deep">
          {remaining === 1 ? "1 free generation left" : `${remaining} free generations left`}
        </p>
        <p className="mt-0.5 text-xs text-ink-soft">
          Sign in with Google to save what you&rsquo;ve made — they&rsquo;ll stay
          attached to your account across devices.
        </p>
      </div>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="shrink-0 self-center rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "…" : "Sign in"}
      </button>
    </div>
  );
}
