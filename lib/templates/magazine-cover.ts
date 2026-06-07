import { EXPORT_DIMENSIONS } from "../export/dimensions";
import { sourceLabel } from "../shared/source";
import type {
  AttributionRenderInput,
  PanelRenderInput,
  TemplateDef,
} from "./types";

/**
 * Magazine Cover — every panel is treated as a magazine issue cover.
 * Display serif headline takes most of the canvas, with a small
 * masthead at the top, an issue line in the corner, and a single
 * accent color drawn from a small palette so the carousel reads as
 * "a series" rather than disconnected slides.
 *
 * Anti-goal: looking like Canva's "magazine" templates. We do this by
 * leaning into typographic discipline (one headline, one accent, no
 * decorative chrome) and pushing image area to zero — pure type cover.
 */

const BG = "#0F1115";
const FG = "#FFFFFF";
const FG_SOFT = "#A8A8AC";
const ACCENT = "#FFB400";

const FONT_DISPLAY =
  "ui-serif, 'Tiempos Headline', 'Source Serif Display', Georgia, 'Times New Roman', serif";
const FONT_SANS =
  "ui-sans-serif, system-ui, -apple-system, 'Inter', 'Söhne', 'Helvetica Neue', Helvetica, Arial, sans-serif";

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
  mastSize: number;
  issueSize: number;
  hSize: number;
  standfirstSize: number;
  footerSize: number;
  gap: number;
}

function sizesFor(format: PanelRenderInput["format"]): Sizes {
  switch (format) {
    case "vertical":
      return {
        pad: 88,
        mastSize: 28,
        issueSize: 22,
        hSize: 160,
        standfirstSize: 32,
        footerSize: 20,
        gap: 40,
      };
    case "landscape":
      return {
        pad: 52,
        mastSize: 18,
        issueSize: 13,
        hSize: 80,
        standfirstSize: 20,
        footerSize: 13,
        gap: 20,
      };
    default: // square
      return {
        pad: 72,
        mastSize: 22,
        issueSize: 18,
        hSize: 120,
        standfirstSize: 26,
        footerSize: 16,
        gap: 30,
      };
  }
}

function headingScaleFor(len: number): number {
  if (len <= 18) return 1.0;
  if (len <= 28) return 0.82;
  if (len <= 40) return 0.68;
  if (len <= 60) return 0.55;
  return 0.45;
}

function baseCss(w: number, h: number, S: Sizes, headingScale = 1): string {
  return `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: ${BG}; color: ${FG}; font-family: ${FONT_DISPLAY}; }
  body { width: ${w}px; height: ${h}px; overflow: hidden; }
  .page {
    width: ${w}px;
    height: ${h}px;
    padding: ${S.pad}px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background:
      radial-gradient(circle at 80% -10%, rgba(255,180,0,0.10), transparent 50%),
      radial-gradient(circle at -10% 110%, rgba(255,255,255,0.04), transparent 60%),
      ${BG};
  }
  .masthead {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
  }
  .masthead .name {
    font-family: ${FONT_DISPLAY};
    font-size: ${S.mastSize}px;
    letter-spacing: -0.01em;
    color: ${FG};
    font-weight: 600;
  }
  .masthead .issue {
    font-family: ${FONT_SANS};
    font-size: ${S.issueSize}px;
    color: ${ACCENT};
    text-align: right;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    line-height: 1.4;
  }
  .masthead .issue .price { color: ${FG_SOFT}; }
  .rule {
    height: 2px;
    background: ${FG};
    margin: ${Math.round(S.gap * 0.5)}px 0 ${S.gap}px;
    opacity: 0.9;
  }
  .cover {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  .kicker {
    font-family: ${FONT_SANS};
    font-size: ${S.issueSize}px;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: ${ACCENT};
    margin-bottom: ${Math.round(S.gap * 0.5)}px;
  }
  .headline {
    font-family: ${FONT_DISPLAY};
    font-size: ${Math.round(S.hSize * headingScale)}px;
    line-height: 0.92;
    font-weight: 600;
    color: ${FG};
    letter-spacing: -0.025em;
    margin: 0 0 ${Math.round(S.gap * 0.6)}px;
    text-wrap: balance;
  }
  .standfirst {
    font-family: ${FONT_DISPLAY};
    font-size: ${S.standfirstSize}px;
    line-height: 1.35;
    color: ${FG_SOFT};
    font-style: italic;
    margin: 0;
    max-width: 88%;
  }
  .footer {
    margin-top: ${S.gap}px;
    padding-top: ${Math.round(S.gap * 0.5)}px;
    border-top: 1px solid rgba(255,255,255,0.18);
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 24px;
    font-family: ${FONT_SANS};
    font-size: ${S.footerSize}px;
    color: ${FG_SOFT};
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }
  .barcode {
    display: inline-flex;
    gap: 2px;
    align-items: end;
    transform: translateY(2px);
  }
  .barcode .bar {
    width: 2px;
    background: ${FG};
    display: inline-block;
  }
  `;
}

function decorativeBars(seed: string): string {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  let out = "";
  for (let i = 0; i < 18; i++) {
    n = (n * 1103515245 + 12345) >>> 0;
    const h = 10 + (n % 16);
    out += `<span class="bar" style="height:${h}px"></span>`;
  }
  return out;
}

async function renderPanel(input: PanelRenderInput): Promise<string> {
  const { explainer, panel, format, panelIndex, totalPanels } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const S = sizesFor(format);
  const headline = panel.heading?.trim() || explainer.title;
  const standfirst = panel.caption?.trim();
  const headingScale = headingScaleFor(headline.length);
  const issueNo = String(panelIndex).padStart(2, "0");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, headingScale)}</style>
</head>
<body>
  <main class="page">
    <header class="masthead">
      <div class="name">Readopp</div>
      <div class="issue">
        <div>Issue ${issueNo}</div>
        <div class="price">${String(panelIndex)}/${String(totalPanels)}</div>
      </div>
    </header>
    <div class="rule"></div>
    <section class="cover">
      <div class="kicker">${escapeHtml(sourceLabel(explainer.url))}</div>
      <h1 class="headline">${escapeHtml(headline)}</h1>
      ${standfirst ? `<p class="standfirst">${escapeHtml(standfirst)}</p>` : ""}
    </section>
    <div class="footer">
      <span>readopp.com</span>
      <span class="barcode">${decorativeBars(`${explainer.id}-${panelIndex}`)}</span>
      <span>${escapeHtml(sourceLabel(explainer.url))}</span>
    </div>
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
<style>${baseCss(dims.w, dims.h, S, 0.85)}
  .attr-url {
    font-family: ${FONT_SANS};
    font-size: ${Math.round(S.standfirstSize * 0.9)}px;
    color: ${ACCENT};
    margin-top: ${S.gap}px;
    letter-spacing: 0.1em;
    word-break: break-all;
  }
</style>
</head>
<body>
  <main class="page">
    <header class="masthead">
      <div class="name">Readopp</div>
      <div class="issue"><div>Source</div><div class="price">end</div></div>
    </header>
    <div class="rule"></div>
    <section class="cover">
      <div class="kicker">Continue reading</div>
      <h1 class="headline">${escapeHtml(explainer.title)}</h1>
      <p class="standfirst">${escapeHtml(sourceLabel(explainer.url))}</p>
      <p class="attr-url">${escapeHtml(explainer.url)}</p>
    </section>
    <div class="footer">
      <span>readopp.com</span>
      <span>source</span>
    </div>
  </main>
</body>
</html>`;
}

export const magazineCoverTemplate: TemplateDef = {
  id: "magazine-cover",
  name: "Magazine Cover",
  category: "Editorial",
  tagline: "Full-bleed display serif with a single accent — every panel a cover.",
  audience: "Indie writers, brand storytellers, founders with strong covers.",
  preview: {
    background: BG,
    foreground: FG,
    accent: ACCENT,
    sampleHeading: "ISSUE 04 — How we ship.",
    fontFamily: FONT_DISPLAY,
  },
  renderPanel,
  renderAttribution,
};
