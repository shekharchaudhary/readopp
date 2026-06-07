import { EXPORT_DIMENSIONS } from "../export/dimensions";
import { sourceLabel } from "../shared/source";
import type {
  AttributionRenderInput,
  PanelRenderInput,
  TemplateDef,
} from "./types";

/**
 * New Yorker Frame — discipline is the design. A thin 1pt black border,
 * generous margins, Caslon-family serif, italic pull-quote, page number
 * in the corner. One idea per panel. Nothing decorative.
 *
 * The killer detail is the *space* — most templates feel anxious to
 * fill the canvas. This one breathes.
 */

const PAPER = "#FFFFFF";
const INK = "#1A1A1A";
const INK_SOFT = "#5A5048";
const DROP_CAP_RED = "#9C2A1B";

const FONT_SERIF =
  "'Adobe Caslon Pro', 'ITC Caslon', 'Caslon', 'EB Garamond', Georgia, 'Times New Roman', serif";
const FONT_SANS =
  "ui-sans-serif, system-ui, -apple-system, 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface Sizes {
  outerPad: number;
  innerPad: number;
  topSize: number;
  hSize: number;
  bodySize: number;
  pullSize: number;
  pageNoSize: number;
  gap: number;
}

function sizesFor(format: PanelRenderInput["format"]): Sizes {
  switch (format) {
    case "vertical":
      return {
        outerPad: 64,
        innerPad: 80,
        topSize: 20,
        hSize: 86,
        bodySize: 32,
        pullSize: 60,
        pageNoSize: 20,
        gap: 32,
      };
    case "landscape":
      return {
        outerPad: 36,
        innerPad: 48,
        topSize: 12,
        hSize: 44,
        bodySize: 20,
        pullSize: 30,
        pageNoSize: 12,
        gap: 16,
      };
    default: // square
      return {
        outerPad: 56,
        innerPad: 72,
        topSize: 16,
        hSize: 66,
        bodySize: 26,
        pullSize: 44,
        pageNoSize: 16,
        gap: 26,
      };
  }
}

function headingScaleFor(len: number): number {
  if (len <= 26) return 1.0;
  if (len <= 42) return 0.85;
  if (len <= 60) return 0.72;
  return 0.6;
}

function baseCss(w: number, h: number, S: Sizes, headingScale = 1): string {
  return `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: ${PAPER}; color: ${INK}; font-family: ${FONT_SERIF}; }
  body { width: ${w}px; height: ${h}px; overflow: hidden; }
  .outer {
    width: ${w}px;
    height: ${h}px;
    padding: ${S.outerPad}px;
    background: ${PAPER};
    overflow: hidden;
  }
  /* The thin black frame — the defining gesture. */
  .frame {
    width: 100%;
    height: 100%;
    border: 1px solid ${INK};
    padding: ${S.innerPad}px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    font-family: ${FONT_SANS};
    font-size: ${S.topSize}px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: ${INK_SOFT};
    margin-bottom: ${S.gap}px;
  }
  .top .name { color: ${INK}; font-weight: 600; }
  .body-area {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: ${S.gap}px;
  }
  .headline {
    font-family: ${FONT_SERIF};
    font-size: ${Math.round(S.hSize * headingScale)}px;
    line-height: 1.05;
    letter-spacing: -0.005em;
    color: ${INK};
    margin: 0;
    text-align: center;
    font-weight: 500;
    text-wrap: balance;
  }
  .pull {
    font-family: ${FONT_SERIF};
    font-style: italic;
    font-size: ${S.pullSize}px;
    line-height: 1.2;
    color: ${INK};
    margin: 0;
    text-align: center;
    text-wrap: balance;
    position: relative;
    padding: 0 ${Math.round(S.pullSize * 0.6)}px;
  }
  .pull::before, .pull::after {
    font-family: ${FONT_SERIF};
    color: ${INK_SOFT};
    font-size: ${Math.round(S.pullSize * 1.4)}px;
    line-height: 0;
    position: absolute;
    top: ${Math.round(S.pullSize * 0.7)}px;
  }
  .pull::before { content: "\\201C"; left: 0; }
  .pull::after { content: "\\201D"; right: 0; }
  .body {
    font-family: ${FONT_SERIF};
    font-size: ${S.bodySize}px;
    line-height: 1.55;
    color: ${INK};
    margin: 0;
    text-align: justify;
    hyphens: auto;
    max-width: 100%;
  }
  .body .drop {
    font-family: ${FONT_SERIF};
    font-size: ${Math.round(S.bodySize * 3.8)}px;
    color: ${DROP_CAP_RED};
    float: left;
    line-height: 0.85;
    padding: ${Math.round(S.bodySize * 0.15)}px ${Math.round(S.bodySize * 0.5)}px 0 0;
    font-weight: 500;
  }
  .footer {
    margin-top: auto;
    padding-top: ${S.gap}px;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-family: ${FONT_SANS};
    font-size: ${S.pageNoSize}px;
    color: ${INK_SOFT};
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }
  .footer .pageno { font-variant-numeric: tabular-nums; color: ${INK}; }
  `;
}

async function renderPanel(input: PanelRenderInput): Promise<string> {
  const { explainer, panel, format, panelIndex, totalPanels } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const S = sizesFor(format);
  const headline = panel.heading?.trim() || explainer.title;
  const caption = panel.caption?.trim();
  const headingScale = headingScaleFor(headline.length);

  // Show either a pull quote OR a body paragraph — never both. Pull
  // quote when the caption is short and punchy; body when it's longer
  // and benefits from the drop-cap treatment.
  const usePull = !!caption && caption.length <= 130;
  const dropCap = caption && caption.length > 1 ? caption[0] : "";
  const bodyRest = caption && caption.length > 1 ? caption.slice(1) : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, headingScale)}</style>
</head>
<body>
  <div class="outer">
    <div class="frame">
      <header class="top">
        <span class="name">The Readopp</span>
        <span>${escapeHtml(sourceLabel(explainer.url))}</span>
      </header>
      <section class="body-area">
        <h1 class="headline">${escapeHtml(headline)}</h1>
        ${
          caption
            ? usePull
              ? `<p class="pull">${escapeHtml(caption)}</p>`
              : `<p class="body"><span class="drop">${escapeHtml(dropCap)}</span>${escapeHtml(bodyRest)}</p>`
            : ""
        }
      </section>
      <footer class="footer">
        <span>READOPP</span>
        <span class="pageno">${String(panelIndex).padStart(2, "0")} / ${String(totalPanels).padStart(2, "0")}</span>
      </footer>
    </div>
  </div>
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
<style>${baseCss(dims.w, dims.h, S, 0.85)}
  .attr-url {
    font-family: ${FONT_SANS};
    font-size: ${Math.round(S.bodySize * 0.7)}px;
    color: ${INK};
    letter-spacing: 0.06em;
    text-align: center;
    border-top: 1px solid ${INK};
    border-bottom: 1px solid ${INK};
    padding: ${Math.round(S.gap * 0.5)}px 0;
    word-break: break-all;
  }
  .attr-label {
    font-family: ${FONT_SANS};
    font-size: ${S.topSize}px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    text-align: center;
    color: ${INK_SOFT};
  }
</style>
</head>
<body>
  <div class="outer">
    <div class="frame">
      <header class="top">
        <span class="name">The Readopp</span>
        <span>Source</span>
      </header>
      <section class="body-area">
        <div class="attr-label">Continue reading</div>
        <h1 class="headline">${escapeHtml(explainer.title)}</h1>
        <p class="pull">${escapeHtml(sourceLabel(explainer.url))}</p>
        <p class="attr-url">${escapeHtml(explainer.url)}</p>
      </section>
      <footer class="footer">
        <span>READOPP</span>
        <span class="pageno">END</span>
      </footer>
    </div>
  </div>
</body>
</html>`;
}

export const newYorkerFrameTemplate: TemplateDef = {
  id: "new-yorker-frame",
  name: "New Yorker Frame",
  category: "Editorial",
  tagline: "Thin black border, Caslon, captioned visual — magazine page energy.",
  audience: "Essayists, critics, longform commentators.",
  preview: {
    background: PAPER,
    foreground: INK,
    accent: DROP_CAP_RED,
    sampleHeading: "A Personal History of Caching",
    fontFamily: FONT_SERIF,
  },
  renderPanel,
  renderAttribution,
};
