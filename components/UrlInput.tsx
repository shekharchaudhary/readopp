"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { signInWithGoogle } from "@/lib/supabase/auth";
import type { AudienceLevel, BrandStyle, PublishingGoal, VoiceProfileId } from "@/lib/shared/schemas";
import { VOICE_PROFILES } from "@/lib/voiceProfiles";
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

const STYLE_OPTIONS: {
  value: BrandStyle;
  label: string;
  hint: string;
}[] = [
  {
    value: "editorial",
    label: "Editorial",
    hint: "Calm serif on paper, hairline rules",
  },
  {
    value: "bold",
    label: "Bold",
    hint: "Loud full-bleed colour, heavy uppercase type",
  },
  {
    value: "clean",
    label: "Clean",
    hint: "Editorial diagrams, thin blue line-art on off-white",
  },
];

const GOAL_OPTIONS: { value: PublishingGoal; label: string; hint: string }[] = [
  { value: "teach", label: "Teach", hint: "Explain the idea clearly" },
  { value: "key_findings", label: "Findings", hint: "Lead with evidence" },
  { value: "make_argument", label: "Argue", hint: "Build a persuasive case" },
  { value: "promote_source", label: "Promote", hint: "Drive readers to the source" },
  { value: "start_discussion", label: "Discuss", hint: "Invite thoughtful responses" },
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
  const [style, setStyle] = useState<BrandStyle>("editorial");
  const [publishingGoal, setPublishingGoal] = useState<PublishingGoal>("teach");
  const [voiceProfileId, setVoiceProfileId] = useState<VoiceProfileId>("clear_expert");
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
      form.append("style", style);
      form.append("publishingGoal", publishingGoal);
      form.append("voiceProfileId", voiceProfileId);
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
        body: JSON.stringify({ url: url.trim(), audienceLevel: audience, style, publishingGoal, voiceProfileId }),
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
    <form onSubmit={submit} className="space-y-5">
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <label htmlFor="url" className="block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Paste your source
          </label>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={submitting || !!uploading || blocked}
            className="text-xs font-semibold text-sky-deep transition-opacity hover:text-sky disabled:cursor-not-allowed disabled:opacity-50"
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
          placeholder="Drop an article, newsletter, or paper URL…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={submitting || !!uploading || blocked}
          className="w-full rounded-xl border border-paper-line bg-paper px-4 py-3.5 text-base text-ink outline-none transition placeholder:text-ink-faint focus:border-sky focus:ring-4 focus:ring-sky/10 disabled:cursor-not-allowed disabled:bg-paper-soft"
        />
      </div>

      <fieldset>
        <legend className="mb-3 block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">What should this post do?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {GOAL_OPTIONS.map((opt) => {
            const selected = publishingGoal === opt.value;
            return <button type="button" key={opt.value} title={opt.hint} aria-pressed={selected} disabled={submitting || !!uploading || blocked} onClick={() => setPublishingGoal(opt.value)} className={"rounded-xl border px-2 py-2.5 text-xs font-medium transition-all " + (selected ? "border-sky bg-sky text-white" : "border-paper-line bg-surface text-ink-soft hover:border-ink-muted") + " disabled:opacity-60"}>{opt.label}</button>;
          })}
        </div>
        <p className="mt-2 text-xs text-ink-muted">{GOAL_OPTIONS.find((o) => o.value === publishingGoal)?.hint}</p>
      </fieldset>

      <fieldset>
        <legend className="mb-3 block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
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
                  "rounded-full border px-3 py-2 text-xs font-medium transition-all " +
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

      <fieldset>
        <legend className="mb-3 block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          Visual style
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {STYLE_OPTIONS.map((opt) => {
            const selected = style === opt.value;
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => setStyle(opt.value)}
                disabled={submitting || !!uploading || blocked}
                title={opt.hint}
                className={
                  "rounded-xl border px-3 py-2.5 text-xs font-medium transition-all " +
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
          {STYLE_OPTIONS.find((o) => o.value === style)?.hint}
        </p>
      </fieldset>

      <fieldset>
        <legend className="mb-3 block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          Editorial voice
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {VOICE_PROFILES.map((profile) => {
            const selected = voiceProfileId === profile.id;
            return (
              <button type="button" key={profile.id} onClick={() => setVoiceProfileId(profile.id)} disabled={submitting || !!uploading || blocked} title={profile.instruction} aria-pressed={selected} className={"rounded-xl border px-3 py-2.5 text-left transition-all " + (selected ? "border-sky bg-sky text-white" : "border-paper-line bg-surface text-ink-soft hover:border-ink-muted") + " disabled:opacity-60"}>
                <span className="block text-xs font-semibold">{profile.name}</span>
                <span className={"mt-1 block text-[10px] leading-4 " + (selected ? "text-white/75" : "text-ink-muted")}>{profile.description}</span>
              </button>
            );
          })}
        </div>
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
          className="group flex w-full items-center justify-center gap-3 rounded-xl bg-[#111827] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_-12px_rgba(17,24,39,.7)] transition hover:-translate-y-0.5 hover:bg-sky-deep disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-ink-faint disabled:shadow-none"
        >
          {submitting ? "Building your visual…" : <><span>Turn this into a visual post</span><span aria-hidden className="transition-transform group-hover:translate-x-1">→</span></>}
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
