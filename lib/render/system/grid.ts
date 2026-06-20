/**
 * Shared grid / spacing tokens for the panel design system.
 *
 * All deterministic templates pin their layouts to these constants
 * instead of hardcoding random px values. Same explainer with mixed
 * template kinds stays on a consistent vertical rhythm — left padding,
 * column rails, baseline grid all align.
 *
 * Coordinates assume the standard 680-wide panel viewBox; height is
 * dynamic per panel (templates emit a viewBox height that fits the
 * content + the standard footer).
 */

export const GRID = {
  // Outer canvas — every template draws against width = 680.
  CANVAS_W: 680,
  // Horizontal padding from canvas edge to content. Used by every left-
  // and right-aligned element. Originally varied 40 / 56 / 60 / 100 across
  // templates; collapse to one value.
  PAD_X: 56,
  // Top padding from the top of the panel to the first ink. Keeps the
  // kicker/heading from feeling clipped against the edge.
  PAD_TOP: 56,
  // Bottom padding from the last content line to the footer rule.
  PAD_BOTTOM: 56,
  // Baseline rhythm — most body text lines stack at multiples of 20.
  BASELINE: 20,
  // Inter-block gap when stacking distinct sections vertically
  // (heading block → body → divider, etc.).
  BLOCK_GAP: 32,
  // Standard rule width for kickers and footnote markers.
  RULE_W: 56,
  // Maximum width of the content column before forcing a wrap. Inside
  // the canvas width minus 2× horizontal padding.
  CONTENT_W: 680 - 2 * 56,
} as const;

/**
 * X position of the right edge of the content column (canvas width
 * minus right padding). Useful for right-aligned text and right-edge
 * decorations.
 */
export const CONTENT_RIGHT = GRID.CANVAS_W - GRID.PAD_X;

/**
 * X position of the centre of the content column.
 */
export const CONTENT_CENTRE = GRID.CANVAS_W / 2;
