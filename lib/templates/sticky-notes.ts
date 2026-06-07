import { EXPORT_DIMENSIONS } from "../export/dimensions";
import { sourceLabel } from "../shared/source";
import type {
  AttributionRenderInput,
  PanelRenderInput,
  TemplateDef,
} from "./types";

/**
 * Sticky Notes — every panel is a small constellation of Post-it
 * notes overlapped on a desk surface, each at a slight rotation. The
 * heading sits on the largest note; supporting points each get their
 * own sticky. The caption becomes a handwritten "what I'm taking from
 * this" annotation on a smaller note.
 *
 * Works because the metaphor is recognisable instantly — readers know
 * this is workshop / brainstorm territory before reading a word.
 */

const DESK = "#FAFAFA";
const DESK_DEEP = "#EEEDE6";
const INK = "#1F1F1F";
const INK_SOFT = "#5C5C5C";
const SHADOW = "rgba(0,0,0,0.12)";

const NOTE_PALETTE = [
  { bg: "#FFE066", edge: "#E5C95C" }, // canary yellow
  { bg: "#FFD8B0", edge: "#E5BF95" }, // peach
  { bg: "#D6F5C9", edge: "#B6D8A6" }, // pale lime
  { bg: "#CDE7FF", edge: "#A8C8E6" }, // sky
  { bg: "#FFC3D5", edge: "#E0A8BC" }, // pink
];

const FONT_HAND =
  "'Caveat', 'Reenie Beanie', 'Comic Sans MS', cursive";
const FONT_SANS =
  "ui-sans-serif, system-ui, -apple-system, 'Inter', 'Söhne', 'Helvetica Neue', Helvetica, Arial, sans-serif";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface Sizes {
  pad: number;
  topSize: number;
  bigNoteSize: number;
  smallNoteSize: number;
  hSize: number;
  noteTextSize: number;
  smallNoteTextSize: number;
  gap: number;
}

function sizesFor(format: PanelRenderInput["format"]): Sizes {
  switch (format) {
    case "vertical":
      return {
        pad: 64,
        topSize: 22,
        bigNoteSize: 720,
        smallNoteSize: 320,
        hSize: 76,
        noteTextSize: 56,
        smallNoteTextSize: 38,
        gap: 40,
      };
    case "landscape":
      return {
        pad: 32,
        topSize: 13,
        bigNoteSize: 360,
        smallNoteSize: 170,
        hSize: 36,
        noteTextSize: 26,
        smallNoteTextSize: 18,
        gap: 18,
      };
    default: // square
      return {
        pad: 48,
        topSize: 18,
        bigNoteSize: 580,
        smallNoteSize: 260,
        hSize: 56,
        noteTextSize: 44,
        smallNoteTextSize: 30,
        gap: 32,
      };
  }
}

function headingScaleFor(len: number): number {
  if (len <= 24) return 1.0;
  if (len <= 42) return 0.82;
  if (len <= 60) return 0.65;
  return 0.55;
}

function extractStickyTexts(input: PanelRenderInput, max = 3): string[] {
  const plan = input.panel.plan;
  if (!plan) return [];
  const out: string[] = [];
  if (plan.stat?.value) out.push(`${plan.stat.value} ${plan.stat.label ?? ""}`.trim());
  if (plan.metaphor?.poles?.length) {
    for (const p of plan.metaphor.poles) {
      const line = [p.label, p.sub].filter(Boolean).join(" — ");
      if (line) out.push(line);
      if (out.length >= max) break;
    }
  }
  if (out.length < max && plan.timeline?.length) {
    for (const t of plan.timeline) {
      out.push(`${t.when}: ${t.what}`);
      if (out.length >= max) break;
    }
  }
  if (out.length < max && plan.comparison?.rows?.length) {
    for (const row of plan.comparison.rows) {
      const line = [row.label, (row.cells || []).filter(Boolean).join(" / ")]
        .filter(Boolean)
        .join(": ");
      if (line) out.push(line);
      if (out.length >= max) break;
    }
  }
  return out.slice(0, max).map((s) => s.slice(0, 80));
}

function paletteIndex(seed: string, offset = 0): number {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  return (n + offset) % NOTE_PALETTE.length;
}

function baseCss(w: number, h: number, S: Sizes, headingScale = 1): string {
  return `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: ${DESK}; color: ${INK}; font-family: ${FONT_SANS}; }
  body { width: ${w}px; height: ${h}px; overflow: hidden; }
  .desk {
    width: ${w}px;
    height: ${h}px;
    padding: ${S.pad}px;
    background:
      radial-gradient(ellipse at 20% 0%, rgba(0,0,0,0.04), transparent 60%),
      radial-gradient(ellipse at 80% 100%, rgba(0,0,0,0.04), transparent 60%),
      ${DESK};
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 24px;
    font-family: ${FONT_SANS};
    font-size: ${S.topSize}px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: ${INK_SOFT};
    margin-bottom: ${S.gap}px;
  }
  .top .left { color: ${INK}; font-weight: 600; }
  .board {
    flex: 1;
    min-height: 0;
    position: relative;
  }
  .note {
    position: absolute;
    padding: ${Math.round(S.gap * 0.6)}px;
    box-shadow: ${Math.round(S.gap * 0.15)}px ${Math.round(S.gap * 0.25)}px ${Math.round(S.gap * 0.6)}px ${SHADOW};
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
  }
  .note .ink {
    font-family: ${FONT_HAND};
    color: ${INK};
    text-align: center;
    word-break: break-word;
    line-height: 1.05;
  }
  .note.big {
    width: ${S.bigNoteSize}px;
    height: ${S.bigNoteSize}px;
    transform: rotate(-2.5deg);
  }
  .note.big .ink {
    font-size: ${Math.round(S.hSize * 1.5 * headingScale)}px;
    line-height: 1.05;
    font-weight: 700;
    letter-spacing: -0.005em;
  }
  .note.small .ink {
    font-size: ${S.noteTextSize}px;
    line-height: 1.15;
  }
  .note.small.a { width: ${S.smallNoteSize}px; height: ${Math.round(S.smallNoteSize * 0.7)}px; }
  .note.small.b { width: ${Math.round(S.smallNoteSize * 1.05)}px; height: ${Math.round(S.smallNoteSize * 0.75)}px; }
  .note.small.c { width: ${Math.round(S.smallNoteSize * 0.95)}px; height: ${Math.round(S.smallNoteSize * 0.78)}px; }
  .note.caption-note {
    width: ${Math.round(S.smallNoteSize * 1.4)}px;
    height: auto;
    min-height: ${Math.round(S.smallNoteSize * 0.7)}px;
    padding: ${Math.round(S.gap * 0.5)}px;
  }
  .note.caption-note .ink {
    font-size: ${S.smallNoteTextSize}px;
    line-height: 1.2;
    text-align: left;
    font-weight: 600;
  }
  .footer {
    margin-top: ${S.gap}px;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    font-family: ${FONT_SANS};
    font-size: ${S.topSize}px;
    color: ${INK_SOFT};
    letter-spacing: 0.12em;
  }
  `;
}

async function renderPanel(input: PanelRenderInput): Promise<string> {
  const { explainer, panel, format, panelIndex, totalPanels } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const S = sizesFor(format);
  const heading = panel.heading?.trim() || explainer.title;
  const stickies = extractStickyTexts(input, 3);
  const captionNote = panel.caption?.trim();
  const headingScale = headingScaleFor(heading.length);
  const seed = `${explainer.id}-${panelIndex}`;
  const bigPalette = NOTE_PALETTE[paletteIndex(seed, 0)];
  const smallPalettes = [1, 2, 3].map((o) => NOTE_PALETTE[paletteIndex(seed, o)]);

  // Approximate placement (in % of board) — big note centered-left,
  // small notes radiating around it. Stays inside the available area
  // for all three aspect ratios.
  const positions =
    format === "vertical"
      ? [
          { top: "5%", left: "10%", rot: -2 },
          { top: "60%", left: "5%", rot: 4 },
          { top: "60%", right: "10%", rot: -3 },
          { top: "30%", right: "5%", rot: 3 },
        ]
      : format === "landscape"
      ? [
          { top: "10%", left: "8%", rot: -2 },
          { top: "55%", left: "55%", rot: 3 },
          { top: "12%", right: "8%", rot: 2 },
          { top: "60%", left: "30%", rot: -3 },
        ]
      : [
          { top: "10%", left: "8%", rot: -2 },
          { top: "55%", left: "60%", rot: 4 },
          { top: "8%", right: "8%", rot: 3 },
          { top: "62%", left: "8%", rot: -3 },
        ];

  const posStyle = (p: (typeof positions)[number]) => {
    const parts: string[] = [];
    if (p.top) parts.push(`top:${p.top}`);
    if (p.left) parts.push(`left:${p.left}`);
    if (p.right) parts.push(`right:${p.right}`);
    parts.push(`transform: rotate(${p.rot}deg)`);
    return parts.join("; ");
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, headingScale)}</style>
</head>
<body>
  <main class="desk">
    <div class="top">
      <span class="left">Readopp · stickies</span>
      <span>${escapeHtml(sourceLabel(explainer.url))} · ${String(panelIndex).padStart(2, "0")} / ${String(totalPanels).padStart(2, "0")}</span>
    </div>
    <div class="board">
      <div class="note big" style="background: ${bigPalette.bg}; border-bottom: 2px solid ${bigPalette.edge}; ${posStyle(
    positions[0]
  )}">
        <div class="ink">${escapeHtml(heading)}</div>
      </div>
      ${stickies
        .map(
          (text, i) => `
        <div class="note small ${["a", "b", "c"][i]}" style="background: ${
            smallPalettes[i].bg
          }; border-bottom: 2px solid ${
            smallPalettes[i].edge
          }; ${posStyle(positions[i + 1])}">
          <div class="ink">${escapeHtml(text)}</div>
        </div>
      `
        )
        .join("")}
      ${
        captionNote
          ? `<div class="note caption-note" style="background: #FFFFFF; border: 1px solid ${DESK_DEEP}; bottom: 4%; right: 4%; transform: rotate(2deg)">
              <div class="ink">${escapeHtml(captionNote)}</div>
            </div>`
          : ""
      }
    </div>
    <div class="footer">
      <span>From the desk of a careful reader</span>
      <span>p. ${String(panelIndex).padStart(2, "0")}</span>
    </div>
  </main>
</body>
</html>`;
}

async function renderAttribution(
  input: AttributionRenderInput
): Promise<string> {
  const { explainer, format } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const S = sizesFor(format);
  const palette = NOTE_PALETTE[paletteIndex(explainer.id, 0)];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, 0.85)}
  .note.center {
    width: ${Math.round(S.bigNoteSize * 1.05)}px;
    height: ${Math.round(S.bigNoteSize * 1.05)}px;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-2deg);
  }
  .note.center .ink {
    font-size: ${Math.round(S.hSize * 1.4)}px;
    line-height: 1.05;
    font-weight: 700;
  }
  .note.url {
    width: ${Math.round(S.smallNoteSize * 1.6)}px;
    bottom: 12%;
    right: 8%;
    transform: rotate(3deg);
  }
  .note.url .ink {
    font-family: ${FONT_SANS};
    font-size: ${S.smallNoteTextSize}px;
    line-height: 1.2;
    font-weight: 600;
    word-break: break-all;
  }
</style>
</head>
<body>
  <main class="desk">
    <div class="top">
      <span class="left">Readopp · stickies</span>
      <span>source</span>
    </div>
    <div class="board">
      <div class="note center" style="background: ${palette.bg}; border-bottom: 2px solid ${palette.edge}">
        <div class="ink">${escapeHtml(explainer.title)}</div>
      </div>
      <div class="note url" style="background: #FFFFFF; border: 1px solid ${DESK_DEEP}">
        <div class="ink">→ ${escapeHtml(explainer.url)}</div>
      </div>
    </div>
    <div class="footer">
      <span>From the desk of a careful reader</span>
      <span>${escapeHtml(sourceLabel(explainer.url))}</span>
    </div>
  </main>
</body>
</html>`;
}

export const stickyNotesTemplate: TemplateDef = {
  id: "sticky-notes",
  name: "Sticky Notes",
  category: "Reader",
  tagline: "Overlapped Post-it notes on a desk with handwritten ink.",
  audience: "Workshop facilitators, product strategists, teachers.",
  preview: {
    background: DESK,
    foreground: INK,
    accent: NOTE_PALETTE[0].bg,
    sampleHeading: "stickies for what mattered",
    fontFamily: FONT_HAND,
  },
  renderPanel,
  renderAttribution,
};
