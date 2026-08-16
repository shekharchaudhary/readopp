import { EXPORT_DIMENSIONS } from "../export/dimensions";
import { sourceLabel } from "../shared/source";
import type {
  AttributionRenderInput,
  PanelRenderInput,
  TemplateDef,
} from "./types";

/**
 * Receipt — the boldest swing in the first template batch. Each panel
 * mimics a thermal-paper receipt: monospace type, dashed perforations
 * top + bottom, "RECEIPT #" header, a stamped accent ("TODAY", "VOID"),
 * line items with right-aligned values, totals at the bottom, and a
 * faux barcode footer.
 *
 * The format mimicry is the design — the whole point is that scrolling
 * past it on LinkedIn makes someone stop and double-take.
 */

const PAPER = "#FBF7EE";
const PAPER_DEEP = "#F1ECDB";
const INK = "#1A1A1A";
const INK_SOFT = "#5C5347";
const STAMP = "#C0392B";

const FONT_MONO =
  "ui-monospace, 'IBM Plex Mono', 'VT323', SFMono-Regular, Menlo, Monaco, Consolas, monospace";
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
  itemSize: number;
  totalSize: number;
  stampSize: number;
  gap: number;
}

function sizesFor(format: PanelRenderInput["format"]): Sizes {
  switch (format) {
    case "vertical":
      return {
        pad: 96,
        topSize: 22,
        hSize: 60,
        bodySize: 28,
        itemSize: 26,
        totalSize: 38,
        stampSize: 64,
        gap: 28,
      };
    case "landscape":
      return {
        pad: 56,
        topSize: 14,
        hSize: 36,
        bodySize: 18,
        itemSize: 17,
        totalSize: 24,
        stampSize: 40,
        gap: 14,
      };
    default: // square
      return {
        pad: 80,
        topSize: 18,
        hSize: 48,
        bodySize: 24,
        itemSize: 22,
        totalSize: 30,
        stampSize: 54,
        gap: 22,
      };
  }
}

function headingScaleFor(headingLength: number): number {
  if (headingLength <= 28) return 1.0;
  if (headingLength <= 44) return 0.85;
  if (headingLength <= 60) return 0.72;
  return 0.6;
}

/** Build receipt line items from the panel plan. We always shape them
 *  as `LABEL ........ VALUE` so the receipt feel holds even when source
 *  data varies. */
function extractItems(input: PanelRenderInput, max = 5): { label: string; value: string }[] {
  const plan = input.panel.plan;
  if (!plan) return [];
  const out: { label: string; value: string }[] = [];

  if (plan.stat?.value) {
    out.push({ label: (plan.stat.label || "key stat").toUpperCase(), value: plan.stat.value });
  }
  if (out.length < max && plan.keyFindings?.findings?.length) {
    for (const finding of plan.keyFindings.findings) {
      const titleLooksLikeValue = /\d|%|×|x\b/i.test(finding.title);
      out.push({
        label: (titleLooksLikeValue ? finding.detail ?? "Finding" : finding.title)
          .toUpperCase()
          .slice(0, 34),
        value: (titleLooksLikeValue ? finding.title : finding.detail ?? "CHECK")
          .toUpperCase()
          .slice(0, 16),
      });
      if (out.length >= max) break;
    }
  }
  if (plan.timeline?.length) {
    for (const t of plan.timeline) {
      out.push({ label: (t.what || "event").toUpperCase().slice(0, 26), value: t.when });
      if (out.length >= max) break;
    }
  }
  if (out.length < max && plan.metaphor?.poles?.length) {
    for (const p of plan.metaphor.poles) {
      out.push({
        label: (p.label || "side").toUpperCase().slice(0, 26),
        value: (p.sub || "—").slice(0, 18),
      });
      if (out.length >= max) break;
    }
  }
  if (out.length < max && plan.comparison?.rows?.length) {
    for (const row of plan.comparison.rows) {
      const cells = (row.cells || []).filter(Boolean);
      if (!row.label && cells.length === 0) continue;
      out.push({
        label: (row.label || "item").toUpperCase().slice(0, 26),
        value: cells.join(" / ").slice(0, 22),
      });
      if (out.length >= max) break;
    }
  }
  return out.slice(0, max);
}

function dateStamp(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}

function receiptNumber(seedId: string): string {
  // Stable 6-digit number derived from the explainer id so the receipt
  // looks "real" without being random per render.
  let n = 0;
  for (let i = 0; i < seedId.length; i++) n = (n * 31 + seedId.charCodeAt(i)) >>> 0;
  return String(n % 1_000_000).padStart(6, "0");
}

function baseCss(w: number, h: number, S: Sizes, headingScale = 1): string {
  return `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: ${PAPER_DEEP}; color: ${INK}; font-family: ${FONT_MONO}; }
  body { width: ${w}px; height: ${h}px; overflow: hidden; }
  .page {
    width: ${w}px;
    height: ${h}px;
    padding: ${S.pad}px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background:
      repeating-linear-gradient(0deg, rgba(0,0,0,0.015) 0 2px, transparent 2px 4px),
      ${PAPER_DEEP};
  }
  .receipt {
    width: 100%;
    height: 100%;
    background:
      radial-gradient(ellipse at 50% 0%, rgba(0,0,0,0.04), transparent 60%),
      ${PAPER};
    padding: ${Math.round(S.pad * 0.7)}px ${Math.round(S.pad * 0.6)}px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    /* Slight side-shadow so the receipt feels like it's lying on a desk */
    box-shadow: 0 0 0 1px rgba(0,0,0,0.04), 0 4px 0 -2px rgba(0,0,0,0.05);
  }
  /* Top + bottom dashed perforations */
  .perf-top, .perf-bottom {
    position: absolute;
    left: 0;
    right: 0;
    height: ${Math.round(S.bodySize * 0.6)}px;
    background-image: radial-gradient(${PAPER_DEEP} ${Math.round(S.bodySize * 0.15)}px, transparent ${Math.round(
    S.bodySize * 0.18
  )}px);
    background-size: ${Math.round(S.bodySize * 0.9)}px ${Math.round(S.bodySize * 0.6)}px;
    background-position: 0 50%;
    background-repeat: repeat-x;
  }
  .perf-top { top: -${Math.round(S.bodySize * 0.3)}px; }
  .perf-bottom { bottom: -${Math.round(S.bodySize * 0.3)}px; }
  .head {
    text-align: center;
    border-bottom: 2px dashed ${INK};
    padding-bottom: ${Math.round(S.gap * 0.6)}px;
    margin-bottom: ${S.gap}px;
  }
  .brand {
    font-size: ${S.bodySize}px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: ${INK};
    font-weight: 700;
    margin-bottom: ${Math.round(S.bodySize * 0.3)}px;
  }
  .sub {
    font-size: ${S.topSize}px;
    color: ${INK_SOFT};
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }
  .meta {
    display: flex;
    justify-content: space-between;
    font-size: ${S.itemSize}px;
    color: ${INK_SOFT};
    margin-bottom: ${S.gap}px;
    letter-spacing: 0.06em;
  }
  .headline {
    font-size: ${Math.round(S.hSize * headingScale)}px;
    line-height: 1.1;
    text-transform: uppercase;
    letter-spacing: -0.005em;
    font-weight: 700;
    color: ${INK};
    margin: 0 0 ${S.gap}px;
    text-align: left;
    word-break: break-word;
  }
  .items {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: ${Math.round(S.itemSize * 0.4)}px;
    margin-bottom: ${S.gap}px;
    overflow: hidden;
  }
  .item {
    font-size: ${S.itemSize}px;
    color: ${INK};
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 12px;
    align-items: baseline;
    line-height: 1.3;
  }
  .item .label {
    overflow: hidden;
    text-overflow: clip;
    position: relative;
  }
  /* Dotted leader between label and value, classic receipt look. */
  .item .label::after {
    content: " ......................................................................................";
    color: ${INK_SOFT};
    letter-spacing: 0.02em;
  }
  .item .value {
    color: ${INK};
    font-weight: 700;
    white-space: nowrap;
  }
  .total {
    border-top: 2px dashed ${INK};
    padding-top: ${Math.round(S.gap * 0.6)}px;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: ${S.totalSize}px;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.04em;
    margin-bottom: ${Math.round(S.gap * 0.6)}px;
    color: ${INK};
  }
  .total .v { color: ${STAMP}; }
  .summary {
    font-size: ${Math.round(S.itemSize * 0.95)}px;
    color: ${INK};
    line-height: 1.4;
    margin: 0 0 ${S.gap}px;
    border-top: 1px dashed ${INK_SOFT};
    padding-top: ${Math.round(S.gap * 0.5)}px;
  }
  .footer {
    margin-top: auto;
    text-align: center;
    font-size: ${S.topSize}px;
    color: ${INK_SOFT};
    letter-spacing: 0.06em;
  }
  /* Faux barcode — 0/1 noise rendered tabular so it scales evenly. */
  .barcode {
    font-family: ${FONT_MONO};
    font-size: ${Math.round(S.topSize * 1.3)}px;
    letter-spacing: -0.04em;
    color: ${INK};
    padding: ${Math.round(S.gap * 0.4)}px 0;
    word-break: break-all;
    line-height: 1;
  }
  .barcode .bar {
    display: inline-block;
    width: ${Math.round(S.topSize * 0.18)}px;
    height: ${Math.round(S.topSize * 1.3)}px;
    margin: 0 ${Math.round(S.topSize * 0.04)}px;
    background: ${INK};
    vertical-align: bottom;
  }
  .barcode .bar.thin { width: ${Math.round(S.topSize * 0.08)}px; }
  .stamp {
    position: absolute;
    top: ${Math.round(S.pad * 0.6)}px;
    right: ${Math.round(S.pad * 0.5)}px;
    font-family: ${FONT_SANS};
    font-size: ${S.stampSize}px;
    color: ${STAMP};
    border: 4px solid ${STAMP};
    padding: 8px 18px;
    transform: rotate(8deg);
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    opacity: 0.85;
    box-shadow: inset 0 0 0 2px ${STAMP};
  }
  `;
}

/** Tiny SVG-like barcode rendered as alternating wide/thin bars. */
function barcode(seed: string, count = 32): string {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 17 + seed.charCodeAt(i)) >>> 0;
  let bars = "";
  for (let i = 0; i < count; i++) {
    n = (n * 1103515245 + 12345) >>> 0;
    bars += `<span class="bar${(n & 1) === 1 ? " thin" : ""}"></span>`;
  }
  return bars;
}

async function renderPanel(input: PanelRenderInput): Promise<string> {
  const { explainer, panel, format, panelIndex, totalPanels } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const S = sizesFor(format);
  const headline = (panel.heading?.trim() || explainer.title).toUpperCase();
  const items = extractItems(input, format === "vertical" ? 6 : 5);
  const summary = panel.caption?.trim();
  const headingScale = headingScaleFor(headline.length);
  const total = items.length ? `${items.length} ITEM${items.length === 1 ? "" : "S"}` : "—";
  const receiptNo = receiptNumber(explainer.id);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, headingScale)}</style>
</head>
<body>
  <main class="page">
    <div class="receipt">
      <div class="perf-top"></div>
      <div class="stamp">${panelIndex === 1 ? "TODAY" : "READ"}</div>
      <header class="head">
        <div class="brand">Readopp Receipt</div>
        <div class="sub">${escapeHtml(sourceLabel(explainer.url))}</div>
      </header>
      <div class="meta">
        <span>NO. ${receiptNo}</span>
        <span>${dateStamp()}</span>
        <span>${String(panelIndex).padStart(2, "0")}/${String(totalPanels).padStart(2, "0")}</span>
      </div>
      <h1 class="headline">${escapeHtml(headline)}</h1>
      ${
        items.length
          ? `<div class="items">${items
              .map(
                (it) =>
                  `<div class="item"><span class="label">${escapeHtml(it.label)}</span><span class="value">${escapeHtml(it.value)}</span></div>`
              )
              .join("")}</div>`
          : summary
          ? `<p class="summary">${escapeHtml(summary)}</p>`
          : ""
      }
      ${
        items.length
          ? `<div class="total"><span>SUBTOTAL</span><span class="v">${total}</span></div>`
          : ""
      }
      ${
        items.length && summary
          ? `<p class="summary">${escapeHtml(summary)}</p>`
          : ""
      }
      <div class="footer">
        <div class="barcode">${barcode(`${explainer.id}-${panelIndex}`)}</div>
        THANK YOU — readopp.com
      </div>
      <div class="perf-bottom"></div>
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
  const receiptNo = receiptNumber(explainer.id);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S)}
  .src-stack { display: flex; flex-direction: column; gap: ${S.gap}px; flex: 1; min-height: 0; }
  .src-title {
    font-size: ${Math.round(S.hSize * 0.95)}px;
    line-height: 1.05;
    text-transform: uppercase;
    color: ${INK};
    margin: 0;
    letter-spacing: -0.01em;
  }
  .src-url {
    font-size: ${S.bodySize}px;
    color: ${INK};
    border: 2px dashed ${INK};
    padding: ${Math.round(S.bodySize * 0.5)}px ${Math.round(S.bodySize * 0.8)}px;
    word-break: break-all;
    text-align: center;
  }
</style>
</head>
<body>
  <main class="page">
    <div class="receipt">
      <div class="perf-top"></div>
      <div class="stamp">SOURCE</div>
      <header class="head">
        <div class="brand">Readopp Receipt</div>
        <div class="sub">${escapeHtml(source)}</div>
      </header>
      <div class="meta">
        <span>NO. ${receiptNo}</span>
        <span>${dateStamp()}</span>
        <span>ORIGIN</span>
      </div>
      <div class="src-stack">
        <h1 class="src-title">${escapeHtml(explainer.title)}</h1>
        <div class="src-url">${escapeHtml(explainer.url)}</div>
      </div>
      <div class="footer">
        <div class="barcode">${barcode(`${explainer.id}-attr`)}</div>
        SCAN — READ — SAVE — readopp.com
      </div>
      <div class="perf-bottom"></div>
    </div>
  </main>
</body>
</html>`;
}

export const receiptTemplate: TemplateDef = {
  id: "receipt",
  name: "Receipt",
  category: "Document",
  tagline: "Thermal-paper receipt with perforations, line items, and an ink stamp.",
  audience: "Finance & business commentators with a sense of humour.",
  preview: {
    background: PAPER,
    foreground: INK,
    accent: STAMP,
    sampleHeading: "RECEIPT // ATTENTION SPENT",
    fontFamily: FONT_MONO,
  },
  renderPanel,
  renderAttribution,
};
