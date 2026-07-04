/**
 * Bold carousel template family — five loud, full-bleed panel
 * archetypes that together render an 8-panel LinkedIn carousel in the
 * "bold" voice (near-black / red / amber fields, heavy uppercase type).
 *
 * Archetypes:
 *   - statement : kicker + stacked phrase lines (cover, setup, reframe)
 *   - stat      : one giant number + unit + supporting lines
 *   - bars      : descending bar chart + headline + caption
 *   - list      : amber kicker + numbered red items
 *   - outro     : share CTA + wordmark
 *
 * Each renderer returns a RenderedPanel just like the editorial
 * templates, so the Bold family can slot into the same render plumbing.
 */

import type { PanelPlan, RenderedPanel } from "../../shared/schemas";
import {
  BOLD,
  BOLD_GRID,
  boldWrap,
  bgFill,
  fgOn,
  mutedOn,
  topAccent,
  uniformSize,
  fitDisplayLines,
  displayLine,
  kickerLine,
  escapeXml,
} from "../system/boldChrome";
import { FONT, wrapToWidth } from "../system/typography";

const { W, H, PAD, CONTENT_W } = BOLD_GRID;

interface Common {
  sectionId: string;
  heading?: string;
  caption?: string;
}

function panel(common: Common, svg: string): RenderedPanel {
  return {
    sectionId: common.sectionId,
    heading: common.heading ?? "",
    caption: common.caption ?? "",
    format: "svg",
    content: svg,
    validated: true,
    fallback: false,
    edited: false,
  };
}

type BoldBgLike = Parameters<typeof bgFill>[0];

// ------------------------------------------------------------------
// statement — kicker + stacked phrase lines (cover / setup / reframe)
// ------------------------------------------------------------------

export interface BoldStatementInput extends Common {
  bg: BoldBgLike;
  kicker?: string;
  /** Manual line breaks; each line can carry its own colour token. */
  lines: Array<{ text: string; color?: "fg" | "red" | "amber" | "white" }>;
  sub?: string;
}

function resolveColor(
  token: "fg" | "red" | "amber" | "white" | undefined,
  bg: BoldBgLike
): string {
  switch (token) {
    case "red":
      return BOLD.red;
    case "amber":
      return BOLD.amber;
    case "white":
      return BOLD.white;
    default:
      return fgOn(bg);
  }
}

export function renderBoldStatement(input: BoldStatementInput): RenderedPanel {
  const { bg, kicker, lines: inputLines, sub } = input;
  // Wrap + size the phrase to fit BOTH the content width and the vertical
  // space left after the kicker (above) and sub-line (below). The incoming
  // lines are just the source text — we re-flow them so a long sentence
  // can't run off the panel edge.
  const text = inputLines.map((l) => l.text).join(" ");
  const vBudget = H - PAD * 2 - (kicker ? 64 : 0) - (sub ? 120 : 0);
  const { lines: texts, size } = fitDisplayLines(text, {
    width: CONTENT_W,
    maxHeight: vBudget,
    maxSize: 86,
    minSize: 30,
  });
  const lineStep = Math.round(size * 1.0);
  const blockH = (texts.length - 1) * lineStep;

  // Vertically centre the phrase block, biased slightly above middle so
  // the optional sub-line has room below.
  const firstBaseline = Math.round(H / 2 - blockH / 2 - (sub ? 10 : 0) + size * 0.32);

  const parts: string[] = [topAccent(bg)];

  if (kicker) {
    const kColor = bg === "ink" || bg === "red" ? BOLD.amber : BOLD.red;
    parts.push(kickerLine(kicker, PAD, firstBaseline - size - 28, kColor));
  }

  // Loud convention: paint the final line red as the punch line.
  const lastIdx = texts.length - 1;
  texts.forEach((t, i) => {
    parts.push(
      displayLine(
        t,
        PAD,
        firstBaseline + i * lineStep,
        size,
        resolveColor(i === lastIdx ? "red" : "fg", bg)
      )
    );
  });

  if (sub) {
    const subSize = 19;
    const subStep = Math.round(subSize * 1.35);
    const subTop = firstBaseline + blockH + 50;
    // Wrap to the content width so a long sub-line stacks instead of running
    // off the panel. One <text> with <tspan> lines keeps it a single editable
    // node for the canvas editor.
    const subLines = wrapToWidth(sub, CONTENT_W, subSize, "sans");
    const tspans = subLines
      .map(
        (ln, i) =>
          `<tspan x="${PAD}" dy="${i === 0 ? 0 : subStep}">${escapeXml(ln)}</tspan>`
      )
      .join("");
    parts.push(
      `<text x="${PAD}" y="${subTop}" font-family="${FONT.sans}" font-size="${subSize}" font-weight="600" fill="${mutedOn(bg)}">${tspans}</text>`
    );
  }

  return panel(input, boldWrap(parts.join(""), bg, texts.join(" ")));
}

// ------------------------------------------------------------------
// stat — one giant number + unit + supporting lines
// ------------------------------------------------------------------

export interface BoldStatInput extends Common {
  bg: BoldBgLike;
  kicker?: string;
  value: string;
  unit?: string;
  /** Uppercase supporting lines under the number. */
  lines?: string[];
  /** Small sentence-case note at the bottom. */
  note?: string;
}

export function renderBoldStat(input: BoldStatInput): RenderedPanel {
  const { bg, kicker, value, unit, lines = [], note } = input;
  const fg = fgOn(bg);
  const valueSize = 168;
  const valueBaseline = 372;
  const parts: string[] = [topAccent(bg)];

  if (kicker) {
    parts.push(kickerLine(kicker, PAD, valueBaseline - valueSize - 8, fg));
  }

  parts.push(displayLine(value, PAD, valueBaseline, valueSize, fg, { weight: 800 }));

  if (unit) {
    // Unit sits on the value baseline, just right of the number.
    const unitSize = Math.round(valueSize * 0.4);
    const valueW = value.length * valueSize * 0.62;
    parts.push(
      displayLine(unit, PAD + valueW + 10, valueBaseline, unitSize, fg, { weight: 800 })
    );
  }

  let y = valueBaseline + 54;
  const subSize = 36;
  for (const line of lines) {
    parts.push(displayLine(line, PAD, y, subSize, fg, { weight: 800 }));
    y += Math.round(subSize * 1.05);
  }

  if (note) {
    parts.push(
      `<text x="${PAD}" y="${y + 20}" font-family="${FONT.sans}" font-size="19" font-weight="600" fill="${fg}">${escapeXml(note)}</text>`
    );
  }

  return panel(input, boldWrap(parts.join(""), bg, `${value}${unit ?? ""}`));
}

// ------------------------------------------------------------------
// bars — descending bar chart + headline + caption
// ------------------------------------------------------------------

export interface BoldBarsInput extends Common {
  bg: BoldBgLike;
  /** Headline lines (manual breaks). */
  headingLines: string[];
  /** Number of bars; heights descend automatically. Default 4. */
  bars?: number;
  /** Real bar values; when given they scale the heights instead of the
   *  default descending ramp. Length wins over `bars`. */
  values?: number[];
  barCaption?: string;
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const mix = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `#${mix.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** A bar with only its top two corners rounded (premium chart detail). */
function topRoundedBar(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string
): string {
  const rad = Math.min(r, w / 2, h);
  const d = `M${x} ${y + h} L${x} ${y + rad} Q${x} ${y} ${x + rad} ${y} L${x + w - rad} ${y} Q${x + w} ${y} ${x + w} ${y + rad} L${x + w} ${y + h} Z`;
  return `<path d="${d}" fill="${fill}"/>`;
}

export function renderBoldBars(input: BoldBarsInput): RenderedPanel {
  const { bg, headingLines, values, barCaption } = input;
  const bars = values?.length ?? input.bars ?? 4;
  const fg = fgOn(bg);
  const parts: string[] = [topAccent(bg)];

  const hSize = uniformSize(headingLines, { width: CONTENT_W, maxSize: 50, minSize: 30 });
  const hStep = Math.round(hSize * 1.02);
  let y = 160;
  for (const line of headingLines) {
    parts.push(displayLine(line, PAD, y, hSize, fg, { weight: 800 }));
    y += hStep;
  }

  // Chart geometry — descending heights + a warm amber→red ramp (on
  // brand, reads as heat/intensity dropping rather than muddy brown).
  const baseY = 480;
  const areaW = CONTENT_W;
  const gap = 22;
  const barW = (areaW - gap * (bars - 1)) / bars;
  const maxBarH = 190;
  const minBarH = 52;
  parts.push(
    `<line x1="${PAD}" y1="${baseY}" x2="${W - PAD}" y2="${baseY}" stroke="${mutedOn(bg)}" stroke-width="2"/>`
  );
  const peak = values && values.length ? Math.max(...values) : 0;
  for (let i = 0; i < bars; i++) {
    const t = bars > 1 ? i / (bars - 1) : 0;
    const bh =
      values && peak > 0
        ? Math.round(minBarH + (maxBarH - minBarH) * (values[i] / peak))
        : Math.round(maxBarH - (maxBarH - minBarH) * t);
    const x = PAD + i * (barW + gap);
    const fill = lerpColor(BOLD.amber, BOLD.red, t * 0.8);
    parts.push(topRoundedBar(x, baseY - bh, barW, bh, 6, fill));
  }

  if (barCaption) {
    parts.push(
      `<text x="${PAD}" y="${baseY + 42}" font-family="${FONT.sans}" font-size="18" font-weight="600" fill="${mutedOn(bg)}">${escapeXml(barCaption)}</text>`
    );
  }

  return panel(input, boldWrap(parts.join(""), bg, headingLines.join(" ")));
}

// ------------------------------------------------------------------
// chart — full bar / donut / line renderer in the Bold voice
// ------------------------------------------------------------------

type BoldChart = NonNullable<PanelPlan["chart"]>;

export interface BoldChartInput extends Common {
  bg: BoldBgLike;
  headingLines: string[];
  chart: BoldChart;
}

/** Two ramp endpoints that both stay legible on the given field. */
function chartRamp(bg: BoldBgLike): [string, string] {
  switch (bg) {
    case "ink":
      return [BOLD.amber, BOLD.red];
    case "red":
      return [BOLD.amber, BOLD.white];
    case "amber":
      return [BOLD.red, BOLD.ink];
    default: // paper
      return [BOLD.red, BOLD.ink];
  }
}

/** Up-to-three distinct series colours for a multi-series line, per field. */
function lineColorsFor(bg: BoldBgLike): string[] {
  const [c0, c1] = chartRamp(bg);
  return [c1, c0, lerpColor(c0, c1, 0.5)];
}

/** Format a value for a compact axis/legend label. */
function fmtNum(v: number, unit?: string | null): string {
  const n = Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);
  return unit ? `${n}${unit}` : n;
}

/** Truncate to roughly `width` px at `size` (Bold caps ≈0.58 ratio). */
function truncateToWidth(text: string, width: number, size: number): string {
  const max = Math.max(1, Math.floor(width / (size * 0.58)));
  return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1))}…`;
}

/**
 * Wrap the FULL heading to fit both the width and a vertical budget, then
 * paint it. Returns the y just below the block. Wrapping the whole string
 * (rather than slicing pre-split lines) means a long heading shrinks a step
 * instead of dropping its trailing words.
 */
function pushBoldChartHeading(
  parts: string[],
  heading: string,
  bg: BoldBgLike
): number {
  const { lines, size } = fitDisplayLines(heading, {
    width: CONTENT_W,
    maxHeight: 150,
    maxSize: 40,
    minSize: 22,
    lineStep: 1.05,
  });
  const step = Math.round(size * 1.05);
  let y = 116;
  for (const line of lines) {
    parts.push(displayLine(line, PAD, y, size, fgOn(bg), { weight: 800 }));
    y += step;
  }
  return y;
}

/** Annular sector (donut slice) path from angle a0→a1 (radians). */
function annularSector(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  a0: number,
  a1: number,
  fill: string
): string {
  const pt = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const d = `M${pt(rOuter, a0)} A${rOuter} ${rOuter} 0 ${large} 1 ${pt(rOuter, a1)} L${pt(rInner, a1)} A${rInner} ${rInner} 0 ${large} 0 ${pt(rInner, a0)} Z`;
  return `<path d="${d}" fill="${fill}"/>`;
}

function renderBoldBarChart(input: BoldChartInput): RenderedPanel {
  const { bg, headingLines, chart } = input;
  const points = chart.series[0]?.points ?? [];
  if (points.length === 0) return renderBoldFallback(input);
  const parts: string[] = [topAccent(bg)];
  const headBottom = pushBoldChartHeading(parts, input.heading ?? headingLines.join(" "), bg);
  const [c0, c1] = chartRamp(bg);
  const n = points.length;
  const baseY = 566;
  const topY = Math.max(headBottom + 44, 300);
  const gap = n > 8 ? 10 : 18;
  const barW = (CONTENT_W - gap * (n - 1)) / n;
  const peak = Math.max(...points.map((p) => p.value), 0) || 1;
  const maxBarH = baseY - topY;
  parts.push(
    `<line x1="${PAD}" y1="${baseY}" x2="${W - PAD}" y2="${baseY}" stroke="${mutedOn(bg)}" stroke-width="2"/>`
  );
  const vSize = Math.min(17, Math.max(11, Math.round(barW * 0.4)));
  const lSize = Math.min(15, Math.max(10, Math.round(barW * 0.32)));
  points.forEach((p, i) => {
    const bh = Math.max(6, Math.round((Math.max(0, p.value) / peak) * maxBarH));
    const x = PAD + i * (barW + gap);
    const cx = x + barW / 2;
    const t = n > 1 ? i / (n - 1) : 0;
    parts.push(topRoundedBar(x, baseY - bh, barW, bh, 6, lerpColor(c0, c1, t)));
    parts.push(
      `<text x="${cx}" y="${baseY - bh - 10}" font-family="${FONT.sans}" font-size="${vSize}" font-weight="800" text-anchor="middle" fill="${fgOn(bg)}">${escapeXml(fmtNum(p.value, chart.unit))}</text>`
    );
    parts.push(
      `<text x="${cx}" y="${baseY + 26}" font-family="${FONT.sans}" font-size="${lSize}" font-weight="600" text-anchor="middle" fill="${mutedOn(bg)}">${escapeXml(truncateToWidth(p.label, barW + gap, lSize))}</text>`
    );
  });
  return panel(input, boldWrap(parts.join(""), bg, headingLines.join(" ")));
}

function renderBoldDonut(input: BoldChartInput): RenderedPanel {
  const { bg, headingLines, chart } = input;
  const points = (chart.series[0]?.points ?? []).filter((p) => p.value > 0);
  if (points.length === 0) return renderBoldFallback(input);
  const parts: string[] = [topAccent(bg)];
  pushBoldChartHeading(parts, input.heading ?? headingLines.join(" "), bg);
  const [c0, c1] = chartRamp(bg);
  const total = points.reduce((s, p) => s + p.value, 0) || 1;
  const cx = 206;
  const cy = 424;
  const rOuter = 130;
  const rInner = 78;
  let a = -Math.PI / 2;
  points.forEach((p, i) => {
    const frac = p.value / total;
    const a1 = a + frac * Math.PI * 2;
    const t = points.length > 1 ? i / (points.length - 1) : 0;
    // A hair of gap between slices reads cleaner on the loud fields.
    parts.push(annularSector(cx, cy, rOuter, rInner, a + 0.012, a1 - 0.012, lerpColor(c0, c1, t)));
    a = a1;
  });
  parts.push(
    `<text x="${cx}" y="${cy - 6}" font-family="${FONT.sans}" font-size="46" font-weight="800" text-anchor="middle" fill="${fgOn(bg)}">${points.length}</text>`,
    `<text x="${cx}" y="${cy + 24}" font-family="${FONT.sans}" font-size="15" font-weight="700" letter-spacing="0.14em" text-anchor="middle" fill="${mutedOn(bg)}">PARTS</text>`
  );
  // Legend on the right — long category names fit here (unlike under bars).
  const lx = 372;
  const legendW = W - PAD - lx;
  const rows = points.slice(0, 6);
  const rowH = Math.min(48, Math.round(240 / rows.length));
  let ly = cy - (rows.length * rowH) / 2 + rowH / 2;
  rows.forEach((p, i) => {
    const t = points.length > 1 ? i / (points.length - 1) : 0;
    const col = lerpColor(c0, c1, t);
    const pct = Math.round((p.value / total) * 100);
    parts.push(`<rect x="${lx}" y="${ly - 13}" width="16" height="16" rx="3" fill="${col}"/>`);
    parts.push(
      `<text x="${lx + 26}" y="${ly}" font-family="${FONT.sans}" font-size="17" font-weight="700" fill="${fgOn(bg)}">${escapeXml(truncateToWidth(p.label, legendW - 84, 17))}</text>`
    );
    parts.push(
      `<text x="${W - PAD}" y="${ly}" font-family="${FONT.sans}" font-size="17" font-weight="800" text-anchor="end" fill="${mutedOn(bg)}">${escapeXml(fmtNum(p.value, chart.unit))}</text>`
    );
    ly += rowH;
  });
  return panel(input, boldWrap(parts.join(""), bg, headingLines.join(" ")));
}

function renderBoldLine(input: BoldChartInput): RenderedPanel {
  const { bg, headingLines, chart } = input;
  const series = chart.series.filter((s) => s.points.length > 0);
  const base = series[0]?.points ?? [];
  if (base.length < 2) return renderBoldBarChart(input);
  const parts: string[] = [topAccent(bg)];
  const headBottom = pushBoldChartHeading(parts, input.heading ?? headingLines.join(" "), bg);
  const cols = lineColorsFor(bg);
  const named = series.length > 1 && series.some((s) => s.name);
  const allVals = series.flatMap((s) => s.points.map((p) => p.value));
  const peak = Math.max(...allVals);
  const floor = Math.min(...allVals, 0);
  const span = peak - floor || 1;
  const left = PAD;
  const right = W - PAD;
  const topY = Math.max(headBottom + (named ? 64 : 40), 300);
  const botY = 560;
  const xAt = (i: number) => (base.length > 1 ? left + (right - left) * (i / (base.length - 1)) : left);
  const yAt = (v: number) => botY - ((v - floor) / span) * (botY - topY);
  parts.push(
    `<line x1="${left}" y1="${botY}" x2="${right}" y2="${botY}" stroke="${mutedOn(bg)}" stroke-width="2"/>`
  );
  series.forEach((s, si) => {
    const col = cols[si % cols.length];
    const pts = s.points.map((p, i) => `${xAt(i).toFixed(1)},${yAt(p.value).toFixed(1)}`).join(" ");
    parts.push(
      `<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>`
    );
    s.points.forEach((p, i) =>
      parts.push(`<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(p.value).toFixed(1)}" r="6" fill="${col}"/>`)
    );
  });
  // X labels: all if few, else first + last to avoid collisions.
  const showAll = base.length <= 6;
  base.forEach((p, i) => {
    if (!showAll && i !== 0 && i !== base.length - 1) return;
    const anchor = i === 0 ? "start" : i === base.length - 1 ? "end" : "middle";
    parts.push(
      `<text x="${xAt(i).toFixed(1)}" y="${botY + 26}" font-family="${FONT.sans}" font-size="14" font-weight="600" text-anchor="${anchor}" fill="${mutedOn(bg)}">${escapeXml(truncateToWidth(p.label, 100, 14))}</text>`
    );
  });
  // Legend for named multi-series, just under the heading.
  if (named) {
    let lx = PAD;
    const ly = topY - 26;
    series.forEach((s, si) => {
      const col = cols[si % cols.length];
      const label = (s.name ?? `Series ${si + 1}`).toUpperCase();
      parts.push(`<rect x="${lx}" y="${ly - 12}" width="22" height="8" rx="2" fill="${col}"/>`);
      parts.push(
        `<text x="${lx + 30}" y="${ly}" font-family="${FONT.sans}" font-size="14" font-weight="700" letter-spacing="0.04em" fill="${fgOn(bg)}">${escapeXml(label)}</text>`
      );
      lx += 30 + label.length * 8 + 34;
    });
  }
  return panel(input, boldWrap(parts.join(""), bg, headingLines.join(" ")));
}

/** Data-free fallback — keep the heading as a statement rather than blank. */
function renderBoldFallback(input: BoldChartInput): RenderedPanel {
  const { bg, headingLines } = input;
  return renderBoldStatement({
    sectionId: input.sectionId,
    heading: input.heading,
    caption: input.caption,
    bg,
    lines: headingLines.map((t, i) => ({ text: t, color: i === headingLines.length - 1 ? "red" : "fg" })),
  });
}

export function renderBoldChart(input: BoldChartInput): RenderedPanel {
  if (input.chart.kind === "donut") return renderBoldDonut(input);
  if (input.chart.kind === "line") return renderBoldLine(input);
  return renderBoldBarChart(input);
}

// ------------------------------------------------------------------
// list — amber kicker + numbered red items
// ------------------------------------------------------------------

export interface BoldListInput extends Common {
  bg: BoldBgLike;
  kicker: string;
  items: string[];
}

export function renderBoldList(input: BoldListInput): RenderedPanel {
  const { bg, kicker, items } = input;
  const fg = fgOn(bg);
  // Accent stays legible on every field: brand red on ink/paper/amber,
  // amber on the red field (where red would vanish). The second kicker
  // token uses the plain foreground so it reads on amber/paper too.
  const accent = bg === "red" ? BOLD.amber : BOLD.red;
  const parts: string[] = [topAccent(bg)];

  // Kicker: first token accent, remainder foreground ("3 FIXES").
  // One <text> with two <tspan>s so word spacing is the font's job, not
  // a char-width guess (which used to collide multi-letter first tokens).
  const [first, ...rest] = kicker.toUpperCase().split(" ");
  const kSize = 38;
  const kY = 210;
  const restSpan = rest.length
    ? `<tspan fill="${fg}"> ${escapeXml(rest.join(" "))}</tspan>`
    : "";
  parts.push(
    `<text x="${PAD}" y="${kY}" font-family="${FONT.sans}" font-size="${kSize}" font-weight="800" letter-spacing="-0.02em"><tspan fill="${accent}">${escapeXml(first)}</tspan>${restSpan}</text>`
  );

  const n = items.length;
  const startY = 300;
  const step = Math.min(86, Math.floor((H - 120 - startY) / Math.max(n - 1, 1)));
  items.forEach((text, i) => {
    const y = startY + i * step;
    parts.push(displayLine(String(i + 1), PAD, y, 42, accent, { weight: 800 }));
    parts.push(
      `<text x="${PAD + 56}" y="${y}" font-family="${FONT.sans}" font-size="24" font-weight="600" fill="${fg}">${escapeXml(text)}</text>`
    );
  });

  return panel(input, boldWrap(parts.join(""), bg, kicker));
}

// ------------------------------------------------------------------
// outro — share CTA + wordmark
// ------------------------------------------------------------------

export interface BoldOutroInput extends Common {
  bg: BoldBgLike;
  lines: string[];
  brand: string;
  sub?: string;
}

export function renderBoldOutro(input: BoldOutroInput): RenderedPanel {
  const { bg, lines, brand, sub } = input;
  const fg = fgOn(bg);
  const parts: string[] = [topAccent(bg)];

  const size = uniformSize(lines, { width: CONTENT_W, maxSize: 92, minSize: 48 });
  const step = Math.round(size * 1.0);
  const firstBaseline = 240;
  lines.forEach((l, i) => {
    parts.push(displayLine(l, PAD, firstBaseline + i * step, size, fg, { weight: 800 }));
  });
  const blockBottom = firstBaseline + (lines.length - 1) * step;

  // Amber underline accent.
  parts.push(
    `<rect x="${PAD}" y="${blockBottom + 34}" width="100" height="9" fill="${BOLD.amber}"/>`
  );

  // Wordmark with a leading dot.
  const brandY = blockBottom + 110;
  parts.push(
    `<circle cx="${PAD + 7}" cy="${brandY - 8}" r="7" fill="${fg}"/>` +
      `<text x="${PAD + 26}" y="${brandY}" font-family="${FONT.sans}" font-size="27" font-weight="700" fill="${fg}">${escapeXml(brand)}</text>`
  );

  if (sub) {
    const subSize = 16;
    const subStep = Math.round(subSize * 1.35);
    // Wrap to the content width and clamp to 2 lines so a full-sentence
    // caption stacks under the wordmark instead of running off the panel.
    const wrapped = wrapToWidth(sub, CONTENT_W, subSize, "sans");
    const subLines = wrapped.slice(0, 2);
    if (wrapped.length > subLines.length) {
      subLines[subLines.length - 1] =
        subLines[subLines.length - 1].replace(/[.,;:\s]+$/, "") + "…";
    }
    const tspans = subLines
      .map(
        (ln, i) =>
          `<tspan x="${PAD}" dy="${i === 0 ? 0 : subStep}">${escapeXml(ln)}</tspan>`
      )
      .join("");
    parts.push(
      `<text x="${PAD}" y="${brandY + 34}" font-family="${FONT.sans}" font-size="${subSize}" font-weight="500" fill="${mutedOn(bg)}">${tspans}</text>`
    );
  }

  return panel(input, boldWrap(parts.join(""), bg, lines.join(" ")));
}

// ------------------------------------------------------------------
// renderBoldPanel — deck-level dispatcher
//
// The Bold style re-skins the WHOLE deck so every slide stays in the
// same loud voice. This maps any PanelPlan onto one of the five
// archetypes (with a generic statement fallback) and rotates the
// background field by slide index so the deck reads as one set.
// ------------------------------------------------------------------

export interface BoldPanelCtx {
  /** Section heading from the outline; the human-readable panel title. */
  heading: string;
  /** Optional supporting caption. */
  caption?: string;
  /** 0-based slide index, used for background rotation. */
  slide?: number;
  /** Total slides; lets us treat the final slide as an outro. */
  total?: number;
  /** Brand wordmark for the outro slide. */
  brand?: string;
}

const BG_ROTATION: BoldBgLike[] = [
  "ink",
  "paper",
  "red",
  "ink",
  "amber",
  "paper",
  "ink",
  "red",
];

function bgForSlide(slide: number): BoldBgLike {
  return BG_ROTATION[((slide % BG_ROTATION.length) + BG_ROTATION.length) % BG_ROTATION.length];
}

/** Split a sentence into a few short stacked display lines (~14 chars). */
function statementLines(
  text: string,
  maxChars = 14
): Array<{ text: string; color?: "fg" | "red" | "amber" | "white" }> {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  // Cap at 6 lines so the type never shrinks past readable; merge overflow.
  while (lines.length > 6) {
    const tail = lines.pop()!;
    lines[lines.length - 1] = `${lines[lines.length - 1]} ${tail}`;
  }
  return lines.map((t, i) => ({
    text: t,
    color: i === lines.length - 1 ? "red" : "fg",
  }));
}

/** Pull a leading number off a stat string: "23 min" -> {value:"23", unit:"min"}. */
function parseStat(raw: string): { value: string; unit?: string } {
  // The magnitude/percent suffix only counts as part of the value when
  // it's glued to the digits (no space) — "40%", "3.2×", "1.5k". A space
  // means the rest is the unit word: "23 min" -> value "23", unit "min".
  const m = raw.trim().match(/^([£$€]?[\d.,]+[%×xKkMmBb]?)\s*(.*)$/);
  if (m) {
    const value = m[1].trim();
    const unit = m[2].trim();
    return { value, unit: unit || undefined };
  }
  return { value: raw.trim() };
}

export function renderBoldPanel(plan: PanelPlan, ctx: BoldPanelCtx): RenderedPanel {
  const slide = ctx.slide ?? 0;
  const bg = bgForSlide(slide);
  const common: Common = {
    sectionId: plan.sectionId,
    heading: ctx.heading,
    caption: ctx.caption,
  };
  const isLast = ctx.total != null && slide === ctx.total - 1;

  // Final slide -> outro CTA.
  if (isLast) {
    return renderBoldOutro({
      ...common,
      bg,
      lines: statementLines(ctx.heading || "Share this.", 9).map((l) => l.text),
      brand: ctx.brand ?? "Readopp",
      sub: ctx.caption,
    });
  }

  switch (plan.visualType) {
    case "stat_callout": {
      if (plan.stat) {
        const { value, unit } = parseStat(plan.stat.value);
        return renderBoldStat({
          ...common,
          bg,
          value,
          unit,
          lines: statementLines(plan.stat.label, 16).map((l) => l.text),
        });
      }
      break;
    }
    case "chart": {
      if (plan.chart?.series[0]?.points.length) {
        return renderBoldChart({
          ...common,
          bg,
          headingLines: statementLines(ctx.heading, 12).map((l) => l.text),
          chart: plan.chart,
        });
      }
      break;
    }
    case "framework": {
      if (plan.framework?.steps.length) {
        return renderBoldList({
          ...common,
          bg,
          kicker: plan.framework.label ?? `${plan.framework.steps.length} steps`,
          items: plan.framework.steps.map((s) => s.name),
        });
      }
      break;
    }
    case "key_findings": {
      if (plan.keyFindings?.findings.length) {
        return renderBoldList({
          ...common,
          bg,
          kicker: plan.keyFindings.label ?? `${plan.keyFindings.findings.length} findings`,
          items: plan.keyFindings.findings.map((f) => f.title),
        });
      }
      break;
    }
    case "insight": {
      if (plan.insight) {
        return renderBoldStatement({
          ...common,
          bg,
          kicker: plan.insight.kicker ?? undefined,
          lines: [{ text: plan.insight.text }],
          sub: plan.insight.attribution ?? undefined,
        });
      }
      break;
    }
    case "quote_card": {
      if (plan.quoteCard) {
        return renderBoldStatement({
          ...common,
          bg,
          lines: [{ text: plan.quoteCard.text }],
          sub: plan.quoteCard.attribution ?? undefined,
        });
      }
      break;
    }
  }

  // Generic fallback: stack the heading as a loud statement.
  return renderBoldStatement({
    ...common,
    bg,
    lines: [{ text: ctx.heading || plan.caption || "Readopp" }],
    sub: ctx.caption,
  });
}
