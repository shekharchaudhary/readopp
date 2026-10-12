"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signInWithGoogle } from "@/lib/supabase/auth";
import {
  DOCUMENT_UPLOAD_ACCEPT,
  DOCUMENT_UPLOAD_LABEL,
  isSupportedDocumentUpload,
  MAX_UPLOAD_BYTES,
} from "@/lib/documents/uploadTypes";
import type { AudienceLevel, BrandStyle, PublishingGoal, VoiceProfileId } from "@/lib/shared/schemas";
import { VOICE_PROFILES } from "@/lib/voiceProfiles";
import { CursorText } from "@/components/ui/CursorText";
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

type WorkspaceProvider = "Google Docs" | "Notion" | "Web article";

export function UrlInput() {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [audience, setAudience] = useState<AudienceLevel>("general");
  const [style, setStyle] = useState<BrandStyle>("editorial");
  const [publishingGoal, setPublishingGoal] = useState<PublishingGoal>("teach");
  const [voiceProfileId, setVoiceProfileId] = useState<VoiceProfileId>("clear_expert");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null); // filename being uploaded
  const [error, setError] = useState<string | null>(null);
  const [connectorNotice, setConnectorNotice] = useState<string | null>(null);
  const [workspaceProvider, setWorkspaceProvider] =
    useState<WorkspaceProvider | null>(null);
  const [workspaceUrl, setWorkspaceUrl] = useState("");
  const [quota, setQuota] = useState<Quota | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const googleDocsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const notionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const restoreWorkspaceFocusRef = useRef<WorkspaceProvider | null>(null);

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

  useEffect(() => {
    if (workspaceProvider || !restoreWorkspaceFocusRef.current) return;
    const provider = restoreWorkspaceFocusRef.current;
    restoreWorkspaceFocusRef.current = null;
    const focusFrame = window.requestAnimationFrame(() => {
      const trigger =
        provider === "Google Docs"
          ? googleDocsTriggerRef.current
          : notionTriggerRef.current;
      trigger?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [workspaceProvider]);

  useEffect(() => {
    if (!workspaceProvider) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeWorkspaceConnector();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [workspaceProvider]);

  async function uploadFile(file: File) {
    setError(null);
    setConnectorNotice(null);
    setWorkspaceProvider(null);
    if (!isSupportedDocumentUpload(file.name, file.type)) {
      setError("Upload a PDF, Word (.docx), Markdown, or text document.");
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

  function openWorkspaceConnector(provider: WorkspaceProvider) {
    setError(null);
    setConnectorNotice(null);
    setWorkspaceUrl("");
    setWorkspaceProvider(provider);
  }

  function closeWorkspaceConnector() {
    if (!workspaceProvider) return;
    setError(null);
    restoreWorkspaceFocusRef.current = workspaceProvider;
    setWorkspaceProvider(null);
  }

  function openJournalExport() {
    setError(null);
    setWorkspaceProvider(null);
    setConnectorNotice(
      "Choose the PDF, Word, Markdown, or text export from Journal."
    );
    fileRef.current?.click();
  }

  async function submitWorkspaceLink() {
    if (!workspaceProvider || submitting || uploading || blocked) return;
    setError(null);
    setConnectorNotice(null);
    const validationError = validateWorkspaceUrl(
      workspaceUrl,
      workspaceProvider
    );
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: workspaceUrl.trim(),
          audienceLevel: audience,
          style,
          publishingGoal,
          voiceProfileId,
        }),
      });
      const data = await res.json();
      if (res.status === 402) {
        setQuota(data?.quota ?? null);
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        setError(data?.error || `Could not read this document (${res.status}).`);
        setSubmitting(false);
        return;
      }
      router.push(`/j/${data.jobId}`);
    } catch (requestError) {
      setError((requestError as Error).message || "Network error");
      setSubmitting(false);
    }
  }

  const blocked = quota?.blocked === true;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (workspaceProvider) void submitWorkspaceLink();
      }}
      onDragOver={event => { if (event.dataTransfer.types.includes("Files") && !submitting && !uploading && !blocked) { event.preventDefault(); setDragging(true); } }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={event => { if (!event.dataTransfer.types.includes("Files")) return; event.preventDefault(); setDragging(false); if (submitting || uploading || blocked) return; const file = event.dataTransfer.files[0]; if (file) void uploadFile(file); }}
      className={"interactive-source space-y-5 " + (dragging ? "is-dragging" : "")}
      aria-busy={submitting || !!uploading}
    >
      {dragging && <p role="status" className="drop-feedback">Drop your document to start a story</p>}
      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              <CursorText text="Choose your source" />
            </p>
            <p className="mt-1 text-sm text-ink-soft"><CursorText text="Bring an article, document, or reading note." /></p>
          </div>
          <span className="hidden text-[10px] font-semibold uppercase tracking-[.1em] text-ink-faint sm:block"><CursorText text="Review before generating" /></span>
        </div>

        {connectorNotice && workspaceProvider && <p role="status" className="mb-3 rounded-xl bg-paper-soft p-3 text-xs text-ink-soft">{connectorNotice}</p>}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <button
            ref={googleDocsTriggerRef}
            type="button"
            onClick={() => openWorkspaceConnector("Google Docs")}
            aria-expanded={workspaceProvider === "Google Docs"}
            aria-controls="workspace-document-link-form"
            disabled={submitting || !!uploading || blocked}
            className="group flex min-h-28 flex-col justify-between rounded-2xl border border-[#dfdfdf] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#bfcf9d] hover:shadow-[0_16px_30px_-26px_rgba(72,72,72,.65)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#648e2e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-[#e4e4e4] bg-[#fafafa] text-sm font-bold text-[#4285f4]">G</span>
            <span className="mt-4 flex w-full items-end justify-between gap-3">
              <span><b className="block text-sm text-ink"><CursorText text="Google Docs" /></b><small className="mt-1 block text-[11px] text-ink-muted"><CursorText text="Use a shared link" /></small></span>
              <span aria-hidden className="text-ink-muted transition-transform group-hover:translate-x-0.5">→</span>
            </span>
          </button>

          <button
            ref={notionTriggerRef}
            type="button"
            onClick={() => openWorkspaceConnector("Notion")}
            aria-expanded={workspaceProvider === "Notion"}
            aria-controls="workspace-document-link-form"
            disabled={submitting || !!uploading || blocked}
            className="group flex min-h-28 flex-col justify-between rounded-2xl border border-[#dfdfdf] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#bfcf9d] hover:shadow-[0_16px_30px_-26px_rgba(72,72,72,.65)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#648e2e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-[#d9d9d9] bg-white font-serif text-sm font-bold text-[#333]">N</span>
            <span className="mt-4 flex w-full items-end justify-between gap-3">
              <span><b className="block text-sm text-ink"><CursorText text="Notion" /></b><small className="mt-1 block text-[11px] text-ink-muted"><CursorText text="Use a shared link" /></small></span>
              <span aria-hidden className="text-ink-muted transition-transform group-hover:translate-x-0.5">→</span>
            </span>
          </button>

          <button
            type="button"
            onClick={openJournalExport}
            disabled={submitting || !!uploading || blocked}
            className="group flex min-h-28 flex-col justify-between rounded-2xl border border-[#dfdfdf] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#bfcf9d] hover:shadow-[0_16px_30px_-26px_rgba(72,72,72,.65)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#648e2e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <JournalLogo />
            <span className="mt-4 flex w-full items-end justify-between gap-3">
              <span><b className="block text-sm text-ink"><CursorText text="Journal" /></b><small className="mt-1 block text-[11px] text-ink-muted"><CursorText text="Upload an export" /></small></span>
              <span aria-hidden className="text-ink-muted transition-transform group-hover:translate-x-0.5">→</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={submitting || !!uploading || blocked}
            className="group flex min-h-28 flex-col justify-between rounded-2xl border border-[#dfdfdf] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#bfcf9d] hover:shadow-[0_16px_30px_-26px_rgba(72,72,72,.65)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#648e2e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#eef6df] text-base font-bold text-[#648e2e]">↑</span>
            <span className="mt-4 flex w-full items-end justify-between gap-3">
              <span><b className="block text-sm text-ink"><CursorText text="Upload document" /></b><small className="mt-1 block text-[11px] leading-4 text-ink-muted"><CursorText text={uploading ? `Uploading ${uploading}…` : DOCUMENT_UPLOAD_LABEL} /></small></span>
              <span aria-hidden className="text-ink-muted transition-transform group-hover:-translate-y-0.5">↑</span>
            </span>
          </button>
        </div>

        <p className="mt-3 text-center text-[10px] text-ink-muted"><CursorText text="You can also drag a PDF, Word, Markdown, or text file here." /></p>
        <input
          ref={fileRef}
          type="file"
          accept={DOCUMENT_UPLOAD_ACCEPT}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadFile(file);
            event.target.value = "";
          }}
        />

        {workspaceProvider ? (
          <div id="workspace-document-link-form" className="mt-3 rounded-2xl border border-paper-line bg-white p-4 shadow-[0_18px_40px_-34px_rgba(16,16,16,.55)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-ink">
                  {workspaceProvider === "Web article" ? "Start with a source link" : `Add a ${workspaceProvider} document`}
                </p>
                <p className="mt-1 text-xs leading-5 text-ink-muted">
                  Paste a public article or shared document. You’ll review the brief before Readopp creates your panels.
                </p>
              </div>
              {workspaceProvider !== "Web article" && <button
                type="button"
                onClick={closeWorkspaceConnector}
                aria-label="Close document link form"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm text-ink-muted transition hover:bg-paper hover:text-ink"
              >
                ×
              </button>}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="workspace-document-url">
                Shared {workspaceProvider} link
              </label>
              <input
                id="workspace-document-url"
                aria-invalid={!!error}
                aria-describedby={error ? "source-error" : undefined}
                type="url"
                value={workspaceUrl}
                onChange={(event) => setWorkspaceUrl(event.target.value)}
                placeholder={
                  workspaceProvider === "Google Docs"
                    ? "https://docs.google.com/document/d/…"
                    : workspaceProvider === "Notion" ? "https://your-page.notion.site/…" : "https://example.com/article"
                }
                disabled={submitting || !!uploading || blocked}
                className="min-w-0 flex-1 rounded-xl border border-paper-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-ink-muted disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={submitting || !!uploading || blocked || !workspaceUrl.trim()}
                className="shrink-0 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Reading…" : "Create story →"}
              </button>
            </div>
          </div>
        ) : connectorNotice ? (
          <p role="status" className="mt-3 rounded-xl bg-[#f5f1e9] px-4 py-3 text-xs leading-5 text-ink-soft">
            {connectorNotice}
          </p>
        ) : null}


      </div>

      <details className="group border-y border-paper-line py-3">
        <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-ink-soft">
          <span><CursorText text="Adjust the brief" /> <span className="font-normal text-ink-muted"><CursorText text="— optional" /></span></span>
          <span aria-hidden className="text-base transition-transform group-open:rotate-45">+</span>
        </summary>
        <div className="space-y-6 pt-6">
      <fieldset>
        <legend className="mb-3 block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">What should this post do?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {GOAL_OPTIONS.map((opt) => {
            const selected = publishingGoal === opt.value;
            return <button type="button" key={opt.value} title={opt.hint} aria-pressed={selected} disabled={submitting || !!uploading || blocked} onClick={() => setPublishingGoal(opt.value)} className={"border-b px-2 py-2 text-xs font-medium transition-colors " + (selected ? "border-ink text-ink" : "border-paper-line text-ink-muted hover:text-ink") + " disabled:opacity-60"}>{opt.label}</button>;
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
                  "border-b px-3 py-2 text-xs font-medium transition-colors " +
                  (selected
                    ? "border-ink text-ink"
                    : "border-paper-line text-ink-muted hover:text-ink") +
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
                  "border-b px-3 py-2.5 text-xs font-medium transition-colors " +
                  (selected
                    ? "border-ink text-ink"
                    : "border-paper-line text-ink-muted hover:text-ink") +
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
              <button type="button" key={profile.id} onClick={() => setVoiceProfileId(profile.id)} disabled={submitting || !!uploading || blocked} title={profile.instruction} aria-pressed={selected} className={"border-l px-3 py-2.5 text-left transition-colors " + (selected ? "border-ink text-ink" : "border-paper-line text-ink-soft hover:border-ink-muted") + " disabled:opacity-60"}>
                <span className="block text-xs font-semibold">{profile.name}</span>
                <span className="mt-1 block text-[10px] leading-4 text-ink-muted">{profile.description}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
        </div>
      </details>

      {error && (
        <div
          id="source-error"
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

function validateWorkspaceUrl(
  value: string,
  provider: WorkspaceProvider
): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return `Paste a valid ${provider} link.`;
  }
  if (url.protocol !== "https:") {
    return "Use the secure https:// document link.";
  }
  const host = url.hostname.toLowerCase();
  if (
    provider === "Google Docs" &&
    !(host === "docs.google.com" && url.pathname.startsWith("/document/"))
  ) {
    return "Paste a Google Docs document link from docs.google.com.";
  }
  if (
    provider === "Notion" &&
    !(
      host === "notion.so" ||
      host.endsWith(".notion.so") ||
      host === "notion.site" ||
      host.endsWith(".notion.site")
    )
  ) {
    return "Paste a public Notion page link from notion.site or notion.so.";
  }
  return null;
}

function JournalLogo() {
  return (
    <span
      aria-hidden
      className="grid h-8 w-8 place-items-center overflow-hidden rounded-[9px] border border-[#54566f] bg-[#25273d] shadow-[inset_0_1px_0_rgba(255,255,255,.16),0_2px_5px_rgba(37,39,61,.18)]"
    >
      <svg width="25" height="25" viewBox="0 0 32 32" fill="none">
        <defs>
          <linearGradient id="journal-purple" x1="5" y1="5" x2="17" y2="18" gradientUnits="userSpaceOnUse">
            <stop stopColor="#B05BFF" />
            <stop offset="1" stopColor="#5E4BE8" />
          </linearGradient>
          <linearGradient id="journal-blue" x1="6" y1="25" x2="17" y2="15" gradientUnits="userSpaceOnUse">
            <stop stopColor="#326DDC" />
            <stop offset="1" stopColor="#6D4CF4" />
          </linearGradient>
          <linearGradient id="journal-pink" x1="17" y1="15" x2="28" y2="5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FF6F9C" />
            <stop offset="1" stopColor="#FF9A99" />
          </linearGradient>
          <linearGradient id="journal-red" x1="17" y1="16" x2="27" y2="27" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F85A82" />
            <stop offset="1" stopColor="#D82C67" />
          </linearGradient>
        </defs>
        <path d="M15.8 7.2C12.8 4.4 9.6 3.1 6.5 2.8c-.9-.1-1.6.6-1.6 1.5v8.1c0 1 .5 1.8 1.4 2.2l9.5 4.1V7.2Z" fill="url(#journal-purple)" />
        <path d="M15.8 18.7 7.2 15c-1.1-.5-2.3.3-2.3 1.5v10.2c0 1 .9 1.7 1.8 1.5 3.6-.7 6.6-2.4 9.1-5.2v-4.3Z" fill="url(#journal-blue)" />
        <path d="M16.2 7.2c3-2.8 6.2-4.1 9.3-4.4.9-.1 1.6.6 1.6 1.5v8.1c0 1-.5 1.8-1.4 2.2l-9.5 4.1V7.2Z" fill="url(#journal-pink)" />
        <path d="m16.2 18.7 8.6-3.7c1.1-.5 2.3.3 2.3 1.5v10.2c0 1-.9 1.7-1.8 1.5-3.6-.7-6.6-2.4-9.1-5.2v-4.3Z" fill="url(#journal-red)" />
        <path d="M16 6.8v16.6" stroke="#FFD7C4" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    </span>
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
          Sign in with Google to keep generating — your existing stories
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
