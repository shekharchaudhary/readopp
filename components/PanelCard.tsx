"use client";

import { useEffect, useRef, useState } from "react";
import type { RenderedPanel } from "@/lib/shared/schemas";

interface Props {
  panel: RenderedPanel;
  index: number;
  onExport?: (panelId: string) => void;
}

function HtmlPanel({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState<number>(120);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc =
      iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;padding:24px;background:#fafaf7;color:#1a1a1a;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;}
      *{box-sizing:border-box}
      table{border-collapse:collapse;width:100%}
      td,th{padding:8px 10px;font-size:14px;vertical-align:top;border-bottom:1px solid #e3e1d8}
      th{font-weight:500;background:#F1EFE8;text-align:left}
    </style></head><body>${html}</body></html>`);
    doc.close();
    // Resize observer
    const resize = () => {
      const h = doc.documentElement.scrollHeight;
      if (h && Math.abs(h - height) > 2) setHeight(h);
    };
    resize();
    const ro = new (iframe.contentWindow as Window & {
      ResizeObserver?: typeof ResizeObserver;
    })!.ResizeObserver!(resize);
    ro.observe(doc.documentElement);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      title="panel"
      sandbox="allow-same-origin"
      style={{ width: "100%", border: "0", height: `${height}px` }}
    />
  );
}

export function PanelCard({ panel, index, onExport }: Props) {
  const heading = panel.heading?.trim() || `Panel ${index + 1}`;
  return (
    <article className="rounded-lg border border-paper-line bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-paper-line px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] text-ink-faint tabular-nums">
            <span>{String(index + 1).padStart(2, "0")}</span>
            {panel.fallback && (
              <span className="rounded-sm border border-paper-line bg-paper-soft px-1.5 py-0.5 text-[10px] text-ink-muted">
                fallback
              </span>
            )}
          </div>
          <h2 className="mt-1 text-lg font-medium leading-snug tracking-tight text-ink sm:text-xl">
            {heading}
          </h2>
        </div>
        {onExport && (
          <button
            type="button"
            onClick={() => onExport(panel.sectionId)}
            className="shrink-0 rounded-md border border-paper-line bg-paper px-2.5 py-1 text-xs text-ink-soft hover:border-ink-muted"
          >
            Export
          </button>
        )}
      </div>

      <div className="p-4">
        {panel.format === "svg" ? (
          <div
            className="panel-svg-wrap"
            // SVG comes from the model. We validated it parses + viewBox. We also
            // strip <script> via the validator. Rendering inline is intentional so
            // text is real vector text (the whole point of this app).
            dangerouslySetInnerHTML={{ __html: panel.content }}
          />
        ) : (
          <HtmlPanel html={panel.content} />
        )}
      </div>

      {panel.caption && (
        <div className="border-t border-paper-line px-5 py-3 text-sm leading-relaxed text-ink-soft">
          {panel.caption}
        </div>
      )}
    </article>
  );
}
