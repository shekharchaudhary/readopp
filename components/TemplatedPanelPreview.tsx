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
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Fetch the template-rendered HTML whenever the panel content or the
  // selected template changes.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setError(null);
    setHtml(null);
    setIframeLoaded(false);
    (async () => {
      try {
        const res = await fetch(
          `/api/explainers/${explainerId}/panels/${sectionId}/template-html?format=square`,
          { cache: "no-store", signal: controller.signal }
        );
        if (!res.ok) {
          setError(`Preview failed (${res.status})`);
          return;
        }
        const text = await res.text();
        if (!cancelled) setHtml(text);
      } catch (reason) {
        if (
          cancelled ||
          (reason instanceof DOMException && reason.name === "AbortError")
        ) {
          return;
        }
        if (!cancelled) setError("Preview failed.");
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
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
      data-testid="templated-panel-preview"
      data-section-id={sectionId}
      data-preview-state={error ? "error" : html !== null && iframeLoaded ? "ready" : "loading"}
      className="relative w-full overflow-hidden rounded-md border border-paper-line bg-paper-soft"
      style={{ aspectRatio: "1 / 1" }}
    >
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-sm text-ink-soft">
          {error}
        </div>
      )}
      {!error && !iframeLoaded && (
        <div
          aria-hidden
          className="absolute inset-0 z-10 overflow-hidden bg-paper p-[7%]"
        >
          <span className="block h-[2.5%] w-[24%] animate-pulse rounded-full bg-accent/45" />
          <span className="mt-[6%] block h-[5.5%] w-[78%] animate-pulse rounded-sm bg-ink/20" />
          <span className="mt-[2.5%] block h-[5.5%] w-[58%] animate-pulse rounded-sm bg-ink/15" />
          <span className="mt-[12%] block border-t border-ink/15" />
          <span className="mt-[6%] grid grid-cols-[10%_1fr] gap-[4%]">
            <span className="aspect-square animate-pulse rounded-full border-2 border-ink/15" />
            <span className="space-y-[2.5%] pt-[1%]">
              <span className="block h-3 w-[36%] animate-pulse rounded-full bg-ink/15" />
              <span className="block h-2 w-[64%] animate-pulse rounded-full bg-ink/10" />
            </span>
          </span>
          <span className="mt-[6%] grid grid-cols-[10%_1fr] gap-[4%]">
            <span className="aspect-square animate-pulse rounded-full border-2 border-ink/15" />
            <span className="space-y-[2.5%] pt-[1%]">
              <span className="block h-3 w-[42%] animate-pulse rounded-full bg-ink/15" />
              <span className="block h-2 w-[72%] animate-pulse rounded-full bg-ink/10" />
            </span>
          </span>
          <span className="absolute inset-x-[7%] bottom-[7%] flex items-center justify-between border-t border-ink/15 pt-[3%] font-mono text-[9px] uppercase tracking-[.12em] text-ink-faint">
            <span>Composing panel</span>
            <span className="h-1.5 w-12 animate-pulse rounded-full bg-accent/40" />
          </span>
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
          onLoad={() => {
            // `load` fires before the newly written iframe necessarily has a
            // painted frame. Keep the loading surface in place through two
            // animation frames so users never see a blank flash.
            requestAnimationFrame(() =>
              requestAnimationFrame(() => setIframeLoaded(true))
            );
          }}
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
