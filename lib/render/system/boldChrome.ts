/**
 * Bold design system — the "loud, punchy, big-type" carousel family.
 *
 * A sibling to panelChrome (the calm editorial system). Where the
 * editorial chrome is serif on paper with hairline rules, the Bold
 * system is heavy condensed-uppercase sans on full-bleed colour fields
 * (near-black, brand red, amber) with a short accent bar at the top.
 *
 * Panels are square (680×680) to match a LinkedIn carousel slide, and
 * carry no footer — the loud type IS the panel. Like the rest of the
 * render layer this emits pure-string SVG, no DOM.
 */

import { escapeXml } from "./panelChrome";
import { FONT } from "./typography";

// Bold palette — pinned hex pulled from the carousel design source.
export const BOLD = {
  ink: "#1A1A1A",
  red: "#E03131",
  amber: "#FFB400",
  paper: "#FAF9F5",
  white: "#FFFFFF",
  mutedOnLight: "#6B6B6B",
  mutedOnDark: "#A3A3A3",
  hairlineOnPaper: "#E3E1D8",
} as const;

export const BOLD_GRID = {
  W: 680,
  H: 680,
  PAD: 64,
  get CONTENT_W() {
    return this.W - 2 * this.PAD;
  },
} as const;

export type BoldBg = "ink" | "paper" | "red" | "amber";

export function bgFill(bg: BoldBg): string {
  return { ink: BOLD.ink, paper: BOLD.paper, red: BOLD.red, amber: BOLD.amber }[bg];
}

/** Default foreground text colour for a given background. */
export function fgOn(bg: BoldBg): string {
  return bg === "ink" || bg === "red" ? BOLD.white : BOLD.ink;
}

/** Muted/secondary text colour for a given background. */
export function mutedOn(bg: BoldBg): string {
  return bg === "ink" || bg === "red" ? BOLD.mutedOnDark : BOLD.mutedOnLight;
}

/**
 * Short accent bar at top-left + a faint full-width hairline. The bar
 * is brand red on dark/paper/amber fields; on a red field it flips to
 * amber so it stays visible.
 */
export function topAccent(bg: BoldBg): string {
  const { PAD, W } = BOLD_GRID;
  const barColor = bg === "red" ? BOLD.amber : BOLD.red;
  const hairColor =
    bg === "paper"
      ? BOLD.hairlineOnPaper
      : bg === "amber"
        ? "rgba(26,26,26,0.18)"
        : "rgba(255,255,255,0.16)";
  const hair =
    bg === "red"
      ? ""
      : `<line x1="${PAD}" y1="40" x2="${W - PAD}" y2="40" stroke="${hairColor}" stroke-width="1"/>`;
  const bar = `<rect x="${PAD}" y="34" width="64" height="7" fill="${barColor}"/>`;
  return bar + hair;
}

/** Outer square <svg> with the chosen background field. */
export function boldWrap(body: string, bg: BoldBg, title: string): string {
  const { W, H } = BOLD_GRID;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img"><title>${escapeXml(
    title
  )}</title><rect width="${W}" height="${H}" fill="${bgFill(bg)}"/>${body}</svg>`;
}

/**
 * Pick one font size so the WIDEST of `lines` fits `width`. Bold caps
 * are wider than the typography module's sans ratio, so we use a
 * heavier 0.62 char-width estimate and clamp to [minSize, maxSize].
 */
export function uniformSize(
  lines: string[],
  opts: { width: number; maxSize: number; minSize: number; ratio?: number }
): number {
  const ratio = opts.ratio ?? 0.62;
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 1);
  // size at which the widest line just fills `width`: width = chars*size*ratio.
  const fit = Math.floor(opts.width / (longest * ratio));
  return Math.max(opts.minSize, Math.min(opts.maxSize, fit));
}

/** One line of heavy condensed-uppercase display type. */
export function displayLine(
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  opts: { anchor?: "start" | "middle" | "end"; weight?: number } = {}
): string {
  const anchor = opts.anchor ?? "start";
  const weight = opts.weight ?? 800;
  return `<text x="${x}" y="${y}" font-family="${FONT.sans}" font-size="${size}" font-weight="${weight}" letter-spacing="-0.02em" text-anchor="${anchor}" fill="${color}">${escapeXml(
    text.toUpperCase()
  )}</text>`;
}

/** Small tracked uppercase eyebrow. */
export function kickerLine(
  text: string,
  x: number,
  y: number,
  color: string,
  size = 16
): string {
  return `<text x="${x}" y="${y}" font-family="${FONT.sans}" font-size="${size}" font-weight="700" letter-spacing="0.16em" fill="${color}">${escapeXml(
    text.toUpperCase()
  )}</text>`;
}

export { escapeXml };
