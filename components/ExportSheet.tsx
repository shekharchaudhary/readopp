"use client";

import { useEffect, useState } from "react";
import type { ExportFormat } from "@/lib/export/dimensions";
import { EXPORT_DIMENSIONS } from "@/lib/export/dimensions";

type ExportResult =
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

interface Props {
  open: boolean;
  onClose: () => void;
  explainerId: string;
  panelId?: string; // omit for whole-explainer
}

const FORMATS: ExportFormat[] = ["square", "vertical", "landscape"];

export function ExportSheet({ open, onClose, explainerId, panelId }: Props) {
  const [format, setFormat] = useState<ExportFormat>("square");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);

  // Reset state each time the sheet opens
  useEffect(() => {
    if (open) {
      setResult(null);
      setError(null);
      setFormat("square");
    }
  }, [open, panelId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function generate(fmt: ExportFormat) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(
        `/api/explainers/${explainerId}/export`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format: fmt, panelId }),
        }
      );
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

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export panel"
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
              Pick a format. We render a PNG at exact dimensions.
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

        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-3 gap-2">
            {FORMATS.map((f) => {
              const dims = EXPORT_DIMENSIONS[f];
              const selected = format === f;
              return (
                <button
                  type="button"
                  key={f}
                  onClick={() => {
                    setFormat(f);
                    generate(f);
                  }}
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

          {loading && (
            <p className="text-sm text-ink-muted">Rendering…</p>
          )}

          {error && (
            <div className="rounded-md border border-paper-line bg-paper-soft px-3 py-2 text-sm text-ink-soft">
              {error}
            </div>
          )}

          {result && <ExportPreview result={result} format={format} />}

          {!loading && !error && !result && (
            <p className="text-xs text-ink-muted">
              Pick a format above to generate a preview.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ExportPreview({
  result,
  format,
}: {
  result: ExportResult;
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
