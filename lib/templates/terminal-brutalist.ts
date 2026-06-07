import { EXPORT_DIMENSIONS } from "../export/dimensions";
import { sourceLabel } from "../shared/source";
import type {
  AttributionRenderInput,
  PanelRenderInput,
  TemplateDef,
} from "./types";

/**
 * Terminal Brutalist — looks like a developer's terminal session or a
 * tech spec doc. Monospace everything, ASCII rule lines, file-path
 * breadcrumbs, single neon accent. Lives in the Linear/Vercel aesthetic
 * lane and is meant for AI / devtools / infra creators.
 *
 * The panel SVG is intentionally ignored — this template reads from
 * panel.heading, panel.caption, and (if present) panel.plan.bullets so
 * the look stays consistent regardless of which agent layout produced
 * the panel.
 */

const BG = "#0A0A0A";
const FG = "#FAFAFA";
const DIM = "#8A8A8A";
const ACCENT = "#B6FF3B";
const RULE = "#2A2A2A";

const FONT_MONO =
  "ui-monospace, 'JetBrains Mono', 'Berkeley Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace";

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
  fileSize: number;
  hSize: number;
  bodySize: number;
  smallSize: number;
  gap: number;
  ruleHeight: number;
}

function sizesFor(format: PanelRenderInput["format"]): Sizes {
  switch (format) {
    case "vertical":
      return {
        pad: 96,
        fileSize: 22,
        hSize: 88,
        bodySize: 36,
        smallSize: 20,
        gap: 56,
        ruleHeight: 1,
      };
    case "landscape":
      return {
        pad: 56,
        fileSize: 14,
        hSize: 52,
        bodySize: 22,
        smallSize: 13,
        gap: 24,
        ruleHeight: 1,
      };
    default: // square
      return {
        pad: 80,
        fileSize: 18,
        hSize: 70,
        bodySize: 28,
        smallSize: 16,
        gap: 40,
        ruleHeight: 1,
      };
  }
}

/**
 * Pull a few short text lines out of the panel plan so we have
 * something to render as bullets under the heading. Returns at most
 * `max` entries, each ≤120 chars.
 */
function extractBullets(input: PanelRenderInput, max = 3): string[] {
  const plan = input.panel.plan;
  if (!plan) return [];
  const out: string[] = [];

  if (plan.stat?.value) {
    out.push(`${plan.stat.value} ${plan.stat.label ?? ""}`.trim());
  }
  if (plan.timeline?.length) {
    for (const t of plan.timeline) {
      out.push(`${t.when} — ${t.what}`.trim());
      if (out.length >= max) break;
    }
  }
  if (out.length < max && plan.comparison?.rows?.length) {
    for (const row of plan.comparison.rows) {
      const label = row.label || "";
      const cells = (row.cells || []).filter(Boolean).join(" / ");
      const line = [label, cells].filter(Boolean).join(": ");
      if (line) out.push(line);
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
  if (out.length < max && plan.metaphor?.items?.length) {
    for (const item of plan.metaphor.items) {
      const line = [item.name, item.sub].filter(Boolean).join(" — ");
      if (line) out.push(line);
      if (out.length >= max) break;
    }
  }
  return out.slice(0, max).map((s) => s.slice(0, 120));
}

function filePath(explainer: PanelRenderInput["explainer"], index: number): string {
  const slug = (explainer.title || "explainer")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return `~/${slug}/panel-${String(index).padStart(2, "0")}.md`;
}

function ascii(line: string): string {
  return line;
}

function baseCss(w: number, h: number, S: Sizes, headingScale = 1): string {
  return `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: ${BG}; color: ${FG}; font-family: ${FONT_MONO}; }
  body { width: ${w}px; height: ${h}px; overflow: hidden; }
  .page {
    width: ${w}px;
    height: ${h}px;
    padding: ${S.pad}px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background:
      linear-gradient(${BG}, ${BG}),
      radial-gradient(circle at 20% -10%, rgba(182,255,59,0.05), transparent 40%);
  }
  .top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 24px;
    font-size: ${S.fileSize}px;
    color: ${DIM};
    letter-spacing: 0.02em;
    margin-bottom: ${Math.round(S.gap * 0.75)}px;
  }
  .top .path { color: ${ACCENT}; }
  .rule {
    height: ${S.ruleHeight}px;
    background: ${RULE};
    margin: ${Math.round(S.gap * 0.5)}px 0;
  }
  .index {
    color: ${DIM};
    font-size: ${S.fileSize}px;
    letter-spacing: 0.04em;
  }
  .index .num { color: ${ACCENT}; }
  .heading {
    font-size: ${Math.round(S.hSize * headingScale)}px;
    line-height: 1.05;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: ${FG};
    margin: ${Math.round(S.gap * 0.4)}px 0 ${S.gap}px;
    /* Block cursor at end of heading */
  }
  .heading .cursor {
    display: inline-block;
    width: 0.5em;
    height: 0.9em;
    background: ${ACCENT};
    margin-left: 0.15em;
    vertical-align: -0.05em;
  }
  .bullets {
    list-style: none;
    padding: 0;
    margin: 0 0 ${S.gap}px;
    display: flex;
    flex-direction: column;
    gap: ${Math.round(S.bodySize * 0.55)}px;
  }
  .bullets li {
    font-size: ${S.bodySize}px;
    line-height: 1.45;
    color: ${FG};
    padding-left: ${Math.round(S.bodySize * 1.5)}px;
    position: relative;
  }
  .bullets li::before {
    content: ">";
    position: absolute;
    left: 0;
    color: ${ACCENT};
    font-weight: 700;
  }
  .caption {
    font-size: ${S.bodySize}px;
    line-height: 1.5;
    color: ${FG};
    max-width: 90%;
    margin: 0 0 ${S.gap}px;
  }
  .spacer { flex: 1; }
  .footer {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    font-size: ${S.smallSize}px;
    color: ${DIM};
    letter-spacing: 0.04em;
    border-top: 1px solid ${RULE};
    padding-top: ${Math.round(S.gap * 0.4)}px;
  }
  .footer .session {
    text-transform: uppercase;
  }
  .footer .source {
    color: ${FG};
  }
  .ascii {
    color: ${RULE};
    font-size: ${S.smallSize}px;
    white-space: pre;
    margin: ${Math.round(S.gap * 0.4)}px 0;
    letter-spacing: 0.02em;
  }
  `;
}

/** Heading sizes step down as the heading grows, so 60-char titles
 *  don't bleed off the panel. Tuned by character length, not pixels. */
function headingScaleFor(headingLength: number): number {
  if (headingLength <= 28) return 1.0;
  if (headingLength <= 40) return 0.85;
  if (headingLength <= 55) return 0.72;
  return 0.62;
}

async function renderPanel(input: PanelRenderInput): Promise<string> {
  const { explainer, panel, format, panelIndex, totalPanels } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const S = sizesFor(format);
  const heading = panel.heading?.trim() || explainer.title;
  // Bullets come from structured plan data; caption is the agent's prose.
  // Show whichever the panel has — but never both, because mixing leaves
  // no room for either to breathe inside 1080×1080.
  const bullets = extractBullets(input, format === "vertical" ? 4 : 3);
  const captionRaw = panel.caption?.trim();
  const caption = bullets.length === 0 ? captionRaw : undefined;
  const path = filePath(explainer, panelIndex);
  const idx = `${String(panelIndex).padStart(2, "0")} / ${String(totalPanels).padStart(2, "0")}`;
  const headingScale = headingScaleFor(heading.length);

  // Build a ratio-aware ASCII rule to break up the body.
  const ruleLen = format === "vertical" ? 60 : format === "landscape" ? 70 : 45;
  const asciiRule = ascii("─".repeat(ruleLen));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, headingScale)}</style>
</head>
<body>
  <main class="page">
    <div class="top">
      <span class="path">${escapeHtml(path)}</span>
      <span class="index">PANEL <span class="num">${idx}</span></span>
    </div>
    <div class="rule"></div>
    <h1 class="heading">${escapeHtml(heading)}<span class="cursor"></span></h1>
    ${
      bullets.length
        ? `<ul class="bullets">${bullets
            .map((b) => `<li>${escapeHtml(b)}</li>`)
            .join("")}</ul>`
        : ""
    }
    ${caption ? `<p class="caption">${escapeHtml(caption)}</p>` : ""}
    <div class="ascii">${asciiRule}</div>
    <div class="spacer"></div>
    <div class="footer">
      <span class="session">readopp // session ${escapeHtml(
        explainer.id.slice(0, 8)
      )}</span>
      <span class="source">${escapeHtml(sourceLabel(explainer.url))}</span>
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
  const ruleLen = format === "vertical" ? 60 : format === "landscape" ? 70 : 45;
  const asciiRule = ascii("─".repeat(ruleLen));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S)}
  .attr-stack { display: flex; flex-direction: column; justify-content: center; flex: 1; }
  .attr-label {
    font-size: ${S.fileSize}px;
    color: ${ACCENT};
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: ${Math.round(S.gap * 0.5)}px;
  }
  .attr-title {
    font-size: ${S.hSize}px;
    line-height: 1.05;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: ${FG};
    margin: 0 0 ${Math.round(S.gap * 0.5)}px;
  }
  .attr-source {
    font-size: ${S.bodySize}px;
    color: ${DIM};
    margin-bottom: ${S.gap}px;
  }
  .attr-cta {
    font-size: ${S.bodySize}px;
    color: ${FG};
    border: 1px solid ${ACCENT};
    padding: ${Math.round(S.bodySize * 0.5)}px ${Math.round(S.bodySize * 0.9)}px;
    align-self: flex-start;
    border-radius: 2px;
  }
  .attr-cta .arrow { color: ${ACCENT}; margin-right: 0.4em; }
</style>
</head>
<body>
  <main class="page">
    <div class="top">
      <span class="path">~/readopp/source.md</span>
      <span class="index">EOF</span>
    </div>
    <div class="rule"></div>
    <div class="attr-stack">
      <div class="attr-label">// source</div>
      <h1 class="attr-title">${escapeHtml(explainer.title)}</h1>
      <div class="attr-source">${escapeHtml(source)}</div>
      <div class="ascii">${asciiRule}</div>
      <div class="attr-cta"><span class="arrow">→</span>${escapeHtml(explainer.url)}</div>
    </div>
    <div class="footer">
      <span class="session">readopp // generated</span>
      <span class="source">${escapeHtml(source)}</span>
    </div>
  </main>
</body>
</html>`;
}

export const terminalBrutalistTemplate: TemplateDef = {
  id: "terminal-brutalist",
  name: "Terminal Brutalist",
  category: "Technical",
  tagline: "Monospace, ASCII rules, neon accent — Linear/Vercel energy.",
  audience: "AI engineers, devtools founders, infra writers.",
  preview: {
    background: BG,
    foreground: FG,
    accent: ACCENT,
    sampleHeading: "panel-04: shipping the orchestrator",
    fontFamily: FONT_MONO,
  },
  renderPanel,
  renderAttribution,
};


