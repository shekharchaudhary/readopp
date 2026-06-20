/**
 * Deterministic timeline renderer for plan.timeline entries.
 *
 * Vertical rail with dotted segments between entries, each row stamped with a
 * "when" pill on the left and a "what" description on the right. Drawn in the
 * same visual family as the career_timeline genre panel but for any narrative
 * sequence of moments, not just job history.
 *
 * Returns null if there are fewer than two entries or any single entry is
 * unreasonably long — Opus picks up the slack in that case.
 */

import type { PanelPlan } from "../../shared/schemas";
import {
  GRID,
  footerBlock,
  headingBlock,
  svgWrap,
  escapeXml as esc,
} from "../system/panelChrome";
import { fitText } from "../system/typography";

export interface ChromeOptions {
  heading?: string;
  source?: string;
  slide?: { index: number; total: number };
}

const C = {
  ink: "#1a1a1a",
  inkSoft: "#3a3a3a",
  inkMuted: "#6b6b6b",
  line: "#e3e1d8",
  accent: "#185FA5",
  accentSoft: "#E6F1FB",
} as const;

function snap4(n: number): number {
  return Math.round(n / 4) * 4;
}

export function renderTimeline(
  plan: PanelPlan,
  chrome: ChromeOptions = {}
): string | null {
  const entries = (plan.timeline ?? []).filter(
    (e): e is { when: string; what: string } =>
      typeof e.when === "string" && typeof e.what === "string"
  );
  if (entries.length < 2 || entries.length > 6) return null;
  if (entries.some((e) => e.what.length > 240)) return null;

  const RAIL_X = 130;
  const TEXT_X = 162;
  const TEXT_W = 680 - TEXT_X - 40;
  const ROW_GAP = 28;

  // 1. Heading block.
  const head = chrome.heading
    ? headingBlock({ heading: chrome.heading, kicker: "TIMELINE" })
    : null;
  const PAD_TOP = head ? head.bottomY + 32 : 48;

  // Per-row text fitting via fitText:
  // - max 5 lines at 12px (smallest) keeps a row bounded to ~84px even for
  //   freakishly long entries;
  // - shrinks font from 15 → 12 to fit BEFORE truncating;
  // - only ellipsises when even the smallest size + line cap overflows.
  // Old behaviour silently chopped at 3 lines × ~68 chars and dropped the
  // rest mid-sentence.
  const MAX_LINES = 5;
  const MIN_SIZE = 12;
  const MAX_SIZE = 15;
  const LINE_HEIGHT = 1.4;

  const rows = entries.map((e) => {
    const fit = fitText(e.what, {
      width: TEXT_W,
      height: MAX_LINES * MIN_SIZE * LINE_HEIGHT,
      minSize: MIN_SIZE,
      maxSize: MAX_SIZE,
      lineHeight: LINE_HEIGHT,
      family: "sans",
    });
    const lineStep = Math.round(fit.size * LINE_HEIGHT);
    const h = 24 + fit.lines.length * lineStep;
    return { when: e.when, lines: fit.lines, size: fit.size, lineStep, h };
  });

  let y = PAD_TOP;
  const positions: { y: number; h: number }[] = [];
  for (const r of rows) {
    positions.push({ y, h: r.h });
    y += r.h + ROW_GAP;
  }
  const bodyBottom = y - ROW_GAP;

  const railTop = positions[0].y + 8;
  const railBottom = positions[positions.length - 1].y + 8;

  const rail = `<line x1="${RAIL_X}" y1="${railTop}" x2="${RAIL_X}" y2="${railBottom}" stroke="${C.line}" stroke-width="2" stroke-dasharray="2 6" stroke-linecap="round"/>`;

  const rowEls = rows
    .map((r, i) => {
      const top = positions[i].y;
      const dotY = top + 8;
      const whenY = top + 12;
      const tspans = r.lines
        .map(
          (l, j) =>
            `<tspan x="${TEXT_X}" dy="${j === 0 ? 0 : r.lineStep}">${esc(l)}</tspan>`
        )
        .join("");
      return `
        <circle cx="${RAIL_X}" cy="${dotY}" r="10" fill="${C.accentSoft}"/>
        <circle cx="${RAIL_X}" cy="${dotY}" r="5" fill="${C.accent}"/>
        <text x="116" y="${whenY}" font-size="12" font-weight="500" fill="${C.inkMuted}" text-anchor="end" letter-spacing="0.04em">${esc(
          r.when.toUpperCase()
        )}</text>
        <text x="${TEXT_X}" y="${top + 14}" font-size="${r.size}" font-weight="400" fill="${C.ink}">${tspans}</text>`;
    })
    .join("");

  // 2. Footer + final height.
  const FOOTER_GAP = 32;
  let totalH: number;
  let footerSvg = "";
  if (head || chrome.source || chrome.slide) {
    const footerY = bodyBottom + FOOTER_GAP;
    const foot = footerBlock({
      topY: footerY,
      source: chrome.source,
      slide: chrome.slide,
      templateLabel: "timeline",
    });
    footerSvg = foot.svg;
    totalH = snap4(foot.bottomY + GRID.PAD_BOTTOM);
  } else {
    totalH = snap4(bodyBottom + 40);
  }

  const desc = entries
    .map((e) => `${e.when}: ${e.what}`)
    .join(" · ")
    .slice(0, 220);
  const title = chrome.heading ?? "Timeline";
  const inner = (head?.svg ?? "") + rail + rowEls + footerSvg;
  return svgWrap(inner, { height: totalH, title, desc });
}
