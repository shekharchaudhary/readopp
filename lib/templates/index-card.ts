import { EXPORT_DIMENSIONS } from "../export/dimensions";
import { sourceLabel } from "../shared/source";
import type {
  AttributionRenderInput,
  PanelRenderInput,
  TemplateDef,
} from "./types";

/**
 * Index Card — every panel is a 4x6 Zettelkasten index card. Ruled
 * horizontal lines, a single red margin rule on the left, punched-hole
 * dot in the top corner, card number + tags metadata, and a slight
 * rotation so the card feels physical.
 *
 * The "cross-references" footer line ("see also: card 03 · 07") is the
 * killer detail — it makes the carousel feel like flipping through a
 * curated card catalog rather than a slide deck.
 */

const PAPER = "#FFFEF7";
const PAPER_DEEP = "#F2EBD8";
const INK = "#1A1A1A";
const INK_SOFT = "#5A5048";
const INK_FAINT = "#9E948A";
const RULE = "#D7CDB8";
const MARGIN_RED = "#C0392B";
const TAG_BG = "#F1ECDB";

const FONT_HAND_NEUTRAL =
  "'iA Writer Quattro', 'IBM Plex Sans', 'Inter', system-ui, sans-serif";
const FONT_MONO =
  "ui-monospace, 'IBM Plex Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace";

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
  cardPad: number;
  marginLeft: number;
  metaSize: number;
  hSize: number;
  bodySize: number;
  noteSize: number;
  footerSize: number;
  ruleSpacing: number;
  gap: number;
}

function sizesFor(format: PanelRenderInput["format"]): Sizes {
  switch (format) {
    case "vertical":
      return {
        outerPad: 56,
        cardPad: 72,
        marginLeft: 140,
        metaSize: 22,
        hSize: 60,
        bodySize: 30,
        noteSize: 26,
        footerSize: 22,
        ruleSpacing: 52,
        gap: 28,
      };
    case "landscape":
      return {
        outerPad: 32,
        cardPad: 40,
        marginLeft: 80,
        metaSize: 13,
        hSize: 32,
        bodySize: 18,
        noteSize: 16,
        footerSize: 13,
        ruleSpacing: 30,
        gap: 14,
      };
    default: // square
      return {
        outerPad: 48,
        cardPad: 56,
        marginLeft: 110,
        metaSize: 18,
        hSize: 46,
        bodySize: 24,
        noteSize: 22,
        footerSize: 16,
        ruleSpacing: 42,
        gap: 22,
      };
  }
}

function headingScaleFor(len: number): number {
  if (len <= 30) return 1.0;
  if (len <= 48) return 0.86;
  if (len <= 70) return 0.72;
  return 0.6;
}

function extractTags(input: PanelRenderInput): string[] {
  const plan = input.panel.plan;
  if (!plan) return [];
  // Use comparison column headers, metaphor kind, and stat label as
  // implicit "tags" — feels like the user wrote them by hand.
  const tags: string[] = [];
  if (plan.metaphor?.kind) tags.push(plan.metaphor.kind.replace(/_/g, "-"));
  if (plan.visualType) tags.push(plan.visualType);
  if (plan.stat?.label) tags.push(plan.stat.label.split(/\s+/)[0].toLowerCase());
  return Array.from(new Set(tags))
    .slice(0, 3)
    .map((t) => `#${t.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`);
}

function extractNotes(input: PanelRenderInput, max = 3): string[] {
  const plan = input.panel.plan;
  if (!plan) return [];
  const out: string[] = [];
  if (plan.stat?.value) out.push(`${plan.stat.value} — ${plan.stat.label ?? ""}`.trim());
  if (plan.timeline?.length) {
    for (const t of plan.timeline) {
      out.push(`${t.when} · ${t.what}`);
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
  return out.slice(0, max).map((s) => s.slice(0, 100));
}

function cardNumber(seed: string): string {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  return String(n % 999).padStart(3, "0");
}

function crossRefs(seed: string, count = 2): string[] {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 17 + seed.charCodeAt(i)) >>> 0;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    n = (n * 1103515245 + 12345) >>> 0;
    out.push(String(n % 999).padStart(3, "0"));
  }
  return out;
}

function isoToday(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function baseCss(w: number, h: number, S: Sizes, headingScale = 1): string {
  return `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: ${PAPER_DEEP}; color: ${INK}; font-family: ${FONT_HAND_NEUTRAL}; }
  body { width: ${w}px; height: ${h}px; overflow: hidden; }
  .desk {
    width: ${w}px;
    height: ${h}px;
    padding: ${S.outerPad}px;
    background:
      repeating-linear-gradient(45deg, rgba(0,0,0,0.02) 0 2px, transparent 2px 6px),
      ${PAPER_DEEP};
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* The card itself, slightly rotated to feel placed by hand. */
  .card {
    width: 100%;
    height: 100%;
    background:
      repeating-linear-gradient(
        to bottom,
        transparent 0 ${S.ruleSpacing - 1}px,
        ${RULE} ${S.ruleSpacing - 1}px ${S.ruleSpacing}px
      ),
      ${PAPER};
    padding: ${S.cardPad}px ${S.cardPad}px ${S.cardPad}px ${S.marginLeft}px;
    border: 1px solid ${RULE};
    border-radius: 4px;
    box-shadow: 0 4px 0 -2px rgba(0,0,0,0.06), 0 12px 24px -12px rgba(0,0,0,0.08);
    transform: rotate(-0.6deg);
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  /* Left red margin rule. */
  .card::before {
    content: "";
    position: absolute;
    left: ${Math.round(S.marginLeft * 0.75)}px;
    top: 0;
    bottom: 0;
    width: 1px;
    background: ${MARGIN_RED};
    opacity: 0.7;
  }
  /* Punched hole top-left. */
  .card::after {
    content: "";
    position: absolute;
    left: ${Math.round(S.marginLeft * 0.35)}px;
    top: ${Math.round(S.cardPad * 0.7)}px;
    width: ${Math.round(S.metaSize * 1.4)}px;
    height: ${Math.round(S.metaSize * 1.4)}px;
    border-radius: 50%;
    background: ${PAPER_DEEP};
    box-shadow: inset 0 0 0 1px ${RULE};
  }
  .meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    font-family: ${FONT_MONO};
    font-size: ${S.metaSize}px;
    color: ${INK_SOFT};
    letter-spacing: 0.04em;
    margin-bottom: ${S.gap}px;
  }
  .meta .id { color: ${MARGIN_RED}; font-weight: 700; }
  .heading {
    font-size: ${Math.round(S.hSize * headingScale)}px;
    line-height: 1.15;
    font-weight: 600;
    color: ${INK};
    margin: 0 0 ${S.gap}px;
    letter-spacing: -0.005em;
    text-wrap: balance;
  }
  .body-area {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: ${Math.round(S.gap * 0.6)}px;
    overflow: hidden;
  }
  .notes {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: ${Math.round(S.noteSize * 0.4)}px;
  }
  .notes li {
    font-size: ${S.noteSize}px;
    line-height: 1.45;
    color: ${INK};
    padding-left: ${Math.round(S.noteSize * 1.2)}px;
    position: relative;
  }
  .notes li::before {
    content: "·";
    position: absolute;
    left: 0;
    color: ${MARGIN_RED};
    font-weight: 700;
  }
  .body {
    font-size: ${S.bodySize}px;
    line-height: 1.55;
    color: ${INK};
    margin: 0;
  }
  .tags {
    margin-top: ${S.gap}px;
    display: flex;
    flex-wrap: wrap;
    gap: ${Math.round(S.metaSize * 0.4)}px;
    font-family: ${FONT_MONO};
  }
  .tag {
    background: ${TAG_BG};
    color: ${INK};
    padding: 2px 8px;
    font-size: ${Math.round(S.metaSize * 0.9)}px;
    border-radius: 3px;
    letter-spacing: 0.02em;
  }
  .footer {
    margin-top: auto;
    padding-top: ${Math.round(S.gap * 0.5)}px;
    border-top: 1px dashed ${RULE};
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-family: ${FONT_MONO};
    font-size: ${S.footerSize}px;
    color: ${INK_FAINT};
    letter-spacing: 0.04em;
  }
  .footer .ref { color: ${INK_SOFT}; }
  `;
}

async function renderPanel(input: PanelRenderInput): Promise<string> {
  const { explainer, panel, format, panelIndex, totalPanels } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const S = sizesFor(format);
  const heading = panel.heading?.trim() || explainer.title;
  const notes = extractNotes(input, format === "vertical" ? 4 : 3);
  const body = panel.caption?.trim();
  const tags = extractTags(input);
  const headingScale = headingScaleFor(heading.length);
  const cardNo = `${cardNumber(explainer.id)}.${String(panelIndex).padStart(2, "0")}`;
  const refs = crossRefs(`${explainer.id}-${panelIndex}`);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, headingScale)}</style>
</head>
<body>
  <div class="desk">
    <article class="card">
      <div class="meta">
        <span><span class="id">${cardNo}</span> · ${isoToday()}</span>
        <span>${String(panelIndex).padStart(2, "0")} / ${String(totalPanels).padStart(2, "0")}</span>
      </div>
      <h1 class="heading">${escapeHtml(heading)}</h1>
      <section class="body-area">
        ${
          notes.length
            ? `<ul class="notes">${notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`
            : ""
        }
        ${body ? `<p class="body">${escapeHtml(body)}</p>` : ""}
        ${
          tags.length
            ? `<div class="tags">${tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>`
            : ""
        }
      </section>
      <footer class="footer">
        <span>${escapeHtml(sourceLabel(explainer.url))}</span>
        <span class="ref">see also: ${refs.map((r) => `№${r}`).join(" · ")}</span>
      </footer>
    </article>
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
  const cardNo = `${cardNumber(explainer.id)}.SRC`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, 0.9)}
  .src-url {
    font-family: ${FONT_MONO};
    font-size: ${Math.round(S.bodySize * 0.85)}px;
    color: ${MARGIN_RED};
    border-top: 1px dashed ${RULE};
    border-bottom: 1px dashed ${RULE};
    padding: ${Math.round(S.gap * 0.5)}px 0;
    word-break: break-all;
    margin-top: ${S.gap}px;
  }
</style>
</head>
<body>
  <div class="desk">
    <article class="card">
      <div class="meta">
        <span><span class="id">${cardNo}</span> · ${isoToday()}</span>
        <span>SOURCE</span>
      </div>
      <h1 class="heading">${escapeHtml(explainer.title)}</h1>
      <section class="body-area">
        <p class="body">From the source publication. Read in full for citations and context.</p>
        <div class="src-url">${escapeHtml(explainer.url)}</div>
      </section>
      <footer class="footer">
        <span>${escapeHtml(sourceLabel(explainer.url))}</span>
        <span class="ref">origin card</span>
      </footer>
    </article>
  </div>
</body>
</html>`;
}

export const indexCardTemplate: TemplateDef = {
  id: "index-card",
  name: "Index Card",
  category: "Document",
  tagline: "Ruled Zettelkasten card with margin rule, tags, and cross-refs.",
  audience: "Second-brain creators, researchers, PKM nerds.",
  preview: {
    background: PAPER,
    foreground: INK,
    accent: MARGIN_RED,
    sampleHeading: "047 / on focused reading",
    fontFamily: FONT_HAND_NEUTRAL,
  },
  renderPanel,
  renderAttribution,
};
