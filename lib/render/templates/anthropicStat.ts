import type { RenderedPanel } from "../../shared/schemas";
import {
  COLOR,
  GRID,
  footerBlock,
  headingBlock,
  svgWrap,
  escapeXml as esc,
} from "../system/panelChrome";
import { FONT, TYPE, fitText } from "../system/typography";

/**
 * "Anthropic-style" stat callout — built from plan data, no model call.
 *
 * Editorial single-number panel: kicker, big heading, hand-drawn rule
 * accent, serif hero number, supporting label, body caption, source
 * footer. Designed to match the Anthropic / NYT brand feel (ivory
 * paper, clay accent, generous whitespace).
 *
 * Phase 2E.1 refactor against the design system primitives:
 *  - Headings use the type scale (was 14px — same as body, no hierarchy).
 *  - All text fits via fitText (was: silent wrap to N lines × M chars).
 *  - Hero number + supporting label sit in a dedicated centred block
 *    with deliberate breathing room (was: label collided with number).
 *  - Source line replaced with the shared footerBlock so attribution,
 *    template label, and slide position match the rest of the system.
 *  - Caption auto-fits its width budget instead of dropping mid-sentence.
 *
 * Cost: zero tokens. Replaces an Opus render call for any panel with stat data.
 */

const HERO_NUMBER_SIZE = TYPE.hero.size; // 56

export interface AnthropicStatInput {
  sectionId: string;
  heading: string;
  caption: string;
  stat: { value: string; label: string };
  /** Optional kicker shown above the heading. Defaults to "The figure". */
  kicker?: string;
  /** Source label printed in the footer (e.g. "nytimes.com"). */
  source?: string;
  /** Slide position printed in the footer right corner. */
  slide?: { index: number; total: number };
}

export function renderAnthropicStat(input: AnthropicStatInput): RenderedPanel {
  const { sectionId, heading, caption, stat } = input;
  const kicker = (input.kicker ?? "the figure").toLowerCase();

  // 1. Heading block (kicker + heading).
  const head = headingBlock({
    heading,
    kicker,
    maxLines: 3,
  });

  // 2. Decorative rule under the heading — a short clay tick.
  const ruleY = head.bottomY + 28;

  // 3. Hero block — number centred, label fit-text under, with deliberate
  //    gap (no more visual collision).
  const numberY = ruleY + 40 + HERO_NUMBER_SIZE; // baseline; 40px breathing room
  const labelWidth = GRID.CANVAS_W - GRID.PAD_X * 2;
  const labelFit = fitText(stat.label, {
    width: labelWidth,
    height: 3 * 14 * 1.35,
    minSize: 12,
    maxSize: 16,
    lineHeight: 1.35,
    family: "sans",
  });
  const labelLineStep = Math.round(labelFit.size * 1.35);
  const labelTopY = numberY + 24; // 24px below hero baseline
  const labelBottomY =
    labelTopY + (labelFit.lines.length - 1) * labelLineStep;

  // 4. Squiggle accent + caption block.
  const squiggleY = labelBottomY + 44;
  const captionTopY = squiggleY + 28;
  const captionFit = fitText(caption, {
    width: GRID.CONTENT_W,
    height: 8 * 15 * 1.5,
    minSize: 13,
    maxSize: TYPE.body.size,
    lineHeight: 1.5,
    family: "sans",
  });
  const captionLineStep = Math.round(captionFit.size * 1.5);
  const captionBottomY =
    captionTopY + captionFit.size + (captionFit.lines.length - 1) * captionLineStep;

  // 5. Footer.
  const FOOTER_GAP = 32;
  const footerY = captionBottomY + FOOTER_GAP;
  const foot = footerBlock({
    topY: footerY,
    source: input.source,
    slide: input.slide,
    templateLabel: "anthropic stat",
  });
  const H = Math.round((foot.bottomY + GRID.PAD_BOTTOM) / 4) * 4;

  // ---------- Build SVG body ----------

  const headingSvg = head.svg;

  const ruleSvg = `<line x1="${GRID.CANVAS_W / 2 - 28}" y1="${ruleY}" x2="${GRID.CANVAS_W / 2 + 28}" y2="${ruleY}" stroke="${COLOR.clay}" stroke-width="1.5" stroke-linecap="round"/>`;

  const numberSvg = `<text x="${GRID.CANVAS_W / 2}" y="${numberY}" font-size="${HERO_NUMBER_SIZE}" font-weight="500" fill="${COLOR.ink}" text-anchor="middle" font-family="Georgia, ui-serif, 'Times New Roman', serif" letter-spacing="-0.02em">${esc(stat.value)}</text>`;

  const labelTspans = labelFit.lines
    .map(
      (l, i) =>
        `<tspan x="${GRID.CANVAS_W / 2}" dy="${i === 0 ? 0 : labelLineStep}">${esc(l)}</tspan>`
    )
    .join("");
  const labelSvg = `<text x="${GRID.CANVAS_W / 2}" y="${labelTopY}" font-size="${labelFit.size}" font-weight="400" fill="${COLOR.inkSoft}" text-anchor="middle" font-family="${FONT.sans}">${labelTspans}</text>`;

  // Hand-drawn squiggle — fixed origin under the hero block.
  const squiggleSvg = `<path d="M ${GRID.PAD_X} ${squiggleY} q 18 -7 36 0 t 36 0 t 36 0 t 36 0 t 36 0" fill="none" stroke="${COLOR.clay}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`;

  const captionTspans = captionFit.lines
    .map(
      (l, i) =>
        `<tspan x="${GRID.PAD_X}" dy="${i === 0 ? 0 : captionLineStep}">${esc(l)}</tspan>`
    )
    .join("");
  const captionSvg = `<text x="${GRID.PAD_X}" y="${captionTopY + captionFit.size}" font-size="${captionFit.size}" font-weight="400" fill="${COLOR.ink}" font-family="${FONT.sans}">${captionTspans}</text>`;

  const body =
    headingSvg +
    ruleSvg +
    numberSvg +
    labelSvg +
    squiggleSvg +
    captionSvg +
    foot.svg;

  const svg = svgWrap(body, {
    height: H,
    title: heading,
    desc: `${stat.value} — ${stat.label}`,
  });

  return {
    sectionId,
    heading,
    caption,
    format: "svg",
    content: svg,
    validated: true,
    fallback: false,
    edited: false,
  };
}
