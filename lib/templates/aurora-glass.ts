import { EXPORT_DIMENSIONS } from "../export/dimensions";
import { sourceLabel } from "../shared/source";
import type {
  AttributionRenderInput,
  PanelRenderInput,
  TemplateDef,
} from "./types";

/**
 * Aurora Glass — dark-mode deck with drifting aurora gradients behind a
 * frosted near-white glass card that carries the panel visual. The look
 * every modern SaaS launch deck is chasing: deep navy-black field,
 * blurred color blooms, hairline glass borders, gradient display type.
 *
 * The panel's generated SVG/HTML renders INSIDE the glass card, so the
 * carousel keeps its diagrams while the chrome goes cinematic.
 */

interface Aurora {
  /** Two bloom colors for the background gradients. */
  a: string;
  b: string;
  /** Gradient pair for the heading text. */
  hFrom: string;
  hTo: string;
}

const AURORAS: Aurora[] = [
  { a: "#4F46E5", b: "#06B6D4", hFrom: "#A5B4FC", hTo: "#67E8F9" }, // indigo x cyan
  { a: "#7C3AED", b: "#EC4899", hFrom: "#C4B5FD", hTo: "#F9A8D4" }, // violet x pink
  { a: "#0EA5E9", b: "#10B981", hFrom: "#7DD3FC", hTo: "#6EE7B7" }, // sky x emerald
  { a: "#F59E0B", b: "#EF4444", hFrom: "#FCD34D", hTo: "#FCA5A5" }, // amber x red
];

const BG = "#07090F";
const FONT_SANS =
  "'Inter', 'Söhne', ui-sans-serif, system-ui, -apple-system, Helvetica, Arial, sans-serif";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function auroraFor(seed: string, panelIndex: number): Aurora {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  return AURORAS[(n + panelIndex) % AURORAS.length];
}

interface Sizes {
  pad: number;
  topSize: number;
  hSize: number;
  bodySize: number;
  footerSize: number;
  gap: number;
  cardPad: number;
  visualMax: number;
  radius: number;
}

function sizesFor(format: PanelRenderInput["format"]): Sizes {
  switch (format) {
    case "vertical":
      return {
        pad: 72,
        topSize: 24,
        hSize: 88,
        bodySize: 34,
        footerSize: 22,
        gap: 40,
        cardPad: 56,
        visualMax: 860,
        radius: 40,
      };
    case "landscape":
      return {
        pad: 40,
        topSize: 13,
        hSize: 48,
        bodySize: 19,
        footerSize: 12,
        gap: 20,
        cardPad: 28,
        visualMax: 280,
        radius: 24,
      };
    default: // square
      return {
        pad: 64,
        topSize: 18,
        hSize: 68,
        bodySize: 27,
        footerSize: 16,
        gap: 32,
        cardPad: 44,
        visualMax: 520,
        radius: 32,
      };
  }
}

function headingScaleFor(len: number): number {
  if (len <= 28) return 1;
  if (len <= 48) return 0.84;
  if (len <= 72) return 0.7;
  return 0.58;
}

function baseCss(w: number, h: number, S: Sizes, A: Aurora, hScale = 1): string {
  return `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: ${BG}; color: #F8FAFC; font-family: ${FONT_SANS}; }
  body { width: ${w}px; height: ${h}px; overflow: hidden; }
  .page {
    position: relative;
    width: ${w}px;
    height: ${h}px;
    padding: ${S.pad}px;
    background: ${BG};
    display: flex;
    flex-direction: column;
    overflow: hidden;
    isolation: isolate;
  }
  /* Aurora blooms */
  .page::before {
    content: "";
    position: absolute;
    inset: -20%;
    z-index: -1;
    background:
      radial-gradient(38% 32% at 16% 8%, ${A.a}55, transparent 70%),
      radial-gradient(42% 36% at 88% 28%, ${A.b}44, transparent 70%),
      radial-gradient(50% 42% at 60% 104%, ${A.a}33, transparent 72%);
    filter: blur(${Math.round(S.pad * 0.9)}px);
  }
  /* Hairline grid whisper */
  .page::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    background-image:
      linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
    background-size: ${Math.round(S.pad * 1.4)}px ${Math.round(S.pad * 1.4)}px;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: ${S.topSize}px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    font-weight: 600;
    color: rgba(248,250,252,0.55);
  }
  .top .pill {
    border: 1px solid rgba(255,255,255,0.16);
    background: rgba(255,255,255,0.06);
    border-radius: 999px;
    padding: ${Math.round(S.topSize * 0.5)}px ${Math.round(S.topSize * 0.9)}px;
    color: rgba(248,250,252,0.8);
  }
  .headline {
    margin: ${S.gap}px 0 0;
    font-size: ${Math.round(S.hSize * hScale)}px;
    line-height: 1.04;
    font-weight: 700;
    letter-spacing: -0.03em;
    background: linear-gradient(92deg, #F8FAFC 0%, ${A.hFrom} 55%, ${A.hTo} 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .card {
    flex: 1;
    min-height: 0;
    margin-top: ${S.gap}px;
    border-radius: ${S.radius}px;
    border: 1px solid rgba(255,255,255,0.14);
    background: rgba(250,251,253,0.94);
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.05) inset,
      0 ${Math.round(S.gap * 0.8)}px ${Math.round(S.gap * 2)}px rgba(0,0,0,0.45);
    padding: ${S.cardPad}px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .card svg { width: 100%; height: auto; max-height: ${S.visualMax}px; }
  .card .html-panel { width: 100%; color: #1a1a1a; font-size: ${S.bodySize * 0.78}px; }
  .body {
    margin: ${S.gap}px 0 0;
    font-size: ${S.bodySize}px;
    line-height: 1.5;
    color: rgba(248,250,252,0.82);
    font-weight: 400;
    max-width: 94%;
  }
  .footer {
    margin-top: ${S.gap}px;
    padding-top: ${Math.round(S.gap * 0.5)}px;
    border-top: 1px solid rgba(255,255,255,0.12);
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    font-size: ${S.footerSize}px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(248,250,252,0.45);
    font-weight: 500;
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
  const A = auroraFor(explainer.id, panelIndex);
  const heading = panel.heading?.trim() || explainer.title;
  const body = panel.caption?.trim();
  const idx = String(panelIndex).padStart(2, "0");
  const visual = visualBlock(panel);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, A, headingScaleFor(heading.length))}</style>
</head>
<body>
  <main class="page">
    <header class="top">
      <span>Readopp</span>
      <span class="pill">${idx} / ${String(totalPanels).padStart(2, "0")}</span>
    </header>
    <h1 class="headline">${escapeHtml(heading)}</h1>
    ${visual ? `<section class="card">${visual}</section>` : ""}
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
  const A = AURORAS[0];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, A, 0.9)}
  .src-card {
    margin-top: ${S.gap}px;
    border-radius: ${S.radius}px;
    border: 1px solid rgba(255,255,255,0.16);
    background: rgba(255,255,255,0.06);
    padding: ${S.cardPad}px;
  }
  .src-label {
    font-size: ${S.footerSize}px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: rgba(248,250,252,0.5);
    margin: 0 0 ${Math.round(S.gap * 0.4)}px;
  }
  .src-url {
    font-size: ${S.bodySize}px;
    color: ${A.hTo};
    word-break: break-all;
    font-weight: 500;
    margin: 0;
  }
</style>
</head>
<body>
  <main class="page">
    <header class="top">
      <span>Readopp</span>
      <span class="pill">Source</span>
    </header>
    <h1 class="headline">Worth the full read.</h1>
    <p class="body">${escapeHtml(explainer.title)}</p>
    <div class="src-card">
      <p class="src-label">Read the original</p>
      <p class="src-url">${escapeHtml(explainer.url)}</p>
    </div>
    <footer class="footer">
      <span>${escapeHtml(sourceLabel(explainer.url))}</span>
      <span>readopp.com</span>
    </footer>
  </main>
</body>
</html>`;
}

export const auroraGlassTemplate: TemplateDef = {
  id: "aurora-glass",
  name: "Aurora Glass",
  category: "Modern",
  tagline: "Dark-mode glass card under drifting aurora gradients.",
  audience: "SaaS founders, product marketers, AI builders shipping launches.",
  preview: {
    background: BG,
    foreground: "#F8FAFC",
    accent: "#67E8F9",
    sampleHeading: "Ship the launch deck.",
    fontFamily: FONT_SANS,
  },
  renderPanel,
  renderAttribution,
};
