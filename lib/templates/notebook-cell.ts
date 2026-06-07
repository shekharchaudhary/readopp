import { EXPORT_DIMENSIONS } from "../export/dimensions";
import { sourceLabel } from "../shared/source";
import type {
  AttributionRenderInput,
  PanelRenderInput,
  TemplateDef,
} from "./types";

/**
 * Notebook Cell — Jupyter / Observable / Marimo aesthetic. The panel
 * heading becomes the cell's "input" line (`In [04]: title`), the body
 * paragraph plus any extracted data points become the output block
 * (`Out[04]:`).
 *
 * Sells the format mimicry by including idle clutter from real
 * notebooks: kernel status pill, cell number gutter, sidecar play
 * button shape. None of it is functional — it's the visual grammar.
 */

const PAPER = "#FAFAFA";
const SURFACE = "#FFFFFF";
const INK = "#1A1A1A";
const INK_SOFT = "#5A5A5A";
const INK_FAINT = "#9A9A9A";
const ACCENT = "#0066CC";
const ACCENT_RED = "#C0392B";
const GUTTER = "#F0F0F0";
const RULE = "#E0E0E5";

const FONT_MONO =
  "ui-monospace, 'IBM Plex Mono', 'JetBrains Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace";
const FONT_SANS =
  "ui-sans-serif, system-ui, -apple-system, 'Inter', Helvetica, Arial, sans-serif";

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
  cellNoSize: number;
  inputSize: number;
  outputSize: number;
  bodySize: number;
  footerSize: number;
  gap: number;
}

function sizesFor(format: PanelRenderInput["format"]): Sizes {
  switch (format) {
    case "vertical":
      return {
        pad: 80,
        topSize: 22,
        cellNoSize: 26,
        inputSize: 56,
        outputSize: 30,
        bodySize: 30,
        footerSize: 20,
        gap: 28,
      };
    case "landscape":
      return {
        pad: 48,
        topSize: 13,
        cellNoSize: 16,
        inputSize: 30,
        outputSize: 18,
        bodySize: 18,
        footerSize: 12,
        gap: 14,
      };
    default: // square
      return {
        pad: 64,
        topSize: 18,
        cellNoSize: 22,
        inputSize: 44,
        outputSize: 24,
        bodySize: 24,
        footerSize: 16,
        gap: 22,
      };
  }
}

function headingScaleFor(len: number): number {
  if (len <= 28) return 1.0;
  if (len <= 44) return 0.85;
  if (len <= 64) return 0.7;
  return 0.6;
}

function extractOutputLines(input: PanelRenderInput, max = 5): string[] {
  const plan = input.panel.plan;
  if (!plan) return [];
  const out: string[] = [];
  if (plan.stat?.value) out.push(`${plan.stat.label ?? "metric"} = ${plan.stat.value}`);
  if (plan.timeline?.length) {
    for (const t of plan.timeline) {
      out.push(`${t.when}: ${t.what}`);
      if (out.length >= max) break;
    }
  }
  if (out.length < max && plan.metaphor?.poles?.length) {
    for (const p of plan.metaphor.poles) {
      const line = [p.label, p.sub].filter(Boolean).join(" — ");
      if (line) out.push(line);
      if (out.length >= max) break;
    }
  }
  if (out.length < max && plan.comparison?.rows?.length) {
    for (const row of plan.comparison.rows) {
      const cells = (row.cells || []).filter(Boolean).join(" | ");
      const line = [row.label, cells].filter(Boolean).join(": ");
      if (line) out.push(line);
      if (out.length >= max) break;
    }
  }
  return out.slice(0, max).map((s) => s.slice(0, 100));
}

function kernelName(seed: string): string {
  const kernels = ["readopp-py3", "readopp-r4.3", "ml-3.11", "data-3.12"];
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  return kernels[n % kernels.length];
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
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: ${PAPER};
  }
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    font-family: ${FONT_SANS};
    font-size: ${S.topSize}px;
    color: ${INK_SOFT};
    margin-bottom: ${Math.round(S.gap * 0.8)}px;
  }
  .topbar .kernel {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: ${FONT_MONO};
    color: ${INK};
  }
  .topbar .kernel .dot {
    width: 8px; height: 8px; border-radius: 999px; background: ${ACCENT};
    box-shadow: 0 0 0 3px rgba(0,102,204,0.15);
  }
  .cell {
    background: ${SURFACE};
    border: 1px solid ${RULE};
    border-radius: 8px;
    display: grid;
    grid-template-columns: ${Math.round(S.cellNoSize * 4.5)}px 1fr;
    overflow: hidden;
  }
  .gutter {
    background: ${GUTTER};
    padding: ${Math.round(S.cellNoSize * 0.8)}px ${Math.round(S.cellNoSize * 0.6)}px;
    border-right: 1px solid ${RULE};
    color: ${ACCENT};
    font-family: ${FONT_MONO};
    font-size: ${S.cellNoSize}px;
    text-align: right;
  }
  .gutter .play {
    display: inline-block;
    width: 0; height: 0;
    border-left: ${Math.round(S.cellNoSize * 0.55)}px solid ${ACCENT};
    border-top: ${Math.round(S.cellNoSize * 0.4)}px solid transparent;
    border-bottom: ${Math.round(S.cellNoSize * 0.4)}px solid transparent;
    margin-bottom: ${Math.round(S.cellNoSize * 0.5)}px;
  }
  .gutter .label { color: ${INK_FAINT}; font-size: ${Math.round(S.cellNoSize * 0.75)}px; letter-spacing: 0.08em; }
  .gutter .num { color: ${ACCENT}; font-weight: 700; font-variant-numeric: tabular-nums; }
  .cell-body {
    padding: ${Math.round(S.gap * 0.8)}px ${S.gap}px;
    display: flex;
    flex-direction: column;
    gap: ${Math.round(S.gap * 0.8)}px;
    overflow: hidden;
    min-width: 0;
  }
  .input-line {
    font-family: ${FONT_MONO};
    font-size: ${Math.round(S.inputSize * headingScale)}px;
    line-height: 1.1;
    color: ${INK};
    letter-spacing: -0.005em;
    margin: 0;
    word-break: break-word;
  }
  .input-line .prompt { color: ${ACCENT}; }
  .input-line .arrow { color: ${INK_FAINT}; margin: 0 ${Math.round(S.inputSize * 0.18)}px; }
  .divider {
    height: 1px;
    background: ${RULE};
    margin: 0;
  }
  .out-tag {
    font-family: ${FONT_MONO};
    font-size: ${Math.round(S.outputSize * 0.85)}px;
    color: ${ACCENT_RED};
  }
  .out-block {
    font-family: ${FONT_MONO};
    font-size: ${S.outputSize}px;
    line-height: 1.55;
    color: ${INK};
    margin: 0;
    white-space: pre-wrap;
  }
  .out-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: ${Math.round(S.outputSize * 0.35)}px;
  }
  .out-list li {
    font-family: ${FONT_MONO};
    font-size: ${S.outputSize}px;
    color: ${INK};
    line-height: 1.4;
  }
  .out-list li .arrow { color: ${ACCENT}; margin-right: ${Math.round(S.outputSize * 0.4)}px; }
  .body-area {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: ${S.gap}px;
    overflow: hidden;
  }
  .footer {
    margin-top: auto;
    padding-top: ${Math.round(S.gap * 0.5)}px;
    display: flex;
    justify-content: space-between;
    font-family: ${FONT_MONO};
    font-size: ${S.footerSize}px;
    color: ${INK_FAINT};
    letter-spacing: 0.04em;
  }
  `;
}

async function renderPanel(input: PanelRenderInput): Promise<string> {
  const { explainer, panel, format, panelIndex, totalPanels } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const S = sizesFor(format);
  const headline = panel.heading?.trim() || explainer.title;
  const body = panel.caption?.trim();
  const items = extractOutputLines(input, format === "vertical" ? 6 : 4);
  const headingScale = headingScaleFor(headline.length);
  const kernel = kernelName(explainer.id);
  const idx = String(panelIndex).padStart(2, "0");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, headingScale)}</style>
</head>
<body>
  <main class="page">
    <div class="topbar">
      <span class="kernel"><span class="dot"></span>${kernel}</span>
      <span>${escapeHtml(sourceLabel(explainer.url))} · cell ${idx}/${String(totalPanels).padStart(2, "0")}</span>
    </div>
    <section class="body-area">
      <div class="cell">
        <div class="gutter">
          <div class="play"></div>
          <div class="label">In [</div>
          <div class="num">${idx}</div>
          <div class="label">]</div>
        </div>
        <div class="cell-body">
          <h1 class="input-line"><span class="prompt">In[${idx}]:</span> ${escapeHtml(headline)}</h1>
          <div class="divider"></div>
          <div class="out-tag">Out[${idx}]:</div>
          ${
            items.length
              ? `<ul class="out-list">${items
                  .map((it) => `<li><span class="arrow">→</span>${escapeHtml(it)}</li>`)
                  .join("")}</ul>`
              : ""
          }
          ${body ? `<p class="out-block">${escapeHtml(body)}</p>` : ""}
        </div>
      </div>
    </section>
    <div class="footer">
      <span>readopp / notebook</span>
      <span>${idx} / ${String(totalPanels).padStart(2, "0")}</span>
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
  const kernel = kernelName(explainer.id);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, 0.9)}
  .src-url {
    font-family: ${FONT_MONO};
    font-size: ${S.outputSize}px;
    color: ${ACCENT};
    background: ${GUTTER};
    border: 1px solid ${RULE};
    padding: ${Math.round(S.gap * 0.5)}px;
    border-radius: 4px;
    word-break: break-all;
  }
</style>
</head>
<body>
  <main class="page">
    <div class="topbar">
      <span class="kernel"><span class="dot"></span>${kernel}</span>
      <span>${escapeHtml(sourceLabel(explainer.url))}</span>
    </div>
    <section class="body-area">
      <div class="cell">
        <div class="gutter">
          <div class="label">In [</div>
          <div class="num">SRC</div>
          <div class="label">]</div>
        </div>
        <div class="cell-body">
          <h1 class="input-line"><span class="prompt">In[SRC]:</span> ${escapeHtml(explainer.title)}</h1>
          <div class="divider"></div>
          <div class="out-tag">Out[SRC]:</div>
          <p class="out-block">Source publication. Open to read the original.</p>
          <div class="src-url">${escapeHtml(explainer.url)}</div>
        </div>
      </div>
    </section>
    <div class="footer">
      <span>readopp / notebook</span>
      <span>SOURCE</span>
    </div>
  </main>
</body>
</html>`;
}

export const notebookCellTemplate: TemplateDef = {
  id: "notebook-cell",
  name: "Notebook Cell",
  category: "Technical",
  tagline: "Jupyter cell with input/output frame and kernel pill.",
  audience: "Data scientists, ML researchers, applied AI writers.",
  preview: {
    background: PAPER,
    foreground: INK,
    accent: ACCENT,
    sampleHeading: "In [04]: training_loop.run()",
    fontFamily: FONT_MONO,
  },
  renderPanel,
  renderAttribution,
};
