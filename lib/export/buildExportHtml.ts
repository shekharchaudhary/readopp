import type { Explainer, RenderedPanel } from "../shared/schemas";
import { EXPORT_DIMENSIONS, type ExportFormat } from "./dimensions";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

interface Layout {
  titleSize: number;
  captionSize: number;
  padding: number;
  metaSize: number;
}

function layoutFor(format: ExportFormat): Layout {
  switch (format) {
    case "square":
      return { titleSize: 38, captionSize: 22, padding: 64, metaSize: 18 };
    case "vertical":
      return { titleSize: 56, captionSize: 30, padding: 80, metaSize: 22 };
    case "landscape":
      return { titleSize: 32, captionSize: 18, padding: 48, metaSize: 16 };
  }
}

function panelHtml(panel: RenderedPanel): string {
  if (panel.format === "svg") return panel.content;
  // HTML panels are already a self-contained block; wrap so they sit cleanly.
  return `<div class="html-panel">${panel.content}</div>`;
}

interface PanelExportInput {
  explainer: Explainer;
  panel: RenderedPanel;
  format: ExportFormat;
  panelIndex: number; // 1-based
  totalPanels: number;
}

/**
 * Single-panel export HTML. Light-locked theme. Title + visual + caption +
 * a thin branding frame at the bottom (wordmark + source domain). No icons.
 */
export function buildPanelExportHtml(input: PanelExportInput): string {
  const { explainer, panel, format, panelIndex, totalPanels } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const L = layoutFor(format);
  const domain = sourceDomain(explainer.url);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  ${baseStyles(dims.w, dims.h, L)}
  .panel-host { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; }
  .panel-host > * { max-width: 100%; max-height: 100%; }
  .panel-host svg { width: 100%; height: auto; }
  .html-panel { background: #ffffff; border: 1px solid #e3e1d8; border-radius: 12px; padding: 24px; width: 100%; max-width: ${
    dims.w - L.padding * 2
  }px; }
  .html-panel table { border-collapse: collapse; width: 100%; }
  .html-panel td, .html-panel th { padding: 10px 12px; font-size: 14px; vertical-align: top; border-bottom: 1px solid #e3e1d8; }
  .html-panel th { font-weight: 500; background: #F1EFE8; text-align: left; }
  .caption { font-size: ${L.captionSize}px; line-height: 1.4; color: #3a3a3a; margin-top: 28px; max-width: ${
    dims.w - L.padding * 2
  }px; }
  .title { font-size: ${L.titleSize}px; line-height: 1.15; color: #1a1a1a; font-weight: 500; letter-spacing: -0.01em; max-width: ${
    dims.w - L.padding * 2
  }px; }
</style>
</head>
<body>
  <main class="page">
    <header class="header">
      <div class="title">${escapeHtml(explainer.title)}</div>
    </header>
    <div class="panel-host">${panelHtml(panel)}</div>
    ${
      panel.caption
        ? `<p class="caption">${escapeHtml(panel.caption)}</p>`
        : ""
    }
    <footer class="footer">
      <span class="wordmark">Readopp</span>
      <span class="dot">·</span>
      <span class="source">${escapeHtml(domain)}</span>
      <span class="spacer"></span>
      <span class="meta">${panelIndex} / ${totalPanels}</span>
    </footer>
  </main>
</body>
</html>`;
}

interface AllExportInput {
  explainer: Explainer;
  format: ExportFormat;
}

/**
 * Multi-panel export (single image). Used for vertical (1080x1920) where we
 * can comfortably stack panels. Square/landscape callers should iterate
 * buildPanelExportHtml per panel instead.
 */
export function buildStackedExportHtml(input: AllExportInput): string {
  const { explainer, format } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const L = layoutFor(format);
  const domain = sourceDomain(explainer.url);
  const panels = explainer.panels.slice(0, 4); // keep it readable

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  ${baseStyles(dims.w, dims.h, L)}
  .stack { display: flex; flex-direction: column; gap: 28px; flex: 1; min-height: 0; }
  .stack > .panel { display: flex; flex-direction: column; gap: 10px; }
  .panel-host { display: flex; align-items: center; justify-content: center; }
  .panel-host > * { max-width: 100%; }
  .panel-host svg { width: 100%; height: auto; max-height: 320px; }
  .html-panel { background: #ffffff; border: 1px solid #e3e1d8; border-radius: 10px; padding: 18px; width: 100%; }
  .html-panel table { border-collapse: collapse; width: 100%; }
  .html-panel td, .html-panel th { padding: 8px 10px; font-size: 14px; vertical-align: top; border-bottom: 1px solid #e3e1d8; }
  .html-panel th { font-weight: 500; background: #F1EFE8; text-align: left; }
  .caption { font-size: ${Math.round(L.captionSize * 0.85)}px; color: #3a3a3a; line-height: 1.4; }
  .title { font-size: ${L.titleSize}px; line-height: 1.1; color: #1a1a1a; font-weight: 500; letter-spacing: -0.01em; }
  .summary { font-size: ${L.captionSize}px; color: #6b6b6b; margin-top: 12px; }
</style>
</head>
<body>
  <main class="page">
    <header class="header">
      <div class="title">${escapeHtml(explainer.title)}</div>
      ${
        explainer.summary
          ? `<div class="summary">${escapeHtml(explainer.summary)}</div>`
          : ""
      }
    </header>
    <div class="stack">
      ${panels
        .map(
          (p, i) => `<section class="panel">
            <div class="panel-host">${panelHtml(p)}</div>
            ${p.caption ? `<p class="caption">${escapeHtml(p.caption)}</p>` : ""}
          </section>`
        )
        .join("")}
    </div>
    <footer class="footer">
      <span class="wordmark">Readopp</span>
      <span class="dot">·</span>
      <span class="source">${escapeHtml(domain)}</span>
      <span class="spacer"></span>
      <span class="meta">${panels.length} of ${explainer.panels.length} panels</span>
    </footer>
  </main>
</body>
</html>`;
}

function baseStyles(w: number, h: number, L: Layout): string {
  return `
    html, body { margin: 0; padding: 0; background: #fafaf7; color: #1a1a1a;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased; }
    *, *::before, *::after { box-sizing: border-box; }
    .page {
      width: ${w}px; height: ${h}px; padding: ${L.padding}px;
      display: flex; flex-direction: column; gap: 24px;
      background: #fafaf7; color: #1a1a1a;
    }
    .header { flex: 0 0 auto; }
    .footer {
      flex: 0 0 auto; margin-top: 16px;
      display: flex; align-items: center; gap: 8px;
      font-size: ${L.metaSize}px; color: #6b6b6b;
      border-top: 1px solid #e3e1d8; padding-top: 14px;
    }
    .footer .wordmark { color: #1a1a1a; font-weight: 500; letter-spacing: -0.005em; }
    .footer .dot { color: #a3a3a3; }
    .footer .spacer { flex: 1; }
    .footer .meta { color: #6b6b6b; }
  `;
}
