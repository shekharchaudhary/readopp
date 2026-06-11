import { EXPORT_DIMENSIONS } from "../export/dimensions";
import { sourceLabel } from "../shared/source";
import type {
  AttributionRenderInput,
  PanelRenderInput,
  TemplateDef,
} from "./types";

/**
 * Bento Board — the Apple-keynote bento layout: a soft neutral field
 * holding rounded tiles of different sizes. The headline gets the hero
 * tile, the panel visual gets the big content tile, and small meta tiles
 * (index, source, accent swatch) fill the corners so every panel feels
 * composed rather than templated.
 */

interface Accent {
  tile: string;
  text: string;
  soft: string;
}

const ACCENTS: Accent[] = [
  { tile: "#0A84FF", text: "#FFFFFF", soft: "#E3F0FF" }, // iOS blue
  { tile: "#BF5AF2", text: "#FFFFFF", soft: "#F5E9FD" }, // purple
  { tile: "#30D158", text: "#04300F", soft: "#E4F9EA" }, // green
  { tile: "#FF9F0A", text: "#3A2300", soft: "#FFF2DE" }, // orange
  { tile: "#FF375F", text: "#FFFFFF", soft: "#FFE5EA" }, // pink-red
];

const BG = "#F5F5F7";
const INK = "#1D1D1F";
const INK_SOFT = "#515154";
const FONT_SANS =
  "'Inter', 'SF Pro Display', -apple-system, ui-sans-serif, system-ui, Helvetica, Arial, sans-serif";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function accentFor(seed: string, panelIndex: number): Accent {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  return ACCENTS[(n + panelIndex) % ACCENTS.length];
}

interface Sizes {
  pad: number;
  gap: number;
  radius: number;
  topSize: number;
  hSize: number;
  bodySize: number;
  metaSize: number;
  numSize: number;
  tilePad: number;
  visualMax: number;
}

function sizesFor(format: PanelRenderInput["format"]): Sizes {
  switch (format) {
    case "vertical":
      return {
        pad: 56,
        gap: 24,
        radius: 36,
        topSize: 22,
        hSize: 84,
        bodySize: 32,
        metaSize: 22,
        numSize: 120,
        tilePad: 48,
        visualMax: 780,
      };
    case "landscape":
      return {
        pad: 28,
        gap: 14,
        radius: 22,
        topSize: 12,
        hSize: 44,
        bodySize: 18,
        metaSize: 12,
        numSize: 64,
        tilePad: 26,
        visualMax: 300,
      };
    default: // square
      return {
        pad: 48,
        gap: 20,
        radius: 30,
        topSize: 16,
        hSize: 62,
        bodySize: 26,
        metaSize: 16,
        numSize: 96,
        tilePad: 40,
        visualMax: 460,
      };
  }
}

function headingScaleFor(len: number): number {
  if (len <= 24) return 1;
  if (len <= 42) return 0.84;
  if (len <= 64) return 0.7;
  return 0.58;
}

function baseCss(w: number, h: number, S: Sizes, A: Accent, hScale = 1): string {
  return `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: ${BG}; color: ${INK}; font-family: ${FONT_SANS}; }
  body { width: ${w}px; height: ${h}px; overflow: hidden; }
  .page {
    width: ${w}px;
    height: ${h}px;
    padding: ${S.pad}px;
    background: ${BG};
    display: flex;
    flex-direction: column;
    gap: ${S.gap}px;
    overflow: hidden;
  }
  .tile {
    background: #FFFFFF;
    border-radius: ${S.radius}px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 8px 28px rgba(0,0,0,0.05);
    padding: ${S.tilePad}px;
    overflow: hidden;
  }
  .row { display: flex; gap: ${S.gap}px; min-height: 0; }
  .hero {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .kicker {
    font-size: ${S.topSize}px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    font-weight: 600;
    color: ${A.tile};
    margin: 0 0 ${Math.round(S.gap * 0.6)}px;
  }
  .headline {
    margin: 0;
    font-size: ${Math.round(S.hSize * hScale)}px;
    line-height: 1.06;
    font-weight: 700;
    letter-spacing: -0.035em;
    color: ${INK};
  }
  .numtile {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: ${A.tile};
    color: ${A.text};
    min-width: ${Math.round(S.numSize * 1.6)}px;
  }
  .numtile .n {
    font-size: ${S.numSize}px;
    font-weight: 700;
    letter-spacing: -0.05em;
    line-height: 1;
  }
  .numtile .of {
    font-size: ${S.metaSize}px;
    font-weight: 600;
    letter-spacing: 0.12em;
    opacity: 0.75;
    margin-top: ${Math.round(S.gap * 0.4)}px;
  }
  .content {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .content svg { width: 100%; height: auto; max-height: ${S.visualMax}px; }
  .content .html-panel { width: 100%; color: ${INK}; font-size: ${Math.round(S.bodySize * 0.78)}px; }
  .content.textonly {
    background: ${A.soft};
  }
  .content.textonly p {
    margin: 0;
    font-size: ${Math.round(S.bodySize * 1.15)}px;
    line-height: 1.5;
    color: ${INK};
    font-weight: 500;
  }
  .caption-tile { flex: 2.6; display: flex; align-items: center; }
  .caption-tile p {
    margin: 0;
    font-size: ${S.bodySize}px;
    line-height: 1.45;
    color: ${INK_SOFT};
  }
  .meta-tile {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: ${Math.round(S.gap * 0.3)}px;
  }
  .meta-tile .lab {
    font-size: ${Math.round(S.metaSize * 0.85)}px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: ${INK_SOFT};
    font-weight: 600;
  }
  .meta-tile .val {
    font-size: ${S.metaSize * 1.15}px;
    font-weight: 600;
    color: ${INK};
    word-break: break-word;
  }
  `;
}

function visualBlock(panel: PanelRenderInput["panel"]): string {
  if (!panel.content?.trim()) return "";
  if (panel.format === "svg") return panel.content;
  return `<div class="html-panel">${panel.content}</div>`;
}

async function renderPanel(input: PanelRenderInput): Promise<string> {
  const { explainer, panel, format, panelIndex, totalPanels } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const S = sizesFor(format);
  const A = accentFor(explainer.id, panelIndex);
  const heading = panel.heading?.trim() || explainer.title;
  const body = panel.caption?.trim();
  const idx = String(panelIndex).padStart(2, "0");
  const visual = visualBlock(panel);

  const contentTile = visual
    ? `<section class="tile content">${visual}</section>`
    : body
      ? `<section class="tile content textonly"><p>${escapeHtml(body)}</p></section>`
      : "";

  // Caption row only when the visual tile is present (otherwise the
  // caption already occupies the content tile).
  const captionRow =
    visual && body
      ? `<div class="row">
      <section class="tile caption-tile"><p>${escapeHtml(body)}</p></section>
      <section class="tile meta-tile">
        <span class="lab">Source</span>
        <span class="val">${escapeHtml(sourceLabel(explainer.url))}</span>
      </section>
    </div>`
      : `<div class="row">
      <section class="tile meta-tile">
        <span class="lab">Source</span>
        <span class="val">${escapeHtml(sourceLabel(explainer.url))}</span>
      </section>
      <section class="tile meta-tile">
        <span class="lab">Made with</span>
        <span class="val">readopp.com</span>
      </section>
    </div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, A, headingScaleFor(heading.length))}</style>
</head>
<body>
  <main class="page">
    <div class="row" style="flex: 0 0 auto;">
      <section class="tile hero">
        <p class="kicker">Readopp</p>
        <h1 class="headline">${escapeHtml(heading)}</h1>
      </section>
      <section class="tile numtile">
        <span class="n">${idx}</span>
        <span class="of">OF ${String(totalPanels).padStart(2, "0")}</span>
      </section>
    </div>
    <div class="row" style="flex: 1;">
      ${contentTile}
    </div>
    ${captionRow}
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
  const A = ACCENTS[0];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, A, 0.95)}
  .url-tile {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: ${Math.round(S.gap * 0.5)}px;
    background: ${A.soft};
  }
  .url-tile .lab {
    font-size: ${S.metaSize}px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: ${A.tile};
    font-weight: 700;
  }
  .url-tile .url {
    font-size: ${Math.round(S.bodySize * 1.05)}px;
    font-weight: 600;
    color: ${INK};
    word-break: break-all;
  }
</style>
</head>
<body>
  <main class="page">
    <div class="row" style="flex: 1;">
      <section class="tile hero">
        <p class="kicker">The source</p>
        <h1 class="headline">This was a summary. The original is better.</h1>
      </section>
    </div>
    <div class="row" style="flex: 0 0 auto;">
      <section class="tile url-tile">
        <span class="lab">Read it in full</span>
        <span class="url">${escapeHtml(explainer.url)}</span>
      </section>
    </div>
    <div class="row">
      <section class="tile meta-tile">
        <span class="lab">Title</span>
        <span class="val">${escapeHtml(explainer.title)}</span>
      </section>
      <section class="tile meta-tile">
        <span class="lab">Made with</span>
        <span class="val">readopp.com</span>
      </section>
    </div>
  </main>
</body>
</html>`;
}

export const bentoGridTemplate: TemplateDef = {
  id: "bento-grid",
  name: "Bento Board",
  category: "Modern",
  tagline: "Keynote-style bento tiles — hero, visual, and meta in one grid.",
  audience: "Product people, designers, anyone fluent in launch-day visuals.",
  preview: {
    background: BG,
    foreground: INK,
    accent: ACCENTS[0].tile,
    sampleHeading: "Everything in its tile.",
    fontFamily: FONT_SANS,
  },
  renderPanel,
  renderAttribution,
};
