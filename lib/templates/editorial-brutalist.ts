import { EXPORT_DIMENSIONS } from "../export/dimensions";
import { sourceLabel } from "../shared/source";
import type {
  AttributionRenderInput,
  PanelRenderInput,
  TemplateDef,
} from "./types";

/**
 * Editorial Brutalist — Pentagram-scale type. The headline is sized so
 * it actively bleeds off the panel edge; the panel index is a giant
 * tabular numeral; no decorative chrome at all. Yellow-on-black is
 * the default palette but every panel can choose its own from a small
 * curated set so the carousel feels like a series, not one slide.
 *
 * Anti-pattern protection: no shadows, no rounded corners, no icons,
 * no gradients. The discipline is the design.
 */

interface Palette {
  bg: string;
  fg: string;
  accent: string;
}

const PALETTES: Palette[] = [
  { bg: "#FFEB00", fg: "#0A0A0A", accent: "#0A0A0A" }, // chrome-yellow x black
  { bg: "#0A0A0A", fg: "#FAFAFA", accent: "#FFEB00" }, // black x yellow
  { bg: "#FF3D2E", fg: "#FAFAFA", accent: "#0A0A0A" }, // signal red
  { bg: "#0E3CFF", fg: "#FAFAFA", accent: "#FFEB00" }, // ultramarine
  { bg: "#1F1F1F", fg: "#FAFAFA", accent: "#FF3D2E" }, // smoke
];

const FONT_DISPLAY =
  "'Druk Wide', 'PP Editorial New', 'GT Sectra', 'Inter', system-ui, sans-serif";
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
  topSize: number;
  hSize: number;
  numSize: number;
  bodySize: number;
  footerSize: number;
  gap: number;
}

function sizesFor(format: PanelRenderInput["format"]): Sizes {
  switch (format) {
    case "vertical":
      return {
        pad: 64,
        topSize: 26,
        hSize: 280,
        numSize: 520,
        bodySize: 32,
        footerSize: 22,
        gap: 36,
      };
    case "landscape":
      return {
        pad: 32,
        topSize: 14,
        hSize: 140,
        numSize: 220,
        bodySize: 18,
        footerSize: 13,
        gap: 16,
      };
    default: // square
      return {
        pad: 56,
        topSize: 20,
        hSize: 220,
        numSize: 420,
        bodySize: 28,
        footerSize: 18,
        gap: 28,
      };
  }
}

function headingScaleFor(len: number): number {
  if (len <= 10) return 1.2;
  if (len <= 18) return 1.0;
  if (len <= 28) return 0.78;
  if (len <= 44) return 0.58;
  if (len <= 64) return 0.42;
  return 0.34;
}

function paletteFor(seed: string, panelIndex: number): Palette {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTES[(n + panelIndex) % PALETTES.length];
}

function baseCss(w: number, h: number, S: Sizes, P: Palette, headingScale = 1): string {
  return `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: ${P.bg}; color: ${P.fg}; font-family: ${FONT_DISPLAY}; }
  body { width: ${w}px; height: ${h}px; overflow: hidden; }
  .page {
    width: ${w}px;
    height: ${h}px;
    padding: ${S.pad}px;
    background: ${P.bg};
    color: ${P.fg};
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 24px;
    font-family: ${FONT_SANS};
    font-size: ${S.topSize}px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    font-weight: 700;
  }
  .stack {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: end;
    gap: ${S.gap}px;
    overflow: hidden;
  }
  .headline {
    font-family: ${FONT_DISPLAY};
    font-size: ${Math.round(S.hSize * headingScale)}px;
    line-height: 0.85;
    font-weight: 800;
    color: ${P.fg};
    margin: 0;
    letter-spacing: -0.04em;
    text-transform: uppercase;
    /* Slight overshoot so the type actually bleeds off the edge */
    margin-left: -0.04em;
    word-break: break-word;
  }
  .headline .dot {
    display: inline-block;
    width: ${Math.round(S.hSize * headingScale * 0.18)}px;
    height: ${Math.round(S.hSize * headingScale * 0.18)}px;
    background: ${P.accent};
    margin-left: ${Math.round(S.hSize * headingScale * 0.05)}px;
    vertical-align: ${Math.round(S.hSize * headingScale * 0.02)}px;
  }
  .num {
    font-family: ${FONT_DISPLAY};
    font-size: ${S.numSize}px;
    line-height: 0.78;
    font-weight: 900;
    color: ${P.accent};
    letter-spacing: -0.08em;
    text-align: right;
    margin: 0;
    align-self: end;
  }
  .body {
    font-family: ${FONT_SANS};
    font-size: ${S.bodySize}px;
    line-height: 1.35;
    color: ${P.fg};
    margin: ${S.gap}px 0 0;
    max-width: 80%;
    font-weight: 500;
  }
  .footer {
    margin-top: ${S.gap}px;
    padding-top: ${Math.round(S.gap * 0.4)}px;
    border-top: 4px solid ${P.fg};
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    font-family: ${FONT_SANS};
    font-size: ${S.footerSize}px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    font-weight: 700;
  }
  `;
}

async function renderPanel(input: PanelRenderInput): Promise<string> {
  const { explainer, panel, format, panelIndex, totalPanels } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const S = sizesFor(format);
  const headline = (panel.heading?.trim() || explainer.title).toUpperCase();
  const body = panel.caption?.trim();
  const headingScale = headingScaleFor(headline.length);
  const palette = paletteFor(explainer.id, panelIndex);
  const idx = String(panelIndex).padStart(2, "0");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, palette, headingScale)}</style>
</head>
<body>
  <main class="page">
    <header class="top">
      <span>Readopp</span>
      <span>${escapeHtml(sourceLabel(explainer.url).toUpperCase())} · ${idx}/${String(totalPanels).padStart(2, "0")}</span>
    </header>
    <section class="stack">
      <h1 class="headline">${escapeHtml(headline)}<span class="dot"></span></h1>
      <div class="num">${idx}</div>
    </section>
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
  const palette = PALETTES[0]; // chrome-yellow x black for the closer
  const title = explainer.title.toUpperCase();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, palette, headingScaleFor(title.length) * 0.95)}
  .src-url {
    font-family: ${FONT_SANS};
    font-size: ${Math.round(S.bodySize * 1.05)}px;
    color: ${palette.accent};
    background: ${palette.fg};
    padding: ${Math.round(S.gap * 0.5)}px ${Math.round(S.gap * 0.7)}px;
    word-break: break-all;
    font-weight: 700;
    margin-top: ${S.gap}px;
  }
</style>
</head>
<body>
  <main class="page">
    <header class="top">
      <span>READOPP · END</span>
      <span>SOURCE</span>
    </header>
    <section class="stack">
      <h1 class="headline">READ.<span class="dot"></span> THE. SOURCE.</h1>
      <div class="num">∞</div>
    </section>
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

export const editorialBrutalistTemplate: TemplateDef = {
  id: "editorial-brutalist",
  name: "Editorial Brutalist",
  category: "Bold",
  tagline: "Pentagram-scale type that bleeds off the panel edge.",
  audience: "Opinionated founders, contrarians, hot-take essayists.",
  preview: {
    background: PALETTES[0].bg,
    foreground: PALETTES[0].fg,
    accent: PALETTES[0].accent,
    sampleHeading: "STOP. THINK. SHIP.",
    fontFamily: FONT_DISPLAY,
  },
  renderPanel,
  renderAttribution,
};
