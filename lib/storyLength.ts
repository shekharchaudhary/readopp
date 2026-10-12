import type { Comprehension } from "./shared/schemas";

export interface PanelCountRange {
  min: number;
  max: number;
  reason: string;
}

export interface StoryLengthPreference extends PanelCountRange {
  target?: number;
}

/**
 * Turn source depth into a narrative budget. The structure model still
 * decides the exact count inside the range, but it never sees a generic
 * five-panel target for every document.
 */
export function recommendedPanelCountRange(
  comprehension: Comprehension,
  sourceWordCount = 0
): PanelCountRange {
  const words = Math.max(0, sourceWordCount);
  const dataPoints = comprehension.dataSeries.reduce(
    (total, series) => total + series.points.length,
    0
  );

  // Unknown length occurs only on older/resumed jobs. Keep the broad range
  // there rather than inventing precision from the fixed-size claim list.
  if (!words) {
    return { min: 1, max: 5, reason: "Source length is unavailable." };
  }

  let range: PanelCountRange;
  if (words <= 260) {
    range = { min: 1, max: 2, reason: "This concise source should stay concise." };
  } else if (words <= 800) {
    range = { min: 2, max: 3, reason: "This short source needs one focused story arc." };
  } else if (words <= 1_800) {
    range = { min: 3, max: 4, reason: "This source can support a claim, proof, and resolution." };
  } else {
    range = { min: 4, max: 5, reason: "This deep source carries several distinct ideas." };
  }

  // Dense comparable evidence deserves room even in a compact source.
  if (dataPoints >= 8) {
    range = {
      min: Math.max(range.min, words > 700 ? 4 : 3),
      max: Math.max(range.max, 4),
      reason: `${dataPoints} comparable data points need their own evidence panel.`,
    };
  } else if (dataPoints >= 4 || comprehension.contentFeatures.hasCharts) {
    range = {
      min: Math.max(range.min, 2),
      max: Math.max(range.max, 3),
      reason: "The source has chartable evidence as well as an argument.",
    };
  }

  // Substantial research needs room for the gap, evidence, and implication.
  if (
    words > 900 &&
    (comprehension.genre === "research_paper" ||
      comprehension.genre === "whitepaper")
  ) {
    range = {
      min: Math.max(range.min, 3),
      max: Math.max(range.max, 4),
      reason: "Research needs room for the gap, evidence, and implication.",
    };
  }

  return {
    min: Math.min(5, range.min),
    max: Math.min(5, Math.max(range.min, range.max)),
    reason: range.reason,
  };
}

export function panelCountRangeLabel(range: PanelCountRange): string {
  const count = range.min === range.max ? `${range.min}` : `${range.min}–${range.max}`;
  return `${count} panel${range.max === 1 ? "" : "s"}`;
}

/** Apply a creator's exact choice without discarding the source-aware
 * recommendation that the review UI explains. */
export function effectivePanelCountRange(
  recommendation: PanelCountRange,
  target?: number
): PanelCountRange {
  if (Number.isInteger(target) && target! >= 1 && target! <= 5) {
    return {
      min: target!,
      max: target!,
      reason: `The creator chose exactly ${target} panel${target === 1 ? "" : "s"}.`,
    };
  }
  return recommendation;
}
