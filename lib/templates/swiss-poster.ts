import { EXPORT_DIMENSIONS } from "../export/dimensions";
import { sourceLabel } from "../shared/source";
import type {
  AttributionRenderInput,
  PanelRenderInput,
  TemplateDef,
} from "./types";

/**
 * Swiss Poster — International Typographic Style. Strict modular grid,
 * Helvetica-lineage grotesk, lowercase display headline, one geometric
 * accent shape per panel, and visible gridlines that tie the carousel
 * together like a Müller-Brockmann concert poster series.
 *
 * Discipline rules: flat color only, no shadows, no rounded corners,
 * the accent shape rotates per panel (circle → quarter arc → bar →
 * triangle) so the series reads as a set.
 */

interface Palette {
  bg: string;
  fg: string;
  accent: string;
}

const PALETTES: Palette[] = [
  { bg: "#F4F2ED", fg: "#111111", accent: "#E63312" }, // off-white x swiss red
  { bg: "#111111", fg: "#F4F2ED", accent: "#E63312" }, // inverted
  { bg: "#E63312", fg: "#F4F2ED", accent: "#111111" }, // red field
  { bg: "#F4F2ED", fg: "#111111", accent: "#0046AD" }, // cobalt variant
];

const FONT_GROTESK =
  "'Neue Haas Grotesk', 'Helvetica Now Display', Helvetica, 'Inter', Arial, sans-serif";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paletteFor(seed: string, panelIndex: number): Palette {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTES[(n + panelIndex) % PALETTES.length];
}

interface Sizes {
  pad: number;
  topSize: number;
  hSize: number;
  bodySize: number;
  footerSize: number;
  gap: number;
  shape: number;
}

function sizesFor(format: PanelRenderInput["format"]): Sizes {
  switch (format) {
    case "vertical":
      return {
        pad: 72,
        topSize: 24,
        hSize: 132,
        bodySize: 34,
        footerSize: 22,
        gap: 40,
        shape: 360,
      };
    case "landscape":
      return {
        pad: 36,
        topSize: 13,
        hSize: 68,
        bodySize: 19,
        footerSize: 12,
        gap: 18,
        shape: 170,
      };
    default: // square
      return {
        pad: 64,
        topSize: 18,
        hSize: 104,
        bodySize: 27,
        footerSize: 16,
        gap: 32,
        shape: 280,
      };
  }
}

function headingScaleFor(len: number): number {
  if (len <= 18) return 1;
  if (len <= 32) return 0.82;
  if (len <= 48) return 0.66;
  if (len <= 72) return 0.54;
  return 0.46;
}

/** One geometric accent per panel, rotating so the series reads as a set. */
function shapeFor(panelIndex: number, size: number, accent: string): string {
  const kind = panelIndex % 4;
  if (kind === 1) {
    // quarter arc
    return `<div style="width:${size}px;height:${size}px;background:${accent};border-radius:0 100% 0 0;"></div>`;
  }
  if (kind === 2) {
    // bar
    return `<div style="width:${size}px;height:${Math.round(size * 0.28)}px;background:${accent};"></div>`;
  }
  if (kind === 3) {
    // triangle
    return `<div style="width:0;height:0;border-left:${Math.round(size * 0.55)}px solid transparent;border-right:${Math.round(size * 0.55)}px solid transparent;border-bottom:${size}px solid ${accent};"></div>`;
  }
  // circle
  return `<div style="width:${size}px;height:${size}px;background:${accent};border-radius:50%;"></div>`;
}

function baseCss(w: number, h: number, S: Sizes, P: Palette, hScale = 1): string {
  const colW = Math.round((w - S.pad * 2) / 4);
  return `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: ${P.bg}; color: ${P.fg}; font-family: ${FONT_GROTESK}; }
  body { width: ${w}px; height: ${h}px; overflow: hidden; }
  .page {
    position: relative;
    width: ${w}px;
    height: ${h}px;
    padding: ${S.pad}px;
    background: ${P.bg};
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  /* Modular grid: 4 visible columns */
  .page::before {
    content: "";
    position: absolute;
    inset: ${S.pad}px;
    background-image: linear-gradient(90deg, ${P.fg}1f 1px, transparent 1px);
    background-size: ${colW}px 100%;
    pointer-events: none;
  }
  .top {
    display: flex;
    justify-content: space-between;
    font-size: ${S.topSize}px;
    font-weight: 500;
    letter-spacing: 0.02em;
  }
  .shape-row {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: ${Math.round(S.pad * 0.5)}px;
  }
  .headline {
    margin: 0;
    font-size: ${Math.round(S.hSize * hScale)}px;
    line-height: 0.98;
    font-weight: 700;
    letter-spacing: -0.045em;
    text-transform: lowercase;
    max-width: 92%;
  }
  .body {
    margin: ${S.gap}px 0 0;
    font-size: ${S.bodySize}px;
    line-height: 1.45;
    font-weight: 400;
    max-width: 72%;
  }
  .footer {
    margin-top: ${S.gap}px;
    padding-top: ${Math.round(S.gap * 0.45)}px;
    border-top: 2px solid ${P.fg};
    display: flex;
    justify-content: space-between;
    font-size: ${S.footerSize}px;
    font-weight: 500;
  }
  .idx {
    font-size: ${S.topSize}px;
    font-weight: 700;
    color: ${P.accent};
  }
  `;
}

async function renderPanel(input: PanelRenderInput): Promise<string> {
  const { explainer, panel, format, panelIndex, totalPanels } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const S = sizesFor(format);
  const P = paletteFor(explainer.id, panelIndex);
  const heading = panel.heading?.trim() || explainer.title;
  const body = panel.caption?.trim();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, P, headingScaleFor(heading.length))}</style>
</head>
<body>
  <main class="page">
    <header class="top">
      <span>readopp — ${escapeHtml(sourceLabel(explainer.url))}</span>
      <span class="idx">${panelIndex}/${totalPanels}</span>
    </header>
    <div class="shape-row">${shapeFor(panelIndex, S.shape, P.accent)}</div>
    <h1 class="headline">${escapeHtml(heading)}</h1>
    ${body ? `<p class="body">${escapeHtml(body)}</p>` : ""}
    <footer class="footer">
      <span>${escapeHtml(sourceLabel(explainer.url))}</span>
      <span>readopp.com</span>
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
  const P = PALETTES[2]; // red field closer

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, P, 0.85)}
  .src-url {
    margin-top: ${S.gap}px;
    font-size: ${Math.round(S.bodySize * 1.05)}px;
    font-weight: 700;
    word-break: break-all;
    border-bottom: 4px solid ${P.fg};
    display: inline-block;
    padding-bottom: ${Math.round(S.gap * 0.2)}px;
  }
</style>
</head>
<body>
  <main class="page">
    <header class="top">
      <span>readopp — source</span>
      <span class="idx">end</span>
    </header>
    <div class="shape-row">${shapeFor(0, S.shape, P.accent)}</div>
    <h1 class="headline">read the original.</h1>
    <p class="body">${escapeHtml(explainer.title)}</p>
    <div class="src-url">${escapeHtml(explainer.url)}</div>
    <footer class="footer">
      <span>${escapeHtml(sourceLabel(explainer.url))}</span>
      <span>readopp.com</span>
    </footer>
  </main>
</body>
</html>`;
}

export const swissPosterTemplate: TemplateDef = {
  id: "swiss-poster",
  name: "Swiss Poster",
  category: "Modern",
  tagline: "Müller-Brockmann grid, lowercase grotesk, one geometric accent.",
  audience: "Design-literate writers, brand thinkers, typography devotees.",
  preview: {
    background: PALETTES[0].bg,
    foreground: PALETTES[0].fg,
    accent: PALETTES[0].accent,
    sampleHeading: "grid above all.",
    fontFamily: FONT_GROTESK,
  },
  renderPanel,
  renderAttribution,
};
