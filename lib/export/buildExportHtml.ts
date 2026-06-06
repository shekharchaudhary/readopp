import QRCode from "qrcode";
import type { Explainer, RenderedPanel } from "../shared/schemas";
import { sourceLabel } from "../shared/source";
import { EXPORT_DIMENSIONS, type ExportFormat } from "./dimensions";

const ACCENT = "#1F97DC";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

async function qrSvg(target: string, size: number): Promise<string> {
  return QRCode.toString(target, {
    type: "svg",
    margin: 0,
    width: size,
    color: { dark: "#1a1a1a", light: "#00000000" },
    errorCorrectionLevel: "M",
  });
}

interface Layout {
  titleSize: number;
  overlineSize: number;
  captionSize: number;
  padding: number;
  metaSize: number;
  qrSize: number;
}

function layoutFor(format: ExportFormat): Layout {
  switch (format) {
    case "square":
      return {
        titleSize: 44,
        overlineSize: 16,
        captionSize: 22,
        padding: 64,
        metaSize: 18,
        qrSize: 96,
      };
    case "vertical":
      return {
        titleSize: 64,
        overlineSize: 22,
        captionSize: 30,
        padding: 80,
        metaSize: 22,
        qrSize: 132,
      };
    case "landscape":
      return {
        titleSize: 36,
        overlineSize: 14,
        captionSize: 18,
        padding: 48,
        metaSize: 16,
        qrSize: 80,
      };
  }
}

function panelHtml(panel: RenderedPanel): string {
  if (panel.format === "svg") return panel.content;
  return `<div class="html-panel">${panel.content}</div>`;
}

interface PanelExportInput {
  explainer: Explainer;
  panel: RenderedPanel;
  format: ExportFormat;
  panelIndex: number;
  totalPanels: number;
}

/**
 * Single-panel export HTML. The shared-asset case: when someone screenshots
 * this on Instagram/TikTok/LinkedIn, the QR + wordmark in the corner is the
 * only way the panel pulls traffic back to the site.
 */
export async function buildPanelExportHtml(
  input: PanelExportInput
): Promise<string> {
  const { explainer, panel, format, panelIndex, totalPanels } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const L = layoutFor(format);
  const domain = sourceLabel(explainer.url);
  const heading = panel.heading?.trim() || explainer.title;
  const showOverline = Boolean(panel.heading?.trim());

  const shareUrl = `${siteUrl()}/e/${explainer.id}`;
  const qr = await qrSvg(shareUrl, L.qrSize);

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
  .overline { font-size: ${L.overlineSize}px; color: #6b6b6b; letter-spacing: 0.02em; margin-bottom: 10px; max-width: ${
    dims.w - L.padding * 2
  }px; }
  .title { font-size: ${L.titleSize}px; line-height: 1.1; color: #1a1a1a; font-weight: 500; letter-spacing: -0.015em; max-width: ${
    dims.w - L.padding * 2
  }px; }
  .index-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .index-dot { width: 8px; height: 8px; border-radius: 999px; background: ${ACCENT}; }
  .index-tag { font-size: ${L.overlineSize}px; color: #6b6b6b; font-variant-numeric: tabular-nums; letter-spacing: 0.04em; }
</style>
</head>
<body>
  <main class="page">
    <header class="header">
      <div class="index-row">
        <span class="index-dot"></span>
        <span class="index-tag">${String(panelIndex).padStart(2, "0")} / ${String(totalPanels).padStart(2, "0")}</span>
      </div>
      ${
        showOverline
          ? `<div class="overline">${escapeHtml(explainer.title)}</div>`
          : ""
      }
      <div class="title">${escapeHtml(heading)}</div>
    </header>
    <div class="panel-host">${panelHtml(panel)}</div>
    ${
      panel.caption
        ? `<p class="caption">${escapeHtml(panel.caption)}</p>`
        : ""
    }
    ${brandedFooter({ domain, L, qr, shareLabel: "scan to read all panels" })}
  </main>
</body>
</html>`;
}

interface AttributionExportInput {
  explainer: Explainer;
  format: ExportFormat;
}

/**
 * Final "source" slide that lives at the end of a carousel — gives the
 * audience a clear pointer back to the original piece, with a big QR.
 * Used by the whole-explainer "set" export so every download already
 * includes the attribution panel, ready to post.
 */
export async function buildAttributionExportHtml(
  input: AttributionExportInput
): Promise<string> {
  const { explainer, format } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const L = layoutFor(format);
  const domain = sourceLabel(explainer.url);
  const isUploadSource = explainer.url.startsWith("upload://");
  // QR points to the SOURCE, not back to Readopp — this slide is "go read
  // the original thing." Falls back to the Readopp explainer page when the
  // source is an upload (no public URL to encode).
  const qrTarget = isUploadSource
    ? `${siteUrl()}/e/${explainer.id}`
    : explainer.url;
  const qr = await qrSvg(qrTarget, Math.round(L.qrSize * 2.4));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  ${baseStyles(dims.w, dims.h, L)}
  .attribution {
    flex: 1; min-height: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px;
    text-align: center;
  }
  .attribution-eyebrow {
    font-size: ${L.overlineSize}px; color: #6b6b6b; letter-spacing: 0.18em;
    text-transform: uppercase; font-weight: 500;
  }
  .attribution-title {
    font-size: ${Math.round(L.titleSize * 0.82)}px;
    line-height: 1.1; color: #1a1a1a; font-weight: 500;
    letter-spacing: -0.015em; max-width: ${dims.w - L.padding * 2}px;
  }
  .attribution-source {
    font-size: ${Math.round(L.metaSize * 1.4)}px;
    color: #3a3a3a; font-weight: 500;
  }
  .attribution-url {
    font-size: ${L.metaSize}px; color: #6b6b6b; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
    overflow-wrap: anywhere; max-width: ${dims.w - L.padding * 2}px;
  }
  .attribution-qr {
    margin-top: 8px;
    background: #ffffff; border: 1px solid #e3e1d8; border-radius: 16px;
    padding: ${Math.round(L.padding * 0.4)}px;
  }
  .attribution-qr svg { display: block; }
  .attribution-cta {
    font-size: ${Math.round(L.metaSize * 1.1)}px;
    color: ${ACCENT}; font-weight: 500;
  }
</style>
</head>
<body>
  <main class="page">
    <header class="header">
      <div class="index-row">
        <span class="index-dot" style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${ACCENT};margin-right:10px;vertical-align:middle;"></span>
        <span class="index-tag" style="font-size:${L.overlineSize}px;color:#6b6b6b;letter-spacing:0.04em;">SOURCE</span>
      </div>
    </header>
    <div class="attribution">
      <div class="attribution-eyebrow">Read the original</div>
      <div class="attribution-title">${escapeHtml(explainer.title)}</div>
      <div class="attribution-source">${escapeHtml(domain)}</div>
      ${
        isUploadSource
          ? ""
          : `<div class="attribution-url">${escapeHtml(explainer.url)}</div>`
      }
      <div class="attribution-qr" aria-hidden="true">${qr}</div>
      <div class="attribution-cta">${
        isUploadSource ? "Scan to view the explainer" : "Scan to read"
      }</div>
    </div>
    ${brandedFooter({
      domain,
      L,
      qr: "",
      shareLabel: "made with Readopp",
    })}
  </main>
</body>
</html>`;
}

interface AllExportInput {
  explainer: Explainer;
  format: ExportFormat;
}

export async function buildStackedExportHtml(
  input: AllExportInput
): Promise<string> {
  const { explainer, format } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const L = layoutFor(format);
  const domain = sourceLabel(explainer.url);
  const panels = explainer.panels.slice(0, 4);

  const shareUrl = `${siteUrl()}/e/${explainer.id}`;
  const qr = await qrSvg(shareUrl, L.qrSize);

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
  .panel-heading { font-size: ${Math.round(L.captionSize * 1.1)}px; color: #1a1a1a; font-weight: 500; letter-spacing: -0.01em; }
  .panel-num { font-size: ${L.metaSize}px; color: ${ACCENT}; font-variant-numeric: tabular-nums; margin-right: 8px; font-weight: 500; }
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
            ${
              p.heading?.trim()
                ? `<div class="panel-heading"><span class="panel-num">${String(
                    i + 1
                  ).padStart(2, "0")}</span>${escapeHtml(p.heading)}</div>`
                : ""
            }
            <div class="panel-host">${panelHtml(p)}</div>
            ${p.caption ? `<p class="caption">${escapeHtml(p.caption)}</p>` : ""}
          </section>`
        )
        .join("")}
    </div>
    ${brandedFooter({
      domain,
      L,
      qr,
      shareLabel: `scan for full explainer · ${panels.length} of ${explainer.panels.length} panels shown`,
    })}
  </main>
</body>
</html>`;
}

function brandedFooter({
  domain,
  L,
  qr,
  shareLabel,
}: {
  domain: string;
  L: Layout;
  qr: string;
  shareLabel: string;
}): string {
  return `<footer class="footer">
    <div class="brand">
      <div class="wordmark"><span class="brand-dot"></span>Readopp</div>
      <div class="brand-meta">
        <span>${escapeHtml(domain)}</span>
        <span class="sep">·</span>
        <span class="share-label">${escapeHtml(shareLabel)}</span>
      </div>
    </div>
    <div class="qr" aria-hidden="true">${qr}</div>
  </footer>`;
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
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      border-top: 1px solid #e3e1d8; padding-top: 16px;
    }
    .brand { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .wordmark {
      display: inline-flex; align-items: center; gap: 8px;
      color: #1a1a1a; font-weight: 600; letter-spacing: -0.01em;
      font-size: ${Math.round(L.metaSize * 1.4)}px;
    }
    .brand-dot {
      width: ${Math.round(L.metaSize * 0.55)}px;
      height: ${Math.round(L.metaSize * 0.55)}px;
      border-radius: 999px;
      background: ${ACCENT};
    }
    .brand-meta {
      display: flex; align-items: center; gap: 8px;
      font-size: ${L.metaSize}px; color: #6b6b6b;
    }
    .brand-meta .sep { color: #a3a3a3; }
    .qr { flex-shrink: 0; line-height: 0; padding: 6px; background: #ffffff; border: 1px solid #e3e1d8; border-radius: 6px; }
    .qr svg { display: block; width: ${L.qrSize}px; height: ${L.qrSize}px; }
  `;
}
