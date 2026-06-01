"use client";

import { useEffect, useState } from "react";
import type { ExportFormat } from "@/lib/export/dimensions";
import { EXPORT_DIMENSIONS } from "@/lib/export/dimensions";
import type { VideoFormat } from "@/lib/export/buildVideoHtml";
import { VIDEO_DIMENSIONS } from "@/lib/export/buildVideoHtml";

type Mode = "image" | "video";

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
      images: { url: string; sectionId: string; panelIndex: number }[];
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
}

const IMAGE_FORMATS: ExportFormat[] = ["square", "vertical", "landscape"];
const VIDEO_FORMATS: VideoFormat[] = ["vertical", "square"];

export function ExportSheet({ open, onClose, explainerId, panelId }: Props) {
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
            className="rounded-md border border-paper-line bg-white px-3 py-1.5 text-sm text-ink-soft hover:border-ink-muted"
          >
            Close
          </button>
        </header>

        <div className="border-b border-paper-line px-5 pt-3">
          <div className="inline-flex rounded-md border border-paper-line bg-white p-0.5">
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
              <span className="ml-1 rounded-sm bg-accent-soft px-1.5 py-px text-[10px] font-medium text-accent-deep">
                new
              </span>
            </ModeTab>
          </div>
          <p className="mt-2 pb-3 text-xs text-ink-muted">
            {mode === "image"
              ? "Pick a format. We render a PNG at exact dimensions."
              : "We animate the panels into a short MP4 with an outro QR — perfect for Reels and TikTok."}
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
          ) : (
            <VideoFormats
              format={videoFormat}
              loading={loading}
              onPick={(f) => {
                setVideoFormat(f);
                generateVideo(f);
              }}
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
                : "border-paper-line bg-white text-ink-soft hover:border-ink-muted")
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
                : "border-paper-line bg-white text-ink-soft hover:border-ink-muted")
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
    return (
      <div className="space-y-3">
        <p className="text-xs text-ink-muted">
          {result.images.length} images — one per panel.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {result.images.map((img) => (
            <a
              key={img.url}
              href={img.url}
              download={`readopp-${format}-${img.panelIndex}.png`}
              className="block overflow-hidden rounded-md border border-paper-line bg-white"
            >
              <img
                src={img.url}
                alt={`Panel ${img.panelIndex}`}
                className="block h-auto w-full"
              />
              <div className="border-t border-paper-line px-2 py-1 text-xs text-ink-muted">
                Panel {img.panelIndex} · download
              </div>
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-md border border-paper-line bg-white">
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
