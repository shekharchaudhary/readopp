/**
 * Clean design system — the "editorial diagram" carousel family.
 *
 * The third sibling alongside panelChrome (calm editorial) and boldChrome
 * (loud full-bleed). Clean is a quiet, technical look: a warm off-white
 * field, a thin blue top accent, mono eyebrow labels, a regular-weight
 * sans heading (NOT the heavy uppercase of Bold), and blue line-art
 * diagram primitives — dots on an axis, sawtooth charts, proportion bars,
 * numbered rings. Near-black prose, grey supporting copy.
 *
 * Square 680×680 to match a LinkedIn carousel slide. Pure-string SVG.
 */

import { escapeXml } from "./panelChrome";
import { FONT } from "./typography";

// Clean palette — a quiet technical look. The blue is deepened a touch
// from the original primary #1B5FA8 to a more editorial slate so it
// reads sophisticated rather than corporate-SaaS, while staying the
// signature cool accent that distinguishes Clean from the warm
// editorial/bold decks.
export const CLEAN = {
  paper: "#FAFAF7",
  card: "#FFFFFF",
  ink: "#1A1A1A",
  blue: "#215681",
  blueDeep: "#1A466B",
  fill: "#EAF1F7",
  muted: "#9AA0A6",
  hairline: "#E4E2DB",
  border: "#D8D6CE",
  axis: "#C9D3DF",
} as const;

// Soft drop shadow so cards/boxes lift off the paper with depth instead
// of reading as flat wireframe rects. Defined once per panel in
// cleanWrap's <defs>; reference it via SHADOW_ATTR on any shape.
const CLEAN_SHADOW_ID = "cleanCardShadow";
const CLEAN_SHADOW_DEF = `<filter id="${CLEAN_SHADOW_ID}" x="-15%" y="-15%" width="130%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="#1B2A3A" flood-opacity="0.10"/></filter>`;
export const SHADOW_ATTR = `filter="url(#${CLEAN_SHADOW_ID})"`;

export const CLEAN_GRID = {
  W: 680,
  H: 680,
  PAD: 64,
  get CONTENT_W() {
    return this.W - 2 * this.PAD;
  },
} as const;

/** Outer square <svg> on the warm paper field. */
export function cleanWrap(body: string, title: string): string {
  const { W, H } = CLEAN_GRID;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img"><title>${escapeXml(
    title
  )}</title><defs>${CLEAN_SHADOW_DEF}</defs><rect width="${W}" height="${H}" fill="${CLEAN.paper}"/>${body}</svg>`;
}

/** Thin blue accent bar at top-left + a faint full-width hairline. */
export function topAccent(): string {
  const { PAD, W } = CLEAN_GRID;
  return (
    `<rect x="${PAD}" y="34" width="56" height="4" rx="2" fill="${CLEAN.blue}"/>` +
    `<line x1="${PAD}" y1="40" x2="${W - PAD}" y2="40" stroke="${CLEAN.hairline}" stroke-width="1"/>`
  );
}

/** Bordered white card inset (used by the cover panel). */
export function cardFrame(): string {
  const { W, H } = CLEAN_GRID;
  const m = 28;
  return `<rect x="${m}" y="${m}" width="${W - 2 * m}" height="${H - 2 * m}" rx="14" fill="${CLEAN.card}" stroke="${CLEAN.border}" stroke-width="1.5" ${SHADOW_ATTR}/>`;
}

/** Small tracked uppercase mono eyebrow, blue. "PANEL 02 · THE PATTERN". */
export function kicker(text: string, x: number, y: number, size = 13): string {
  return `<text x="${x}" y="${y}" font-family="${FONT.mono}" font-size="${size}" font-weight="500" letter-spacing="0.14em" fill="${CLEAN.blue}">${escapeXml(
    text.toUpperCase()
  )}</text>`;
}

/** Mono footer/attribution, grey, tracked. */
export function metaLine(
  text: string,
  x: number,
  y: number,
  opts: { anchor?: "start" | "middle" | "end"; color?: string; size?: number } = {}
): string {
  const anchor = opts.anchor ?? "start";
  const color = opts.color ?? CLEAN.muted;
  const size = opts.size ?? 12;
  return `<text x="${x}" y="${y}" font-family="${FONT.mono}" font-size="${size}" font-weight="500" letter-spacing="0.12em" text-anchor="${anchor}" fill="${color}">${escapeXml(
    text.toUpperCase()
  )}</text>`;
}

/** Grey/ink sans supporting copy line. */
export function bodyLine(
  text: string,
  x: number,
  y: number,
  opts: {
    anchor?: "start" | "middle" | "end";
    color?: string;
    size?: number;
    weight?: number;
  } = {}
): string {
  const anchor = opts.anchor ?? "start";
  const color = opts.color ?? CLEAN.muted;
  const size = opts.size ?? 17;
  const weight = opts.weight ?? 400;
  return `<text x="${x}" y="${y}" font-family="${FONT.sans}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${color}">${escapeXml(
    text
  )}</text>`;
}

/**
 * A heading segment with an optional colour. The heading renders as a
 * single regular-weight sans line built from one or more <tspan>s, so an
 * inline highlight ("Up to {40%} of focused time") stays on the baseline
 * without manual width math.
 */
export interface HeadingSegment {
  text: string;
  color?: string;
}

/**
 * Render a possibly-multi-line heading. Each entry in `lines` is a list
 * of coloured segments. `x`/`y` is the baseline of the first line.
 * Returns the SVG plus the baseline y of the LAST line so callers can
 * place the diagram below it.
 */
export function headingBlock(
  lines: HeadingSegment[][],
  x: number,
  y: number,
  opts: { size?: number; weight?: number; step?: number } = {}
): { svg: string; lastBaseline: number } {
  const size = opts.size ?? 30;
  const weight = opts.weight ?? 600;
  const step = opts.step ?? Math.round(size * 1.28);
  const parts: string[] = [];
  lines.forEach((segs, i) => {
    const baseline = y + i * step;
    const spans = segs
      .map(
        (s) =>
          `<tspan fill="${s.color ?? CLEAN.ink}">${escapeXml(s.text)}</tspan>`
      )
      .join("");
    parts.push(
      `<text x="${x}" y="${baseline}" font-family="${FONT.sans}" font-size="${size}" font-weight="${weight}" letter-spacing="-0.01em">${spans}</text>`
    );
  });
  return {
    svg: parts.join(""),
    lastBaseline: y + (lines.length - 1) * step,
  };
}

export { escapeXml };
