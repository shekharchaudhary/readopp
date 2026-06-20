"use client";

import { useEffect, useState } from "react";
import type { ExportFormat } from "@/lib/export/dimensions";
import { EXPORT_DIMENSIONS } from "@/lib/export/dimensions";
import type { VideoFormat } from "@/lib/export/buildVideoHtml";
import { VIDEO_DIMENSIONS } from "@/lib/export/buildVideoHtml";
import type { Explainer, SocialPack } from "@/lib/shared/schemas";

type Mode = "image" | "video" | "caption";

type ImageResult =
  | {
      kind?: "single";
      format: ExportFormat;
      url: string;
      width: number;
      height: number;
      cached?: boolean;
    }
  | {
      kind: "stacked";
      format: ExportFormat;
      url: string;
      width: number;
      height: number;
      cached?: boolean;
    }
  | {
      kind: "set";
      format: ExportFormat;
      images: {
        url: string;
        sectionId: string;
        panelIndex: number;
        kind?: "panel" | "attribution";
      }[];
      /** Phase 8 week 2 — one-click bundle of every image in the set. */
      zipUrl?: string;
      zipName?: string;
    };

interface VideoResultPayload {
  url: string;
  format: VideoFormat;
  width: number;
  height: number;
  durationMs: number;
  panelsShown: number;
  cached?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  explainerId: string;
  panelId?: string;
  /** Current socialPack from the parent's Explainer state. The Caption tab
   *  shows this and the regenerate button replaces it. */
  socialPack?: SocialPack;
  /** Called after a successful socialPack regeneration so the parent can
   *  refresh its Explainer state. */
  onSocialPackChange?: (next: Explainer) => void;
}

const IMAGE_FORMATS: ExportFormat[] = ["square", "vertical", "landscape"];
const VIDEO_FORMATS: VideoFormat[] = ["vertical", "square"];

export function ExportSheet({
  open,
  onClose,
  explainerId,
  panelId,
  socialPack,
  onSocialPackChange,
}: Props) {
  const [mode, setMode] = useState<Mode>("image");
  const [format, setFormat] = useState<ExportFormat>("square");
  const [videoFormat, setVideoFormat] = useState<VideoFormat>("vertical");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImageResult | null>(null);
  const [videoResult, setVideoResult] = useState<VideoResultPayload | null>(null);

  useEffect(() => {
    if (open) {
      setResult(null);
      setVideoResult(null);
      setError(null);
      setFormat("square");
      setVideoFormat("vertical");
      setMode("image");
    }
  }, [open, panelId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function generateImage(fmt: ExportFormat) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/explainers/${explainerId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: fmt, panelId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || `Export failed (${res.status}).`);
        return;
      }
      setResult(data);
    } catch (e) {
      setError((e as Error).message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  async function generateVideo(fmt: VideoFormat) {
    setLoading(true);
    setError(null);
    setVideoResult(null);
    try {
      const res = await fetch(`/api/explainers/${explainerId}/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: fmt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || `Video failed (${res.status}).`);
        return;
      }
      setVideoResult(data);
    } catch (e) {
      setError((e as Error).message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 px-4 pb-4 pt-12 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-lg border border-paper-line bg-paper shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-paper-line px-5 py-4">
          <div>
            <h2 className="text-base font-medium text-ink">
              {panelId ? "Export panel" : "Export explainer"}
            </h2>
            <p className="text-xs text-ink-muted">
              Image for carousels and stills · Video for Reels, TikTok, and Shorts.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-paper-line bg-surface px-3 py-1.5 text-sm text-ink-soft hover:border-ink-muted"
          >
            Close
          </button>
        </header>

        <div className="border-b border-paper-line px-5 pt-3">
          <div className="inline-flex rounded-md border border-paper-line bg-surface p-0.5">
            <ModeTab
              active={mode === "image"}
              onClick={() => {
                setMode("image");
                setError(null);
              }}
            >
              Image
            </ModeTab>
            <ModeTab
              active={mode === "video"}
              onClick={() => {
                if (panelId) return; // video is whole-explainer only
                setMode("video");
                setError(null);
              }}
              disabled={Boolean(panelId)}
              hint={
                panelId
                  ? "Video uses the whole explainer. Close this sheet and use Export all."
                  : undefined
              }
            >
              Video
            </ModeTab>
            <ModeTab
              active={mode === "caption"}
              onClick={() => {
                if (panelId) return; // caption is whole-explainer only
                setMode("caption");
                setError(null);
              }}
              disabled={Boolean(panelId)}
              hint={
                panelId
                  ? "Caption uses the whole explainer."
                  : undefined
              }
            >
              Caption
              <span className="ml-1 rounded-sm bg-accent-soft px-1.5 py-px text-[10px] font-medium text-accent-deep">
                new
              </span>
            </ModeTab>
          </div>
          <p className="mt-2 pb-3 text-xs text-ink-muted">
            {mode === "image"
              ? "Pick a format. We render a PNG at exact dimensions."
              : mode === "video"
              ? "We animate the panels into a short MP4 with an outro QR — perfect for Reels and TikTok."
              : "The post caption + hashtags + alt-text per panel — copy or refresh."}
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          {mode === "image" ? (
            <ImageFormats
              format={format}
              loading={loading}
              onPick={(f) => {
                setFormat(f);
                generateImage(f);
              }}
            />
          ) : mode === "video" ? (
            <VideoFormats
              format={videoFormat}
              loading={loading}
              onPick={(f) => {
                setVideoFormat(f);
                generateVideo(f);
              }}
            />
          ) : (
            <CaptionPack
              explainerId={explainerId}
              socialPack={socialPack}
              onChange={onSocialPackChange}
            />
          )}

          {loading &&
            (mode === "video" ? (
              <VideoRenderProgress />
            ) : (
              <p className="text-sm text-ink-muted">Rendering…</p>
            ))}

          {error && (
            <div className="rounded-md border border-paper-line bg-paper-soft px-3 py-2 text-sm text-ink-soft">
              {error}
            </div>
          )}

          {mode === "image" && result && (
            <ImagePreview result={result} format={format} />
          )}
          {mode === "video" && videoResult && (
            <VideoPreview result={videoResult} />
          )}

          {!loading && !error && !result && !videoResult && (
            <p className="text-xs text-ink-muted">
              {mode === "image"
                ? "Pick a format above to generate a preview."
                : "Pick an aspect ratio above to record the explainer."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  disabled,
  hint,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      aria-pressed={active}
      className={
        "rounded-[5px] px-3 py-1.5 text-sm font-medium transition-colors " +
        (active
          ? "bg-ink text-paper"
          : "text-ink-soft hover:bg-paper-soft disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:bg-transparent")
      }
    >
      {children}
    </button>
  );
}

function ImageFormats({
  format,
  loading,
  onPick,
}: {
  format: ExportFormat;
  loading: boolean;
  onPick: (f: ExportFormat) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {IMAGE_FORMATS.map((f) => {
        const dims = EXPORT_DIMENSIONS[f];
        const selected = format === f;
        return (
          <button
            type="button"
            key={f}
            onClick={() => onPick(f)}
            disabled={loading}
            className={
              "rounded-md border px-3 py-3 text-left text-sm transition-colors " +
              (selected
                ? "border-ink bg-ink text-paper"
                : "border-paper-line bg-surface text-ink-soft hover:border-ink-muted")
            }
            aria-pressed={selected}
          >
            <div className="font-medium capitalize">{f}</div>
            <div
              className={
                "text-xs " + (selected ? "text-paper/80" : "text-ink-muted")
              }
            >
              {dims.w} × {dims.h}
            </div>
            <div
              className={
                "text-xs " + (selected ? "text-paper/80" : "text-ink-muted")
              }
            >
              {dims.label}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function VideoFormats({
  format,
  loading,
  onPick,
}: {
  format: VideoFormat;
  loading: boolean;
  onPick: (f: VideoFormat) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {VIDEO_FORMATS.map((f) => {
        const dims = VIDEO_DIMENSIONS[f];
        const selected = format === f;
        return (
          <button
            type="button"
            key={f}
            onClick={() => onPick(f)}
            disabled={loading}
            className={
              "rounded-md border px-3 py-3 text-left text-sm transition-colors " +
              (selected
                ? "border-accent bg-accent text-paper"
                : "border-paper-line bg-surface text-ink-soft hover:border-ink-muted")
            }
            aria-pressed={selected}
          >
            <div className="font-medium capitalize">{f}</div>
            <div
              className={
                "text-xs " + (selected ? "text-paper/80" : "text-ink-muted")
              }
            >
              {dims.w} × {dims.h}
            </div>
            <div
              className={
                "text-xs " + (selected ? "text-paper/80" : "text-ink-muted")
              }
            >
              {dims.label}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ImagePreview({
  result,
  format,
}: {
  result: ImageResult;
  format: ExportFormat;
}) {
  if ("images" in result) {
    const panelCount = result.images.filter(
      (i) => i.kind !== "attribution"
    ).length;
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-muted">
            {panelCount} panel{panelCount === 1 ? "" : "s"} + 1 source slide
            {" = "}
            <span className="font-medium text-ink-soft">
              {result.images.length} images
            </span>
          </p>
          {result.zipUrl && (
            <a
              href={result.zipUrl}
              download={result.zipName || `readopp-${format}.zip`}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-paper transition-colors hover:bg-accent-deep"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M8 2v8m-3-3l3 3 3-3M3 12v2h10v-2"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Download all (ZIP)
            </a>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {result.images.map((img) => {
            const isAttribution = img.kind === "attribution";
            const label = isAttribution
              ? "Source slide"
              : `Panel ${img.panelIndex}`;
            return (
              <a
                key={img.url}
                href={img.url}
                download={
                  isAttribution
                    ? `readopp-${format}-source.png`
                    : `readopp-${format}-${img.panelIndex}.png`
                }
                className={
                  "block overflow-hidden rounded-md border bg-surface " +
                  (isAttribution
                    ? "border-accent/40 ring-1 ring-accent/15"
                    : "border-paper-line")
                }
              >
                <img
                  src={img.url}
                  alt={label}
                  className="block h-auto w-full"
                />
                <div
                  className={
                    "border-t px-2 py-1 text-xs " +
                    (isAttribution
                      ? "border-accent/30 bg-accent-soft text-accent-deep"
                      : "border-paper-line text-ink-muted")
                  }
                >
                  {label} · download
                </div>
              </a>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-md border border-paper-line bg-surface">
        <img
          src={result.url}
          alt={`${format} export preview`}
          className="block h-auto w-full"
        />
      </div>
      <a
        href={result.url}
        download={`readopp-${format}.png`}
        className="inline-block rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
      >
        Download PNG
      </a>
    </div>
  );
}

/**
 * The video route is one long POST with no streamed progress, so this is a
 * time-driven simulation: an asymptotic curve that eases toward ~97% (typical
 * first render is 30–45s) and phase labels that flip at fixed points along it.
 * The real response unmounts it, so it never has to "finish" on its own.
 */
const VIDEO_PHASES = [
  { at: 0, label: "Laying out the panels" },
  { at: 0.12, label: "Warming up the recorder" },
  { at: 0.28, label: "Recording the animation" },
  { at: 0.82, label: "Encoding the MP4" },
];

function VideoRenderProgress() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(
      () => setElapsed((performance.now() - start) / 1000),
      200
    );
    return () => clearInterval(id);
  }, []);

  const progress = Math.min(0.97, 1 - Math.exp(-elapsed / 18));
  const phaseIndex = VIDEO_PHASES.reduce(
    (acc, p, i) => (progress >= p.at ? i : acc),
    0
  );

  return (
    <div className="space-y-3 rounded-md border border-paper-line bg-surface p-4">
      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span className="font-medium text-ink-soft">
          Generating your video
        </span>
        <span className="tabular-nums">
          {Math.round(progress * 100)}% · {Math.floor(elapsed)}s
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-paper-soft">
        <div
          className="relative h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
          style={{ width: `${progress * 100}%` }}
        >
          <div
            className="absolute inset-0 motion-safe:animate-pulse"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
            }}
          />
        </div>
      </div>

      <ul className="space-y-1.5">
        {VIDEO_PHASES.map((p, i) => {
          const state =
            i < phaseIndex ? "done" : i === phaseIndex ? "active" : "pending";
          return (
            <li
              key={p.label}
              className={
                "flex items-center gap-2 text-sm transition-colors " +
                (state === "done"
                  ? "text-ink-muted"
                  : state === "active"
                  ? "text-ink"
                  : "text-ink-faint")
              }
            >
              {state === "done" ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden
                  className="shrink-0 text-accent"
                >
                  <path
                    d="M3.5 8.5l3 3 6-7"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : state === "active" ? (
                <span className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-accent/30 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                </span>
              ) : (
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-paper-line" />
                </span>
              )}
              {p.label}
              {state === "active" && <Ellipsis />}
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-ink-faint">
        First render takes ~30–45s — it&rsquo;s cached after that, so re-downloads
        are instant.
      </p>
    </div>
  );
}

/** Animated trailing dots for the active phase label. */
function Ellipsis() {
  const [n, setN] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setN((v) => (v % 3) + 1), 450);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="w-4 text-left" aria-hidden>
      {".".repeat(n)}
    </span>
  );
}

function VideoPreview({ result }: { result: VideoResultPayload }) {
  const seconds = Math.round(result.durationMs / 100) / 10;
  // Limit preview size so a 1080×1920 vertical doesn't blow out the modal.
  const maxPreviewWidth = result.format === "vertical" ? 280 : 460;
  return (
    <div className="space-y-3">
      <div className="flex justify-center overflow-hidden rounded-md border border-paper-line bg-ink/95 p-2">
        <video
          src={result.url}
          controls
          autoPlay
          loop
          playsInline
          muted
          style={{ maxWidth: `${maxPreviewWidth}px`, width: "100%", height: "auto" }}
          className="block rounded"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={result.url}
          download={`readopp-${result.format}.mp4`}
          className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent-deep"
        >
          Download MP4
        </a>
        <span className="text-xs text-ink-muted">
          {result.width}×{result.height} · {seconds}s ·{" "}
          {result.panelsShown} panel{result.panelsShown === 1 ? "" : "s"}
          {result.cached ? " · cached" : ""}
        </span>
      </div>
    </div>
  );
}

/**
 * Caption-pack tab body — Phase 8 week 1. Renders the persisted SocialPack
 * (caption + hashtags + alt-texts) with copy and refresh affordances.
 * Falls back to an empty-state with a Generate button when the explainer
 * doesn't have a pack yet (older runs, or pipeline skipped it).
 */
function CaptionPack({
  explainerId,
  socialPack,
  onChange,
}: {
  explainerId: string;
  socialPack?: SocialPack;
  onChange?: (next: Explainer) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Free-text hint piped into the regenerate request so the user can
  // nudge the caption ("shorter", "more skeptical", "lead with the
  // stat"). Kept in local state so it survives between regens.
  const [hint, setHint] = useState("");
  // In-place editing of the existing caption — toggled by the "Edit"
  // button on the Caption block. Save calls PATCH which overwrites the
  // caption without re-running the agent (hashtags/alt-text untouched).
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  async function regenerate(passedHint?: string) {
    setBusy(true);
    setErr(null);
    try {
      const trimmedHint = (passedHint ?? hint).trim();
      const res = await fetch(
        `/api/explainers/${explainerId}/social-pack`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(trimmedHint ? { hint: trimmedHint } : {}),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      if (data.explainer && onChange) onChange(data.explainer as Explainer);
    } catch (e) {
      setErr((e as Error).message || "Could not refresh caption.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/explainers/${explainerId}/social-pack`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caption: draft.trim() }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      if (data.explainer && onChange) onChange(data.explainer as Explainer);
      setEditing(false);
    } catch (e) {
      setErr((e as Error).message || "Could not save caption.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit() {
    if (!socialPack) return;
    setDraft(socialPack.caption);
    setEditing(true);
    setErr(null);
  }

  if (!socialPack) {
    return (
      <div className="space-y-3 rounded-md border border-paper-line bg-surface p-4">
        <p className="text-sm text-ink-soft">
          No caption yet. Generate one and we&rsquo;ll write a 2-line post
          caption + hashtags + alt-text for each panel.
        </p>
        <button
          type="button"
          onClick={() => regenerate()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-paper transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Writing…" : "Generate caption"}
        </button>
        {err && <p className="text-xs text-red-600">{err}</p>}
      </div>
    );
  }

  const hashtagLine = socialPack.hashtags.map((h) => `#${h}`).join(" ");

  return (
    <div className="space-y-4">
      {/* Steering hint — sits above the Caption block because it only
          affects the caption regeneration, not hashtags / alt-text. */}
      <div className="space-y-1.5 rounded-md border border-paper-line bg-paper p-3">
        <label
          htmlFor="caption-hint"
          className="block text-[10px] font-medium uppercase tracking-wider text-ink-faint"
        >
          Steer next refresh
        </label>
        <input
          id="caption-hint"
          type="text"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder="e.g. shorter · more skeptical · lead with the stat · no question"
          maxLength={280}
          disabled={busy || editing}
          className="w-full rounded-md border border-paper-line bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-ink-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
        <p className="text-[11px] text-ink-faint">
          Optional. The next Refresh applies this on top of the default voice.
        </p>
      </div>

      {/* Caption */}
      <Block
        label="Caption"
        copyValue={editing ? undefined : socialPack.caption}
        actions={
          editing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setErr(null);
                }}
                disabled={busy}
                className="rounded-md border border-paper-line bg-surface px-2 py-1 text-[11px] text-ink-soft transition-colors hover:border-ink-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={busy || draft.trim().length === 0}
                className="rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-paper transition-colors hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={startEdit}
                disabled={busy}
                className="rounded-md border border-paper-line bg-surface px-2 py-1 text-[11px] text-ink-soft transition-colors hover:border-ink-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => regenerate()}
                disabled={busy}
                className="rounded-md border border-paper-line bg-surface px-2 py-1 text-[11px] text-ink-soft transition-colors hover:border-ink-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Refreshing…" : "Refresh"}
              </button>
            </>
          )
        }
      >
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            maxLength={1200}
            disabled={busy}
            className="w-full resize-y rounded-md border border-paper-line bg-surface px-2.5 py-2 text-sm leading-relaxed text-ink focus:border-ink-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {socialPack.caption}
          </p>
        )}
      </Block>

      {/* Hashtags */}
      {socialPack.hashtags.length > 0 && (
        <Block label="Hashtags" copyValue={hashtagLine}>
          <div className="flex flex-wrap gap-1.5">
            {socialPack.hashtags.map((h) => (
              <span
                key={h}
                className="rounded-full border border-paper-line bg-paper-soft px-2.5 py-0.5 font-mono text-xs text-ink-soft"
              >
                #{h}
              </span>
            ))}
          </div>
        </Block>
      )}

      {/* Source attribution */}
      {socialPack.sourceAttribution && (
        <Block
          label="Source attribution"
          copyValue={socialPack.sourceAttribution}
        >
          <p className="text-sm text-ink-soft">{socialPack.sourceAttribution}</p>
        </Block>
      )}

      {/* Per-panel alt text */}
      {socialPack.altTexts.length > 0 && (
        <Block label="Alt text per panel">
          <div className="space-y-2">
            {socialPack.altTexts.map((a) => (
              <div
                key={a.sectionId}
                className="rounded-md border border-paper-line bg-surface p-2.5"
              >
                <div className="text-[10px] font-medium uppercase tracking-wider text-ink-faint">
                  {a.sectionId}
                </div>
                <p className="mt-1 text-sm text-ink-soft">{a.text}</p>
              </div>
            ))}
          </div>
        </Block>
      )}

      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}

function Block({
  label,
  copyValue,
  actions,
  children,
}: {
  label: string;
  copyValue?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!copyValue) return;
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Older browsers — ignore.
    }
  }
  return (
    <div className="space-y-2 rounded-md border border-paper-line bg-paper p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-ink-faint">
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          {actions}
          {copyValue && (
            <button
              type="button"
              onClick={copy}
              className="rounded-md border border-paper-line bg-surface px-2 py-1 text-[11px] text-ink-soft transition-colors hover:border-ink-muted"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
