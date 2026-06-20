/**
 * Framework callout — numbered named principles.
 *
 * One column of N steps (2–6), each numbered ("01") with a serif name
 * and a one-sentence description. Maps the "OODA loop" / "3 Rs" /
 * "5 whys" content shape that previously had to be forced into
 * `structural` or `key_findings`, neither of which is built for it.
 *
 * Phase 2E.3: editorial layout — name in display serif, number in
 * tracked clay caps, description in body sans. Each row is a panel of
 * its own with the same hierarchy as the page heading.
 */

import type { FrameworkPlan, RenderedPanel } from "../../shared/schemas";
import {
  COLOR,
  GRID,
  footerBlock,
  headingBlock,
  svgWrap,
  escapeXml as esc,
} from "../system/panelChrome";
import { FONT, fitText } from "../system/typography";

export interface RenderFrameworkInput {
  sectionId: string;
  heading: string;
  caption: string;
  plan: FrameworkPlan;
  source?: string;
  slide?: { index: number; total: number };
}

export function renderFramework(input: RenderFrameworkInput): RenderedPanel {
  const { sectionId, heading, caption, plan } = input;
  const steps = plan.steps.slice(0, 6);

  // ---------- Layout ----------

  // Heading block (top — same shape as Tier C templates).
  const head = headingBlock({
    heading,
    kicker: plan.label?.toUpperCase() ?? "FRAMEWORK",
    maxLines: 2,
  });
  let y = head.bottomY + 28;

  // Pre-compute per-step layout so we can stack them.
  const NUMBER_COL_W = 56;
  const STEP_LEFT_PAD = GRID.PAD_X + NUMBER_COL_W;
  const STEP_BODY_W = GRID.CONTENT_W - NUMBER_COL_W;

  const stepLayouts = steps.map((s, i) => {
    const nameFit = fitText(s.name, {
      width: STEP_BODY_W,
      height: 2 * 22 * 1.2,
      minSize: 17,
      maxSize: 22,
      lineHeight: 1.2,
      family: "serif",
    });
    const descFit = s.description
      ? fitText(s.description, {
          width: STEP_BODY_W,
          height: 3 * 14 * 1.45,
          minSize: 12,
          maxSize: 14,
          lineHeight: 1.45,
          family: "sans",
        })
      : null;
    const nameStep = Math.round(nameFit.size * 1.2);
    const descStep = descFit ? Math.round(descFit.size * 1.45) : 0;
    const nameH = nameFit.lines.length * nameStep;
    const descH = descFit ? descFit.lines.length * descStep : 0;
    const rowH = nameH + (descH > 0 ? descH + 8 : 0);
    return {
      nameFit,
      nameStep,
      descFit,
      descStep,
      rowH,
      number: String(i + 1).padStart(2, "0"),
    };
  });

  // Row baseline = previous row + row height + gap.
  const ROW_GAP = 28;
  const stepPositions = stepLayouts.map((l) => {
    const top = y;
    y += l.rowH + ROW_GAP;
    return top;
  });

  // Optional caption below the steps.
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
  const captionTopY = caption ? y + 8 + (captionFit?.size ?? 0) : y;
  const captionBottomY = caption && captionFit
    ? captionTopY + (captionFit.lines.length - 1) * captionLineStep
    : y;

  // Footer.
  const FOOTER_GAP = 28;
  const footerY = captionBottomY + FOOTER_GAP;
  const foot = footerBlock({
    topY: footerY,
    source: input.source,
    slide: input.slide,
    templateLabel: "framework",
  });
  const H = Math.round((foot.bottomY + GRID.PAD_BOTTOM) / 4) * 4;

  // ---------- SVG body ----------

  const stepSvgs = steps.map((_, i) => {
    const l = stepLayouts[i];
    const top = stepPositions[i];
    const numberY = top + l.nameFit.size;
    const numberSvg = `<text x="${GRID.PAD_X}" y="${numberY}" font-family="${FONT.sans}" font-size="13" font-weight="500" fill="${COLOR.clay}" letter-spacing="0.18em">${l.number}</text>`;
    const nameTspans = l.nameFit.lines
      .map(
        (line, j) =>
          `<tspan x="${STEP_LEFT_PAD}" dy="${j === 0 ? 0 : l.nameStep}">${esc(line)}</tspan>`
      )
      .join("");
    const nameSvg = `<text x="${STEP_LEFT_PAD}" y="${top + l.nameFit.size}" font-family="${FONT.serif}" font-size="${l.nameFit.size}" font-weight="500" fill="${COLOR.ink}" letter-spacing="-0.01em">${nameTspans}</text>`;
    const descSvg = l.descFit
      ? `<text x="${STEP_LEFT_PAD}" y="${top + l.nameFit.lines.length * l.nameStep + l.descFit.size + 4}" font-family="${FONT.sans}" font-size="${l.descFit.size}" font-weight="400" fill="${COLOR.inkSoft}">${l.descFit.lines
          .map(
            (line, j) =>
              `<tspan x="${STEP_LEFT_PAD}" dy="${j === 0 ? 0 : l.descStep}">${esc(line)}</tspan>`
          )
          .join("")}</text>`
      : "";
    return numberSvg + nameSvg + descSvg;
  });

  const captionSvg = captionFit
    ? `<text x="${GRID.PAD_X}" y="${captionTopY}" font-family="${FONT.sans}" font-size="${captionFit.size}" font-weight="400" fill="${COLOR.ink}">${captionFit.lines
        .map(
          (l, i) =>
            `<tspan x="${GRID.PAD_X}" dy="${i === 0 ? 0 : captionLineStep}">${esc(l)}</tspan>`
        )
        .join("")}</text>`
    : "";

  const body = head.svg + stepSvgs.join("") + captionSvg + foot.svg;

  const svg = svgWrap(body, {
    height: H,
    title: heading,
    desc: steps.map((s) => s.name).join(" → "),
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
