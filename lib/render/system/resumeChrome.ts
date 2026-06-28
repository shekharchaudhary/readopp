/**
 * Résumé design system — the structured, professional carousel family used
 * when the source document is a resume/CV (genre === "resume").
 *
 * Where the editorial/bold/clean families re-skin an article into a deck,
 * this family draws a *resume* directly from a structured `ResumeDoc`:
 * a colour header band, tracked section kickers, dated experience entries,
 * grouped skill bars, education, and a closing contact card — the "Canva
 * resume" visual language, one section per square slide.
 *
 * Like the rest of the render layer this emits pure-string SVG (no DOM).
 * Slides are 680×680 to match a LinkedIn carousel.
 */

import { escapeXml } from "./panelChrome";
import { FONT, fitText, measureText, wrapToWidth } from "./typography";

// Warm, professional palette — ivory paper, near-black ink, bronze accent,
// and a deep warm sidebar tone for full-bleed bands. No green (brand rule).
export const RESUME = {
  ink: "#1F1B16",
  inkSoft: "#3C362E",
  inkMuted: "#7A7163",
  paper: "#FAF8F3",
  panel: "#FFFFFF",
  band: "#221E18", // warm near-black header band
  bandText: "#F4EFE6",
  bandMuted: "#B7AD9C",
  bronze: "#B07A3C",
  bronzeSoft: "#ECDFCC",
  bronzeDeep: "#8A5C28",
  line: "#E6E1D6",
  lineOnDark: "rgba(255,255,255,0.16)",
} as const;

export const R_GRID = {
  W: 680,
  H: 680,
  PAD: 56,
  get CONTENT_W() {
    return this.W - 2 * this.PAD;
  },
} as const;

/** Outer square <svg> over the ivory paper field (or a custom bg). */
export function resumeWrap(
  body: string,
  opts: { bg?: string; title?: string } = {}
): string {
  const { W, H } = R_GRID;
  const bg = opts.bg ?? RESUME.paper;
  const title = opts.title ?? "Résumé";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" font-family="${FONT.sans}"><title>${escapeXml(
    title
  )}</title><rect width="${W}" height="${H}" fill="${bg}"/>${body}</svg>`;
}

/**
 * Top-of-slide section header: a short bronze accent bar, a tracked
 * uppercase kicker, and the section title. Returns the SVG plus the
 * `bottom` y-coordinate where body content can safely begin.
 */
export function sectionHeader(opts: {
  kicker: string;
  title: string;
}): { svg: string; bottom: number } {
  const { PAD } = R_GRID;
  const barY = PAD;
  const kickerY = PAD + 30;
  const titleY = PAD + 60;
  const svg = `
    <rect x="${PAD}" y="${barY}" width="48" height="6" rx="3" fill="${RESUME.bronze}"/>
    <text x="${PAD}" y="${kickerY}" font-size="13" font-weight="600" letter-spacing="0.18em" fill="${RESUME.inkMuted}">${escapeXml(
      opts.kicker.toUpperCase()
    )}</text>
    <text x="${PAD}" y="${titleY}" font-size="30" font-weight="600" letter-spacing="-0.01em" fill="${RESUME.ink}">${escapeXml(
      opts.title
    )}</text>
  `;
  return { svg, bottom: titleY + 28 };
}

/** Hairline + name (left) and slide counter (right) at the foot of a slide. */
export function footerBlock(opts: {
  name: string;
  index: number;
  total: number;
  onDark?: boolean;
}): string {
  const { PAD, W, H } = R_GRID;
  const y = H - 40;
  const fg = opts.onDark ? RESUME.bandMuted : RESUME.inkMuted;
  const lineColor = opts.onDark ? RESUME.lineOnDark : RESUME.line;
  const counter = `${String(opts.index).padStart(2, "0")} / ${String(
    opts.total
  ).padStart(2, "0")}`;
  return `
    <line x1="${PAD}" y1="${y - 16}" x2="${W - PAD}" y2="${y - 16}" stroke="${lineColor}" stroke-width="1"/>
    <text x="${PAD}" y="${y}" font-size="12" font-weight="600" letter-spacing="0.06em" fill="${fg}">${escapeXml(
      opts.name
    )}</text>
    <text x="${W - PAD}" y="${y}" font-size="12" font-weight="600" letter-spacing="0.08em" fill="${fg}" text-anchor="end">${escapeXml(
      counter
    )}</text>
  `;
}

const LEVEL_FRACTION: Record<"expert" | "strong" | "familiar", number> = {
  expert: 1,
  strong: 0.72,
  familiar: 0.45,
};

/**
 * A labelled skill row: the skill name with a thin progress track beneath.
 * When `level` is absent the track is omitted (just the name as a chip-less
 * line) so undated skill lists don't fake a proficiency they didn't claim.
 */
export function skillRow(opts: {
  x: number;
  y: number;
  width: number;
  name: string;
  level?: "expert" | "strong" | "familiar" | null;
}): string {
  const { x, y, width, name } = opts;
  const label = `<text x="${x}" y="${y}" font-size="15" font-weight="500" fill="${RESUME.inkSoft}">${escapeXml(
    name
  )}</text>`;
  if (!opts.level) return label;
  const trackY = y + 10;
  const frac = LEVEL_FRACTION[opts.level];
  return `
    ${label}
    <rect x="${x}" y="${trackY}" width="${width}" height="5" rx="2.5" fill="${RESUME.bronzeSoft}"/>
    <rect x="${x}" y="${trackY}" width="${(width * frac).toFixed(1)}" height="5" rx="2.5" fill="${RESUME.bronze}"/>
  `;
}

export { escapeXml, FONT, fitText, measureText, wrapToWidth };
