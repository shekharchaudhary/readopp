import { EXPORT_DIMENSIONS } from "../export/dimensions";
import { sourceLabel } from "../shared/source";
import type {
  AttributionRenderInput,
  PanelRenderInput,
  TemplateDef,
} from "./types";

/**
 * Tabloid Splash — UK tabloid front-page energy. ALL-CAPS sans-serif,
 * EXCLUSIVE kicker, oversized leading sentence, color blocks behind
 * key phrases, italic kicker text, and a polaroid-style image insert
 * at a tilted angle. Self-aware loud — comments well because it's
 * emotionally legible at a glance.
 *
 * Anti-cringe protection: we keep the chrome restrained and the body
 * legible. The shouting is in the kicker + headline only; everything
 * else is quiet.
 */

const PAPER = "#FFFFFF";
const SCARLET = "#E03131";
const SUN = "#FFD500";
const INK = "#0A0A0A";
const INK_SOFT = "#3A3A3A";

const FONT_DISPLAY =
  "'Knockout', 'Champion Gothic', 'Anton', 'Bebas Neue', 'Inter', system-ui, sans-serif";
const FONT_SERIF =
  "ui-serif, Georgia, 'Times New Roman', serif";
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
  mastSize: number;
  kickerSize: number;
  hSize: number;
  body1Size: number;
  bodySize: number;
  footerSize: number;
  gap: number;
}

function sizesFor(format: PanelRenderInput["format"]): Sizes {
  switch (format) {
    case "vertical":
      return {
        pad: 64,
        mastSize: 28,
        kickerSize: 38,
        hSize: 200,
        body1Size: 38,
        bodySize: 28,
        footerSize: 22,
        gap: 28,
      };
    case "landscape":
      return {
        pad: 36,
        mastSize: 14,
        kickerSize: 20,
        hSize: 96,
        body1Size: 20,
        bodySize: 15,
        footerSize: 12,
        gap: 14,
      };
    default: // square
      return {
        pad: 52,
        mastSize: 22,
        kickerSize: 30,
        hSize: 160,
        body1Size: 30,
        bodySize: 22,
        footerSize: 18,
        gap: 22,
      };
  }
}

function headingScaleFor(len: number): number {
  if (len <= 14) return 1.1;
  if (len <= 22) return 0.9;
  if (len <= 36) return 0.68;
  if (len <= 56) return 0.5;
  return 0.4;
}

function leadSentence(input: PanelRenderInput): string {
  // Prefer the caption as the lead; fall back to a stat or first
  // timeline event so the splash always has something punchy.
  const cap = input.panel.caption?.trim();
  if (cap) return cap;
  const plan = input.panel.plan;
  if (plan?.stat?.value) return `${plan.stat.value} — ${plan.stat.label ?? ""}`.trim();
  if (plan?.timeline?.[0]) return `${plan.timeline[0].when}: ${plan.timeline[0].what}`;
  return input.explainer.summary || "";
}

function baseCss(w: number, h: number, S: Sizes, headingScale = 1): string {
  return `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: ${PAPER}; color: ${INK}; font-family: ${FONT_SANS}; }
  body { width: ${w}px; height: ${h}px; overflow: hidden; }
  .page {
    width: ${w}px;
    height: ${h}px;
    padding: ${S.pad}px;
    background: ${PAPER};
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .mast {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: ${Math.round(S.gap * 0.7)}px;
  }
  .mast .brand {
    font-family: ${FONT_DISPLAY};
    font-size: ${Math.round(S.mastSize * 2.2)}px;
    color: ${PAPER};
    background: ${INK};
    padding: 4px ${Math.round(S.mastSize * 0.6)}px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    line-height: 1;
  }
  .mast .price {
    font-family: ${FONT_SANS};
    font-size: ${S.mastSize}px;
    color: ${INK};
    letter-spacing: 0.16em;
    text-transform: uppercase;
    font-weight: 800;
  }
  .kicker {
    display: inline-block;
    background: ${SCARLET};
    color: ${PAPER};
    font-family: ${FONT_DISPLAY};
    font-size: ${S.kickerSize}px;
    padding: ${Math.round(S.kickerSize * 0.1)}px ${Math.round(S.kickerSize * 0.5)}px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    transform: rotate(-2deg);
    margin-bottom: ${Math.round(S.gap * 0.6)}px;
    box-shadow: 2px 4px 0 ${INK};
  }
  .headline {
    font-family: ${FONT_DISPLAY};
    font-size: ${Math.round(S.hSize * headingScale)}px;
    line-height: 0.95;
    color: ${INK};
    margin: 0 0 ${S.gap}px;
    letter-spacing: -0.02em;
    text-transform: uppercase;
    font-weight: 800;
    word-break: break-word;
  }
  .headline .hit {
    background: ${SUN};
    color: ${INK};
    padding: 0 ${Math.round(S.hSize * 0.04)}px;
    margin: 0 ${Math.round(S.hSize * 0.02)}px;
    display: inline-block;
    transform: skew(-4deg);
  }
  .lead {
    font-family: ${FONT_SERIF};
    font-size: ${S.body1Size}px;
    line-height: 1.3;
    color: ${INK};
    margin: 0 0 ${Math.round(S.gap * 0.7)}px;
    font-style: italic;
    border-left: 6px solid ${SCARLET};
    padding-left: ${Math.round(S.body1Size * 0.6)}px;
  }
  .lead strong { font-weight: 800; font-style: normal; background: ${SUN}; padding: 0 6px; }
  .stack {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: ${Math.round(S.gap * 0.6)}px;
    overflow: hidden;
  }
  .body {
    font-family: ${FONT_SERIF};
    font-size: ${S.bodySize}px;
    line-height: 1.45;
    color: ${INK_SOFT};
    margin: 0;
  }
  .footer {
    margin-top: auto;
    padding-top: ${Math.round(S.gap * 0.5)}px;
    border-top: 4px solid ${INK};
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    font-family: ${FONT_SANS};
    font-size: ${S.footerSize}px;
    color: ${INK};
    font-weight: 800;
    letter-spacing: 0.22em;
    text-transform: uppercase;
  }
  `;
}

async function renderPanel(input: PanelRenderInput): Promise<string> {
  const { explainer, panel, format, panelIndex, totalPanels } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const S = sizesFor(format);
  const heading = (panel.heading?.trim() || explainer.title).toUpperCase();
  const lead = leadSentence(input);
  const body = lead === panel.caption?.trim() ? "" : panel.caption?.trim() || "";
  const headingScale = headingScaleFor(heading.length);

  // Pick one short token from the heading to wrap in the yellow hit
  // block so each headline has at least one anchored emphasis point.
  const tokens = heading.split(/\s+/);
  let hitIdx = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].length >= 3 && tokens[i].length <= 9) {
      hitIdx = i;
      break;
    }
  }
  const renderedHeading = tokens
    .map((t, i) =>
      i === hitIdx
        ? `<span class="hit">${escapeHtml(t)}</span>`
        : escapeHtml(t)
    )
    .join(" ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, headingScale)}</style>
</head>
<body>
  <main class="page">
    <header class="mast">
      <span class="brand">The Readopp</span>
      <span class="price">${escapeHtml(sourceLabel(explainer.url).toUpperCase())} · ${String(panelIndex).padStart(2, "0")}/${String(totalPanels).padStart(2, "0")}</span>
    </header>
    <div><span class="kicker">${panelIndex === 1 ? "Exclusive" : "Inside"}</span></div>
    <h1 class="headline">${renderedHeading}</h1>
    <section class="stack">
      ${lead ? `<p class="lead">${escapeHtml(lead)}</p>` : ""}
      ${body ? `<p class="body">${escapeHtml(body)}</p>` : ""}
    </section>
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
  const title = explainer.title.toUpperCase();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, headingScaleFor(title.length))}
  .src-url {
    font-family: ${FONT_SANS};
    font-size: ${Math.round(S.bodySize * 1.1)}px;
    color: ${PAPER};
    background: ${INK};
    padding: ${Math.round(S.gap * 0.5)}px ${Math.round(S.gap * 0.7)}px;
    font-weight: 800;
    letter-spacing: 0.04em;
    word-break: break-all;
    margin-top: ${Math.round(S.gap * 0.5)}px;
  }
</style>
</head>
<body>
  <main class="page">
    <header class="mast">
      <span class="brand">The Readopp</span>
      <span class="price">SOURCE</span>
    </header>
    <div><span class="kicker">Read it all</span></div>
    <h1 class="headline">${escapeHtml(title)}</h1>
    <section class="stack">
      <p class="lead"><strong>Full story</strong> at the original publication. Open below for citations, methodology and the rest of the receipts.</p>
      <div class="src-url">→ ${escapeHtml(explainer.url)}</div>
    </section>
    <footer class="footer">
      <span>${escapeHtml(sourceLabel(explainer.url))}</span>
      <span>readopp.com</span>
    </footer>
  </main>
</body>
</html>`;
}

export const tabloidSplashTemplate: TemplateDef = {
  id: "tabloid-splash",
  name: "Tabloid Splash",
  category: "Bold",
  tagline: "UK tabloid front-page energy — screaming headlines and color blocks.",
  audience: "B2B humourists, marketing parodists, hot-take operators.",
  preview: {
    background: SCARLET,
    foreground: PAPER,
    accent: SUN,
    sampleHeading: "SHOCK! AGENT FORGETS CONTEXT.",
    fontFamily: FONT_DISPLAY,
  },
  renderPanel,
  renderAttribution,
};
