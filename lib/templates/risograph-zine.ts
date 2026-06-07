import { EXPORT_DIMENSIONS } from "../export/dimensions";
import { sourceLabel } from "../shared/source";
import type {
  AttributionRenderInput,
  PanelRenderInput,
  TemplateDef,
} from "./types";

/**
 * Risograph Zine — looks like a two-color Riso-printed zine page.
 * Constraint is the design: only two ink colors (fluorescent pink +
 * reflex blue by default), grain noise overlay, halftone shading,
 * deliberate slight misregistration (a thin offset between layers),
 * paper-texture background, monospace small text.
 *
 * No gradients, no shadows, no anti-aliased decoration — anything not
 * achievable on a real Riso machine is out.
 */

const PAPER = "#FFFCEB";
const PAPER_GRAIN = "rgba(0,0,0,0.04)";
const INK = "#1A1A1A";
const PINK = "#FF48B0";
const BLUE = "#0033A0";
const OVERPRINT = "#5B0F62"; // pink + blue multiply-ish overlap color

const FONT_MONO =
  "ui-monospace, 'GT America Mono', 'IBM Plex Mono', 'JetBrains Mono', SFMono-Regular, Menlo, monospace";
const FONT_DISPLAY =
  "ui-serif, 'Reckless', 'GT Sectra', 'Tiempos Headline', Georgia, serif";
const FONT_SANS =
  "ui-sans-serif, system-ui, -apple-system, 'Inter', sans-serif";

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
  bodySize: number;
  noteSize: number;
  ribbonSize: number;
  footerSize: number;
  gap: number;
}

function sizesFor(format: PanelRenderInput["format"]): Sizes {
  switch (format) {
    case "vertical":
      return {
        pad: 88,
        topSize: 22,
        hSize: 100,
        bodySize: 32,
        noteSize: 26,
        ribbonSize: 28,
        footerSize: 20,
        gap: 32,
      };
    case "landscape":
      return {
        pad: 48,
        topSize: 12,
        hSize: 48,
        bodySize: 18,
        noteSize: 14,
        ribbonSize: 14,
        footerSize: 11,
        gap: 16,
      };
    default: // square
      return {
        pad: 72,
        topSize: 18,
        hSize: 76,
        bodySize: 26,
        noteSize: 20,
        ribbonSize: 20,
        footerSize: 15,
        gap: 24,
      };
  }
}

function headingScaleFor(len: number): number {
  if (len <= 22) return 1.0;
  if (len <= 38) return 0.85;
  if (len <= 56) return 0.7;
  return 0.58;
}

function extractItems(input: PanelRenderInput, max = 4): string[] {
  const plan = input.panel.plan;
  if (!plan) return [];
  const out: string[] = [];
  if (plan.stat?.value) out.push(`${plan.stat.value} — ${plan.stat.label ?? ""}`.trim());
  if (plan.metaphor?.poles?.length) {
    for (const p of plan.metaphor.poles) {
      const line = [p.label, p.sub].filter(Boolean).join(" — ");
      if (line) out.push(line);
      if (out.length >= max) break;
    }
  }
  if (out.length < max && plan.timeline?.length) {
    for (const t of plan.timeline) {
      out.push(`${t.when}: ${t.what}`);
      if (out.length >= max) break;
    }
  }
  if (out.length < max && plan.comparison?.rows?.length) {
    for (const row of plan.comparison.rows) {
      const cells = (row.cells || []).filter(Boolean).join(" / ");
      const line = [row.label, cells].filter(Boolean).join(": ");
      if (line) out.push(line);
      if (out.length >= max) break;
    }
  }
  return out.slice(0, max).map((s) => s.slice(0, 90));
}

function baseCss(w: number, h: number, S: Sizes, headingScale = 1): string {
  return `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: ${PAPER}; color: ${INK}; font-family: ${FONT_MONO}; }
  body { width: ${w}px; height: ${h}px; overflow: hidden; }
  .page {
    width: ${w}px;
    height: ${h}px;
    padding: ${S.pad}px;
    overflow: hidden;
    position: relative;
    background:
      /* paper grain dots */
      radial-gradient(${PAPER_GRAIN} 1px, transparent 1.6px) 0 0 / 6px 6px,
      radial-gradient(${PAPER_GRAIN} 1px, transparent 1.6px) 3px 3px / 6px 6px,
      ${PAPER};
    display: flex;
    flex-direction: column;
  }
  /* The "misregistration" — a thin pink rectangle nudged 4px off the
     real frame, sitting under everything. The whole zine vibe in one move. */
  .page::before {
    content: "";
    position: absolute;
    top: ${Math.round(S.pad * 0.45)}px;
    left: ${Math.round(S.pad * 0.5)}px;
    right: ${Math.round(S.pad * 0.4)}px;
    bottom: ${Math.round(S.pad * 0.45)}px;
    border: 2px solid ${PINK};
    pointer-events: none;
    transform: translate(-4px, -4px);
    opacity: 0.85;
    mix-blend-mode: multiply;
  }
  .frame {
    width: 100%;
    height: 100%;
    border: 2px solid ${BLUE};
    padding: ${Math.round(S.gap * 1.1)}px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    background: transparent;
  }
  .top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    font-family: ${FONT_MONO};
    font-size: ${S.topSize}px;
    color: ${INK};
    letter-spacing: 0.18em;
    text-transform: uppercase;
    margin-bottom: ${S.gap}px;
  }
  .top .blue { color: ${BLUE}; }
  .top .pink { color: ${PINK}; }
  .ribbon {
    display: inline-block;
    font-family: ${FONT_MONO};
    font-size: ${S.ribbonSize}px;
    color: ${PAPER};
    background: ${BLUE};
    padding: 2px ${Math.round(S.ribbonSize * 0.5)}px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    margin-bottom: ${Math.round(S.gap * 0.6)}px;
  }
  .headline {
    font-family: ${FONT_DISPLAY};
    font-size: ${Math.round(S.hSize * headingScale)}px;
    line-height: 1.0;
    font-weight: 700;
    color: ${INK};
    margin: 0 0 ${S.gap}px;
    letter-spacing: -0.02em;
    text-wrap: balance;
    position: relative;
  }
  .headline .echo {
    position: absolute;
    top: 6px;
    left: 6px;
    color: ${PINK};
    z-index: -1;
    mix-blend-mode: multiply;
    opacity: 0.7;
  }
  .body-area {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 1fr ${Math.round(160 + S.gap * 4)}px;
    gap: ${S.gap}px;
    overflow: hidden;
  }
  .col-main { display: flex; flex-direction: column; gap: ${Math.round(S.gap * 0.7)}px; min-width: 0; overflow: hidden; }
  .col-side { display: flex; flex-direction: column; gap: ${Math.round(S.gap * 0.7)}px; min-width: 0; overflow: hidden; }
  .body {
    font-family: ${FONT_MONO};
    font-size: ${S.bodySize}px;
    line-height: 1.55;
    color: ${INK};
    margin: 0;
  }
  .items {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: ${Math.round(S.noteSize * 0.4)}px;
  }
  .items li {
    font-family: ${FONT_MONO};
    font-size: ${S.noteSize}px;
    line-height: 1.35;
    color: ${INK};
    padding-left: ${Math.round(S.noteSize * 1.4)}px;
    position: relative;
  }
  .items li::before {
    content: "■";
    position: absolute;
    left: 0;
    color: ${PINK};
  }
  /* The halftone "image area" — a dot grid that pretends to be a riso
     halftone illustration block. */
  .halftone {
    border: 1.5px solid ${BLUE};
    aspect-ratio: 1 / 1;
    background:
      radial-gradient(${PINK} 28%, transparent 30%) 0 0 / ${Math.round(S.bodySize * 0.6)}px ${Math.round(S.bodySize * 0.6)}px,
      radial-gradient(${BLUE} 22%, transparent 26%) ${Math.round(S.bodySize * 0.3)}px ${Math.round(S.bodySize * 0.3)}px / ${Math.round(S.bodySize * 0.6)}px ${Math.round(S.bodySize * 0.6)}px,
      ${PAPER};
    mix-blend-mode: multiply;
  }
  .halftone-label {
    font-family: ${FONT_MONO};
    font-size: ${Math.round(S.noteSize * 0.85)}px;
    color: ${OVERPRINT};
    letter-spacing: 0.18em;
    text-transform: uppercase;
    text-align: center;
    margin-top: -${Math.round(S.noteSize * 0.4)}px;
  }
  .footer {
    margin-top: ${Math.round(S.gap * 0.6)}px;
    padding-top: ${Math.round(S.gap * 0.5)}px;
    border-top: 1.5px dashed ${BLUE};
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    font-family: ${FONT_MONO};
    font-size: ${S.footerSize}px;
    color: ${INK};
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  `;
}

async function renderPanel(input: PanelRenderInput): Promise<string> {
  const { explainer, panel, format, panelIndex, totalPanels } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const S = sizesFor(format);
  const heading = panel.heading?.trim() || explainer.title;
  const body = panel.caption?.trim();
  const items = extractItems(input, format === "vertical" ? 5 : 4);
  const headingScale = headingScaleFor(heading.length);
  const idx = String(panelIndex).padStart(2, "0");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, headingScale)}</style>
</head>
<body>
  <main class="page">
    <div class="frame">
      <header class="top">
        <span><span class="blue">RP</span> · <span class="pink">ZINE</span></span>
        <span>${escapeHtml(sourceLabel(explainer.url).toUpperCase())} · ${idx}/${String(totalPanels).padStart(2, "0")}</span>
      </header>
      <div><span class="ribbon">Issue ${idx}</span></div>
      <h1 class="headline">${escapeHtml(heading)}<span class="echo" aria-hidden="true">${escapeHtml(heading)}</span></h1>
      <section class="body-area">
        <div class="col-main">
          ${body ? `<p class="body">${escapeHtml(body)}</p>` : ""}
          ${
            items.length
              ? `<ul class="items">${items.map((it) => `<li>${escapeHtml(it)}</li>`).join("")}</ul>`
              : ""
          }
        </div>
        <aside class="col-side">
          <div class="halftone"></div>
          <div class="halftone-label">fig. ${idx} · pink/blue</div>
        </aside>
      </section>
      <footer class="footer">
        <span>printed in two colors · readopp</span>
        <span>p. ${idx}</span>
      </footer>
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
  .src-url {
    font-family: ${FONT_MONO};
    font-size: ${Math.round(S.bodySize * 0.8)}px;
    color: ${BLUE};
    border-top: 1.5px dashed ${PINK};
    border-bottom: 1.5px dashed ${PINK};
    padding: ${Math.round(S.gap * 0.5)}px 0;
    word-break: break-all;
    margin: ${S.gap}px 0;
    letter-spacing: 0.04em;
  }
</style>
</head>
<body>
  <main class="page">
    <div class="frame">
      <header class="top">
        <span><span class="blue">RP</span> · <span class="pink">SRC</span></span>
        <span>END · COLOPHON</span>
      </header>
      <div><span class="ribbon">Source</span></div>
      <h1 class="headline">${escapeHtml(explainer.title)}<span class="echo" aria-hidden="true">${escapeHtml(explainer.title)}</span></h1>
      <section class="body-area">
        <div class="col-main">
          <p class="body">Printed offset to suggest the real piece. Read it in colour at the source.</p>
          <div class="src-url">${escapeHtml(explainer.url)}</div>
        </div>
        <aside class="col-side">
          <div class="halftone"></div>
          <div class="halftone-label">fig. END · risograph</div>
        </aside>
      </section>
      <footer class="footer">
        <span>${escapeHtml(sourceLabel(explainer.url))}</span>
        <span>readopp</span>
      </footer>
    </div>
  </main>
</body>
</html>`;
}

export const risographZineTemplate: TemplateDef = {
  id: "risograph-zine",
  name: "Risograph Zine",
  category: "Bold",
  tagline: "Two-color riso print with deliberate misregistration and grain.",
  audience: "Designers, brand strategists, indie founders, zine creators.",
  preview: {
    background: PAPER,
    foreground: INK,
    accent: PINK,
    sampleHeading: "small studies in design taste",
    fontFamily: FONT_DISPLAY,
  },
  renderPanel,
  renderAttribution,
};
