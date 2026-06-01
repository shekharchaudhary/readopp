"use client";

import { useEffect, useRef, useState } from "react";
import type { RenderedPanel } from "@/lib/shared/schemas";
import { themeSvg } from "@/lib/svg/theme";
import { EditableHtmlTablePanel } from "./EditableHtmlTablePanel";
import { EditableSvgPanel } from "./EditableSvgPanel";
import { EditableText } from "./EditableText";
import { PanelThemePopover, type ColorTriple } from "./NodeEditPopover";

interface Props {
  panel: RenderedPanel;
  index: number;
  onExport?: (panelId: string) => void;
  /**
   * Called when the user commits an inline edit. Resolve with the patched
   * panel (or anything) — the caller is responsible for persisting and
   * refreshing parent state. Omit to disable editing.
   */
  onEdit?: (
    sectionId: string,
    patch: { heading?: string; caption?: string; content?: string }
  ) => Promise<void>;
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

export function PanelCard({ panel, index, onExport, onEdit }: Props) {
  const heading = panel.heading?.trim() || `Panel ${index + 1}`;
  const editable = Boolean(onEdit);
  const canTheme = editable && panel.format === "svg";
  const [themeOpen, setThemeOpen] = useState(false);
  const [themeBusy, setThemeBusy] = useState(false);

  async function applyTheme(triple: ColorTriple) {
    if (!onEdit) return;
    const next = themeSvg(panel.content, triple);
    if (next === panel.content) return;
    setThemeBusy(true);
    try {
      await onEdit(panel.sectionId, { content: next });
    } finally {
      setThemeBusy(false);
    }
  }

  return (
    <article
      className="relative rounded-lg border border-paper-line bg-white motion-safe:animate-rise-in"
      style={{ animationDelay: `${Math.min(index, 5) * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-4 border-b border-paper-line px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] text-ink-faint tabular-nums">
            <span>{String(index + 1).padStart(2, "0")}</span>
            {panel.fallback && (
              <span className="rounded-sm border border-paper-line bg-paper-soft px-1.5 py-0.5 text-[10px] text-ink-muted">
                fallback
              </span>
            )}
          </div>
          <h2 className="mt-1 text-lg font-medium leading-snug tracking-tight text-ink sm:text-xl">
            {editable ? (
              <EditableText
                value={heading}
                onSave={(next) => onEdit!(panel.sectionId, { heading: next })}
                maxLength={140}
                ariaLabel="Panel heading"
                className="inline-block"
                editClassName="text-lg font-medium tracking-tight sm:text-xl"
              />
            ) : (
              heading
            )}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canTheme && (
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setThemeOpen((v) => !v)}
              aria-expanded={themeOpen}
              aria-pressed={themeOpen}
              className={
                "rounded-md border px-2.5 py-1 text-xs transition-colors " +
                (themeOpen
                  ? "border-accent bg-accent-soft text-accent-deep"
                  : "border-paper-line bg-paper text-ink-soft hover:border-ink-muted")
              }
            >
              Theme
            </button>
          )}
          {onExport && (
            <button
              type="button"
              onClick={() => onExport(panel.sectionId)}
              className="rounded-md border border-paper-line bg-paper px-2.5 py-1 text-xs text-ink-soft hover:border-ink-muted"
            >
              Export
            </button>
          )}
        </div>
      </div>

      {themeOpen && canTheme && (
        <PanelThemePopover
          busy={themeBusy}
          onColorChange={applyTheme}
          onClose={() => setThemeOpen(false)}
        />
      )}

      <div className="p-4">
        {panel.format === "svg" ? (
          editable ? (
            <EditableSvgPanel
              content={panel.content}
              onSave={(next) => onEdit!(panel.sectionId, { content: next })}
            />
          ) : (
            <div
              className="panel-svg-wrap"
              // SVG comes from the model. We validated it parses + viewBox.
              // We also strip <script> via the validator. Rendering inline is
              // intentional so text is real vector text.
              dangerouslySetInnerHTML={{ __html: panel.content }}
            />
          )
        ) : editable && /<table[\s>]/i.test(panel.content) ? (
          <EditableHtmlTablePanel
            content={panel.content}
            onSave={(next) => onEdit!(panel.sectionId, { content: next })}
          />
        ) : (
          <HtmlPanel html={panel.content} />
        )}
      </div>

      {(panel.caption || editable) && (
        <div className="border-t border-paper-line px-5 py-3 text-sm leading-relaxed text-ink-soft">
          {editable ? (
            <EditableText
              value={panel.caption || ""}
              onSave={(next) => onEdit!(panel.sectionId, { caption: next })}
              multiline
              maxLength={600}
              placeholder="Add a caption…"
              ariaLabel="Panel caption"
              className="block"
              editClassName="text-sm leading-relaxed"
            />
          ) : (
            panel.caption
          )}
        </div>
      )}
    </article>
  );
}
