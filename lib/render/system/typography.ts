/**
 * Typography scale + text-fitting primitives for the panel design system.
 *
 * Why a scale: Tier C templates were inheriting font-size 14 for both
 * heading and body, so the only visual hierarchy was the kicker (12) and
 * the hero number (56) — a "missing middle". Fixed by defining named
 * roles that templates pull from instead of hardcoding sizes.
 *
 * Why fitText: every existing template silently truncates long input
 * mid-sentence (drops words past a fixed line/char cap). fitText binary-
 * searches the largest font size at which the full text wraps inside its
 * box, ellipsis-trims only if the smallest configured size still doesn't
 * fit. Caller can never accidentally drop content without an indicator.
 */

export const TYPE = {
  // Editorial display — for "hero" pull quotes and definition terms.
  display: { size: 32, lineHeight: 1.15, weight: 500, family: "serif" as const },
  // Stat hero — for large statistics like "93%".
  hero: { size: 56, lineHeight: 1.0, weight: 500, family: "serif" as const },
  // Panel heading — top of every panel, the section title.
  heading: { size: 22, lineHeight: 1.2, weight: 500, family: "sans" as const },
  // Subheading / sub-title — second line under heading or stat label.
  subheading: { size: 16, lineHeight: 1.35, weight: 500, family: "sans" as const },
  // Body / caption text — most prose lives here.
  body: { size: 15, lineHeight: 1.45, weight: 400, family: "sans" as const },
  // Caption / supporting copy — slightly smaller body for secondary info.
  caption: { size: 13, lineHeight: 1.4, weight: 400, family: "sans" as const },
  // Kicker / eyebrow — small, all-caps, tracked label above heading.
  kicker: { size: 11, lineHeight: 1.2, weight: 500, family: "sans" as const },
  // Footer / footnote — smallest visible text, source attribution.
  footer: { size: 11, lineHeight: 1.2, weight: 500, family: "sans" as const },
} as const;

export type TypeRole = keyof typeof TYPE;

export const FONT = {
  sans: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif",
  serif: "Georgia, 'Iowan Old Style', 'Times New Roman', ui-serif, serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, 'Cascadia Mono', monospace",
} as const;

/**
 * Approximate character-width-to-font-size ratio per family. Used by
 * the text-measurement helpers to estimate rendered width without an
 * SVG measurement context (we're rendering server-side).
 *
 * Calibrated against Helvetica at common UI sizes — slightly conservative
 * so text under-fills its box rather than overflowing.
 */
const CHAR_WIDTH_RATIO = {
  sans: 0.55,
  serif: 0.5,
  mono: 0.6,
} as const;

/**
 * Estimate the rendered width (in px) of a string at a given font size +
 * family. Approximation — won't match the browser exactly but is stable
 * enough for layout decisions.
 */
export function measureText(
  text: string,
  size: number,
  family: keyof typeof CHAR_WIDTH_RATIO = "sans"
): number {
  return text.length * size * CHAR_WIDTH_RATIO[family];
}

/**
 * Greedy word-wrap: split `text` into lines so each line measures
 * <= maxWidth at the given font. Returns an array of lines. Doesn't
 * cap line count — caller decides whether to truncate.
 */
export function wrapToWidth(
  text: string,
  maxWidth: number,
  size: number,
  family: keyof typeof CHAR_WIDTH_RATIO = "sans"
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? line + " " + w : w;
    if (measureText(candidate, size, family) <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      // If a single word exceeds the box, hard-break it across lines
      // rather than leaving an overflow.
      if (measureText(w, size, family) > maxWidth) {
        lines.push(...hardBreakWord(w, maxWidth, size, family));
        line = "";
      } else {
        line = w;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

function hardBreakWord(
  word: string,
  maxWidth: number,
  size: number,
  family: keyof typeof CHAR_WIDTH_RATIO
): string[] {
  const out: string[] = [];
  let buf = "";
  for (const ch of word) {
    const next = buf + ch;
    if (measureText(next, size, family) > maxWidth) {
      out.push(buf);
      buf = ch;
    } else {
      buf = next;
    }
  }
  if (buf) out.push(buf);
  return out;
}

export interface FitResult {
  lines: string[];
  size: number;
  /** True when the text didn't fit even at the smallest configured size
   *  and was ellipsised to fit. UI can show a "truncated" hint. */
  truncated: boolean;
}

export interface FitOptions {
  /** Target box width in px. */
  width: number;
  /** Target box height in px (lines × size × lineHeight must fit). */
  height: number;
  /** Hard floor — never shrink below this size. Default 11. */
  minSize?: number;
  /** Preferred (max) size — start the search here. Default = TYPE role size. */
  maxSize?: number;
  /** Number of search steps. More = smoother sizing, slower. Default 8. */
  steps?: number;
  /** Line-height multiplier. Default 1.4. */
  lineHeight?: number;
  /** Font family for width estimates. Default sans. */
  family?: keyof typeof CHAR_WIDTH_RATIO;
}

/**
 * Fit `text` into a `width × height` box by binary-searching the largest
 * font size at which the wrapped text fits. Returns the chosen lines +
 * size, and a `truncated` flag set true only when the smallest configured
 * size still overflowed (and the result was ellipsis-trimmed).
 *
 * Replaces the silent truncation in stat / timeline / flowchart / etc:
 * text is never dropped without `truncated === true` to signal it.
 */
export function fitText(text: string, opts: FitOptions): FitResult {
  const {
    width,
    height,
    minSize = 11,
    maxSize = 22,
    steps = 8,
    lineHeight = 1.4,
    family = "sans",
  } = opts;

  let lo = minSize;
  let hi = maxSize;
  let best: FitResult = {
    lines: [],
    size: minSize,
    truncated: false,
  };

  for (let i = 0; i < steps; i++) {
    const mid = Math.round(((lo + hi) / 2) * 10) / 10;
    const lines = wrapToWidth(text, width, mid, family);
    const blockHeight = lines.length * mid * lineHeight;
    if (blockHeight <= height && lines.every((l) => measureText(l, mid, family) <= width)) {
      best = { lines, size: mid, truncated: false };
      lo = mid + 0.5;
    } else {
      hi = mid - 0.5;
    }
    if (hi < lo) break;
  }

  // If even the minimum size doesn't fit, ellipsis-trim at the minimum.
  if (best.lines.length === 0) {
    const minLines = wrapToWidth(text, width, minSize, family);
    const maxLineCount = Math.floor(height / (minSize * lineHeight));
    if (maxLineCount > 0 && minLines.length > maxLineCount) {
      const kept = minLines.slice(0, maxLineCount);
      const last = kept[maxLineCount - 1];
      kept[maxLineCount - 1] = ellipsisFit(last, width, minSize, family);
      best = { lines: kept, size: minSize, truncated: true };
    } else {
      best = { lines: minLines, size: minSize, truncated: false };
    }
  }
  return best;
}

function ellipsisFit(
  line: string,
  width: number,
  size: number,
  family: keyof typeof CHAR_WIDTH_RATIO
): string {
  let s = line;
  while (s.length > 0 && measureText(s + "…", size, family) > width) {
    s = s.slice(0, -1);
  }
  return s.replace(/[\s,;]+$/, "") + "…";
}
