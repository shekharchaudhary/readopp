import { EXPORT_DIMENSIONS } from "../export/dimensions";
import { sourceLabel } from "../shared/source";
import type {
  AttributionRenderInput,
  PanelRenderInput,
  TemplateDef,
} from "./types";

/**
 * Highlighter Reader — looks like a marked-up PDF excerpt with a yellow
 * highlighter pass over the most important sentence and handwritten
 * margin notes alongside. This is Readopp's signature template because
 * "the source article IS the design" is something competing tools
 * can't easily ship.
 *
 * Visual moves:
 *  - Off-white paper, serif body
 *  - The panel heading sits inside a yellow highlight block
 *  - The caption renders as a margin note in a handwritten font
 *  - Faint paper grain via subtle radial gradients
 *  - Page-number annotation in the corner
 */

const PAPER = "#FFFCEB";
const PAPER_EDGE = "#F4EFD1";
const INK = "#1A1A1A";
const INK_SOFT = "#5C5347";
const HIGHLIGHT = "#FFE066";
const HIGHLIGHT_SOFT = "rgba(255, 224, 102, 0.55)";
const MARGIN_INK = "#C0392B";

const FONT_SERIF =
  "ui-serif, 'IBM Plex Serif', 'Source Serif Pro', Georgia, 'Times New Roman', serif";
const FONT_HAND =
  "'Caveat', 'Reenie Beanie', 'Comic Sans MS', cursive";
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
  hSize: number;
  bodySize: number;
  marginSize: number;
  gap: number;
  marginGap: number;
}

function sizesFor(format: PanelRenderInput["format"]): Sizes {
  switch (format) {
    case "vertical":
      return {
        pad: 88,
        topSize: 22,
        hSize: 76,
        bodySize: 32,
        marginSize: 40,
        gap: 36,
        marginGap: 24,
      };
    case "landscape":
      return {
        pad: 56,
        topSize: 14,
        hSize: 44,
        bodySize: 19,
        marginSize: 22,
        gap: 18,
        marginGap: 14,
      };
    default: // square
      return {
        pad: 72,
        topSize: 18,
        hSize: 60,
        bodySize: 26,
        marginSize: 30,
        gap: 26,
        marginGap: 20,
      };
  }
}

function headingScaleFor(headingLength: number): number {
  if (headingLength <= 30) return 1.0;
  if (headingLength <= 48) return 0.85;
  if (headingLength <= 66) return 0.72;
  return 0.62;
}

/** Pull supporting passages — first reach for stat/timeline/poles, then
 *  fall back to the comparison rows. Kept short so they read like
 *  highlight quotes, not bullets. */
function extractPassages(input: PanelRenderInput, max = 2): string[] {
  const plan = input.panel.plan;
  if (!plan) return [];
  const out: string[] = [];
  if (plan.stat?.value) {
    out.push(`${plan.stat.value} — ${plan.stat.label ?? ""}`.trim());
  }
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
      const cells = (row.cells || []).filter(Boolean).join(" / ");
      const line = [row.label, cells].filter(Boolean).join(": ");
      if (line) out.push(line);
      if (out.length >= max) break;
    }
  }
  return out.slice(0, max).map((s) => s.slice(0, 140));
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
    position: relative;
    background:
      radial-gradient(ellipse at 15% 0%, rgba(0,0,0,0.04), transparent 50%),
      radial-gradient(ellipse at 85% 100%, rgba(196,165,80,0.08), transparent 60%),
      ${PAPER};
  }
  /* Faint paper edge shadow so the panel reads as a real torn-out leaf */
  .page::after {
    content: "";
    position: absolute;
    inset: 0;
    border: 1px solid ${PAPER_EDGE};
    pointer-events: none;
  }
  .top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 24px;
    font-family: ${FONT_SANS};
    font-size: ${S.topSize}px;
    color: ${INK_SOFT};
    letter-spacing: 0.16em;
    text-transform: uppercase;
    margin-bottom: ${Math.round(S.gap * 0.8)}px;
  }
  .top .page-no { font-variant-numeric: tabular-nums; }
  .layout {
    display: grid;
    grid-template-columns: 1fr ${Math.round(w * 0.28)}px;
    gap: ${S.marginGap * 1.5}px;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .col-main { display: flex; flex-direction: column; gap: ${S.gap}px; min-width: 0; }
  .col-margin { position: relative; padding-top: ${Math.round(S.gap * 0.4)}px; min-width: 0; }
  .headline {
    font-size: ${Math.round(S.hSize * headingScale)}px;
    line-height: 1.08;
    font-weight: 600;
    color: ${INK};
    margin: 0;
    letter-spacing: -0.01em;
  }
  /* The signature move: the headline sits behind a yellow highlight
     block, with slightly offset color stops so the "marker stroke" feels
     hand-drawn rather than rectangular. */
  .highlight {
    background:
      linear-gradient(${HIGHLIGHT_SOFT}, ${HIGHLIGHT_SOFT})
      no-repeat 0 86%/100% 64%;
    padding: 0 4px;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  .passages { display: flex; flex-direction: column; gap: ${S.gap}px; }
  .passages p {
    font-size: ${S.bodySize}px;
    line-height: 1.5;
    color: ${INK};
    margin: 0;
    position: relative;
  }
  .passages p::before {
    content: "“";
    position: absolute;
    left: -${Math.round(S.bodySize * 1.1)}px;
    top: -${Math.round(S.bodySize * 0.2)}px;
    font-family: ${FONT_SERIF};
    font-size: ${Math.round(S.bodySize * 2.6)}px;
    color: ${INK_SOFT};
    line-height: 1;
  }
  .passage-highlight {
    background: ${HIGHLIGHT};
    padding: 1px 5px;
    border-radius: 1px;
  }
  /* Margin notes: handwritten, ink-red, slight rotation. */
  .margin-note {
    font-family: ${FONT_HAND};
    color: ${MARGIN_INK};
    font-size: ${S.marginSize}px;
    line-height: 1.2;
    transform: rotate(-1.5deg);
    margin-bottom: ${Math.round(S.marginSize * 0.8)}px;
  }
  .margin-arrow {
    color: ${MARGIN_INK};
    font-size: ${S.marginSize}px;
    line-height: 1;
    transform: rotate(8deg);
    margin-bottom: ${Math.round(S.marginSize * 0.4)}px;
    display: inline-block;
  }
  .footer {
    margin-top: ${Math.round(S.gap * 0.6)}px;
    padding-top: ${Math.round(S.gap * 0.4)}px;
    border-top: 1px dashed ${PAPER_EDGE};
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    font-family: ${FONT_SANS};
    font-size: ${S.topSize}px;
    color: ${INK_SOFT};
    letter-spacing: 0.06em;
  }
  `;
}

async function renderPanel(input: PanelRenderInput): Promise<string> {
  const { explainer, panel, format, panelIndex, totalPanels } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const S = sizesFor(format);
  const headline = panel.heading?.trim() || explainer.title;
  const passages = extractPassages(input, format === "vertical" ? 3 : 2);
  const marginNote = panel.caption?.trim();
  const headingScale = headingScaleFor(headline.length);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, headingScale)}</style>
</head>
<body>
  <main class="page">
    <div class="top">
      <span>${escapeHtml(sourceLabel(explainer.url))}</span>
      <span class="page-no">p. ${String(panelIndex).padStart(2, "0")} / ${String(
        totalPanels
      ).padStart(2, "0")}</span>
    </div>
    <div class="layout">
      <div class="col-main">
        <h1 class="headline"><span class="highlight">${escapeHtml(headline)}</span></h1>
        <div class="passages">
          ${passages
            .map((p, i) => {
              // Highlight the first passage so the eye lands there first;
              // the rest read as supporting quotes.
              const inner = i === 0
                ? `<span class="passage-highlight">${escapeHtml(p)}</span>`
                : escapeHtml(p);
              return `<p>${inner}</p>`;
            })
            .join("")}
          ${
            passages.length === 0 && explainer.summary
              ? `<p><span class="passage-highlight">${escapeHtml(
                  explainer.summary.slice(0, 220)
                )}</span></p>`
              : ""
          }
        </div>
      </div>
      <aside class="col-margin">
        <div class="margin-arrow">↤</div>
        ${
          marginNote
            ? `<div class="margin-note">${escapeHtml(marginNote)}</div>`
            : ""
        }
        <div class="margin-note">note ${panelIndex} of ${totalPanels}</div>
      </aside>
    </div>
    <div class="footer">
      <span>READOPP · margin reader</span>
      <span>${escapeHtml(explainer.title).slice(0, 50)}</span>
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
  .attr-center {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: ${S.gap}px;
  }
  .attr-label {
    font-family: ${FONT_HAND};
    color: ${MARGIN_INK};
    font-size: ${Math.round(S.marginSize * 1.1)}px;
    transform: rotate(-2deg);
    align-self: flex-start;
  }
  .attr-title {
    font-size: ${Math.round(S.hSize * 0.95)}px;
    line-height: 1.05;
    margin: 0;
    color: ${INK};
    letter-spacing: -0.01em;
  }
  .attr-title .highlight { padding: 0 8px; }
  .attr-source {
    font-size: ${S.bodySize}px;
    color: ${INK_SOFT};
    margin: 0;
  }
  .attr-url {
    font-family: ${FONT_SANS};
    font-size: ${Math.round(S.bodySize * 0.85)}px;
    color: ${INK};
    padding: ${Math.round(S.gap * 0.5)}px 0;
    border-top: 1px dashed ${PAPER_EDGE};
    border-bottom: 1px dashed ${PAPER_EDGE};
  }
</style>
</head>
<body>
  <main class="page">
    <div class="top">
      <span>READOPP</span>
      <span>source note</span>
    </div>
    <section class="attr-center">
      <div class="attr-label">read the original →</div>
      <h2 class="attr-title"><span class="highlight">${escapeHtml(
        explainer.title
      )}</span></h2>
      <p class="attr-source">${escapeHtml(source)}</p>
      <div class="attr-url">${escapeHtml(explainer.url)}</div>
    </section>
    <div class="footer">
      <span>READOPP · margin reader</span>
      <span>${escapeHtml(source)}</span>
    </div>
  </main>
</body>
</html>`;
}

export const highlighterReaderTemplate: TemplateDef = {
  id: "highlighter-reader",
  name: "Highlighter Reader",
  category: "Reader",
  tagline: "Marked-up PDF excerpt with margin notes and a yellow highlighter.",
  audience: "Knowledge workers, students, learn-in-public creators.",
  preview: {
    background: PAPER,
    foreground: INK,
    accent: HIGHLIGHT,
    sampleHeading: "Three ideas worth highlighting",
    fontFamily: FONT_SERIF,
  },
  renderPanel,
  renderAttribution,
};
