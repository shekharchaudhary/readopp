/**
 * Insight callout — single striking sentence in display serif.
 *
 * The "aha moment" panel. One thought, set big and editorial, with a
 * small kicker label above and an optional attribution line below.
 * Built for counter-intuitive reveals, summary takeaways, and the
 * payoff sentence of an essay.
 *
 * Phase 2E.3: built directly against the design-system primitives
 * (panelChrome + typography) so the panel looks like part of the same
 * editorial family as anthropicStat, quote_card, definition_card.
 */

import type { InsightPlan, RenderedPanel } from "../../shared/schemas";
import {
  COLOR,
  GRID,
  footerBlock,
  svgWrap,
  escapeXml as esc,
} from "../system/panelChrome";
import { FONT, fitText } from "../system/typography";

export interface RenderInsightInput {
  sectionId: string;
  heading: string;
  caption: string;
  plan: InsightPlan;
  source?: string;
  slide?: { index: number; total: number };
}

export function renderInsight(input: RenderInsightInput): RenderedPanel {
  const { sectionId, heading, caption, plan } = input;
  const kicker = (plan.kicker ?? "the insight").toLowerCase();

  // ---------- Layout ----------
  let y: number = GRID.PAD_TOP;

  // Kicker
  const kickerY = y;
  y += 24;

  // Hero sentence — display serif. fitText shrinks 36→24 across long
  // insights so the text always feels deliberate, never crammed.
  const insightFit = fitText(plan.text, {
    width: GRID.CONTENT_W,
    height: 5 * 36 * 1.18,
    minSize: 24,
    maxSize: 36,
    lineHeight: 1.18,
    family: "serif",
  });
  const insightLineStep = Math.round(insightFit.size * 1.18);
  const insightTopY = y + insightFit.size;
  const insightBottomY =
    insightTopY + (insightFit.lines.length - 1) * insightLineStep;
  y = insightBottomY + 32;

  // Short clay rule under the sentence (editorial pause).
  const ruleY = y;
  y += 20;

  // Caption — supports the insight with context. fitText keeps it
  // single-paragraph-sized below the hero text.
  const captionFit = fitText(caption || "", {
    width: GRID.CONTENT_W,
    height: 5 * 16 * 1.5,
    minSize: 13,
    maxSize: 16,
    lineHeight: 1.5,
    family: "sans",
  });
  const captionLineStep = Math.round(captionFit.size * 1.5);
  const captionTopY = caption ? y + captionFit.size : y;
  const captionBottomY =
    captionTopY + (captionFit.lines.length - 1) * captionLineStep;
  y = caption ? captionBottomY + 24 : y;

  // Attribution line (em-dash prefix).
  const attributionTopY = plan.attribution ? y + 14 : y;
  y = plan.attribution ? attributionTopY + 20 : y;

  // Footer.
  const FOOTER_GAP = 28;
  const footerY = y + FOOTER_GAP;
  const foot = footerBlock({
    topY: footerY,
    source: input.source,
    slide: input.slide,
    templateLabel: "insight",
  });
  const H = Math.round((foot.bottomY + GRID.PAD_BOTTOM) / 4) * 4;

  // ---------- SVG body ----------

  const kickerSvg = `<text x="${GRID.PAD_X}" y="${kickerY}" font-family="${FONT.sans}" font-size="11" font-weight="500" fill="${COLOR.clay}" letter-spacing="0.18em">${esc(kicker.toUpperCase())}</text>`;

  const insightTspans = insightFit.lines
    .map(
      (l, i) =>
        `<tspan x="${GRID.PAD_X}" dy="${i === 0 ? 0 : insightLineStep}">${esc(l)}</tspan>`
    )
    .join("");
  const insightSvg = `<text x="${GRID.PAD_X}" y="${insightTopY}" font-family="${FONT.serif}" font-size="${insightFit.size}" font-weight="500" fill="${COLOR.ink}" letter-spacing="-0.015em">${insightTspans}</text>`;

  const ruleSvg = `<line x1="${GRID.PAD_X}" y1="${ruleY}" x2="${GRID.PAD_X + 56}" y2="${ruleY}" stroke="${COLOR.clay}" stroke-width="2" stroke-linecap="round"/>`;

  const captionSvg = caption
    ? `<text x="${GRID.PAD_X}" y="${captionTopY}" font-family="${FONT.sans}" font-size="${captionFit.size}" font-weight="400" fill="${COLOR.inkSoft}">${captionFit.lines
        .map(
          (l, i) =>
            `<tspan x="${GRID.PAD_X}" dy="${i === 0 ? 0 : captionLineStep}">${esc(l)}</tspan>`
        )
        .join("")}</text>`
    : "";

  const attributionSvg = plan.attribution
    ? `<text x="${GRID.PAD_X}" y="${attributionTopY}" font-family="${FONT.sans}" font-size="13" font-weight="500" fill="${COLOR.inkMuted}" letter-spacing="0.02em">— ${esc(plan.attribution)}</text>`
    : "";

  const body =
    kickerSvg + insightSvg + ruleSvg + captionSvg + attributionSvg + foot.svg;

  const svg = svgWrap(body, {
    height: H,
    title: heading,
    desc: plan.text,
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
