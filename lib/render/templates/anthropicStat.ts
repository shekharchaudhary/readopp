import type { RenderedPanel } from "../../shared/schemas";

/**
 * "Anthropic-style" stat callout — built from plan data, no model call.
 *
 * Editorial single-number panel: kicker, serif hero number, supporting label,
 * hand-drawn squiggle accent, body caption, source rule. Designed to match the
 * Anthropic brand feel (ivory paper, clay accent, generous whitespace) while
 * staying inside the render pipeline's validator constraints (viewBox width
 * 680, font sizes ∈ {12, 14, 56}, no foreignObject).
 *
 * Cost: zero tokens. Replaces an Opus render call for any panel with stat data.
 */

const PAPER = "#FAF9F5";
const INK = "#1A1A1A";
const INK_SOFT = "#4E463C";
const INK_MUTED = "#7A6F62";
const CLAY = "#C7613D";
const RULE = "#D6CFC2";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > maxChars) {
      if (line) lines.push(line.trim());
      line = w;
    } else {
      line = line ? line + " " + w : w;
    }
  }
  if (line) lines.push(line.trim());
  return lines;
}

function snap4(n: number): number {
  return Math.round(n / 4) * 4;
}

export interface AnthropicStatInput {
  sectionId: string;
  heading: string;
  caption: string;
  stat: { value: string; label: string };
  /** Optional kicker shown above the heading. Defaults to "The figure". */
  kicker?: string;
}

export function renderAnthropicStat(input: AnthropicStatInput): RenderedPanel {
  const { sectionId, heading, caption, stat } = input;
  const kicker = (input.kicker ?? "The figure").toLowerCase();

  const headingLines = wrapText(heading, 52).slice(0, 2);
  const labelLines = wrapText(stat.label, 46).slice(0, 2);
  const captionLines = wrapText(caption, 64).slice(0, 6);

  let y = 64;
  const kickerY = y;
  y += 24;

  const headingY = y;
  y += headingLines.length * 22 + 28;

  const ruleY = y;
  y += 36;

  const numberY = y + 56;
  y = numberY + 16;

  const labelY = y;
  y += labelLines.length * 20 + 32;

  const squiggleY = y;
  y += 36;

  const captionY = y + 14;
  y += captionLines.length * 20 + 28;

  const dividerY = y;
  y += 20;

  const sourceY = y;
  y += 40;

  const H = snap4(Math.max(y, 480));

  const headingTspans = headingLines
    .map(
      (l, i) =>
        `<tspan x="56" dy="${i === 0 ? 0 : 22}">${escapeXml(l)}</tspan>`
    )
    .join("");

  const labelTspans = labelLines
    .map(
      (l, i) =>
        `<tspan x="340" dy="${i === 0 ? 0 : 20}">${escapeXml(l)}</tspan>`
    )
    .join("");

  const captionTspans = captionLines
    .map(
      (l, i) =>
        `<tspan x="56" dy="${i === 0 ? 0 : 20}">${escapeXml(l)}</tspan>`
    )
    .join("");

  // Hand-drawn squiggle accent under the supporting label. Two passes — a soft
  // halo and the clay line — to fake the look of a brush-pen stroke.
  const squigglePath = `M 56 ${squiggleY} q 18 -7 36 0 t 36 0 t 36 0 t 36 0 t 36 0`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 ${H}" role="img" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif">
  <title>${escapeXml(heading)}</title>
  <desc>${escapeXml(stat.value)} — ${escapeXml(stat.label)}</desc>
  <rect x="0" y="0" width="680" height="${H}" fill="${PAPER}"/>

  <text x="56" y="${kickerY}" font-size="12" font-weight="500" fill="${CLAY}" letter-spacing="3">${escapeXml(kicker)}</text>

  <text x="56" y="${headingY}" font-size="14" font-weight="500" fill="${INK}">${headingTspans}</text>

  <line x1="312" y1="${ruleY}" x2="368" y2="${ruleY}" stroke="${CLAY}" stroke-width="1"/>

  <text x="340" y="${numberY}" font-size="56" font-weight="500" fill="${INK}" text-anchor="middle" font-family="Georgia, ui-serif, 'Times New Roman', serif">${escapeXml(stat.value)}</text>

  <text x="340" y="${labelY}" font-size="14" font-weight="400" fill="${INK_SOFT}" text-anchor="middle">${labelTspans}</text>

  <path d="${squigglePath}" fill="none" stroke="${CLAY}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>

  <text x="56" y="${captionY}" font-size="14" font-weight="400" fill="${INK}">${captionTspans}</text>

  <line x1="56" y1="${dividerY}" x2="200" y2="${dividerY}" stroke="${RULE}" stroke-width="1"/>

  <text x="56" y="${sourceY}" font-size="12" font-weight="500" fill="${INK_MUTED}" letter-spacing="2">readopp · anthropic stat</text>
</svg>`;

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
