/**
 * Reusable editorial chrome — headings, kickers, footers, dividers.
 *
 * Tier C templates (flowchart, structural, timeline, metaphor) used to
 * render no heading inside the SVG and no source footer. Tier A
 * templates (quote_card, key_findings, definition_card) inlined their
 * own heading + footer patterns. This module formalises those patterns
 * so every template — Tier A through C — emits a consistent panel
 * envelope.
 *
 * All helpers return SVG fragment strings the template concatenates
 * into its body. No DOM, no React; the pipeline is server-rendered
 * pure-string SVG end-to-end.
 */

import { GRID } from "./grid";
import { FONT, TYPE, fitText, wrapToWidth } from "./typography";

// Editorial palette — pinned constants because tailwind tokens don't
// exist in pure-string SVG output. Mirrors the brand vars in globals.css.
export const COLOR = {
  paper: "#FAF9F5",
  ink: "#1A1A1A",
  inkSoft: "#4E463C",
  inkMuted: "#7A6F62",
  inkFaint: "#A89E8E",
  rule: "#D6CFC2",
  clay: "#C7613D",
} as const;

// ---------- Escape ----------

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ---------- Heading block ----------

export interface HeadingBlockOptions {
  heading: string;
  /** Small all-caps eyebrow above the heading ("the figure",
   *  "definition", "key findings"). Drawn in clay. */
  kicker?: string;
  /** Y of the kicker baseline. Heading sits BLOCK_GAP/2 below it. */
  topY?: number;
  /** Width budget for the heading. Defaults to GRID.CONTENT_W. */
  width?: number;
  /** Maximum lines the heading may wrap to. Beyond this, fitText
   *  shrinks the font and (last resort) ellipsises. Default 3. */
  maxLines?: number;
}

export interface HeadingBlockResult {
  svg: string;
  /** Y position of the LAST baseline drawn — callers anchor the next
   *  block off this so the heading block can grow without overlapping. */
  bottomY: number;
  /** True when fitText had to ellipsise. Templates can decide whether
   *  to surface a "truncated" hint or just accept it. */
  truncated: boolean;
}

export function headingBlock(opts: HeadingBlockOptions): HeadingBlockResult {
  const {
    heading,
    kicker,
    topY = GRID.PAD_TOP,
    width = GRID.CONTENT_W,
    maxLines = 3,
  } = opts;

  const parts: string[] = [];
  let y = topY;

  if (kicker) {
    parts.push(
      `<text x="${GRID.PAD_X}" y="${y}" font-family="${FONT.sans}" font-size="${TYPE.kicker.size}" font-weight="${TYPE.kicker.weight}" fill="${COLOR.clay}" letter-spacing="0.18em">${escapeXml(kicker.toUpperCase())}</text>`
    );
    y += TYPE.kicker.size + 14;
  }

  const fit = fitText(heading, {
    width,
    height: TYPE.heading.size * TYPE.heading.lineHeight * maxLines,
    minSize: TYPE.subheading.size,
    maxSize: TYPE.heading.size,
    lineHeight: TYPE.heading.lineHeight,
    family: "sans",
  });

  // First baseline lands at y + size; subsequent lines stack by
  // size * lineHeight.
  const lineStep = Math.round(fit.size * TYPE.heading.lineHeight);
  const firstBaseline = y + fit.size;
  for (let i = 0; i < fit.lines.length; i++) {
    parts.push(
      `<text x="${GRID.PAD_X}" y="${firstBaseline + i * lineStep}" font-family="${FONT.sans}" font-size="${fit.size}" font-weight="${TYPE.heading.weight}" fill="${COLOR.ink}" letter-spacing="-0.01em">${escapeXml(fit.lines[i])}</text>`
    );
  }
  const bottomY = firstBaseline + (fit.lines.length - 1) * lineStep + 8;

  return { svg: parts.join("\n"), bottomY, truncated: fit.truncated };
}

// ---------- Footer block ----------

export interface FooterBlockOptions {
  /** Y at which the footer rule sits. Footer text is drawn ~20px below. */
  topY: number;
  /** Source domain or filename ("nytimes.com", "paper.pdf"). */
  source?: string;
  /** Optional slide position ("01 / 05"). */
  slide?: { index: number; total: number };
  /** Optional explicit kicker for the template name shown next to the
   *  Readopp wordmark. Defaults to nothing. */
  templateLabel?: string;
}

/**
 * Slim editorial footer: paper-line divider + small attribution line.
 * Layout is left=source · centre=template label · right=slide N/M.
 *
 * Long source labels (e.g. ENGINEERING.NOTES at 0.16em letter-spacing)
 * used to collide with the centre templateLabel, producing run-on text
 * like "READOPPANTHROPIC STAT". We now estimate width and drop the
 * centre label when there's no room — the eyebrow heading at the top
 * of every panel already names the type, so the footer copy is
 * decorative and safe to omit on overflow.
 */
export function footerBlock(opts: FooterBlockOptions): { svg: string; bottomY: number } {
  const { topY, source, slide, templateLabel } = opts;
  const parts: string[] = [];

  // Hairline rule
  parts.push(
    `<line x1="${GRID.PAD_X}" y1="${topY}" x2="${GRID.CANVAS_W - GRID.PAD_X}" y2="${topY}" stroke="${COLOR.rule}" stroke-width="1"/>`
  );

  const textY = topY + 18;
  const left: string[] = [];
  if (source) left.push(source);
  left.push("READOPP");
  const leftText = left.join(" · ").toUpperCase();

  parts.push(
    `<text x="${GRID.PAD_X}" y="${textY}" font-family="${FONT.sans}" font-size="${TYPE.footer.size}" font-weight="${TYPE.footer.weight}" fill="${COLOR.inkMuted}" letter-spacing="0.16em">${escapeXml(leftText)}</text>`
  );

  if (templateLabel) {
    // Width estimate: each char ≈ font-size × 0.62 (caps avg width) +
    // font-size × 0.16 (letter-spacing). Conservative upper bound so
    // we err on the side of dropping the centre label rather than
    // letting it overlap.
    const charW = TYPE.footer.size * 0.78;
    const labelText = templateLabel.toUpperCase();
    const leftWidthPx = leftText.length * charW;
    const labelWidthPx = labelText.length * charW;
    const slideReservePx = slide ? 60 : 0;
    const centreLeft = GRID.CANVAS_W / 2 - labelWidthPx / 2;
    const centreRight = GRID.CANVAS_W / 2 + labelWidthPx / 2;
    const safeFromLeft = centreLeft > GRID.PAD_X + leftWidthPx + 24;
    const safeFromRight =
      centreRight < GRID.CANVAS_W - GRID.PAD_X - slideReservePx - 24;
    if (safeFromLeft && safeFromRight) {
      parts.push(
        `<text x="${GRID.CANVAS_W / 2}" y="${textY}" font-family="${FONT.sans}" font-size="${TYPE.footer.size}" font-weight="${TYPE.footer.weight}" fill="${COLOR.inkFaint}" letter-spacing="0.16em" text-anchor="middle">${escapeXml(labelText)}</text>`
      );
    }
  }

  if (slide) {
    const slideStr = `${String(slide.index).padStart(2, "0")} / ${String(slide.total).padStart(2, "0")}`;
    parts.push(
      `<text x="${GRID.CANVAS_W - GRID.PAD_X}" y="${textY}" font-family="${FONT.sans}" font-size="${TYPE.footer.size}" font-weight="${TYPE.footer.weight}" fill="${COLOR.inkMuted}" letter-spacing="0.16em" text-anchor="end">${escapeXml(slideStr)}</text>`
    );
  }

  return { svg: parts.join("\n"), bottomY: textY + 8 };
}

// ---------- Canvas wrapper ----------

export interface SvgWrapOptions {
  height: number;
  title: string;
  desc?: string;
}

/**
 * Outer <svg> element with the brand paper background. Templates wrap
 * their body content in this so dimensions / metadata are consistent.
 */
export function svgWrap(body: string, opts: SvgWrapOptions): string {
  const desc = opts.desc ? `<desc>${escapeXml(opts.desc)}</desc>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID.CANVAS_W} ${opts.height}" role="img"><title>${escapeXml(opts.title)}</title>${desc}<rect x="0" y="0" width="${GRID.CANVAS_W}" height="${opts.height}" fill="${COLOR.paper}"/>${body}</svg>`;
}

// ---------- Body text helper ----------

export interface BodyTextOptions {
  text: string;
  topY: number;
  width?: number;
  maxLines?: number;
  color?: string;
  size?: number;
}

/**
 * Render a body-text paragraph that auto-fits to the available width
 * and line cap. Returns the SVG + the Y the next block should start at.
 */
export function bodyText(opts: BodyTextOptions): { svg: string; bottomY: number; truncated: boolean } {
  const {
    text,
    topY,
    width = GRID.CONTENT_W,
    maxLines = 6,
    color = COLOR.ink,
    size = TYPE.body.size,
  } = opts;

  const fit = fitText(text, {
    width,
    height: size * TYPE.body.lineHeight * maxLines,
    minSize: TYPE.caption.size,
    maxSize: size,
    lineHeight: TYPE.body.lineHeight,
    family: "sans",
  });

  const lineStep = Math.round(fit.size * TYPE.body.lineHeight);
  const firstBaseline = topY + fit.size;
  const parts: string[] = [];
  for (let i = 0; i < fit.lines.length; i++) {
    parts.push(
      `<text x="${GRID.PAD_X}" y="${firstBaseline + i * lineStep}" font-family="${FONT.sans}" font-size="${fit.size}" font-weight="${TYPE.body.weight}" fill="${color}">${escapeXml(fit.lines[i])}</text>`
    );
  }
  const bottomY = firstBaseline + (fit.lines.length - 1) * lineStep;
  return { svg: parts.join("\n"), bottomY, truncated: fit.truncated };
}

// Re-export for convenience so templates can import everything from here.
export { GRID, TYPE, FONT, fitText, wrapToWidth };
