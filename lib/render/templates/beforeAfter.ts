/**
 * Before / after transformation panel.
 *
 * Two side-by-side cards — the world before the change vs the world
 * after — joined by a centred transition badge. Lighter than the
 * `comparison` template (vsScene); for narrative "old way → new way"
 * beats rather than table-style head-to-head comparisons.
 *
 * Phase 2E.3: editorial pair layout — left card desaturated (was),
 * right card warm (becomes), transition word ("→", "BECOMES",
 * "INSTEAD") in a circular badge between them.
 */

import type { BeforeAfterPlan, RenderedPanel } from "../../shared/schemas";
import {
  COLOR,
  GRID,
  footerBlock,
  headingBlock,
  svgWrap,
  escapeXml as esc,
} from "../system/panelChrome";
import { FONT, fitText } from "../system/typography";

export interface RenderBeforeAfterInput {
  sectionId: string;
  heading: string;
  caption: string;
  plan: BeforeAfterPlan;
  source?: string;
  slide?: { index: number; total: number };
}

export function renderBeforeAfter(
  input: RenderBeforeAfterInput
): RenderedPanel {
  const { sectionId, heading, caption, plan } = input;
  const transition = (plan.transition ?? "becomes").trim();

  // ---------- Layout ----------

  const head = headingBlock({
    heading,
    kicker: "BEFORE → AFTER",
    maxLines: 2,
  });
  const cardTop = head.bottomY + 32;

  const CARD_GAP = 40;
  const CARD_W = (GRID.CONTENT_W - CARD_GAP) / 2;
  const LEFT_X = GRID.PAD_X;
  const RIGHT_X = GRID.PAD_X + CARD_W + CARD_GAP;

  // Fit the longer side's text first to determine card height.
  const beforeLabelFit = fitText(plan.before.label, {
    width: CARD_W - 32,
    height: 2 * 22 * 1.2,
    minSize: 17,
    maxSize: 22,
    lineHeight: 1.2,
    family: "serif",
  });
  const afterLabelFit = fitText(plan.after.label, {
    width: CARD_W - 32,
    height: 2 * 22 * 1.2,
    minSize: 17,
    maxSize: 22,
    lineHeight: 1.2,
    family: "serif",
  });
  const beforeDescFit = plan.before.description
    ? fitText(plan.before.description, {
        width: CARD_W - 32,
        height: 5 * 14 * 1.5,
        minSize: 12,
        maxSize: 14,
        lineHeight: 1.5,
        family: "sans",
      })
    : null;
  const afterDescFit = plan.after.description
    ? fitText(plan.after.description, {
        width: CARD_W - 32,
        height: 5 * 14 * 1.5,
        minSize: 12,
        maxSize: 14,
        lineHeight: 1.5,
        family: "sans",
      })
    : null;

  const cardInnerH = (labelFit: typeof beforeLabelFit, descFit: typeof beforeDescFit): number => {
    const labelStep = Math.round(labelFit.size * 1.2);
    const labelH = labelFit.lines.length * labelStep;
    const descStep = descFit ? Math.round(descFit.size * 1.5) : 0;
    const descH = descFit ? descFit.lines.length * descStep : 0;
    return labelH + (descH ? descH + 16 : 0);
  };
  const beforeInnerH = cardInnerH(beforeLabelFit, beforeDescFit);
  const afterInnerH = cardInnerH(afterLabelFit, afterDescFit);
  const CARD_PAD = 28;
  const CARD_H = Math.max(beforeInnerH, afterInnerH) + CARD_PAD * 2 + 28; // +28 for the kicker rule

  // Caption below the cards (optional).
  let y = cardTop + CARD_H + 24;
  const captionFit = caption
    ? fitText(caption, {
        width: GRID.CONTENT_W,
        height: 4 * 14 * 1.5,
        minSize: 12,
        maxSize: 14,
        lineHeight: 1.5,
        family: "sans",
      })
    : null;
  const captionLineStep = captionFit ? Math.round(captionFit.size * 1.5) : 0;
  const captionTopY = caption && captionFit ? y + captionFit.size : y;
  const captionBottomY =
    caption && captionFit
      ? captionTopY + (captionFit.lines.length - 1) * captionLineStep
      : y;

  // Footer.
  const FOOTER_GAP = 28;
  const footerY = captionBottomY + FOOTER_GAP;
  const foot = footerBlock({
    topY: footerY,
    source: input.source,
    slide: input.slide,
    templateLabel: "before · after",
  });
  const H = Math.round((foot.bottomY + GRID.PAD_BOTTOM) / 4) * 4;

  // ---------- SVG body ----------

  const renderCard = (
    side: "before" | "after",
    x: number,
    labelFit: typeof beforeLabelFit,
    descFit: typeof beforeDescFit,
    palStroke: string,
    palFill: string,
    palText: string,
    kicker: string
  ): string => {
    const labelStep = Math.round(labelFit.size * 1.2);
    const descStep = descFit ? Math.round(descFit.size * 1.5) : 0;
    const cardBg = `<rect x="${x}" y="${cardTop}" width="${CARD_W}" height="${CARD_H}" rx="14" ry="14" fill="${palFill}" stroke="${palStroke}" stroke-width="1.25"/>`;
    const kickerSvg = `<text x="${x + CARD_PAD}" y="${cardTop + CARD_PAD + 8}" font-family="${FONT.sans}" font-size="11" font-weight="500" fill="${palStroke}" letter-spacing="0.18em">${esc(kicker)}</text>`;
    const ruleSvg = `<line x1="${x + CARD_PAD}" y1="${cardTop + CARD_PAD + 18}" x2="${x + CARD_PAD + 32}" y2="${cardTop + CARD_PAD + 18}" stroke="${palStroke}" stroke-width="2" stroke-linecap="round"/>`;
    const labelY = cardTop + CARD_PAD + 18 + 24 + labelFit.size;
    const labelTspans = labelFit.lines
      .map(
        (l, i) =>
          `<tspan x="${x + CARD_PAD}" dy="${i === 0 ? 0 : labelStep}">${esc(l)}</tspan>`
      )
      .join("");
    const labelSvg = `<text x="${x + CARD_PAD}" y="${labelY}" font-family="${FONT.serif}" font-size="${labelFit.size}" font-weight="500" fill="${palText}" letter-spacing="-0.01em">${labelTspans}</text>`;
    const descTopY =
      labelY + (labelFit.lines.length - 1) * labelStep + (descFit ? descFit.size + 16 : 0);
    const descSvg = descFit
      ? `<text x="${x + CARD_PAD}" y="${descTopY}" font-family="${FONT.sans}" font-size="${descFit.size}" font-weight="400" fill="${COLOR.inkSoft}">${descFit.lines
          .map(
            (l, i) =>
              `<tspan x="${x + CARD_PAD}" dy="${i === 0 ? 0 : descStep}">${esc(l)}</tspan>`
          )
          .join("")}</text>`
      : "";
    return cardBg + kickerSvg + ruleSvg + labelSvg + descSvg;
  };

  // Before card uses muted gray; after uses brand clay/amber for the warm "post-transformation" feel.
  const beforeSvg = renderCard(
    "before",
    LEFT_X,
    beforeLabelFit,
    beforeDescFit,
    "#7A6F62", // muted ink as stroke
    COLOR.paper, // ivory
    COLOR.inkSoft,
    "BEFORE"
  );
  const afterSvg = renderCard(
    "after",
    RIGHT_X,
    afterLabelFit,
    afterDescFit,
    COLOR.clay,
    "#FAEEDA", // soft amber wash
    "#633806",
    "AFTER"
  );

  // Transition badge between cards.
  const badgeCx = GRID.PAD_X + CARD_W + CARD_GAP / 2;
  const badgeCy = cardTop + CARD_H / 2;
  const transitionShort =
    transition.length > 12 ? transition.slice(0, 11) + "…" : transition;
  const badgeSvg = `
    <circle cx="${badgeCx}" cy="${badgeCy}" r="26" fill="${COLOR.paper}" stroke="${COLOR.clay}" stroke-width="2"/>
    <text x="${badgeCx}" y="${badgeCy + 5}" font-family="${FONT.sans}" font-size="11" font-weight="500" fill="${COLOR.clay}" text-anchor="middle" letter-spacing="0.08em">${esc(transitionShort.toUpperCase())}</text>
  `;

  const captionSvg = captionFit
    ? `<text x="${GRID.PAD_X}" y="${captionTopY}" font-family="${FONT.sans}" font-size="${captionFit.size}" font-weight="400" fill="${COLOR.ink}">${captionFit.lines
        .map(
          (l, i) =>
            `<tspan x="${GRID.PAD_X}" dy="${i === 0 ? 0 : captionLineStep}">${esc(l)}</tspan>`
        )
        .join("")}</text>`
    : "";

  const body = head.svg + beforeSvg + afterSvg + badgeSvg + captionSvg + foot.svg;

  const svg = svgWrap(body, {
    height: H,
    title: heading,
    desc: `${plan.before.label} → ${plan.after.label}`,
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
