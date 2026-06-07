"use client";

import { useEffect, useRef, useState } from "react";
import type { TemplateId } from "@/lib/shared/schemas";

interface Props {
  explainerId: string;
  sectionId: string;
  /** Bump to re-fetch after a template change or panel edit. */
  cacheKey: string;
  templateId: TemplateId;
}

/**
 * Renders the export-HTML for one panel inside a sandboxed iframe and
 * CSS-scales it down to fit the panel card. Same renderer as the export
 * pipeline, so picking a template gives instant visual parity with what
 * the downloaded PNG will look like.
 *
 * The iframe is fixed at the export viewport (1080×1080 for square) and
 * transform-scaled to fit; this avoids reflow at small sizes and keeps
 * type hierarchy correct.
 */
export function TemplatedPanelPreview({
  explainerId,
  sectionId,
  cacheKey,
  templateId,
}: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Fetch the template-rendered HTML whenever the panel content or the
  // selected template changes.
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setHtml(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/explainers/${explainerId}/panels/${sectionId}/template-html?format=square`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          setError(`Preview failed (${res.status})`);
          return;
        }
        const text = await res.text();
        if (!cancelled) setHtml(text);
      } catch {
        if (!cancelled) setError("Preview failed.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [explainerId, sectionId, cacheKey, templateId]);

  // Keep the iframe scaled to whatever width the parent card allows.
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      setScale(w / 1080);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-md border border-paper-line bg-paper-soft"
      style={{ aspectRatio: "1 / 1" }}
    >
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-sm text-ink-soft">
          {error}
        </div>
      )}
      {!error && html === null && (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-sm text-ink-soft">
          Rendering preview…
        </div>
      )}
      {html !== null && (
        <iframe
          // sandbox prevents the iframe from scripting the parent or
          // reaching out to the network; templates ship inline styles
          // only, so we don't need allow-scripts.
          sandbox=""
          title={`panel-${sectionId}`}
          srcDoc={html}
          style={{
            width: 1080,
            height: 1080,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            border: 0,
            display: "block",
          }}
        />
      )}
    </div>
  );
}
