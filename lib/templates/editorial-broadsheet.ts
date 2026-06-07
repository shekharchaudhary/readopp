import { EXPORT_DIMENSIONS } from "../export/dimensions";
import { sourceLabel } from "../shared/source";
import type {
  AttributionRenderInput,
  PanelRenderInput,
  TemplateDef,
} from "./types";

/**
 * Editorial Broadsheet — FT Weekend / Stripe Press supplement
 * aesthetic. Serif headlines, hairline rules, small-caps overlines,
 * a single drop cap on the body paragraph, and tabular numerals in
 * the masthead. Reads like a magazine page that happened to be 1080
 * pixels wide.
 *
 * Uses panel.heading as the headline, panel.caption as the body, and
 * (when present) plan.timeline/comparison/metaphor as a secondary
 * column. Panel SVGs are intentionally not used — this template's
 * whole point is the type, not illustration.
 */

const PAPER = "#F6F2EA";
const INK = "#1A1A1A";
const INK_SOFT = "#5C5347";
const ACCENT = "#922B21";
const RULE = "#1A1A1A";

const FONT_SERIF =
  "ui-serif, 'Tiempos Text', 'Source Serif Pro', Georgia, Cambria, 'Times New Roman', Times, serif";
const FONT_DISPLAY_SERIF =
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
  masthead: number;
  hSize: number;
  subhSize: number;
  bodySize: number;
  smallSize: number;
  gap: number;
}

function sizesFor(format: PanelRenderInput["format"]): Sizes {
  switch (format) {
    case "vertical":
      return {
        pad: 88,
        masthead: 22,
        hSize: 96,
        subhSize: 34,
        bodySize: 34,
        smallSize: 20,
        gap: 36,
      };
    case "landscape":
      return {
        pad: 52,
        masthead: 14,
        hSize: 56,
        subhSize: 22,
        bodySize: 20,
        smallSize: 13,
        gap: 18,
      };
    default: // square
      return {
        pad: 72,
        masthead: 18,
        hSize: 76,
        subhSize: 28,
        bodySize: 26,
        smallSize: 16,
        gap: 28,
      };
  }
}

function headingScaleFor(headingLength: number): number {
  if (headingLength <= 30) return 1.0;
  if (headingLength <= 50) return 0.85;
  if (headingLength <= 70) return 0.72;
  return 0.62;
}

function extractDataPoints(input: PanelRenderInput, max = 3): string[] {
  const plan = input.panel.plan;
  if (!plan) return [];
  const out: string[] = [];
  if (plan.stat?.value) {
    out.push(`${plan.stat.value} — ${plan.stat.label ?? ""}`.trim());
  }
  if (plan.timeline?.length) {
    for (const t of plan.timeline) {
      out.push(`${t.when} · ${t.what}`);
      if (out.length >= max) break;
    }
  }
  if (out.length < max && plan.metaphor?.poles?.length) {
    for (const pole of plan.metaphor.poles) {
      const line = [pole.label, pole.sub].filter(Boolean).join(" — ");
      if (line) out.push(line);
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
  return out.slice(0, max).map((s) => s.slice(0, 120));
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
    background:
      radial-gradient(circle at 30% 0%, rgba(0,0,0,0.02), transparent 60%),
      ${PAPER};
  }
  .masthead {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 24px;
    font-family: ${FONT_SANS};
    font-size: ${S.masthead}px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: ${INK};
    padding-bottom: ${Math.round(S.gap * 0.4)}px;
    border-bottom: 2px solid ${RULE};
  }
  .masthead .left { font-weight: 700; }
  .masthead .right { color: ${INK_SOFT}; font-variant-numeric: tabular-nums; letter-spacing: 0.12em; }
  .hairline { height: 1px; background: ${RULE}; margin: 6px 0 ${S.gap}px; }
  .overline {
    font-family: ${FONT_SANS};
    font-size: ${S.smallSize}px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: ${ACCENT};
    margin-bottom: ${Math.round(S.gap * 0.4)}px;
  }
  .headline {
    font-family: ${FONT_DISPLAY_SERIF};
    font-size: ${Math.round(S.hSize * headingScale)}px;
    line-height: 1.02;
    letter-spacing: -0.015em;
    font-weight: 600;
    color: ${INK};
    margin: 0 0 ${S.gap}px;
  }
  .standfirst {
    font-family: ${FONT_SERIF};
    font-size: ${S.subhSize}px;
    line-height: 1.35;
    font-style: italic;
    color: ${INK_SOFT};
    margin: 0 0 ${S.gap}px;
    max-width: 90%;
  }
  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .body p {
    font-size: ${S.bodySize}px;
    line-height: 1.5;
    color: ${INK};
    margin: 0 0 ${Math.round(S.bodySize * 0.6)}px;
    text-align: justify;
    hyphens: auto;
  }
  .body p::first-letter {
    font-family: ${FONT_DISPLAY_SERIF};
    font-size: ${Math.round(S.bodySize * 3.8)}px;
    line-height: 0.82;
    float: left;
    padding: ${Math.round(S.bodySize * 0.15)}px ${Math.round(S.bodySize * 0.4)}px 0 0;
    color: ${INK};
    font-weight: 600;
  }
  .data {
    margin: ${S.gap}px 0 0;
    padding: ${Math.round(S.gap * 0.6)}px 0;
    border-top: 1px solid ${RULE};
    border-bottom: 1px solid ${RULE};
    font-family: ${FONT_SANS};
  }
  .data .label {
    font-size: ${S.smallSize}px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: ${ACCENT};
    margin-bottom: ${Math.round(S.smallSize * 0.4)}px;
  }
  .data ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: ${Math.round(S.smallSize * 0.4)}px;
  }
  .data li {
    font-size: ${Math.round(S.bodySize * 0.85)}px;
    line-height: 1.35;
    color: ${INK};
    font-variant-numeric: tabular-nums;
  }
  .footer {
    margin-top: auto;
    padding-top: ${Math.round(S.gap * 0.5)}px;
    border-top: 1px solid ${RULE};
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    font-family: ${FONT_SANS};
    font-size: ${S.smallSize}px;
    color: ${INK_SOFT};
    letter-spacing: 0.08em;
  }
  .footer .page-no { font-variant-numeric: tabular-nums; }
  `;
}

async function renderPanel(input: PanelRenderInput): Promise<string> {
  const { explainer, panel, format, panelIndex, totalPanels } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const S = sizesFor(format);
  const headline = panel.heading?.trim() || explainer.title;
  const standfirst = panel.caption?.trim();
  const data = extractDataPoints(input, format === "vertical" ? 4 : 3);
  const headingScale = headingScaleFor(headline.length);
  const sectionLabel = explainer.title.toUpperCase();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, headingScale)}</style>
</head>
<body>
  <main class="page">
    <header class="masthead">
      <span class="left">READOPP · WEEKEND</span>
      <span class="right">No. ${String(panelIndex).padStart(2, "0")} · ${escapeHtml(
        sourceLabel(explainer.url).toUpperCase()
      )}</span>
    </header>
    <div class="hairline"></div>
    <div class="overline">${escapeHtml(sectionLabel.slice(0, 56))}</div>
    <h1 class="headline">${escapeHtml(headline)}</h1>
    ${
      standfirst
        ? `<p class="standfirst">${escapeHtml(standfirst)}</p>`
        : ""
    }
    <section class="body">
      ${
        // Use the summary as the longer body when no standfirst is set,
        // and the standfirst+summary together when both exist. Adds the
        // characteristic broadsheet "drop cap on first paragraph" feel.
        standfirst
          ? ""
          : `<p>${escapeHtml(explainer.summary || "")}</p>`
      }
      ${
        data.length
          ? `<div class="data">
              <div class="label">Notes</div>
              <ul>${data.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>
            </div>`
          : ""
      }
    </section>
    <div class="footer">
      <span>${escapeHtml(sourceLabel(explainer.url))}</span>
      <span class="page-no">${String(panelIndex).padStart(2, "0")} / ${String(
        totalPanels
      ).padStart(2, "0")}</span>
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
  const source = sourceLabel(explainer.url);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S)}
  .attr {
    display: flex;
    flex-direction: column;
    justify-content: center;
    flex: 1;
    padding: ${S.gap}px 0;
  }
  .attr .read {
    font-family: ${FONT_SANS};
    font-size: ${S.smallSize}px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: ${ACCENT};
    margin-bottom: ${S.gap}px;
  }
  .attr h2 {
    font-family: ${FONT_DISPLAY_SERIF};
    font-size: ${Math.round(S.hSize * 0.85)}px;
    line-height: 1.05;
    margin: 0 0 ${S.gap}px;
    color: ${INK};
    letter-spacing: -0.015em;
  }
  .attr .src {
    font-family: ${FONT_SERIF};
    font-style: italic;
    font-size: ${S.subhSize}px;
    color: ${INK_SOFT};
    margin-bottom: ${S.gap}px;
  }
  .attr .url {
    font-family: ${FONT_SANS};
    font-size: ${S.bodySize}px;
    border-top: 1px solid ${RULE};
    border-bottom: 1px solid ${RULE};
    padding: ${Math.round(S.gap * 0.6)}px 0;
    color: ${INK};
  }
</style>
</head>
<body>
  <main class="page">
    <header class="masthead">
      <span class="left">READOPP · WEEKEND</span>
      <span class="right">SOURCE NOTE</span>
    </header>
    <div class="hairline"></div>
    <section class="attr">
      <div class="read">Continue reading</div>
      <h2>${escapeHtml(explainer.title)}</h2>
      <div class="src">${escapeHtml(source)}</div>
      <div class="url">${escapeHtml(explainer.url)}</div>
    </section>
    <div class="footer">
      <span>Generated by Readopp</span>
      <span>${escapeHtml(source)}</span>
    </div>
  </main>
</body>
</html>`;
}

export const editorialBroadsheetTemplate: TemplateDef = {
  id: "editorial-broadsheet",
  name: "Editorial Broadsheet",
  category: "Editorial",
  tagline: "FT Weekend grid with drop caps and hairline rules.",
  audience: "Analysts, VCs, longform writers, market commentators.",
  preview: {
    background: PAPER,
    foreground: INK,
    accent: ACCENT,
    sampleHeading: "The Last Honest Read of the Year",
    fontFamily: FONT_DISPLAY_SERIF,
  },
  renderPanel,
  renderAttribution,
};
