import { EXPORT_DIMENSIONS } from "../export/dimensions";
import { sourceLabel } from "../shared/source";
import type {
  AttributionRenderInput,
  PanelRenderInput,
  TemplateDef,
} from "./types";

/**
 * Engineering Spec — looks like an internal RFC or design doc page.
 * Numbered section headers, "Status / Authors / Date" header block,
 * monospace body with hanging indents, and an inline code-block region
 * for any data points we extract.
 *
 * The vibe is "this was pasted out of Notion / Linear / Google Docs"
 * — readers should believe a real engineer wrote it.
 */

const PAPER = "#FAFAFA";
const SURFACE = "#FFFFFF";
const INK = "#0A0A0A";
const INK_SOFT = "#4A4A4A";
const INK_FAINT = "#8E8E92";
const ACCENT = "#2962FF";
const RULE = "#E5E5EA";
const CODE_BG = "#F4F4F6";

const FONT_MONO =
  "ui-monospace, 'JetBrains Mono', 'Berkeley Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace";
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
  metaSize: number;
  hSize: number;
  bodySize: number;
  codeSize: number;
  footerSize: number;
  gap: number;
}

function sizesFor(format: PanelRenderInput["format"]): Sizes {
  switch (format) {
    case "vertical":
      return {
        pad: 88,
        metaSize: 22,
        hSize: 68,
        bodySize: 30,
        codeSize: 24,
        footerSize: 20,
        gap: 32,
      };
    case "landscape":
      return {
        pad: 52,
        metaSize: 14,
        hSize: 36,
        bodySize: 18,
        codeSize: 15,
        footerSize: 13,
        gap: 16,
      };
    default: // square
      return {
        pad: 72,
        metaSize: 18,
        hSize: 52,
        bodySize: 24,
        codeSize: 19,
        footerSize: 16,
        gap: 24,
      };
  }
}

function headingScaleFor(len: number): number {
  if (len <= 28) return 1.0;
  if (len <= 42) return 0.88;
  if (len <= 60) return 0.76;
  return 0.65;
}

function extractDataLines(input: PanelRenderInput, max = 4): string[] {
  const plan = input.panel.plan;
  if (!plan) return [];
  const out: string[] = [];
  if (plan.stat?.value) {
    out.push(`${plan.stat.label ?? "metric"}: ${plan.stat.value}`);
  }
  if (plan.timeline?.length) {
    for (const t of plan.timeline) {
      out.push(`${t.when}  // ${t.what}`);
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
  if (out.length < max && plan.metaphor?.poles?.length) {
    for (const p of plan.metaphor.poles) {
      const line = [p.label, p.sub].filter(Boolean).join(" — ");
      if (line) out.push(line);
      if (out.length >= max) break;
    }
  }
  return out.slice(0, max).map((s) => s.slice(0, 90));
}

function rfcNumber(seed: string): string {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  return String(n % 999).padStart(3, "0");
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
  .meta-grid {
    display: grid;
    grid-template-columns: ${Math.round(S.metaSize * 4)}px 1fr;
    row-gap: ${Math.round(S.metaSize * 0.4)}px;
    column-gap: ${Math.round(S.metaSize * 0.8)}px;
    font-family: ${FONT_MONO};
    font-size: ${S.metaSize}px;
    line-height: 1.4;
    color: ${INK_SOFT};
    margin-bottom: ${S.gap}px;
  }
  .meta-grid .k { color: ${INK_FAINT}; text-transform: uppercase; letter-spacing: 0.12em; }
  .meta-grid .v { color: ${INK}; }
  .meta-grid .v .pill {
    display: inline-block;
    padding: 2px 8px;
    border: 1px solid ${ACCENT};
    color: ${ACCENT};
    border-radius: 2px;
    font-size: ${Math.round(S.metaSize * 0.85)}px;
    letter-spacing: 0.06em;
  }
  .section-no {
    font-family: ${FONT_MONO};
    font-size: ${S.metaSize}px;
    color: ${ACCENT};
    letter-spacing: 0.08em;
    margin-bottom: ${Math.round(S.gap * 0.4)}px;
  }
  .headline {
    font-family: ${FONT_SANS};
    font-size: ${Math.round(S.hSize * headingScale)}px;
    line-height: 1.1;
    font-weight: 600;
    color: ${INK};
    margin: 0 0 ${S.gap}px;
    letter-spacing: -0.015em;
    text-wrap: balance;
  }
  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: ${S.gap}px;
    overflow: hidden;
  }
  .prose {
    font-family: ${FONT_SANS};
    font-size: ${S.bodySize}px;
    line-height: 1.55;
    color: ${INK};
    margin: 0;
  }
  .code {
    background: ${CODE_BG};
    border: 1px solid ${RULE};
    border-radius: 6px;
    padding: ${Math.round(S.codeSize * 0.8)}px ${Math.round(S.codeSize * 1.1)}px;
    font-family: ${FONT_MONO};
    font-size: ${S.codeSize}px;
    line-height: 1.55;
    color: ${INK};
  }
  .code .line { display: block; }
  .code .line .num {
    color: ${INK_FAINT};
    margin-right: ${Math.round(S.codeSize * 0.8)}px;
    user-select: none;
    font-variant-numeric: tabular-nums;
  }
  .code .line .k { color: ${ACCENT}; }
  .footer {
    margin-top: ${Math.round(S.gap * 0.6)}px;
    padding-top: ${Math.round(S.gap * 0.5)}px;
    border-top: 1px solid ${RULE};
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    font-family: ${FONT_MONO};
    font-size: ${S.footerSize}px;
    color: ${INK_FAINT};
    letter-spacing: 0.06em;
  }
  .footer .doc { color: ${INK_SOFT}; }
  `;
}

function isoToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

async function renderPanel(input: PanelRenderInput): Promise<string> {
  const { explainer, panel, format, panelIndex, totalPanels } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const S = sizesFor(format);
  const headline = panel.heading?.trim() || explainer.title;
  const body = panel.caption?.trim();
  const data = extractDataLines(input, format === "vertical" ? 5 : 4);
  const headingScale = headingScaleFor(headline.length);
  const rfc = rfcNumber(explainer.id);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, headingScale)}</style>
</head>
<body>
  <main class="page">
    <div class="meta-grid">
      <div class="k">Doc</div><div class="v">RFC-${rfc}-${String(panelIndex).padStart(2, "0")}</div>
      <div class="k">Status</div><div class="v"><span class="pill">DRAFT</span></div>
      <div class="k">Date</div><div class="v">${isoToday()}</div>
      <div class="k">Authors</div><div class="v">@readopp · 1</div>
    </div>
    <div class="section-no">§ ${String(panelIndex).padStart(2, "0")}.0 — section</div>
    <h1 class="headline">${escapeHtml(headline)}</h1>
    <section class="body">
      ${body ? `<p class="prose">${escapeHtml(body)}</p>` : ""}
      ${
        data.length
          ? `<div class="code">${data
              .map(
                (d, i) =>
                  `<span class="line"><span class="num">${String(i + 1).padStart(2, " ")}</span>${escapeHtml(d)}</span>`
              )
              .join("")}</div>`
          : ""
      }
    </section>
    <footer class="footer">
      <span class="doc">${escapeHtml(sourceLabel(explainer.url))}</span>
      <span>p. ${String(panelIndex).padStart(2, "0")} / ${String(totalPanels).padStart(2, "0")}</span>
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
  const rfc = rfcNumber(explainer.id);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, 0.9)}
  .src-url {
    font-family: ${FONT_MONO};
    font-size: ${S.bodySize}px;
    color: ${ACCENT};
    border: 1px solid ${ACCENT};
    border-radius: 6px;
    padding: ${Math.round(S.gap * 0.5)}px;
    word-break: break-all;
    background: ${SURFACE};
  }
</style>
</head>
<body>
  <main class="page">
    <div class="meta-grid">
      <div class="k">Doc</div><div class="v">RFC-${rfc}-SRC</div>
      <div class="k">Status</div><div class="v"><span class="pill">SOURCE</span></div>
      <div class="k">Date</div><div class="v">${isoToday()}</div>
      <div class="k">Origin</div><div class="v">${escapeHtml(sourceLabel(explainer.url))}</div>
    </div>
    <div class="section-no">§ EOF — source</div>
    <h1 class="headline">${escapeHtml(explainer.title)}</h1>
    <section class="body">
      <p class="prose">Original publication. Open to verify all data points and citations.</p>
      <div class="src-url">${escapeHtml(explainer.url)}</div>
    </section>
    <footer class="footer">
      <span class="doc">${escapeHtml(sourceLabel(explainer.url))}</span>
      <span>END</span>
    </footer>
  </main>
</body>
</html>`;
}

export const engineeringSpecTemplate: TemplateDef = {
  id: "engineering-spec",
  name: "Engineering Spec",
  category: "Technical",
  tagline: "RFC-style design doc with status pill, numbered sections, code blocks.",
  audience: "Devtools founders, infra engineers, tech-lead writers.",
  preview: {
    background: PAPER,
    foreground: INK,
    accent: ACCENT,
    sampleHeading: "RFC-014: Stream Resumption",
    fontFamily: FONT_SANS,
  },
  renderPanel,
  renderAttribution,
};
