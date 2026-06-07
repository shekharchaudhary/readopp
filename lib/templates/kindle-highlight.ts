import { EXPORT_DIMENSIONS } from "../export/dimensions";
import { sourceLabel } from "../shared/source";
import type {
  AttributionRenderInput,
  PanelRenderInput,
  TemplateDef,
} from "./types";

/**
 * Kindle Highlight — looks like an e-reader page with a highlighted
 * passage. Bookerly-style serif body, "Location 1820" markers, a
 * quiet "highlighted" tag, and minimal chrome at top/bottom (battery,
 * page %). Reads as "this is from a book I actually read."
 *
 * Carries instant trust for the book-Twitter / Substack reader
 * audience because the format is so familiar it's almost invisible.
 */

const PAPER = "#F8F5EE";
const PAPER_DEEP = "#EEE9DD";
const INK = "#1A1A1A";
const INK_SOFT = "#5A5048";
const INK_FAINT = "#8E867A";
const HIGHLIGHT = "rgba(255, 220, 130, 0.55)";
const ACCENT = "#7A6650";

const FONT_SERIF =
  "'Bookerly', 'IBM Plex Serif', 'Source Serif Pro', Georgia, 'Times New Roman', serif";
const FONT_SANS =
  "ui-sans-serif, system-ui, -apple-system, 'Inter', 'Söhne', Helvetica, Arial, sans-serif";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface Sizes {
  pad: number;
  chromeSize: number;
  locSize: number;
  hSize: number;
  bodySize: number;
  noteSize: number;
  footerSize: number;
  gap: number;
}

function sizesFor(format: PanelRenderInput["format"]): Sizes {
  switch (format) {
    case "vertical":
      return {
        pad: 80,
        chromeSize: 20,
        locSize: 22,
        hSize: 64,
        bodySize: 38,
        noteSize: 28,
        footerSize: 18,
        gap: 32,
      };
    case "landscape":
      return {
        pad: 44,
        chromeSize: 12,
        locSize: 14,
        hSize: 32,
        bodySize: 22,
        noteSize: 16,
        footerSize: 11,
        gap: 16,
      };
    default: // square
      return {
        pad: 64,
        chromeSize: 16,
        locSize: 18,
        hSize: 50,
        bodySize: 30,
        noteSize: 22,
        footerSize: 14,
        gap: 24,
      };
  }
}

function headingScaleFor(len: number): number {
  if (len <= 30) return 1.0;
  if (len <= 50) return 0.85;
  if (len <= 70) return 0.72;
  return 0.6;
}

function locationFor(seed: string, panelIndex: number): number {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  return ((n % 9000) + 500) + panelIndex * 47;
}

function batteryPercent(panelIndex: number, total: number): number {
  // Battery slowly drains across the carousel — small visual narrative
  // that ties panels together.
  const start = 92;
  const end = 67;
  const pct = start - ((start - end) * (panelIndex - 1)) / Math.max(1, total - 1);
  return Math.round(pct);
}

function extractHighlightedPassage(input: PanelRenderInput): string | null {
  const plan = input.panel.plan;
  if (plan?.stat?.value) {
    return `${plan.stat.value} — ${plan.stat.label ?? ""}`.trim();
  }
  if (plan?.metaphor?.poles?.length) {
    const lines = plan.metaphor.poles
      .map((p) => [p.label, p.sub].filter(Boolean).join(" — "))
      .filter(Boolean);
    if (lines.length) return lines.join(". ").slice(0, 240);
  }
  if (plan?.timeline?.length) {
    return plan.timeline
      .slice(0, 3)
      .map((t) => `${t.when}: ${t.what}`)
      .join(". ")
      .slice(0, 240);
  }
  return null;
}

function baseCss(w: number, h: number, S: Sizes, headingScale = 1): string {
  return `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: ${PAPER}; color: ${INK}; font-family: ${FONT_SERIF}; }
  body { width: ${w}px; height: ${h}px; overflow: hidden; }
  .page {
    width: ${w}px;
    height: ${h}px;
    padding: ${S.pad}px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: ${PAPER};
  }
  .chrome {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    font-family: ${FONT_SANS};
    font-size: ${S.chromeSize}px;
    color: ${INK_FAINT};
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border-bottom: 1px solid ${PAPER_DEEP};
    padding-bottom: ${Math.round(S.chromeSize * 0.6)}px;
    margin-bottom: ${S.gap}px;
  }
  .chrome .battery {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .chrome .battery .pack {
    display: inline-block;
    width: ${Math.round(S.chromeSize * 1.8)}px;
    height: ${Math.round(S.chromeSize * 0.9)}px;
    border: 1px solid ${INK_FAINT};
    border-radius: 2px;
    position: relative;
    padding: 1px;
  }
  .chrome .battery .pack::after {
    content: "";
    position: absolute;
    right: -3px;
    top: 25%;
    width: 2px;
    height: 50%;
    background: ${INK_FAINT};
    border-radius: 0 1px 1px 0;
  }
  .chrome .battery .pack .fill {
    height: 100%;
    background: ${ACCENT};
  }
  .location {
    font-family: ${FONT_SANS};
    font-size: ${S.locSize}px;
    color: ${ACCENT};
    text-transform: uppercase;
    letter-spacing: 0.18em;
    margin-bottom: ${Math.round(S.gap * 0.5)}px;
  }
  .location .tag {
    margin-left: ${Math.round(S.locSize * 0.6)}px;
    background: ${PAPER_DEEP};
    padding: 2px 8px;
    border-radius: 2px;
    color: ${ACCENT};
    font-size: ${Math.round(S.locSize * 0.8)}px;
    letter-spacing: 0.15em;
  }
  .headline {
    font-family: ${FONT_SERIF};
    font-size: ${Math.round(S.hSize * headingScale)}px;
    line-height: 1.18;
    font-weight: 600;
    color: ${INK};
    margin: 0 0 ${S.gap}px;
    letter-spacing: -0.005em;
    text-wrap: balance;
  }
  .body-area {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: ${Math.round(S.gap * 0.8)}px;
    overflow: hidden;
  }
  .passage {
    font-family: ${FONT_SERIF};
    font-size: ${S.bodySize}px;
    line-height: 1.55;
    color: ${INK};
    margin: 0;
  }
  .passage .h {
    background:
      linear-gradient(${HIGHLIGHT}, ${HIGHLIGHT}) no-repeat 0 80% / 100% 70%;
    padding: 0 4px;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  .note {
    font-family: ${FONT_SANS};
    font-size: ${S.noteSize}px;
    line-height: 1.45;
    color: ${INK_SOFT};
    border-left: 3px solid ${ACCENT};
    padding-left: ${Math.round(S.noteSize * 0.8)}px;
    margin: 0;
  }
  .note .label {
    font-size: ${Math.round(S.noteSize * 0.75)}px;
    color: ${ACCENT};
    text-transform: uppercase;
    letter-spacing: 0.18em;
    display: block;
    margin-bottom: 4px;
  }
  .footer {
    margin-top: ${Math.round(S.gap * 0.6)}px;
    padding-top: ${Math.round(S.gap * 0.5)}px;
    border-top: 1px solid ${PAPER_DEEP};
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    font-family: ${FONT_SANS};
    font-size: ${S.footerSize}px;
    color: ${INK_FAINT};
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  `;
}

async function renderPanel(input: PanelRenderInput): Promise<string> {
  const { explainer, panel, format, panelIndex, totalPanels } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const S = sizesFor(format);
  const headline = panel.heading?.trim() || explainer.title;
  const passageText = extractHighlightedPassage(input) ?? explainer.summary ?? "";
  const note = panel.caption?.trim();
  const headingScale = headingScaleFor(headline.length);
  const loc = locationFor(explainer.id, panelIndex);
  const battery = batteryPercent(panelIndex, totalPanels);
  const pct = Math.round((panelIndex / totalPanels) * 100);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, headingScale)}</style>
</head>
<body>
  <main class="page">
    <header class="chrome">
      <span>${escapeHtml(sourceLabel(explainer.url))}</span>
      <span class="battery">${battery}% <span class="pack"><span class="fill" style="width:${battery}%"></span></span></span>
    </header>
    <div class="location">Location ${loc.toLocaleString()}<span class="tag">highlighted</span></div>
    <h1 class="headline">${escapeHtml(headline)}</h1>
    <section class="body-area">
      ${
        passageText
          ? `<p class="passage"><span class="h">${escapeHtml(passageText)}</span></p>`
          : ""
      }
      ${
        note
          ? `<p class="note"><span class="label">Note</span>${escapeHtml(note)}</p>`
          : ""
      }
    </section>
    <footer class="footer">
      <span>readopp library</span>
      <span>${pct}% · ${String(panelIndex).padStart(2, "0")} / ${String(totalPanels).padStart(2, "0")}</span>
    </footer>
  </main>
</body>
</html>`;
}

async function renderAttribution(
  input: AttributionRenderInput
): Promise<string> {
  const { explainer, format } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const S = sizesFor(format);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, 0.9)}
  .src-url {
    font-family: ${FONT_SANS};
    font-size: ${Math.round(S.bodySize * 0.6)}px;
    color: ${ACCENT};
    border-top: 1px solid ${PAPER_DEEP};
    border-bottom: 1px solid ${PAPER_DEEP};
    padding: ${Math.round(S.gap * 0.5)}px 0;
    word-break: break-all;
    margin-top: ${S.gap}px;
    letter-spacing: 0.04em;
  }
</style>
</head>
<body>
  <main class="page">
    <header class="chrome">
      <span>${escapeHtml(sourceLabel(explainer.url))}</span>
      <span class="battery">100% <span class="pack"><span class="fill" style="width:100%"></span></span></span>
    </header>
    <div class="location">End of carousel<span class="tag">source</span></div>
    <h1 class="headline">${escapeHtml(explainer.title)}</h1>
    <section class="body-area">
      <p class="passage">Continue reading the full piece at the source. Quotes here are excerpts — the original gives more context, methodology, and citations.</p>
      <div class="src-url">${escapeHtml(explainer.url)}</div>
    </section>
    <footer class="footer">
      <span>readopp library</span>
      <span>source</span>
    </footer>
  </main>
</body>
</html>`;
}

export const kindleHighlightTemplate: TemplateDef = {
  id: "kindle-highlight",
  name: "Kindle Highlight",
  category: "Reader",
  tagline: "E-reader page with location marker and a quiet highlighted passage.",
  audience: "Book reviewers, learn-in-public readers, librarians-of-Twitter.",
  preview: {
    background: PAPER,
    foreground: INK,
    accent: ACCENT,
    sampleHeading: "Location 1820 · highlighted",
    fontFamily: FONT_SERIF,
  },
  renderPanel,
  renderAttribution,
};
