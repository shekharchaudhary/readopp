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

          {loading && (
            <p className="text-sm text-ink-muted">
              {mode === "image"
                ? "Rendering…"
                : "Recording the animation… this takes ~30–45s the first time."}
            </p>
          )}

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

  async function regenerate() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/explainers/${explainerId}/social-pack`,
        { method: "POST" }
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

  if (!socialPack) {
    return (
      <div className="space-y-3 rounded-md border border-paper-line bg-surface p-4">
        <p className="text-sm text-ink-soft">
          No caption yet. Generate one and we&rsquo;ll write a 2-line post
          caption + hashtags + alt-text for each panel.
        </p>
        <button
          type="button"
          onClick={regenerate}
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
      {/* Caption */}
      <Block
        label="Caption"
        copyValue={socialPack.caption}
        actions={
          <button
            type="button"
            onClick={regenerate}
            disabled={busy}
            className="rounded-md border border-paper-line bg-surface px-2 py-1 text-[11px] text-ink-soft transition-colors hover:border-ink-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Refreshing…" : "Refresh"}
          </button>
        }
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
          {socialPack.caption}
        </p>
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
