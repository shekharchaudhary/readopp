import QRCode from "qrcode";
import type { BrandKit, Explainer, RenderedPanel } from "../shared/schemas";
import { sourceLabel } from "../shared/source";
import { EXPORT_DIMENSIONS, type ExportFormat } from "./dimensions";

const DEFAULT_ACCENT = "#1F97DC";

const BRAND_FONT_FAMILY: Record<NonNullable<BrandKit["font"]>, string> = {
  sans: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
  serif: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  display:
    "ui-sans-serif, system-ui, 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
};

/** Resolve a brand kit into the values the builders use. */
function brandTokens(brand?: BrandKit | null) {
  return {
    accent: brand?.color || DEFAULT_ACCENT,
    fontFamily:
      brand?.font && BRAND_FONT_FAMILY[brand.font]
        ? BRAND_FONT_FAMILY[brand.font]
        : "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
    logoUrl: brand?.logoUrl || null,
    authorName: brand?.authorName || null,
    authorHeadline: brand?.authorHeadline || null,
  };
}

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

async function qrSvg(
  target: string,
  size: number,
  // Accepts a brand accent but stays #1a1a1a for QR readability — pure
  // brand color often fails QR contrast checks. Kept as a parameter so we
  // can override later without a signature change.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _brandAccent?: string
): Promise<string> {
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
  brand?: BrandKit | null;
}

/**
 * Single-panel export HTML. The shared-asset case: when someone screenshots
 * this on Instagram/TikTok/LinkedIn, the QR + wordmark in the corner is the
 * only way the panel pulls traffic back to the site.
 */
export async function buildPanelExportHtml(
  input: PanelExportInput
): Promise<string> {
  const { explainer, panel, format, panelIndex, totalPanels, brand } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const L = layoutFor(format);
  const B = brandTokens(brand);
  const domain = sourceLabel(explainer.url);
  const heading = panel.heading?.trim() || explainer.title;
  const showOverline = Boolean(panel.heading?.trim());

  const shareUrl = `${siteUrl()}/e/${explainer.id}`;
  const qr = await qrSvg(shareUrl, L.qrSize, B.accent);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  ${baseStyles(dims.w, dims.h, L, B)}
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
  .index-dot { width: 8px; height: 8px; border-radius: 999px; background: ${B.accent}; }
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
    ${brandedFooter({ domain, L, B, qr, shareLabel: "scan to read all panels" })}
  </main>
</body>
</html>`;
}

interface AttributionExportInput {
  explainer: Explainer;
  format: ExportFormat;
  brand?: BrandKit | null;
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
  const { explainer, format, brand } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const L = layoutFor(format);
  const B = brandTokens(brand);
  const domain = sourceLabel(explainer.url);
  const isUploadSource = explainer.url.startsWith("upload://");
  // QR points to the SOURCE, not back to Readopp — this slide is "go read
  // the original thing." Falls back to the Readopp explainer page when the
  // source is an upload (no public URL to encode).
  const qrTarget = isUploadSource
    ? `${siteUrl()}/e/${explainer.id}`
    : explainer.url;
  const qr = await qrSvg(qrTarget, Math.round(L.qrSize * 2.4), B.accent);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  ${baseStyles(dims.w, dims.h, L, B)}
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
    color: ${B.accent}; font-weight: 500;
  }
</style>
</head>
<body>
  <main class="page">
    <header class="header">
      <div class="index-row">
        <span class="index-dot" style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${B.accent};margin-right:10px;vertical-align:middle;"></span>
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
      B,
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
  brand?: BrandKit | null;
}

export async function buildStackedExportHtml(
  input: AllExportInput
): Promise<string> {
  const { explainer, format, brand } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const L = layoutFor(format);
  const B = brandTokens(brand);
  const domain = sourceLabel(explainer.url);
  const panels = explainer.panels.slice(0, 4);

  const shareUrl = `${siteUrl()}/e/${explainer.id}`;
  const qr = await qrSvg(shareUrl, L.qrSize, B.accent);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  ${baseStyles(dims.w, dims.h, L, B)}
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
  .panel-num { font-size: ${L.metaSize}px; color: ${B.accent}; font-variant-numeric: tabular-nums; margin-right: 8px; font-weight: 500; }
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
      B,
      qr,
      shareLabel: `scan for full explainer · ${panels.length} of ${explainer.panels.length} panels shown`,
    })}
  </main>
</body>
</html>`;
}

type BrandTokens = ReturnType<typeof brandTokens>;

function brandedFooter({
  domain,
  L,
  B,
  qr,
  shareLabel,
}: {
  domain: string;
  L: Layout;
  B: BrandTokens;
  qr: string;
  shareLabel: string;
}): string {
  // Wordmark: brand logo if set, else accent dot + "Readopp"
  const wordmark = B.logoUrl
    ? `<img class="brand-logo" src="${escapeHtml(B.logoUrl)}" alt="" />`
    : `<span class="wordmark"><span class="brand-dot"></span>Readopp</span>`;
  // When a brand author is set, the line shows their name + headline and the
  // brand becomes "name · headline" with a small "made with Readopp" tag.
  const authorLine = B.authorName
    ? `<div class="brand-author">
         <span class="brand-author-name">${escapeHtml(B.authorName)}</span>
         ${
           B.authorHeadline
             ? `<span class="brand-author-headline">${escapeHtml(B.authorHeadline)}</span>`
             : ""
         }
       </div>`
    : "";
  return `<footer class="footer">
    <div class="brand">
      <div class="brand-row">${wordmark}${authorLine}</div>
      <div class="brand-meta">
        <span>${escapeHtml(domain)}</span>
        <span class="sep">·</span>
        <span class="share-label">${escapeHtml(shareLabel)}</span>
        ${
          B.authorName
            ? `<span class="sep">·</span><span class="madewith">made with Readopp</span>`
            : ""
        }
      </div>
    </div>
    ${qr ? `<div class="qr" aria-hidden="true">${qr}</div>` : ""}
  </footer>`;
}

function baseStyles(w: number, h: number, L: Layout, B: BrandTokens): string {
  return `
    html, body { margin: 0; padding: 0; background: #fafaf7; color: #1a1a1a;
      font-family: ${B.fontFamily};
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
    .brand-row { display: flex; align-items: center; gap: 12px; }
    .brand-logo {
      height: ${Math.round(L.metaSize * 2.2)}px;
      width: ${Math.round(L.metaSize * 2.2)}px;
      object-fit: contain;
      border-radius: 6px;
      background: #ffffff;
      border: 1px solid #e3e1d8;
      padding: 4px;
    }
    .wordmark {
      display: inline-flex; align-items: center; gap: 8px;
      color: #1a1a1a; font-weight: 600; letter-spacing: -0.01em;
      font-size: ${Math.round(L.metaSize * 1.4)}px;
    }
    .brand-dot {
      display: inline-block;
      width: ${Math.round(L.metaSize * 0.55)}px;
      height: ${Math.round(L.metaSize * 0.55)}px;
      border-radius: 999px;
      background: ${B.accent};
    }
    .brand-author { display: flex; flex-direction: column; gap: 2px; line-height: 1.15; min-width: 0; }
    .brand-author-name {
      color: #1a1a1a; font-weight: 600; letter-spacing: -0.01em;
      font-size: ${Math.round(L.metaSize * 1.2)}px;
    }
    .brand-author-headline { color: #6b6b6b; font-size: ${L.metaSize}px; }
    .brand-meta {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      font-size: ${L.metaSize}px; color: #6b6b6b;
    }
    .brand-meta .sep { color: #a3a3a3; }
    .madewith { color: #a3a3a3; }
    .qr { flex-shrink: 0; line-height: 0; padding: 6px; background: #ffffff; border: 1px solid #e3e1d8; border-radius: 6px; }
    .qr svg { display: block; width: ${L.qrSize}px; height: ${L.qrSize}px; }
  `;
}
