/**
 * Deterministic SVG templates for metaphor panels.
 *
 * Each template takes a MetaphorPlan and returns a self-contained <svg> string
 * with viewBox="0 0 680 H". No model calls — the planner picks the metaphor
 * and fills the slots, the template draws it. Untemplated kinds fall through
 * to the AI renderer (see lib/pipeline/render.ts).
 *
 * Style matches the samples in /samples — editorial illustration, leader-line
 * labels, one hero color per panel, organic where it should be organic.
 */
import { iconSvg, isIconName } from "./icons";
import type { MetaphorKind, MetaphorPlan, PanelPlan } from "../shared/schemas";
import {
  GRID,
  footerBlock,
  headingBlock,
  svgWrap as chromeWrap,
} from "./system/panelChrome";

export interface MetaphorChrome {
  heading?: string;
  source?: string;
  slide?: { index: number; total: number };
}

type TemplateFn = (plan: MetaphorPlan) => string;

const REGISTRY: Partial<Record<MetaphorKind, TemplateFn>> = {
  // Duality / tension
  iceberg: renderIceberg,
  bridge: renderBridge,
  scale: renderScale,
  tug_of_war: renderTugOfWar,
  spectrum: renderSpectrum,
  paradox: renderParadox,
  // Sequence
  mountain: renderMountain,
  staircase: renderStaircase,
  garden: renderGarden,
  domino: renderDomino,
  weaving: renderWeaving,
  // Many-to-one
  confluence: renderConfluence,
  funnel: renderFunnel,
  tipping_point: renderTippingPoint,
  // One-to-many
  branching: renderBranching,
  ripple: renderRipple,
  crossroads: renderCrossroads,
  // Focus
  lighthouse: renderLighthouse,
  spotlight: renderSpotlight,
  orbits: renderOrbits,
  // Cycle
  loop: renderLoop,
  tide: renderTide,
  engine: renderEngine,
  gears: renderGears,
  // Stack
  layers: renderLayers,
  pyramid: renderPyramid,
  onion: renderOnion,
  // Spatial
  compass: renderCompass,
  maze: renderMaze,
  // Classification
  quadrant: renderQuadrant,
};

export function renderMetaphor(
  plan: PanelPlan,
  chrome?: MetaphorChrome
): string | null {
  if (plan.visualType !== "metaphor" || !plan.metaphor) return null;
  const fn = REGISTRY[plan.metaphor.kind];
  if (!fn) return null;
  const innerSvg = fn(plan.metaphor);
  if (!chrome || (!chrome.heading && !chrome.source && !chrome.slide)) {
    return innerSvg;
  }
  return wrapMetaphorWithChrome(innerSvg, plan.metaphor.kind, chrome);
}

/**
 * Wrap a rendered metaphor SVG with the system chrome envelope (kicker
 * + heading + source/slide footer + paper background) without touching
 * any of the 26 individual renderers. The inner SVG is shifted down
 * inside a translated <g> so its native coordinates still work; the
 * heading sits above it and the footer below.
 *
 * The kicker is derived from the metaphor kind ("LIGHTHOUSE", "TUG OF
 * WAR") so each panel announces its visual idea explicitly.
 */
function wrapMetaphorWithChrome(
  innerSvg: string,
  kind: MetaphorKind,
  chrome: MetaphorChrome
): string {
  const vbMatch = innerSvg.match(/viewBox="0 0 680 ([\d.]+)"/);
  if (!vbMatch) return innerSvg; // Defensive: malformed inner SVG → bail.
  const innerH = parseFloat(vbMatch[1]);

  // Pull just the body — drop the outer <svg>, <title>, <desc>. The
  // body keeps its native coordinates and gets translated below the
  // heading block.
  const bodyMatch = innerSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  const rawBody = bodyMatch ? bodyMatch[1] : "";
  const body = rawBody
    .replace(/<title>[\s\S]*?<\/title>/g, "")
    .replace(/<desc>[\s\S]*?<\/desc>/g, "");

  const kickerLabel = kind.replace(/_/g, " ").toUpperCase();
  const templateLabel = `metaphor · ${kind.replace(/_/g, " ")}`;

  const head = chrome.heading
    ? headingBlock({ heading: chrome.heading, kicker: kickerLabel })
    : null;
  const HEADING_BOTTOM = head ? head.bottomY + 28 : GRID.PAD_TOP;

  const translatedBody = `<g transform="translate(0, ${HEADING_BOTTOM})">${body}</g>`;

  const FOOTER_GAP = 32;
  const footerY = HEADING_BOTTOM + innerH + FOOTER_GAP;
  const foot = footerBlock({
    topY: footerY,
    source: chrome.source,
    slide: chrome.slide,
    templateLabel,
  });
  const totalH = Math.ceil((foot.bottomY + GRID.PAD_BOTTOM) / 4) * 4;

  const inner = (head?.svg ?? "") + translatedBody + foot.svg;
  return chromeWrap(inner, {
    height: totalH,
    title: chrome.heading ?? kind,
    desc: kind,
  });
}

export function hasMetaphorTemplate(kind: MetaphorKind): boolean {
  return kind in REGISTRY;
}

// ---------- helpers ----------

const FONT =
  "ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif";

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Word-wrap a label into up to `maxLines` lines, each at most `maxChars` chars.
 * Returns the lines; a trailing line is ellipsised if there's overflow.
 */
export function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (words.join(" ").length > lines.join(" ").length && lines.length) {
    const last = lines[lines.length - 1];
    if (last.length > maxChars - 1) {
      lines[lines.length - 1] = last.slice(0, maxChars - 1) + "…";
    } else {
      lines[lines.length - 1] = last + "…";
    }
  }
  return lines;
}

/**
 * Multi-line <text> block. lineHeight is in px between baselines.
 */
export function textBlock(
  x: number,
  y: number,
  lines: string[],
  opts: {
    fontSize: number;
    fontWeight?: 400 | 500;
    fill: string;
    anchor?: "start" | "middle" | "end";
    lineHeight?: number;
  }
): string {
  const weight = opts.fontWeight ?? 400;
  const anchor = opts.anchor ?? "start";
  const lh = opts.lineHeight ?? opts.fontSize + 4;
  return lines
    .map((line, i) => {
      const yy = y + i * lh;
      return `<text x="${x}" y="${yy}" font-size="${opts.fontSize}" font-weight="${weight}" fill="${opts.fill}" text-anchor="${anchor}">${esc(line)}</text>`;
    })
    .join("");
}

export function svgWrap(viewH: number, title: string, desc: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 ${viewH}" role="img" font-family="${FONT}"><title>${esc(title)}</title><desc>${esc(desc)}</desc>${body}</svg>`;
}

/**
 * Planner-chosen icon for a pole/item/hub slot, or "" when absent/unknown.
 * x/y is the top-left of the icon box.
 */
function slotIcon(
  icon: string | null | undefined,
  x: number,
  y: number,
  size: number,
  stroke: string
): string {
  if (!icon || !isIconName(icon)) return "";
  return iconSvg(icon, { x, y, size, stroke });
}

// Palette tokens reused across templates.
export const C = {
  blue: { fill: "#E6F1FB", stroke: "#185FA5", text: "#0C447C" },
  teal: { fill: "#E1F5EE", stroke: "#0F6E56", text: "#085041" },
  amber: { fill: "#FAEEDA", stroke: "#854F0B", text: "#633806" },
  purple: { fill: "#EEEDFE", stroke: "#534AB7", text: "#3C3489" },
  gray: { fill: "#F1EFE8", stroke: "#5F5E5A", text: "#2C2C2A" },
  ink: "#1a1a1a",
  inkSoft: "#3a3a3a",
  inkMuted: "#6b6b6b",
  line: "#e3e1d8",
  paper: "#fafaf7",
} as const;

// ---------- templates ----------

function renderIceberg(m: MetaphorPlan): string {
  const visible = m.poles[0] ?? { label: "Visible", sub: null };
  const hidden = m.poles[1] ?? { label: "Hidden", sub: null };
  const ratio = (m.hint || "").trim();
  // Phase 2E.2b: items[] now renders as labeled bullets inside the
  // hidden mass — these are the specific examples of "what's hidden"
  // the planner attached. Previously they were silently dropped.
  const items = m.items.slice(0, 5);
  const H = 480;

  const visLines = [
    ...wrap(visible.label, 28, 1),
    ...(visible.sub ? wrap(visible.sub, 32, 2) : []),
  ];
  const hidLines = [
    ...wrap(hidden.label, 28, 1),
    ...(hidden.sub ? wrap(hidden.sub, 32, 2) : []),
  ];

  // Distribute items as bullets stacked in the lower-mass area
  // (between roughly y=250 and y=410, x=480 column with leader lines
  // pointing into the mass). Right side so they don't collide with
  // the left "hidden" pole label.
  const ITEMS_X = 488;
  const ITEMS_TOP = 244;
  const ITEMS_BOTTOM = 412;
  const itemStep =
    items.length > 1
      ? (ITEMS_BOTTOM - ITEMS_TOP) / (items.length - 1)
      : 0;
  const itemEls = items.map((it, i) => {
    const y = items.length > 1 ? ITEMS_TOP + i * itemStep : (ITEMS_TOP + ITEMS_BOTTOM) / 2;
    const nameLines = wrap(it.name, 22, 2);
    const nameEls = nameLines
      .map(
        (l, k) =>
          `<text x="${ITEMS_X}" y="${y + 4 + k * 16}" font-size="13" font-weight="500" fill="${C.blue.text}">${esc(l)}</text>`
      )
      .join("");
    const subEl = it.sub
      ? `<text x="${ITEMS_X}" y="${y + 4 + nameLines.length * 16 + 14}" font-size="11" fill="${C.inkSoft}">${esc(it.sub)}</text>`
      : "";
    return `
      <line x1="438" y1="${y}" x2="${ITEMS_X - 8}" y2="${y}" stroke="${C.inkMuted}" stroke-width="1" opacity="0.55"/>
      <circle cx="438" cy="${y}" r="2.5" fill="${C.blue.stroke}"/>
      ${nameEls}
      ${subEl}
    `;
  });

  // Iceberg geometry: peak above water (~y=110), surface at y=200, mass below.
  const body = `
    <rect x="0" y="200" width="680" height="280" fill="${C.blue.fill}" opacity="0.55"/>
    <line x1="0" y1="200" x2="680" y2="200" stroke="${C.blue.stroke}" stroke-width="1" opacity="0.4"/>
    <line x1="0" y1="208" x2="680" y2="208" stroke="${C.blue.stroke}" stroke-width="1" opacity="0.18"/>
    <path d="M 300 200 L 330 108 L 366 156 L 396 200 Z" fill="#ffffff" stroke="${C.blue.stroke}" stroke-width="1.5"/>
    <path d="M 272 200 L 232 252 L 218 322 L 240 400 L 312 432 L 396 422 L 444 380 L 458 290 L 430 220 L 410 200 Z" fill="#ffffff" stroke="${C.blue.stroke}" stroke-width="1.5" opacity="0.92"/>
    ${ratio && items.length === 0
      ? `<text x="338" y="316" font-size="56" font-weight="500" fill="${C.blue.stroke}" text-anchor="middle" opacity="0.18">${esc(ratio)}</text>`
      : ""}
    <line x1="384" y1="135" x2="490" y2="105" stroke="${C.inkMuted}" stroke-width="1"/>
    <circle cx="384" cy="135" r="2.5" fill="${C.inkMuted}"/>
    ${slotIcon(visible.icon, 500, 64, 22, C.blue.stroke)}
    ${textBlock(500, 100, visLines, { fontSize: 14, fontWeight: 500, fill: C.blue.text, lineHeight: 18 })}
    <line x1="290" y1="340" x2="160" y2="380" stroke="${C.inkMuted}" stroke-width="1"/>
    <circle cx="290" cy="340" r="2.5" fill="${C.inkMuted}"/>
    ${slotIcon(hidden.icon, 40, 340, 22, C.blue.stroke)}
    ${textBlock(40, 376, hidLines, { fontSize: 14, fontWeight: 500, fill: C.blue.text, lineHeight: 18 })}
    ${itemEls.join("")}
  `;
  return svgWrap(H, visible.label, hidden.label, body);
}

function renderMountain(m: MetaphorPlan): string {
  // Cap raised from 4 → 5 (Phase 2E.2c). Mountain stages naturally suit
  // 4–5 camps along the trail; the 5th camp sits near the summit.
  const stages = m.items.slice(0, 5);
  if (stages.length === 0) return svgWrap(200, "Mountain", "", "");
  const summit = m.outcome;
  const H = 500;

  // Camp positions distributed along a zigzag trail up the mountain.
  // We place camps from base-right to summit, with labels alternating sides.
  const CAMP_POSITIONS: Array<{
    cx: number;
    cy: number;
    labelSide: "left" | "right";
  }> = [
    { cx: 510, cy: 432, labelSide: "right" },
    { cx: 410, cy: 386, labelSide: "left" },
    { cx: 432, cy: 320, labelSide: "right" },
    { cx: 388, cy: 270, labelSide: "left" },
    { cx: 408, cy: 224, labelSide: "right" },
  ];

  const camps = stages.map((s, i) => {
    const pos = CAMP_POSITIONS[i] ?? CAMP_POSITIONS[CAMP_POSITIONS.length - 1];
    const labelLines = [
      `STAGE ${i + 1}`,
      ...wrap(s.name, 22, 1),
      ...(s.sub ? wrap(s.sub, 26, 2) : []),
    ];
    const isLeft = pos.labelSide === "left";
    const lx = isLeft ? 40 : 530;
    const leaderX1 = isLeft ? pos.cx - 10 : pos.cx + 10;
    const leaderX2 = isLeft ? lx + 130 : lx - 10;
    const leaderY = pos.cy + 2;
    const anchor: "start" = "start";
    return `
      <circle cx="${pos.cx}" cy="${pos.cy}" r="5" fill="${C.amber.text}"/>
      <line x1="${pos.cx}" y1="${pos.cy}" x2="${pos.cx}" y2="${pos.cy - 20}" stroke="${C.amber.text}" stroke-width="1.5"/>
      <path d="M ${pos.cx} ${pos.cy - 20} L ${pos.cx + 22} ${pos.cy - 13} L ${pos.cx} ${pos.cy - 6} Z" fill="${C.amber.text}"/>
      <line x1="${leaderX1}" y1="${leaderY}" x2="${leaderX2}" y2="${leaderY}" stroke="${C.inkMuted}" stroke-width="1" opacity="0.7"/>
      ${slotIcon(s.icon, lx, pos.cy - 48, 20, C.amber.stroke)}
      <text x="${lx}" y="${pos.cy - 14}" font-size="12" font-weight="500" fill="${C.amber.stroke}" text-anchor="${anchor}">${esc(labelLines[0])}</text>
      <text x="${lx}" y="${pos.cy + 4}" font-size="14" font-weight="500" fill="${C.ink}" text-anchor="${anchor}">${esc(labelLines[1] || "")}</text>
      ${labelLines
        .slice(2)
        .map(
          (l, j) =>
            `<text x="${lx}" y="${pos.cy + 22 + j * 16}" font-size="12" fill="${C.inkSoft}" text-anchor="${anchor}">${esc(l)}</text>`
        )
        .join("")}
    `;
  });

  // Trail through used camps + summit.
  const used = stages.map((_, i) => CAMP_POSITIONS[i] ?? CAMP_POSITIONS[CAMP_POSITIONS.length - 1]);
  const trail =
    "M " +
    [...used.map((p) => `${p.cx} ${p.cy}`), "420 230"].join(" L ");

  const body = `
    <path d="M 80 470 L 200 290 L 280 360 L 380 250 L 480 320 L 580 230 L 680 470 Z" fill="${C.gray.fill}" opacity="0.7"/>
    <path d="M 40 480 L 220 320 L 320 400 L 420 200 L 540 320 L 620 280 L 680 480 Z" fill="${C.amber.fill}" stroke="${C.amber.stroke}" stroke-width="1.5"/>
    <path d="M 400 240 L 420 200 L 444 244 L 432 254 L 422 246 L 412 254 Z" fill="#ffffff" stroke="${C.amber.stroke}" stroke-width="1"/>
    <path d="${trail}" fill="none" stroke="${C.amber.text}" stroke-width="1.5" stroke-dasharray="4 5" stroke-linecap="round"/>
    ${
      summit
        ? `<text x="420" y="184" font-size="12" font-weight="500" fill="${C.amber.text}" text-anchor="middle">↑ ${esc(summit.name)}</text>`
        : ""
    }
    ${camps.join("")}
  `;
  return svgWrap(H, summit?.name || "The climb", stages.map((s) => s.name).join(" → "), body);
}

function renderConfluence(m: MetaphorPlan): string {
  // Cap raised from 3 → 5 (Phase 2E.2c). SOURCE_Y is computed from the
  // stream count so 3/4/5 streams all distribute evenly.
  const sources = m.items.slice(0, 5);
  if (sources.length === 0) return svgWrap(200, "Confluence", "", "");
  const output = m.outcome ?? m.hub ?? { name: "Output", sub: null };
  const H = 440;
  const PALETTES = [C.blue, C.amber, C.purple, C.teal, C.gray];
  // Confluence point on the right edge of streams.
  const CX = 396;
  const CY = 240;
  // Distribute source endpoints evenly across a vertical band so 3, 4,
  // and 5 streams all space out without overlapping.
  const TOP = 110;
  const BOTTOM = 370;
  const n = sources.length;
  const SOURCE_Y =
    n === 1
      ? [CY]
      : Array.from({ length: n }, (_, i) =>
          Math.round(TOP + ((BOTTOM - TOP) * i) / (n - 1))
        );

  const streams = sources.map((s, i) => {
    const pal = PALETTES[i % PALETTES.length];
    const sy = SOURCE_Y[i] ?? CY;
    // Bezier-ish path from (60, sy) curving to (CX, CY).
    const d = `M 60 ${sy} Q 220 ${sy}, 290 ${(sy + CY) / 2} T ${CX} ${CY}`;
    return `
      <path d="${d}" fill="none" stroke="${pal.stroke}" stroke-width="10" stroke-linecap="round" opacity="0.35"/>
      <path d="${d}" fill="none" stroke="${pal.stroke}" stroke-width="2.5" stroke-linecap="round"/>
      <text x="40" y="${sy - 10}" font-size="14" font-weight="500" fill="${pal.text}">${esc(s.name)}</text>
      ${s.sub ? `<text x="40" y="${sy + 6}" font-size="12" fill="${C.inkSoft}">${esc(s.sub)}</text>` : ""}
    `;
  });

  const body = `
    ${streams.join("")}
    <circle cx="${CX}" cy="${CY}" r="14" fill="${C.paper}" stroke="${C.ink}" stroke-width="1.5"/>
    <path d="M 410 ${CY} L 600 ${CY}" fill="none" stroke="${C.ink}" stroke-width="14" stroke-linecap="round" opacity="0.25"/>
    <path d="M 410 ${CY} L 600 ${CY}" fill="none" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/>
    <path d="M 596 ${CY - 10} L 622 ${CY} L 596 ${CY + 10} Z" fill="${C.ink}"/>
    <text x="640" y="${CY - 20}" font-size="14" font-weight="500" fill="${C.ink}" text-anchor="end">${esc(output.name)}</text>
    ${output.sub ? `<text x="640" y="${CY - 4}" font-size="12" fill="${C.inkSoft}" text-anchor="end">${esc(output.sub)}</text>` : ""}
  `;
  return svgWrap(H, output.name, sources.map((s) => s.name).join(" + "), body);
}

function renderBridge(m: MetaphorPlan): string {
  const before = m.poles[0] ?? { label: "Before", sub: null };
  const after = m.poles[1] ?? { label: "After", sub: null };
  const via = m.outcome?.name || m.hint || "";
  // Phase 2E.2b: items[] now renders as labeled waypoints along the
  // bridge — the actual steps of the crossing ("Refactor", "Tests",
  // "Migration"). Previously items were dropped.
  const items = m.items.slice(0, 5);
  const H = 380;

  // Two cliffs, a bridge between them, labels above each side.
  const body = `
    <!-- Left cliff -->
    <path d="M 0 280 L 200 280 L 200 380 L 0 380 Z" fill="${C.gray.fill}" stroke="${C.gray.stroke}" stroke-width="1"/>
    <path d="M 0 280 L 200 280" stroke="${C.gray.stroke}" stroke-width="1.5"/>
    <!-- Right cliff -->
    <path d="M 480 280 L 680 280 L 680 380 L 480 380 Z" fill="${C.gray.fill}" stroke="${C.gray.stroke}" stroke-width="1"/>
    <path d="M 480 280 L 680 280" stroke="${C.gray.stroke}" stroke-width="1.5"/>
    <!-- Bridge deck -->
    <rect x="200" y="278" width="280" height="6" rx="3" ry="3" fill="${C.amber.fill}" stroke="${C.amber.stroke}" stroke-width="1"/>
    <!-- Bridge cables (suspension look) -->
    <path d="M 220 278 Q 340 240, 460 278" fill="none" stroke="${C.amber.stroke}" stroke-width="1.5"/>
    <line x1="240" y1="266" x2="240" y2="278" stroke="${C.amber.stroke}" stroke-width="1"/>
    <line x1="280" y1="252" x2="280" y2="278" stroke="${C.amber.stroke}" stroke-width="1"/>
    <line x1="340" y1="244" x2="340" y2="278" stroke="${C.amber.stroke}" stroke-width="1"/>
    <line x1="400" y1="252" x2="400" y2="278" stroke="${C.amber.stroke}" stroke-width="1"/>
    <line x1="440" y1="266" x2="440" y2="278" stroke="${C.amber.stroke}" stroke-width="1"/>
    <!-- Mid label (the transition) -->
    ${via ? `<text x="340" y="220" font-size="14" font-weight="500" fill="${C.amber.text}" text-anchor="middle">${esc(via)}</text>` : ""}
    ${via ? `<line x1="340" y1="228" x2="340" y2="244" stroke="${C.amber.stroke}" stroke-width="1" opacity="0.4"/>` : ""}
    <!-- Before label -->
    ${slotIcon(before.icon, 84, 48, 32, C.gray.stroke)}
    <text x="100" y="100" font-size="12" font-weight="500" fill="${C.gray.stroke}" text-anchor="middle">BEFORE</text>
    <text x="100" y="124" font-size="14" font-weight="500" fill="${C.ink}" text-anchor="middle">${esc(before.label)}</text>
    ${before.sub ? `<text x="100" y="142" font-size="12" fill="${C.inkSoft}" text-anchor="middle">${esc(before.sub)}</text>` : ""}
    <!-- After label -->
    ${slotIcon(after.icon, 564, 48, 32, C.amber.stroke)}
    <text x="580" y="100" font-size="12" font-weight="500" fill="${C.amber.stroke}" text-anchor="middle">AFTER</text>
    <text x="580" y="124" font-size="14" font-weight="500" fill="${C.ink}" text-anchor="middle">${esc(after.label)}</text>
    ${after.sub ? `<text x="580" y="142" font-size="12" fill="${C.inkSoft}" text-anchor="middle">${esc(after.sub)}</text>` : ""}
    ${renderBridgeWaypoints(items)}
  `;
  return svgWrap(H, `${before.label} → ${after.label}`, via, body);
}

/**
 * Labeled waypoints along the bridge deck. Items distribute evenly
 * across the deck span (x=200 → x=480), each with a small marker on
 * the deck and a label tucked just above the suspension cables.
 */
function renderBridgeWaypoints(
  items: ReadonlyArray<{ name: string; sub?: string | null }>
): string {
  if (items.length === 0) return "";
  const SPAN_START = 220;
  const SPAN_END = 460;
  const baseY = 280; // top of bridge deck
  return items
    .map((it, i) => {
      const n = items.length;
      const x = SPAN_START + ((SPAN_END - SPAN_START) * (i + 0.5)) / n;
      const labelLines = wrap(it.name, 16, 2);
      const labelEls = labelLines
        .map(
          (l, k) =>
            `<text x="${x}" y="${320 + k * 14}" font-size="11" font-weight="500" fill="${C.ink}" text-anchor="middle">${esc(l)}</text>`
        )
        .join("");
      return `
        <line x1="${x}" y1="${baseY + 2}" x2="${x}" y2="${baseY + 16}" stroke="${C.amber.stroke}" stroke-width="1"/>
        <circle cx="${x}" cy="${baseY + 16}" r="3" fill="${C.amber.stroke}"/>
        ${labelEls}
      `;
    })
    .join("");
}

function renderScale(m: MetaphorPlan): string {
  const left = m.poles[0] ?? { label: "Side A", sub: null };
  const right = m.poles[1] ?? { label: "Side B", sub: null };
  const question = m.hint || "";
  // Phase 2E.2b: items[] renders as a "WEIGHED" row at the top of the
  // canvas — the factors being judged, surfaced as small pills above
  // the scale visualization. Without a planner signal for which side
  // an item belongs to, listing them inline avoids guessing.
  const items = m.items.slice(0, 6);
  const H = items.length > 0 ? 460 : 420;
  const leftIcon = slotIcon(left.icon, 186, 168, 28, C.blue.stroke);
  const rightIcon = slotIcon(right.icon, 466, 168, 28, C.amber.stroke);
  // With an icon resting on the pan, the label pair moves up to clear it.
  const lLabelY = leftIcon ? 140 : 160;
  const rLabelY = rightIcon ? 140 : 160;

  // Balance beam with two pans. Slight tilt: render level for neutrality.
  const body = `
    ${question ? `<text x="340" y="48" font-size="12" font-weight="500" fill="${C.inkMuted}" text-anchor="middle">${esc(question)}</text>` : ""}
    <!-- Fulcrum base -->
    <path d="M 300 360 L 340 280 L 380 360 Z" fill="${C.gray.fill}" stroke="${C.gray.stroke}" stroke-width="1.5"/>
    <rect x="280" y="358" width="120" height="6" rx="2" ry="2" fill="${C.gray.stroke}"/>
    <!-- Beam (level) -->
    <rect x="140" y="276" width="400" height="6" rx="3" ry="3" fill="${C.gray.stroke}"/>
    <!-- Left pan suspender -->
    <line x1="200" y1="282" x2="200" y2="200" stroke="${C.gray.stroke}" stroke-width="1.5"/>
    <line x1="200" y1="282" x2="160" y2="220" stroke="${C.gray.stroke}" stroke-width="1.5"/>
    <line x1="200" y1="282" x2="240" y2="220" stroke="${C.gray.stroke}" stroke-width="1.5"/>
    <!-- Left pan -->
    <path d="M 140 200 Q 200 240, 260 200" fill="${C.blue.fill}" stroke="${C.blue.stroke}" stroke-width="1.5"/>
    <line x1="140" y1="200" x2="260" y2="200" stroke="${C.blue.stroke}" stroke-width="1.5"/>
    <!-- Right pan suspender -->
    <line x1="480" y1="282" x2="480" y2="200" stroke="${C.gray.stroke}" stroke-width="1.5"/>
    <line x1="480" y1="282" x2="440" y2="220" stroke="${C.gray.stroke}" stroke-width="1.5"/>
    <line x1="480" y1="282" x2="520" y2="220" stroke="${C.gray.stroke}" stroke-width="1.5"/>
    <!-- Right pan -->
    <path d="M 420 200 Q 480 240, 540 200" fill="${C.amber.fill}" stroke="${C.amber.stroke}" stroke-width="1.5"/>
    <line x1="420" y1="200" x2="540" y2="200" stroke="${C.amber.stroke}" stroke-width="1.5"/>
    <!-- Icons resting on the pans -->
    ${leftIcon}
    ${rightIcon}
    <!-- Labels above pans -->
    <text x="200" y="${lLabelY}" font-size="14" font-weight="500" fill="${C.blue.text}" text-anchor="middle">${esc(left.label)}</text>
    ${left.sub ? `<text x="200" y="${lLabelY + 18}" font-size="12" fill="${C.inkSoft}" text-anchor="middle">${esc(left.sub)}</text>` : ""}
    <text x="480" y="${rLabelY}" font-size="14" font-weight="500" fill="${C.amber.text}" text-anchor="middle">${esc(right.label)}</text>
    ${right.sub ? `<text x="480" y="${rLabelY + 18}" font-size="12" fill="${C.inkSoft}" text-anchor="middle">${esc(right.sub)}</text>` : ""}
    ${renderScaleFactors(items)}
  `;
  return svgWrap(H, `${left.label} vs ${right.label}`, question, body);
}

/**
 * Bottom "WEIGHED" strip — items as small pills below the fulcrum
 * showing the factors being judged on the scale. Single row when items
 * fit; wraps to a second row past 4 items at typical widths.
 */
function renderScaleFactors(
  items: ReadonlyArray<{ name: string; sub?: string | null }>
): string {
  if (items.length === 0) return "";
  const FACTORS_Y = 408;
  const PILL_H = 24;
  const PILL_GAP = 10;
  // Greedy fit into rows up to ~600px wide.
  const ROW_W = 600;
  const charW = 6.6;

  const pills = items.map((it) => {
    const name = it.name.length > 28 ? it.name.slice(0, 27) + "…" : it.name;
    const w = Math.round(name.length * charW + 28);
    return { name, w };
  });

  const rows: Array<typeof pills> = [[]];
  let used = 0;
  for (const p of pills) {
    const need = (rows[rows.length - 1].length > 0 ? PILL_GAP : 0) + p.w;
    if (used + need > ROW_W && rows[rows.length - 1].length > 0) {
      rows.push([p]);
      used = p.w;
    } else {
      rows[rows.length - 1].push(p);
      used += need;
    }
  }

  return rows
    .map((row, rIdx) => {
      const totalW =
        row.reduce((a, b) => a + b.w, 0) + PILL_GAP * (row.length - 1);
      let x = (680 - totalW) / 2;
      const y = FACTORS_Y + rIdx * (PILL_H + 6);
      return row
        .map((p) => {
          const cx = x + p.w / 2;
          const seg = `
            <rect x="${x}" y="${y}" width="${p.w}" height="${PILL_H}" rx="${PILL_H / 2}" ry="${PILL_H / 2}" fill="${C.paper}" stroke="${C.inkMuted}" stroke-width="1"/>
            <text x="${cx}" y="${y + PILL_H / 2 + 4}" font-size="11" font-weight="500" fill="${C.inkSoft}" text-anchor="middle">${esc(p.name)}</text>
          `;
          x += p.w + PILL_GAP;
          return seg;
        })
        .join("");
    })
    .join("");
}

function renderBranching(m: MetaphorPlan): string {
  const root = m.hub ?? { name: "Root", sub: null };
  const branches = m.items.slice(0, 4);
  if (branches.length === 0) return svgWrap(200, "Branching", "", "");
  const H = 460;
  const PALETTES = [C.blue, C.teal, C.amber, C.purple];

  // Root box at top center; branches fan out below, evenly spaced.
  const ROOT_X = 340;
  const ROOT_Y = 80;
  const ROOT_W = 200;
  const ROOT_H = 60;
  const BRANCH_Y = 280;
  const BRANCH_W = 140;
  const BRANCH_H = 76;
  const GAP = 24;
  const totalW = branches.length * BRANCH_W + (branches.length - 1) * GAP;
  const startX = 340 - totalW / 2;

  const branchEls = branches.map((b, i) => {
    const pal = PALETTES[i % PALETTES.length];
    const bx = startX + i * (BRANCH_W + GAP);
    const cx = bx + BRANCH_W / 2;
    // Curved edge from bottom-center of root to top-center of branch.
    const startY = ROOT_Y + ROOT_H;
    const midY = (startY + BRANCH_Y) / 2;
    const d = `M ${ROOT_X} ${startY} C ${ROOT_X} ${midY}, ${cx} ${midY}, ${cx} ${BRANCH_Y}`;
    const nameLines = wrap(b.name, 18, 2);
    const subLines = b.sub ? wrap(b.sub, 22, 2) : [];
    return `
      <path d="${d}" fill="none" stroke="${pal.stroke}" stroke-width="1.5" opacity="0.7"/>
      <rect x="${bx}" y="${BRANCH_Y}" width="${BRANCH_W}" height="${BRANCH_H}" rx="8" ry="8" fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="1"/>
      ${nameLines
        .map(
          (l, j) =>
            `<text x="${cx}" y="${BRANCH_Y + 24 + j * 18}" font-size="14" font-weight="500" fill="${pal.text}" text-anchor="middle">${esc(l)}</text>`
        )
        .join("")}
      ${subLines
        .map(
          (l, j) =>
            `<text x="${cx}" y="${BRANCH_Y + BRANCH_H + 18 + j * 16}" font-size="12" fill="${C.inkSoft}" text-anchor="middle">${esc(l)}</text>`
        )
        .join("")}
    `;
  });

  const rootNameLines = wrap(root.name, 24, 1);
  const rootSubLines = root.sub ? wrap(root.sub, 30, 1) : [];

  const body = `
    <rect x="${ROOT_X - ROOT_W / 2}" y="${ROOT_Y}" width="${ROOT_W}" height="${ROOT_H}" rx="8" ry="8" fill="${C.gray.fill}" stroke="${C.gray.stroke}" stroke-width="1"/>
    ${rootNameLines
      .map(
        (l) =>
          `<text x="${ROOT_X}" y="${ROOT_Y + 28}" font-size="14" font-weight="500" fill="${C.gray.text}" text-anchor="middle">${esc(l)}</text>`
      )
      .join("")}
    ${rootSubLines
      .map(
        (l) =>
          `<text x="${ROOT_X}" y="${ROOT_Y + 46}" font-size="12" fill="${C.inkSoft}" text-anchor="middle">${esc(l)}</text>`
      )
      .join("")}
    ${branchEls.join("")}
  `;
  return svgWrap(H, root.name, branches.map((b) => b.name).join(", "), body);
}

// ===== Duality (remaining) =====

function renderTugOfWar(m: MetaphorPlan): string {
  const left = m.poles[0] ?? { label: "Side A", sub: null };
  const right = m.poles[1] ?? { label: "Side B", sub: null };
  const prize = m.outcome?.name || "";
  const items = m.items.slice(0, 6);
  const leftItems = items.filter((_, i) => i % 2 === 0);
  const rightItems = items.filter((_, i) => i % 2 === 1);
  const H = items.length > 0 ? 440 : 380;

  // Geometry: the rope runs across the rope band; the two team
  // anchors (chunky tabs) clamp it at each end. Outward arrows beyond
  // the tabs visualize the direction of pull, which is what was
  // missing before — without them the scene reads as two static boxes
  // connected by a wire instead of teams *pulling*.
  const ROPE_Y = 232;
  const LEFT_TAB_X = 110;
  const RIGHT_TAB_X = 570;
  const TAB_W = 70;
  const TAB_H = 78;
  const ROPE_LEFT_X = LEFT_TAB_X + TAB_W / 2;
  const ROPE_RIGHT_X = RIGHT_TAB_X - TAB_W / 2;
  const CENTRE_X = (ROPE_LEFT_X + ROPE_RIGHT_X) / 2;

  // Rope: three thin parallel strands give a braided look; a faint
  // central highlight reads as the rope's spine. Much closer to a
  // real rope than the single line + paper-coloured dashes the old
  // code used.
  const rope = `
    <line x1="${ROPE_LEFT_X}" y1="${ROPE_Y - 3}" x2="${ROPE_RIGHT_X}" y2="${ROPE_Y - 3}" stroke="${C.gray.stroke}" stroke-width="2.5" stroke-linecap="round" opacity="0.75"/>
    <line x1="${ROPE_LEFT_X}" y1="${ROPE_Y}" x2="${ROPE_RIGHT_X}" y2="${ROPE_Y}" stroke="${C.gray.stroke}" stroke-width="3" stroke-linecap="round"/>
    <line x1="${ROPE_LEFT_X}" y1="${ROPE_Y + 3}" x2="${ROPE_RIGHT_X}" y2="${ROPE_Y + 3}" stroke="${C.gray.stroke}" stroke-width="2.5" stroke-linecap="round" opacity="0.75"/>
  `;

  // Centre marker: vertical staff + small triangular flag waving away
  // from centre. Replaces the tiny black diamond which was visually
  // invisible.
  const flag = `
    <line x1="${CENTRE_X}" y1="${ROPE_Y - 4}" x2="${CENTRE_X}" y2="${ROPE_Y - 32}" stroke="${C.ink}" stroke-width="1.8" stroke-linecap="round"/>
    <polygon points="${CENTRE_X},${ROPE_Y - 32} ${CENTRE_X + 18},${ROPE_Y - 27} ${CENTRE_X},${ROPE_Y - 22}" fill="${C.amber.stroke}"/>
  `;

  // Side anchors. Each carries the slotIcon if available, otherwise
  // three short rope-grip dashes inside the tab. Outward arrow heads
  // visualize the pull direction — the metaphor needs them to read.
  const leftAnchor = `
    <rect x="${LEFT_TAB_X - TAB_W / 2}" y="${ROPE_Y - TAB_H / 2}" width="${TAB_W}" height="${TAB_H}" rx="10" ry="10" fill="${C.blue.fill}" stroke="${C.blue.stroke}" stroke-width="1.5"/>
    ${left.icon ? slotIcon(left.icon, LEFT_TAB_X - 14, ROPE_Y - 14, 28, C.blue.stroke) : `
      <line x1="${LEFT_TAB_X - 12}" y1="${ROPE_Y - 10}" x2="${LEFT_TAB_X + 12}" y2="${ROPE_Y - 10}" stroke="${C.blue.stroke}" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="${LEFT_TAB_X - 12}" y1="${ROPE_Y}" x2="${LEFT_TAB_X + 12}" y2="${ROPE_Y}" stroke="${C.blue.stroke}" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="${LEFT_TAB_X - 12}" y1="${ROPE_Y + 10}" x2="${LEFT_TAB_X + 12}" y2="${ROPE_Y + 10}" stroke="${C.blue.stroke}" stroke-width="1.5" stroke-linecap="round"/>
    `}
    <line x1="${LEFT_TAB_X - TAB_W / 2 - 6}" y1="${ROPE_Y}" x2="${LEFT_TAB_X - TAB_W / 2 - 30}" y2="${ROPE_Y}" stroke="${C.blue.stroke}" stroke-width="2" stroke-linecap="round"/>
    <polygon points="${LEFT_TAB_X - TAB_W / 2 - 30},${ROPE_Y - 6} ${LEFT_TAB_X - TAB_W / 2 - 42},${ROPE_Y} ${LEFT_TAB_X - TAB_W / 2 - 30},${ROPE_Y + 6}" fill="${C.blue.stroke}"/>
  `;
  const rightAnchor = `
    <rect x="${RIGHT_TAB_X - TAB_W / 2}" y="${ROPE_Y - TAB_H / 2}" width="${TAB_W}" height="${TAB_H}" rx="10" ry="10" fill="${C.amber.fill}" stroke="${C.amber.stroke}" stroke-width="1.5"/>
    ${right.icon ? slotIcon(right.icon, RIGHT_TAB_X - 14, ROPE_Y - 14, 28, C.amber.stroke) : `
      <line x1="${RIGHT_TAB_X - 12}" y1="${ROPE_Y - 10}" x2="${RIGHT_TAB_X + 12}" y2="${ROPE_Y - 10}" stroke="${C.amber.stroke}" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="${RIGHT_TAB_X - 12}" y1="${ROPE_Y}" x2="${RIGHT_TAB_X + 12}" y2="${ROPE_Y}" stroke="${C.amber.stroke}" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="${RIGHT_TAB_X - 12}" y1="${ROPE_Y + 10}" x2="${RIGHT_TAB_X + 12}" y2="${ROPE_Y + 10}" stroke="${C.amber.stroke}" stroke-width="1.5" stroke-linecap="round"/>
    `}
    <line x1="${RIGHT_TAB_X + TAB_W / 2 + 6}" y1="${ROPE_Y}" x2="${RIGHT_TAB_X + TAB_W / 2 + 30}" y2="${ROPE_Y}" stroke="${C.amber.stroke}" stroke-width="2" stroke-linecap="round"/>
    <polygon points="${RIGHT_TAB_X + TAB_W / 2 + 30},${ROPE_Y - 6} ${RIGHT_TAB_X + TAB_W / 2 + 42},${ROPE_Y} ${RIGHT_TAB_X + TAB_W / 2 + 30},${ROPE_Y + 6}" fill="${C.amber.stroke}"/>
  `;

  const body = `
    ${prize ? `<text x="${CENTRE_X}" y="60" font-size="12" font-weight="500" fill="${C.inkMuted}" text-anchor="middle" letter-spacing="0.04em">${esc(prize)}</text>` : ""}
    ${rope}
    ${leftAnchor}
    ${rightAnchor}
    ${flag}
    <text x="${LEFT_TAB_X}" y="${ROPE_Y - TAB_H / 2 - 12}" font-size="14" font-weight="500" fill="${C.blue.text}" text-anchor="middle">${esc(left.label)}</text>
    ${left.sub ? `<text x="${LEFT_TAB_X}" y="${ROPE_Y + TAB_H / 2 + 22}" font-size="12" fill="${C.inkSoft}" text-anchor="middle">${esc(left.sub)}</text>` : ""}
    <text x="${RIGHT_TAB_X}" y="${ROPE_Y - TAB_H / 2 - 12}" font-size="14" font-weight="500" fill="${C.amber.text}" text-anchor="middle">${esc(right.label)}</text>
    ${right.sub ? `<text x="${RIGHT_TAB_X}" y="${ROPE_Y + TAB_H / 2 + 22}" font-size="12" fill="${C.inkSoft}" text-anchor="middle">${esc(right.sub)}</text>` : ""}
    ${renderTugTeam(leftItems, LEFT_TAB_X, "left")}
    ${renderTugTeam(rightItems, RIGHT_TAB_X, "right")}
  `;
  return svgWrap(H, `${left.label} vs ${right.label}`, prize, body);
}

/**
 * Tug-of-war team members: items stacked vertically below each side's
 * label, in the canvas footer band. Up to 3 per side at typical font.
 */
function renderTugTeam(
  items: ReadonlyArray<{ name: string; sub?: string | null }>,
  cx: number,
  side: "left" | "right"
): string {
  if (items.length === 0) return "";
  const pal = side === "left" ? C.blue : C.amber;
  const TOP_Y = 340;
  const ROW_GAP = 22;
  return items
    .slice(0, 3)
    .map((it, i) => {
      const y = TOP_Y + i * ROW_GAP;
      const trimmed = it.name.length > 20 ? it.name.slice(0, 19) + "…" : it.name;
      return `
        <circle cx="${cx - 60}" cy="${y - 4}" r="2.5" fill="${pal.stroke}"/>
        <text x="${cx - 50}" y="${y}" font-size="11" font-weight="500" fill="${pal.text}">${esc(trimmed)}</text>
      `;
    })
    .join("");
}

function renderSpectrum(m: MetaphorPlan): string {
  const left = m.poles[0] ?? { label: "Pole A", sub: null };
  const right = m.poles[1] ?? { label: "Pole B", sub: null };
  const marker = (m.hint || "").trim();
  // Items array (capped at 6) renders as labeled markers distributed
  // evenly along the spectrum. Previously items were silently dropped.
  const items = m.items.slice(0, 6);
  const H = items.length > 0 ? 380 : 320;
  const pctMatch = marker.match(/(\d+)\s*%/);
  const pct = pctMatch ? Math.min(100, Math.max(0, parseInt(pctMatch[1], 10))) : 50;
  const markerX = 80 + (pct / 100) * 520;

  // Distribute items evenly across the spectrum band. With N items,
  // first item at 80 + step/2 and stepping by 520/N keeps every item
  // visually centred in its lane (avoids labels landing on the pole
  // endpoints).
  const itemEls = items.map((it, i) => {
    const n = items.length;
    const x = 80 + (520 * (i + 0.5)) / n;
    const labelLines = wrap(it.name, 16, 2);
    const labelEls = labelLines
      .map(
        (l, k) =>
          `<text x="${x}" y="${290 + k * 16}" font-size="12" font-weight="500" fill="${C.ink}" text-anchor="middle">${esc(l)}</text>`
      )
      .join("");
    const subEl = it.sub
      ? `<text x="${x}" y="${290 + labelLines.length * 16 + 14}" font-size="11" fill="${C.inkSoft}" text-anchor="middle">${esc(it.sub)}</text>`
      : "";
    return `
      <circle cx="${x}" cy="${262}" r="4" fill="${C.ink}"/>
      <line x1="${x}" y1="${258}" x2="${x}" y2="${178}" stroke="${C.inkMuted}" stroke-width="1" stroke-dasharray="2 3" opacity="0.55"/>
      ${labelEls}
      ${subEl}
    `;
  });

  const body = `
    <rect x="80" y="170" width="173" height="6" rx="3" ry="3" fill="${C.blue.stroke}" opacity="0.75"/>
    <rect x="253" y="170" width="174" height="6" fill="${C.gray.stroke}" opacity="0.4"/>
    <rect x="427" y="170" width="173" height="6" rx="3" ry="3" fill="${C.amber.stroke}" opacity="0.75"/>
    <line x1="80" y1="160" x2="80" y2="186" stroke="${C.blue.stroke}" stroke-width="1.5"/>
    <line x1="600" y1="160" x2="600" y2="186" stroke="${C.amber.stroke}" stroke-width="1.5"/>
    ${marker
      ? `<line x1="${markerX}" y1="150" x2="${markerX}" y2="196" stroke="${C.ink}" stroke-width="2"/>
         <circle cx="${markerX}" cy="173" r="8" fill="${C.paper}" stroke="${C.ink}" stroke-width="2"/>
         <text x="${markerX}" y="140" font-size="12" font-weight="500" fill="${C.ink}" text-anchor="middle">${esc(marker)}</text>`
      : ""}
    <text x="80" y="220" font-size="14" font-weight="500" fill="${C.blue.text}">${esc(left.label)}</text>
    ${left.sub ? `<text x="80" y="238" font-size="12" fill="${C.inkSoft}">${esc(left.sub)}</text>` : ""}
    <text x="600" y="220" font-size="14" font-weight="500" fill="${C.amber.text}" text-anchor="end">${esc(right.label)}</text>
    ${right.sub ? `<text x="600" y="238" font-size="12" fill="${C.inkSoft}" text-anchor="end">${esc(right.sub)}</text>` : ""}
    ${itemEls.join("")}
  `;
  return svgWrap(H, `${left.label} ↔ ${right.label}`, marker, body);
}

// ===== Sequence (remaining) =====

function renderStaircase(m: MetaphorPlan): string {
  const steps = m.items.slice(0, 5);
  if (steps.length === 0) return svgWrap(200, "Staircase", "", "");
  const top = m.outcome;
  const H = 460;
  const STEP_W = 100;
  const STEP_H = 60;
  const RISE = 50;
  const RUN = 90;
  const BASE_X = 80;
  const BASE_Y = 380;
  const stepEls = steps.map((s, i) => {
    const x = BASE_X + i * RUN;
    const y = BASE_Y - i * RISE;
    const nameLines = wrap(s.name, 14, 2);
    return `
      <rect x="${x}" y="${y}" width="${STEP_W}" height="${STEP_H}" fill="${C.blue.fill}" stroke="${C.blue.stroke}" stroke-width="1.5"/>
      ${slotIcon(s.icon, x + STEP_W / 2 - 11, y - 50, 22, C.blue.stroke)}
      <text x="${x + STEP_W / 2}" y="${y - 8}" font-size="12" font-weight="500" fill="${C.blue.stroke}" text-anchor="middle">STEP ${i + 1}</text>
      ${nameLines.map((l, j) => `<text x="${x + STEP_W / 2}" y="${y + 26 + j * 16}" font-size="14" font-weight="500" fill="${C.blue.text}" text-anchor="middle">${esc(l)}</text>`).join("")}
      ${s.sub ? `<text x="${x + STEP_W / 2}" y="${y + STEP_H - 8}" font-size="12" fill="${C.inkSoft}" text-anchor="middle">${esc(s.sub)}</text>` : ""}
    `;
  });
  const topX = BASE_X + steps.length * RUN;
  const topY = BASE_Y - steps.length * RISE;
  const topEl = top
    ? `<text x="${topX + 20}" y="${topY + 20}" font-size="14" font-weight="500" fill="${C.amber.text}">↑ ${esc(top.name)}</text>${top.sub ? `<text x="${topX + 20}" y="${topY + 38}" font-size="12" fill="${C.inkSoft}">${esc(top.sub)}</text>` : ""}`
    : "";
  return svgWrap(H, top?.name || "Stages", steps.map((s) => s.name).join(" → "), stepEls.join("") + topEl);
}

function renderGarden(m: MetaphorPlan): string {
  const phases = m.items.slice(0, 5);
  if (phases.length === 0) return svgWrap(200, "Garden", "", "");
  const bloom = m.outcome;
  const H = 460;
  const STEM = "M 80 420 Q 200 380 280 320 T 480 200 T 620 100";
  const POS: Record<number, Array<{ x: number; y: number }>> = {
    1: [{ x: 340, y: 260 }],
    2: [{ x: 180, y: 380 }, { x: 500, y: 160 }],
    3: [{ x: 130, y: 400 }, { x: 340, y: 280 }, { x: 560, y: 140 }],
    4: [{ x: 130, y: 400 }, { x: 280, y: 320 }, { x: 440, y: 220 }, { x: 580, y: 130 }],
    5: [{ x: 130, y: 400 }, { x: 240, y: 340 }, { x: 360, y: 260 }, { x: 480, y: 190 }, { x: 600, y: 120 }],
  };
  const positions = POS[phases.length] || POS[3];
  const SIZES = [10, 14, 18, 22, 26];
  const phaseEls = phases.map((p, i) => {
    const pos = positions[i];
    const size = SIZES[Math.min(i, SIZES.length - 1)];
    const above = i % 2 === 0;
    const ly = above ? pos.y - size - 14 : pos.y + size + 22;
    return `
      <circle cx="${pos.x}" cy="${pos.y}" r="${size}" fill="${C.teal.fill}" stroke="${C.teal.stroke}" stroke-width="1.5"/>
      <text x="${pos.x}" y="${ly}" font-size="14" font-weight="500" fill="${C.teal.text}" text-anchor="middle">${esc(p.name)}</text>
      ${p.sub ? `<text x="${pos.x}" y="${ly + (above ? -16 : 16)}" font-size="12" fill="${C.inkSoft}" text-anchor="middle">${esc(p.sub)}</text>` : ""}
    `;
  });
  const bloomEl = bloom
    ? `<text x="620" y="84" font-size="14" font-weight="500" fill="${C.teal.text}" text-anchor="end">→ ${esc(bloom.name)}</text>`
    : "";
  const body = `
    <path d="${STEM}" fill="none" stroke="${C.teal.stroke}" stroke-width="3" stroke-linecap="round" opacity="0.45"/>
    <path d="${STEM}" fill="none" stroke="${C.teal.stroke}" stroke-width="1.5" stroke-linecap="round"/>
    ${phaseEls.join("")}
    ${bloomEl}
  `;
  return svgWrap(H, bloom?.name || "Growth", phases.map((p) => p.name).join(" → "), body);
}

function renderDomino(m: MetaphorPlan): string {
  const events = m.items.slice(0, 5);
  if (events.length === 0) return svgWrap(200, "Domino", "", "");
  const H = 440;
  const D_W = 30;
  const D_H = 80;
  const D_GAP = 90;
  const BASE_Y = 280;
  const totalW = events.length * D_W + (events.length - 1) * D_GAP;
  const startX = (680 - totalW) / 2;
  const dominoEls = events.map((e, i) => {
    const x = startX + i * (D_W + D_GAP);
    const transform = i === 0 ? `transform="rotate(-30 ${x + D_W / 2} ${BASE_Y + D_H})"` : "";
    const nameLines = wrap(e.name, 14, 2);
    return `
      <rect x="${x}" y="${BASE_Y}" width="${D_W}" height="${D_H}" rx="2" ry="2" fill="${C.purple.fill}" stroke="${C.purple.stroke}" stroke-width="1.5" ${transform}/>
      <text x="${x + D_W / 2}" y="${BASE_Y - 16}" font-size="12" font-weight="500" fill="${C.purple.stroke}" text-anchor="middle">${i + 1}</text>
      ${nameLines.map((l, j) => `<text x="${x + D_W / 2}" y="${BASE_Y + D_H + 24 + j * 16}" font-size="13" font-weight="500" fill="${C.ink}" text-anchor="middle">${esc(l)}</text>`).join("")}
      ${e.sub ? `<text x="${x + D_W / 2}" y="${BASE_Y + D_H + 24 + nameLines.length * 16 + 4}" font-size="12" fill="${C.inkSoft}" text-anchor="middle">${esc(e.sub)}</text>` : ""}
    `;
  });
  const arrowY = 100;
  const arrowStart = startX + D_W;
  const arrowEnd = startX + (events.length - 1) * (D_W + D_GAP);
  return svgWrap(
    H,
    "Cascade",
    events.map((e) => e.name).join(" → "),
    `
      <path d="M ${arrowStart} ${arrowY} Q ${(arrowStart + arrowEnd) / 2} 50, ${arrowEnd} ${arrowY}" fill="none" stroke="${C.purple.stroke}" stroke-width="1.5" stroke-dasharray="4 5"/>
      <path d="M ${arrowEnd - 10} ${arrowY - 6} L ${arrowEnd + 4} ${arrowY} L ${arrowEnd - 10} ${arrowY + 6} Z" fill="${C.purple.stroke}"/>
      ${dominoEls.join("")}
      <line x1="40" y1="${BASE_Y + D_H + 2}" x2="640" y2="${BASE_Y + D_H + 2}" stroke="${C.line}" stroke-width="1"/>
    `
  );
}

function renderWeaving(m: MetaphorPlan): string {
  const threads = m.items.slice(0, 4);
  if (threads.length === 0) return svgWrap(200, "Weaving", "", "");
  const fabric = m.outcome;
  const H = 420;
  const PALETTES = [C.blue, C.amber, C.purple, C.teal];
  const startX = 60;
  const fabricX = 480;
  const fabricW = 120;
  const fabricY = 160;
  const fabricH = 120;
  const threadEls = threads.map((t, i) => {
    const pal = PALETTES[i % PALETTES.length];
    const sy = 120 + i * 40;
    const wobble = i % 2 === 0 ? 40 : -40;
    const d = `M ${startX} ${sy} C 200 ${sy + wobble}, 320 ${sy - wobble}, ${fabricX} ${fabricY + (i + 0.5) * (fabricH / threads.length)}`;
    return `
      <path d="${d}" fill="none" stroke="${pal.stroke}" stroke-width="3" stroke-linecap="round" opacity="0.75"/>
      <text x="40" y="${sy + 4}" font-size="12" font-weight="500" fill="${pal.text}">${esc(t.name)}</text>
    `;
  });
  const hLines = [0, 1, 2, 3, 4, 5]
    .map(
      (i) =>
        `<line x1="${fabricX}" y1="${fabricY + 20 + i * 20}" x2="${fabricX + fabricW}" y2="${fabricY + 20 + i * 20}" stroke="${C.gray.stroke}" stroke-width="0.5" opacity="0.3"/>`
    )
    .join("");
  const vLines = [0, 1, 2, 3, 4]
    .map(
      (i) =>
        `<line x1="${fabricX + 20 + i * 20}" y1="${fabricY}" x2="${fabricX + 20 + i * 20}" y2="${fabricY + fabricH}" stroke="${C.gray.stroke}" stroke-width="0.5" opacity="0.3"/>`
    )
    .join("");
  return svgWrap(
    H,
    fabric?.name || "Fabric",
    threads.map((t) => t.name).join(" + "),
    `
      ${threadEls.join("")}
      <rect x="${fabricX}" y="${fabricY}" width="${fabricW}" height="${fabricH}" rx="6" ry="6" fill="${C.gray.fill}" stroke="${C.gray.stroke}" stroke-width="1.5"/>
      ${hLines}
      ${vLines}
      ${fabric ? `<text x="${fabricX + fabricW / 2}" y="${fabricY + fabricH + 28}" font-size="14" font-weight="500" fill="${C.ink}" text-anchor="middle">${esc(fabric.name)}</text>` : ""}
      ${fabric?.sub ? `<text x="${fabricX + fabricW / 2}" y="${fabricY + fabricH + 46}" font-size="12" fill="${C.inkSoft}" text-anchor="middle">${esc(fabric.sub)}</text>` : ""}
    `
  );
}

// ===== Many-to-one / one-to-many (remaining) =====

function renderFunnel(m: MetaphorPlan): string {
  const stages = m.items.slice(0, 4);
  if (stages.length === 0) return svgWrap(200, "Funnel", "", "");
  const output = m.hub ?? m.outcome ?? { name: "Result", sub: null };
  const H = 480;
  const TOP_Y = 60;
  const BOT_Y = 360;
  const TOP_HALF = 180;
  const BOT_HALF = 40;
  const CENTER = 340;
  const SECTION_H = (BOT_Y - TOP_Y) / stages.length;
  const PAL_BY_INDEX = [C.blue, C.teal, C.purple, C.amber];
  const stageEls = stages.map((s, i) => {
    const y1 = TOP_Y + i * SECTION_H;
    const y2 = TOP_Y + (i + 1) * SECTION_H;
    const tFrac1 = (y1 - TOP_Y) / (BOT_Y - TOP_Y);
    const tFrac2 = (y2 - TOP_Y) / (BOT_Y - TOP_Y);
    const half1 = TOP_HALF - (TOP_HALF - BOT_HALF) * tFrac1;
    const half2 = TOP_HALF - (TOP_HALF - BOT_HALF) * tFrac2;
    const pal = PAL_BY_INDEX[i % PAL_BY_INDEX.length];
    const poly = `${CENTER - half1},${y1} ${CENTER + half1},${y1} ${CENTER + half2},${y2} ${CENTER - half2},${y2}`;
    const midY = (y1 + y2) / 2;
    const nameLines = wrap(s.name, 22, 1);
    return `
      <polygon points="${poly}" fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="1"/>
      <text x="${CENTER}" y="${midY + 5}" font-size="14" font-weight="500" fill="${pal.text}" text-anchor="middle">${esc(nameLines[0])}</text>
      ${s.sub ? `<text x="${CENTER + half1 + 16}" y="${midY + 4}" font-size="12" fill="${C.inkSoft}">${esc(s.sub)}</text>` : ""}
    `;
  });
  return svgWrap(
    H,
    output.name,
    stages.map((s) => s.name).join(" → "),
    `
      ${stageEls.join("")}
      <line x1="${CENTER}" y1="${BOT_Y}" x2="${CENTER}" y2="${BOT_Y + 24}" stroke="${C.gray.stroke}" stroke-width="2"/>
      <path d="M ${CENTER - 8} ${BOT_Y + 20} L ${CENTER} ${BOT_Y + 32} L ${CENTER + 8} ${BOT_Y + 20} Z" fill="${C.gray.stroke}"/>
      <text x="${CENTER}" y="${BOT_Y + 60}" font-size="14" font-weight="500" fill="${C.ink}" text-anchor="middle">${esc(output.name)}</text>
      ${output.sub ? `<text x="${CENTER}" y="${BOT_Y + 78}" font-size="12" fill="${C.inkSoft}" text-anchor="middle">${esc(output.sub)}</text>` : ""}
    `
  );
}

function renderRipple(m: MetaphorPlan): string {
  const waves = m.items.slice(0, 4);
  if (waves.length === 0) return svgWrap(200, "Ripple", "", "");
  const epicenter = m.hub ?? { name: "Event", sub: null };
  const H = 460;
  const CX = 220;
  const CY = 230;
  const RADII = [50, 100, 150, 200];
  const ringEls = waves.map((_, i) => {
    const r = RADII[i] ?? RADII[RADII.length - 1];
    const opacity = (1 - i * 0.18).toFixed(2);
    return `<circle cx="${CX}" cy="${CY}" r="${r}" fill="none" stroke="${C.purple.stroke}" stroke-width="1.5" opacity="${opacity}"/>`;
  });
  const labelX = 460;
  const labelEls = waves.map((w, i) => {
    const r = RADII[i] ?? RADII[RADII.length - 1];
    const ly = 100 + i * 80;
    const lineY = CY + (i % 2 === 0 ? -20 : 20);
    const lineX1 = CX + Math.round(r * 0.95);
    return `
      <line x1="${lineX1}" y1="${lineY}" x2="${labelX - 8}" y2="${ly - 4}" stroke="${C.inkMuted}" stroke-width="1" opacity="0.45"/>
      <text x="${labelX}" y="${ly}" font-size="14" font-weight="500" fill="${C.purple.text}">${esc(w.name)}</text>
      ${w.sub ? `<text x="${labelX}" y="${ly + 18}" font-size="12" fill="${C.inkSoft}">${esc(w.sub)}</text>` : ""}
    `;
  });
  return svgWrap(
    H,
    epicenter.name,
    waves.map((w) => w.name).join(", "),
    `
      ${ringEls.join("")}
      <circle cx="${CX}" cy="${CY}" r="8" fill="${C.purple.stroke}"/>
      <circle cx="${CX}" cy="${CY}" r="14" fill="none" stroke="${C.purple.stroke}" stroke-width="2"/>
      <text x="${CX}" y="${CY + 36}" font-size="14" font-weight="500" fill="${C.ink}" text-anchor="middle">${esc(epicenter.name)}</text>
      ${epicenter.sub ? `<text x="${CX}" y="${CY + 54}" font-size="12" fill="${C.inkSoft}" text-anchor="middle">${esc(epicenter.sub)}</text>` : ""}
      ${labelEls.join("")}
    `
  );
}

function renderCrossroads(m: MetaphorPlan): string {
  const paths = m.items.slice(0, 3);
  if (paths.length === 0) return svgWrap(200, "Crossroads", "", "");
  const start = m.hub ?? { name: "Decision", sub: null };
  const H = 480;
  const ROAD_BOTTOM = 420;
  const SPLIT_Y = 290;
  const PATH_TOP_Y = 140;
  const CX = 340;
  const TOP_XS: Record<number, number[]> = { 1: [340], 2: [200, 480], 3: [120, 340, 560] };
  const tops = TOP_XS[paths.length] || TOP_XS[3];
  const PAL = [C.blue, C.amber, C.teal, C.purple];
  const pathEls = paths.map((p, i) => {
    const tx = tops[i] ?? CX;
    const pal = PAL[i % PAL.length];
    const d = `M ${CX} ${SPLIT_Y} C ${CX} ${SPLIT_Y - 60}, ${tx} ${SPLIT_Y - 40}, ${tx} ${PATH_TOP_Y}`;
    const nameLines = wrap(p.name, 14, 2);
    const subLines = p.sub ? wrap(p.sub, 18, 2) : [];
    return `
      <path d="${d}" fill="none" stroke="${pal.stroke}" stroke-width="6" stroke-linecap="round" opacity="0.4"/>
      <path d="${d}" fill="none" stroke="${pal.stroke}" stroke-width="2"/>
      <rect x="${tx - 56}" y="${PATH_TOP_Y - 68}" width="112" height="54" rx="6" ry="6" fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="1"/>
      ${slotIcon(p.icon, tx - 13, PATH_TOP_Y - 100, 26, pal.stroke)}
      ${nameLines.map((l, j) => `<text x="${tx}" y="${PATH_TOP_Y - 44 + j * 16}" font-size="14" font-weight="500" fill="${pal.text}" text-anchor="middle">${esc(l)}</text>`).join("")}
      ${subLines.map((l, j) => `<text x="${tx}" y="${PATH_TOP_Y + 14 + j * 16}" font-size="12" fill="${C.inkSoft}" text-anchor="middle">${esc(l)}</text>`).join("")}
    `;
  });
  return svgWrap(
    H,
    start.name,
    paths.map((p) => p.name).join(" / "),
    `
      <line x1="${CX}" y1="${ROAD_BOTTOM}" x2="${CX}" y2="${SPLIT_Y}" stroke="${C.gray.stroke}" stroke-width="10" stroke-linecap="round" opacity="0.4"/>
      <line x1="${CX}" y1="${ROAD_BOTTOM}" x2="${CX}" y2="${SPLIT_Y}" stroke="${C.gray.stroke}" stroke-width="2"/>
      ${pathEls.join("")}
      <circle cx="${CX}" cy="${SPLIT_Y}" r="10" fill="${C.paper}" stroke="${C.ink}" stroke-width="2"/>
      <text x="${CX}" y="${ROAD_BOTTOM + 28}" font-size="14" font-weight="500" fill="${C.ink}" text-anchor="middle">${esc(start.name)}</text>
      ${start.sub ? `<text x="${CX}" y="${ROAD_BOTTOM + 46}" font-size="12" fill="${C.inkSoft}" text-anchor="middle">${esc(start.sub)}</text>` : ""}
    `
  );
}

// ===== Focus =====

function renderLighthouse(m: MetaphorPlan): string {
  const noise = m.items.slice(0, 4);
  const signal = m.hub ?? m.outcome ?? { name: "Signal", sub: null };
  const H = 460;
  const LH_X = 110;
  const LH_BASE_Y = 380;
  const LH_TOP_Y = 180;
  const LIGHT_Y = LH_TOP_Y + 10;
  const cone = `
    <polygon points="${LH_X + 30},${LIGHT_Y} 620,${LIGHT_Y - 110} 620,${LIGHT_Y + 110}" fill="${C.amber.fill}" opacity="0.45"/>
    <polygon points="${LH_X + 30},${LIGHT_Y} 620,${LIGHT_Y - 60} 620,${LIGHT_Y + 60}" fill="${C.amber.fill}" opacity="0.7"/>
  `;
  const lighthouse = `
    <path d="M ${LH_X - 30} ${LH_BASE_Y} L ${LH_X + 30} ${LH_BASE_Y} L ${LH_X + 20} ${LH_TOP_Y + 30} L ${LH_X - 20} ${LH_TOP_Y + 30} Z" fill="${C.paper}" stroke="${C.ink}" stroke-width="1.5"/>
    <rect x="${LH_X - 22}" y="${LH_TOP_Y + 20}" width="44" height="10" fill="${C.ink}"/>
    <rect x="${LH_X - 16}" y="${LH_TOP_Y}" width="32" height="22" fill="${C.amber.stroke}" stroke="${C.ink}" stroke-width="1.5"/>
    <polygon points="${LH_X - 18},${LH_TOP_Y} ${LH_X + 18},${LH_TOP_Y} ${LH_X},${LH_TOP_Y - 16}" fill="${C.ink}"/>
    <line x1="${LH_X - 26}" y1="${LH_BASE_Y - 30}" x2="${LH_X + 26}" y2="${LH_BASE_Y - 30}" stroke="${C.ink}" stroke-width="1"/>
    <line x1="${LH_X - 24}" y1="${LH_BASE_Y - 60}" x2="${LH_X + 24}" y2="${LH_BASE_Y - 60}" stroke="${C.ink}" stroke-width="1"/>
  `;
  const signalEl = `
    <text x="620" y="${LIGHT_Y - 6}" font-size="14" font-weight="500" fill="${C.amber.text}" text-anchor="end">${esc(signal.name)}</text>
    ${signal.sub ? `<text x="620" y="${LIGHT_Y + 12}" font-size="12" fill="${C.inkSoft}" text-anchor="end">${esc(signal.sub)}</text>` : ""}
  `;
  const NOISE_POS = [
    { x: 280, y: 80 },
    { x: 440, y: 110 },
    { x: 340, y: 380 },
    { x: 520, y: 410 },
  ];
  const noiseEls = noise.map((n, i) => {
    const pos = NOISE_POS[i % NOISE_POS.length];
    return `
      <circle cx="${pos.x}" cy="${pos.y}" r="4" fill="${C.gray.stroke}" opacity="0.5"/>
      <text x="${pos.x + 10}" y="${pos.y + 5}" font-size="12" fill="${C.inkMuted}">${esc(n.name)}</text>
    `;
  });
  return svgWrap(H, signal.name, `Among ${noise.length} distractions`, `${cone}${lighthouse}${signalEl}${noiseEls.join("")}`);
}

function renderSpotlight(m: MetaphorPlan): string {
  const others = m.items.slice(0, 6);
  const focus = m.hub ?? m.outcome ?? { name: "Focus", sub: null };
  const H = 460;
  const CX = 340;
  const CY = 240;
  const OTHER_POS = [
    { x: 100, y: 130 },
    { x: 580, y: 130 },
    { x: 80, y: 360 },
    { x: 600, y: 360 },
    { x: 340, y: 420 },
    { x: 340, y: 60 },
  ];
  const otherEls = others.map((o, i) => {
    const pos = OTHER_POS[i % OTHER_POS.length];
    return `
      <circle cx="${pos.x}" cy="${pos.y}" r="22" fill="${C.gray.fill}" stroke="${C.gray.stroke}" stroke-width="1" opacity="0.45"/>
      <text x="${pos.x}" y="${pos.y + 5}" font-size="12" fill="${C.inkMuted}" text-anchor="middle" opacity="0.8">${esc(o.name.slice(0, 14))}</text>
    `;
  });
  return svgWrap(
    H,
    focus.name,
    `Picked out of ${others.length}`,
    `
      <rect x="0" y="0" width="680" height="${H}" fill="${C.gray.stroke}" opacity="0.04"/>
      ${otherEls.join("")}
      <polygon points="${CX - 30},20 ${CX + 30},20 ${CX + 110},${CY + 60} ${CX - 110},${CY + 60}" fill="${C.amber.fill}" opacity="0.5"/>
      <circle cx="${CX}" cy="${CY}" r="60" fill="${C.amber.fill}" stroke="${C.amber.stroke}" stroke-width="2"/>
      <circle cx="${CX}" cy="${CY}" r="50" fill="${C.amber.fill}" opacity="0.5"/>
      <text x="${CX}" y="${CY + 4}" font-size="14" font-weight="500" fill="${C.amber.text}" text-anchor="middle">${esc(focus.name)}</text>
      ${focus.sub ? `<text x="${CX}" y="${CY + 22}" font-size="12" fill="${C.inkSoft}" text-anchor="middle">${esc(focus.sub)}</text>` : ""}
    `
  );
}

function renderOrbits(m: MetaphorPlan): string {
  const sats = m.items.slice(0, 5);
  const center = m.hub ?? { name: "Core", sub: null };
  const H = 460;
  const CX = 340;
  const CY = 230;
  const ORBIT_RADII = [90, 140, 190, 230];
  const SAT_ANGLES = [30, 100, 200, 280, 340];
  const orbitRings = sats
    .map((_, i) => {
      const r = ORBIT_RADII[i % ORBIT_RADII.length];
      return `<ellipse cx="${CX}" cy="${CY}" rx="${r}" ry="${Math.round(r * 0.65)}" fill="none" stroke="${C.gray.stroke}" stroke-width="1" opacity="0.3"/>`;
    })
    .join("");
  const satEls = sats.map((s, i) => {
    const r = ORBIT_RADII[i % ORBIT_RADII.length];
    const angle = (SAT_ANGLES[i % SAT_ANGLES.length] * Math.PI) / 180;
    const sx = Math.round(CX + r * Math.cos(angle));
    const sy = Math.round(CY + r * 0.65 * Math.sin(angle));
    const labelRight = sx > CX;
    const lx = labelRight ? sx + 16 : sx - 16;
    const anchor = labelRight ? "start" : "end";
    const nameLines = wrap(s.name, 18, 2);
    return `
      <circle cx="${sx}" cy="${sy}" r="14" fill="${C.blue.fill}" stroke="${C.blue.stroke}" stroke-width="1.5"/>
      <text x="${lx}" y="${sy + 5}" font-size="14" font-weight="500" fill="${C.blue.text}" text-anchor="${anchor}">${esc(nameLines[0])}</text>
      ${s.sub ? `<text x="${lx}" y="${sy + 22}" font-size="12" fill="${C.inkSoft}" text-anchor="${anchor}">${esc(s.sub)}</text>` : ""}
    `;
  });
  return svgWrap(
    H,
    center.name,
    sats.map((s) => s.name).join(", "),
    `
      ${orbitRings}
      ${satEls.join("")}
      <circle cx="${CX}" cy="${CY}" r="28" fill="${C.amber.fill}" stroke="${C.amber.stroke}" stroke-width="2"/>
      <text x="${CX}" y="${CY + 5}" font-size="14" font-weight="500" fill="${C.amber.text}" text-anchor="middle">${esc(center.name)}</text>
    `
  );
}

// ===== Cycle =====

function renderLoop(m: MetaphorPlan): string {
  const phases = m.items.slice(0, 5);
  if (phases.length === 0) return svgWrap(200, "Loop", "", "");
  const H = 460;
  const CX = 340;
  const CY = 230;
  const R = 140;
  const PALETTES = [C.blue, C.teal, C.amber, C.purple, C.gray];
  const positions = phases.map((_, i) => {
    const angle = ((-90 + (i * 360) / phases.length) * Math.PI) / 180;
    return { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) };
  });
  const phaseEls = phases.map((p, i) => {
    const pos = positions[i];
    const pal = PALETTES[i % PALETTES.length];
    const nameLines = wrap(p.name, 14, 2);
    return `
      <circle cx="${pos.x}" cy="${pos.y}" r="40" fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="1.5"/>
      ${nameLines.map((l, j) => `<text x="${pos.x}" y="${pos.y + 4 + j * 14 - (nameLines.length - 1) * 7}" font-size="12" font-weight="500" fill="${pal.text}" text-anchor="middle">${esc(l)}</text>`).join("")}
      ${p.sub ? `<text x="${pos.x}" y="${pos.y + 58}" font-size="12" fill="${C.inkMuted}" text-anchor="middle">${esc(p.sub)}</text>` : ""}
    `;
  });
  const arrows = positions.map((p, i) => {
    const next = positions[(i + 1) % positions.length];
    // Straight line from edge to edge along the outer cycle
    const dx = next.x - p.x;
    const dy = next.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / dist;
    const uy = dy / dist;
    const fromX = Math.round(p.x + ux * 42);
    const fromY = Math.round(p.y + uy * 42);
    const toX = Math.round(next.x - ux * 50);
    const toY = Math.round(next.y - uy * 50);
    return `<line x1="${fromX}" y1="${fromY}" x2="${toX}" y2="${toY}" stroke="${C.gray.stroke}" stroke-width="1.5" marker-end="url(#chev-loop)" opacity="0.7"/>`;
  });
  return svgWrap(
    H,
    "Cycle",
    phases.map((p) => p.name).join(" → "),
    `
      <defs>
        <marker id="chev-loop" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10" fill="none" stroke="${C.gray.stroke}" stroke-width="1.5"/>
        </marker>
      </defs>
      ${arrows.join("")}
      ${phaseEls.join("")}
    `
  );
}

function renderTide(m: MetaphorPlan): string {
  const phases = m.items.slice(0, 4);
  const period = m.hint || "";
  const H = 400;
  const POINTS = [
    { x: 150, y: 100, side: "high" as const },
    { x: 330, y: 300, side: "low" as const },
    { x: 510, y: 100, side: "high" as const },
    { x: 600, y: 200, side: "level" as const },
  ];
  const phaseEls = phases.map((p, i) => {
    const pt = POINTS[i % POINTS.length];
    const labelY = pt.side === "high" ? pt.y - 16 : pt.y + 30;
    return `
      <circle cx="${pt.x}" cy="${pt.y}" r="6" fill="${C.blue.stroke}"/>
      <text x="${pt.x}" y="${labelY}" font-size="14" font-weight="500" fill="${C.blue.text}" text-anchor="middle">${esc(p.name)}</text>
      ${p.sub ? `<text x="${pt.x}" y="${labelY + (pt.side === "high" ? -16 : 16)}" font-size="12" fill="${C.inkSoft}" text-anchor="middle">${esc(p.sub)}</text>` : ""}
    `;
  });
  return svgWrap(
    H,
    "Tide",
    period,
    `
      ${period ? `<text x="340" y="40" font-size="12" font-weight="500" fill="${C.inkMuted}" text-anchor="middle">${esc(period)}</text>` : ""}
      <line x1="40" y1="200" x2="640" y2="200" stroke="${C.line}" stroke-width="1" stroke-dasharray="3 4"/>
      <path d="M 60 200 Q 150 100, 240 200 T 420 200 T 600 200" fill="none" stroke="${C.blue.stroke}" stroke-width="2.5" stroke-linecap="round"/>
      ${phaseEls.join("")}
    `
  );
}

function renderEngine(m: MetaphorPlan): string {
  const stages = m.items.slice(0, 4);
  const process = m.hub ?? { name: "Process", sub: null };
  const output = m.outcome ?? { name: "Output", sub: null };
  const H = 380;
  const BOX_X = 200;
  const BOX_Y = 130;
  const BOX_W = 280;
  const BOX_H = 110;
  const CENTER_Y = BOX_Y + BOX_H / 2;
  const stageBadges = stages.map((s, i) => {
    const gap = BOX_W / (stages.length + 1);
    const cx = BOX_X + gap * (i + 1);
    return `
      <circle cx="${cx}" cy="${CENTER_Y - 10}" r="14" fill="${C.amber.fill}" stroke="${C.amber.stroke}" stroke-width="1.5"/>
      <text x="${cx}" y="${CENTER_Y - 5}" font-size="12" font-weight="500" fill="${C.amber.text}" text-anchor="middle">${i + 1}</text>
      <text x="${cx}" y="${CENTER_Y + 24}" font-size="12" fill="${C.ink}" text-anchor="middle">${esc(s.name.slice(0, 14))}</text>
    `;
  });
  return svgWrap(
    H,
    process.name,
    stages.map((s) => s.name).join(" → "),
    `
      <line x1="60" y1="${CENTER_Y}" x2="${BOX_X - 22}" y2="${CENTER_Y}" stroke="${C.gray.stroke}" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M ${BOX_X - 28} ${CENTER_Y - 8} L ${BOX_X - 12} ${CENTER_Y} L ${BOX_X - 28} ${CENTER_Y + 8} Z" fill="${C.gray.stroke}"/>
      <text x="60" y="${CENTER_Y - 14}" font-size="12" font-weight="500" fill="${C.inkMuted}">INPUT</text>
      <rect x="${BOX_X}" y="${BOX_Y}" width="${BOX_W}" height="${BOX_H}" rx="10" ry="10" fill="${C.amber.fill}" stroke="${C.amber.stroke}" stroke-width="1.5"/>
      <text x="${BOX_X + BOX_W / 2}" y="${BOX_Y + 22}" font-size="12" font-weight="500" fill="${C.amber.stroke}" text-anchor="middle">${esc(process.name)}</text>
      ${stageBadges.join("")}
      <line x1="${BOX_X + BOX_W + 12}" y1="${CENTER_Y}" x2="620" y2="${CENTER_Y}" stroke="${C.gray.stroke}" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M 614 ${CENTER_Y - 8} L 628 ${CENTER_Y} L 614 ${CENTER_Y + 8} Z" fill="${C.gray.stroke}"/>
      <text x="620" y="${CENTER_Y - 14}" font-size="12" font-weight="500" fill="${C.ink}" text-anchor="end">${esc(output.name)}</text>
    `
  );
}

function renderGears(m: MetaphorPlan): string {
  // Cap raised from 3 → 4 (Phase 2E.2c). 4 gears across a 680-wide
  // canvas is the practical visual maximum — shrinking further loses
  // the teeth detail that makes the metaphor read as gears.
  const gears = m.items.slice(0, 4);
  if (gears.length === 0) return svgWrap(200, "Gears", "", "");
  const H = 420;
  const TOOTH_DEPTH_RATIO = 0.18;

  // Sizes get smaller down the chain — bigger upstream gear drives a
  // smaller one. Centres are placed so adjacent gears MESH (centre
  // distance = r1 + r2 - small overlap) instead of floating apart.
  // Without this, the panel reads as "four decorative wheels," not as
  // a connected system.
  const SIZES = [
    { r: 52, teeth: 12 },
    { r: 42, teeth: 10 },
    { r: 34, teeth: 9 },
    { r: 28, teeth: 8 },
  ];
  const PALETTES = [C.amber, C.blue, C.teal, C.purple];

  const placed = SIZES.slice(0, gears.length).map((s, i) => ({
    ...s,
    pal: PALETTES[i % PALETTES.length],
    name: gears[i].name,
    sub: gears[i].sub,
    cx: 0, // filled below
  }));

  // Walk left→right, putting each gear's centre at the previous one's
  // pitch radius + this gear's pitch radius − a small overlap so the
  // teeth visibly bite into each other.
  const OVERLAP = 6;
  let cursorX = 0;
  for (let i = 0; i < placed.length; i++) {
    if (i === 0) cursorX = placed[i].r;
    else cursorX += placed[i - 1].r + placed[i].r - OVERLAP;
    placed[i].cx = cursorX;
  }
  const totalSpan = placed[placed.length - 1].cx + placed[placed.length - 1].r;
  // Centre the meshed row horizontally on the 680-wide canvas.
  const OFFSET = (680 - totalSpan) / 2;

  const ROW_Y = 200;

  function gearPath(
    cx: number,
    cy: number,
    r: number,
    teeth: number,
    rotateBy: number
  ): string {
    const depth = r * TOOTH_DEPTH_RATIO;
    const step = (Math.PI * 2) / (teeth * 2);
    const pts: string[] = [];
    for (let i = 0; i < teeth * 2; i++) {
      const radius = i % 2 === 0 ? r + depth : r;
      const a = i * step + rotateBy;
      pts.push(
        `${(cx + radius * Math.cos(a)).toFixed(1)},${(cy + radius * Math.sin(a)).toFixed(1)}`
      );
    }
    return `M ${pts.join(" L ")} Z`;
  }

  // Because adjacent gears now mesh (centres ~r1+r2 apart), their
  // labels would collide if all sat at the same y. Zig-zag the labels:
  // even gears below the mechanism, odd gears further below, so
  // neighbouring labels never share a horizontal band.
  const LABEL_NEAR_Y_OFFSET = 26;
  const LABEL_FAR_Y_OFFSET = 56;
  const gearEls = placed.map((p, i) => {
    const cx = p.cx + OFFSET;
    const cy = ROW_Y;
    // Alternate tooth phase by half a tooth-step so adjacent gears
    // appear to interlock (one gear's tooth slots into the next one's
    // gap) instead of teeth-to-teeth collision.
    const phase = i % 2 === 0 ? 0 : Math.PI / p.teeth;
    const labelY =
      cy + p.r + (i % 2 === 0 ? LABEL_NEAR_Y_OFFSET : LABEL_FAR_Y_OFFSET);
    return `
      <path d="${gearPath(cx, cy, p.r, p.teeth, phase)}" fill="${p.pal.fill}" stroke="${p.pal.stroke}" stroke-width="1.5"/>
      <circle cx="${cx}" cy="${cy}" r="${Math.round(p.r * 0.32)}" fill="${C.paper}" stroke="${p.pal.stroke}" stroke-width="1.5"/>
      <line x1="${cx}" y1="${cy + p.r + 2}" x2="${cx}" y2="${labelY - 12}" stroke="${p.pal.stroke}" stroke-width="0.8" opacity="0.45"/>
      <text x="${cx}" y="${labelY}" font-size="12" font-weight="500" fill="${p.pal.text}" text-anchor="middle">${esc(p.name)}</text>
      ${p.sub ? `<text x="${cx}" y="${labelY + 16}" font-size="11" fill="${C.inkSoft}" text-anchor="middle">${esc(p.sub)}</text>` : ""}
    `;
  });
  return svgWrap(H, "Mechanism", gears.map((g) => g.name).join(" + "), gearEls.join(""));
}

// ===== Stack =====

function renderLayers(m: MetaphorPlan): string {
  const layers = m.items.slice(0, 5);
  if (layers.length === 0) return svgWrap(200, "Layers", "", "");
  const LAYER_W = 480;
  const LAYER_H = 60;
  const GAP = 8;
  const H = 60 + layers.length * (LAYER_H + GAP) + 20;
  const LAYER_X = 100;
  const BASE_Y = H - 20;
  const PALETTES = [C.gray, C.blue, C.teal, C.amber, C.purple];
  const layerEls = layers.map((l, i) => {
    const y = BASE_Y - (i + 1) * (LAYER_H + GAP) + GAP;
    const pal = PALETTES[i % PALETTES.length];
    return `
      <rect x="${LAYER_X}" y="${y}" width="${LAYER_W}" height="${LAYER_H}" rx="6" ry="6" fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="1"/>
      <text x="${LAYER_X + 16}" y="${y + 32}" font-size="14" font-weight="500" fill="${pal.text}">${esc(l.name)}</text>
      ${l.sub ? `<text x="${LAYER_X + 16}" y="${y + 50}" font-size="12" fill="${C.inkSoft}">${esc(l.sub)}</text>` : ""}
      <text x="${LAYER_X - 12}" y="${y + 36}" font-size="12" font-weight="500" fill="${C.inkMuted}" text-anchor="end">${i + 1}</text>
    `;
  });
  return svgWrap(H, "Stack", layers.map((l) => l.name).join(" / "), layerEls.join(""));
}

function renderPyramid(m: MetaphorPlan): string {
  const levels = m.items.slice(0, 4);
  if (levels.length === 0) return svgWrap(200, "Pyramid", "", "");
  const H = 460;
  const APEX_X = 340;
  const APEX_Y = 80;
  const BASE_Y = 400;
  const BASE_HALF = 240;
  const SLICE_H = (BASE_Y - APEX_Y) / levels.length;
  const PALETTES = [C.amber, C.purple, C.blue, C.teal];
  const sliceEls = levels.map((l, i) => {
    const y1 = BASE_Y - (i + 1) * SLICE_H;
    const y2 = BASE_Y - i * SLICE_H;
    const tFrac1 = (y1 - APEX_Y) / (BASE_Y - APEX_Y);
    const tFrac2 = (y2 - APEX_Y) / (BASE_Y - APEX_Y);
    const half1 = BASE_HALF * tFrac1;
    const half2 = BASE_HALF * tFrac2;
    const pal = PALETTES[i % PALETTES.length];
    const poly = `${APEX_X - half1},${y1} ${APEX_X + half1},${y1} ${APEX_X + half2},${y2} ${APEX_X - half2},${y2}`;
    const midY = (y1 + y2) / 2;
    return `
      <polygon points="${poly}" fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="1"/>
      <text x="${APEX_X}" y="${midY + 5}" font-size="14" font-weight="500" fill="${pal.text}" text-anchor="middle">${esc(l.name)}</text>
      ${l.sub ? `<text x="${APEX_X + half2 + 16}" y="${midY + 5}" font-size="12" fill="${C.inkSoft}">${esc(l.sub)}</text>` : ""}
    `;
  });
  return svgWrap(H, "Pyramid", levels.map((l) => l.name).join(" / "), sliceEls.join(""));
}

// ===== Spatial =====

function renderCompass(m: MetaphorPlan): string {
  const directions = m.items.slice(0, 4);
  const center = m.hub ?? { name: "Center", sub: null };
  const H = 460;
  const CX = 340;
  const CY = 230;
  const R = 140;
  const CARDINALS = [
    { x: CX, y: CY - R, anchor: "middle" as const, label: "N" },
    { x: CX + R, y: CY, anchor: "start" as const, label: "E" },
    { x: CX, y: CY + R, anchor: "middle" as const, label: "S" },
    { x: CX - R, y: CY, anchor: "end" as const, label: "W" },
  ];
  const dirEls = directions.map((d, i) => {
    const card = CARDINALS[i];
    const angle = Math.atan2(card.y - CY, card.x - CX);
    const startX = Math.round(CX + 30 * Math.cos(angle));
    const startY = Math.round(CY + 30 * Math.sin(angle));
    const endX = Math.round(card.x - 16 * Math.cos(angle));
    const endY = Math.round(card.y - 16 * Math.sin(angle));
    const baseY =
      card.anchor === "start" || card.anchor === "end"
        ? card.y + 5
        : card.y > CY
        ? card.y + 28
        : card.y - 12;
    const subY =
      card.anchor === "start" || card.anchor === "end"
        ? card.y + 23
        : card.y > CY
        ? card.y + 46
        : card.y - 30;
    const lx = card.x + (card.anchor === "end" ? -8 : card.anchor === "start" ? 8 : 0);
    return `
      <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="${C.gray.stroke}" stroke-width="2"/>
      <text x="${card.x}" y="${baseY - 16}" font-size="11" font-weight="500" fill="${C.inkMuted}" text-anchor="${card.anchor}">${card.label}</text>
      <text x="${lx}" y="${baseY}" font-size="14" font-weight="500" fill="${C.ink}" text-anchor="${card.anchor}">${esc(d.name)}</text>
      ${d.sub ? `<text x="${lx}" y="${subY}" font-size="12" fill="${C.inkSoft}" text-anchor="${card.anchor}">${esc(d.sub)}</text>` : ""}
    `;
  });
  return svgWrap(
    H,
    center.name,
    directions.map((d) => d.name).join(", "),
    `
      <circle cx="${CX}" cy="${CY}" r="${R + 4}" fill="none" stroke="${C.line}" stroke-width="1"/>
      ${dirEls.join("")}
      <circle cx="${CX}" cy="${CY}" r="28" fill="${C.amber.fill}" stroke="${C.amber.stroke}" stroke-width="2"/>
      <text x="${CX}" y="${CY + 5}" font-size="14" font-weight="500" fill="${C.amber.text}" text-anchor="middle">${esc(center.name)}</text>
    `
  );
}

function renderMaze(m: MetaphorPlan): string {
  const choices = m.items.slice(0, 4);
  const start = m.hub ?? { name: "Start", sub: null };
  const end = m.outcome ?? { name: "Goal", sub: null };
  const H = 460;
  const PATH_PTS = [
    { x: 80, y: 380 },
    { x: 200, y: 380 },
    { x: 200, y: 280 },
    { x: 320, y: 280 },
    { x: 320, y: 200 },
    { x: 440, y: 200 },
    { x: 440, y: 100 },
    { x: 600, y: 100 },
  ];
  const pathD = PATH_PTS.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const CHOICE_POS = [
    { x: 200, y: 330 },
    { x: 320, y: 240 },
    { x: 440, y: 150 },
    { x: 520, y: 100 },
  ];
  const choiceEls = choices.map((c, i) => {
    const pos = CHOICE_POS[i % CHOICE_POS.length];
    return `
      <circle cx="${pos.x}" cy="${pos.y}" r="6" fill="${C.amber.stroke}"/>
      <text x="${pos.x + 12}" y="${pos.y - 8}" font-size="12" font-weight="500" fill="${C.amber.text}">${esc(c.name)}</text>
    `;
  });
  const gridLines: string[] = [];
  for (let x = 80; x <= 600; x += 60) {
    gridLines.push(`<line x1="${x}" y1="80" x2="${x}" y2="400" stroke="${C.line}" stroke-width="0.5" opacity="0.4"/>`);
  }
  for (let y = 80; y <= 400; y += 60) {
    gridLines.push(`<line x1="80" y1="${y}" x2="600" y2="${y}" stroke="${C.line}" stroke-width="0.5" opacity="0.4"/>`);
  }
  return svgWrap(
    H,
    `${start.name} → ${end.name}`,
    choices.map((c) => c.name).join(", "),
    `
      ${gridLines.join("")}
      <path d="M 80 80 L 140 80 L 140 200" fill="none" stroke="${C.gray.stroke}" stroke-width="2" opacity="0.4"/>
      <path d="M 260 80 L 380 80 L 380 140" fill="none" stroke="${C.gray.stroke}" stroke-width="2" opacity="0.4"/>
      <path d="M 600 220 L 540 220 L 540 380" fill="none" stroke="${C.gray.stroke}" stroke-width="2" opacity="0.4"/>
      <path d="${pathD}" fill="none" stroke="${C.amber.stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      ${choiceEls.join("")}
      <circle cx="80" cy="380" r="8" fill="${C.amber.stroke}"/>
      <text x="80" y="420" font-size="14" font-weight="500" fill="${C.ink}" text-anchor="middle">${esc(start.name)}</text>
      <circle cx="600" cy="100" r="8" fill="${C.amber.stroke}"/>
      <circle cx="600" cy="100" r="14" fill="none" stroke="${C.amber.stroke}" stroke-width="2"/>
      <text x="600" y="70" font-size="14" font-weight="500" fill="${C.ink}" text-anchor="middle">${esc(end.name)}</text>
    `
  );
}

// ===== Phase 2E.2d: new metaphor templates =====
//
// quadrant       — 2×2 matrix with two named axes; items[0..3] are the
//                  four cells in row-major (TL, TR, BL, BR) order.
// paradox        — "what you think vs what's actually true"; poles
//                  carry the two opposing statements, with the sub
//                  fields holding the supporting detail.
// onion          — concentric rings from surface (item[0]) to core
//                  (item[N-1]) representing successive depth of insight.
// tipping_point  — bars representing cumulative pressures rising under
//                  a horizontal threshold; outcome is what tips over
//                  when the threshold is breached.

function renderQuadrant(m: MetaphorPlan): string {
  const xAxis = m.poles[0] ?? { label: "X axis", sub: null };
  const yAxis = m.poles[1] ?? { label: "Y axis", sub: null };
  // items[] are the 4 cells in row-major order: TL, TR, BL, BR.
  // Empty slots render as muted "—" placeholders so the grid stays
  // visually balanced even with fewer than 4 inputs.
  const cells = Array.from(
    { length: 4 },
    (_, i) =>
      m.items[i] ?? { name: "—", sub: null, icon: null }
  );
  const H = 460;

  // 2×2 grid sized to inset comfortably below heading chrome.
  const GX = 80;
  const GY = 60;
  const GW = 520;
  const GH = 320;
  const MX = GX + GW / 2;
  const MY = GY + GH / 2;

  const CELL_PALETTES = [C.blue, C.amber, C.purple, C.teal];

  const cellEls = cells.map((c, i) => {
    const col = i % 2;
    const row = i < 2 ? 0 : 1;
    const pal = CELL_PALETTES[i];
    const cx = GX + col * (GW / 2);
    const cy = GY + row * (GH / 2);
    const cw = GW / 2;
    const ch = GH / 2;
    const isPlaceholder = c.name === "—";
    const nameLines = isPlaceholder ? ["—"] : wrap(c.name, 18, 2);
    const subLines = c.sub && !isPlaceholder ? wrap(c.sub, 24, 2) : [];
    const fill = isPlaceholder ? C.paper : pal.fill;
    const stroke = isPlaceholder ? C.gray.stroke : pal.stroke;
    const textFill = isPlaceholder ? C.inkMuted : pal.text;
    const nameEls = nameLines
      .map(
        (l, j) =>
          `<text x="${cx + cw / 2}" y="${cy + 50 + j * 20}" font-size="15" font-weight="500" fill="${textFill}" text-anchor="middle">${esc(l)}</text>`
      )
      .join("");
    const subEls = subLines
      .map(
        (l, j) =>
          `<text x="${cx + cw / 2}" y="${cy + 50 + nameLines.length * 20 + j * 16}" font-size="12" fill="${C.inkSoft}" text-anchor="middle">${esc(l)}</text>`
      )
      .join("");
    return `
      <rect x="${cx + 4}" y="${cy + 4}" width="${cw - 8}" height="${ch - 8}" rx="10" ry="10" fill="${fill}" stroke="${stroke}" stroke-width="${isPlaceholder ? 1 : 1.5}" opacity="${isPlaceholder ? 0.5 : 1}"/>
      ${nameEls}
      ${subEls}
    `;
  });

  // Axis labels — X under the grid, Y rotated on the left.
  const xLabel = `
    <text x="${MX}" y="${GY + GH + 36}" font-size="12" font-weight="500" fill="${C.inkMuted}" letter-spacing="0.12em" text-anchor="middle">${esc(xAxis.label.toUpperCase())} →</text>
    ${xAxis.sub ? `<text x="${MX}" y="${GY + GH + 54}" font-size="11" fill="${C.inkSoft}" text-anchor="middle">${esc(xAxis.sub)}</text>` : ""}
  `;
  const yLabel = `
    <text x="${GX - 18}" y="${MY}" font-size="12" font-weight="500" fill="${C.inkMuted}" letter-spacing="0.12em" text-anchor="middle" transform="rotate(-90 ${GX - 18} ${MY})">↑ ${esc(yAxis.label.toUpperCase())}</text>
    ${yAxis.sub ? `<text x="${GX - 36}" y="${MY}" font-size="11" fill="${C.inkSoft}" text-anchor="middle" transform="rotate(-90 ${GX - 36} ${MY})">${esc(yAxis.sub)}</text>` : ""}
  `;

  // Centre crosshair to reinforce the 2×2 read.
  const crosshair = `
    <line x1="${MX}" y1="${GY}" x2="${MX}" y2="${GY + GH}" stroke="${C.gray.stroke}" stroke-width="1" stroke-dasharray="2 4" opacity="0.5"/>
    <line x1="${GX}" y1="${MY}" x2="${GX + GW}" y2="${MY}" stroke="${C.gray.stroke}" stroke-width="1" stroke-dasharray="2 4" opacity="0.5"/>
  `;

  return svgWrap(
    H,
    `${xAxis.label} × ${yAxis.label}`,
    cells.map((c) => c.name).filter((n) => n !== "—").join(" · "),
    `${crosshair}${cellEls.join("")}${xLabel}${yLabel}`
  );
}

function renderParadox(m: MetaphorPlan): string {
  const myth = m.poles[0] ?? { label: "What you think", sub: null };
  const truth = m.poles[1] ?? { label: "What's actually true", sub: null };
  const twist = m.outcome?.name || m.hint || "BUT";
  const H = 420;
  const CARD_W = 280;
  const CARD_H = 220;
  const PAD = 40;
  const leftX = PAD;
  const rightX = 680 - PAD - CARD_W;
  const cardY = 70;

  const renderCard = (
    pole: { label: string; sub?: string | null },
    x: number,
    pal: { fill: string; stroke: string; text: string },
    kicker: string
  ): string => {
    const labelLines = wrap(pole.label, 24, 3);
    const subLines = pole.sub ? wrap(pole.sub, 28, 4) : [];
    const labelEls = labelLines
      .map(
        (l, i) =>
          `<text x="${x + 24}" y="${cardY + 76 + i * 24}" font-size="20" font-weight="500" fill="${pal.text}" font-family="Georgia, ui-serif, 'Times New Roman', serif">${esc(l)}</text>`
      )
      .join("");
    const subEls = subLines
      .map(
        (l, i) =>
          `<text x="${x + 24}" y="${cardY + 76 + labelLines.length * 24 + 18 + i * 16}" font-size="12" fill="${C.inkSoft}">${esc(l)}</text>`
      )
      .join("");
    return `
      <rect x="${x}" y="${cardY}" width="${CARD_W}" height="${CARD_H}" rx="14" ry="14" fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="1"/>
      <text x="${x + 24}" y="${cardY + 36}" font-size="11" font-weight="500" fill="${pal.stroke}" letter-spacing="0.16em">${esc(kicker)}</text>
      <line x1="${x + 24}" y1="${cardY + 46}" x2="${x + 64}" y2="${cardY + 46}" stroke="${pal.stroke}" stroke-width="2"/>
      ${labelEls}
      ${subEls}
    `;
  };

  const myCard = renderCard(myth, leftX, C.gray, "WHAT YOU THINK");
  const truthCard = renderCard(truth, rightX, C.amber, "WHAT'S ACTUALLY TRUE");

  // The "twist" connector in the middle — a circular badge with the
  // turn word ("BUT", "ACTUALLY", "INSTEAD"). Sits centred between the
  // two cards.
  const twistCx = 340;
  const twistCy = cardY + CARD_H / 2;
  const twistShort = twist.length > 16 ? twist.slice(0, 14).trim() + "…" : twist;

  const connector = `
    <line x1="${leftX + CARD_W}" y1="${twistCy}" x2="${twistCx - 30}" y2="${twistCy}" stroke="${C.amber.stroke}" stroke-width="1.5" stroke-dasharray="2 4" opacity="0.7"/>
    <line x1="${twistCx + 30}" y1="${twistCy}" x2="${rightX}" y2="${twistCy}" stroke="${C.amber.stroke}" stroke-width="1.5" stroke-dasharray="2 4" opacity="0.7"/>
    <circle cx="${twistCx}" cy="${twistCy}" r="28" fill="${C.paper}" stroke="${C.amber.stroke}" stroke-width="2"/>
    <text x="${twistCx}" y="${twistCy + 4}" font-size="13" font-weight="500" fill="${C.amber.text}" text-anchor="middle">${esc(twistShort.toUpperCase())}</text>
  `;

  return svgWrap(
    H,
    `${myth.label} → ${truth.label}`,
    twist,
    `${myCard}${truthCard}${connector}`
  );
}

function renderOnion(m: MetaphorPlan): string {
  // items[0] is the outermost ring (surface), items[N-1] the core. We
  // cap at 5 rings — beyond that labels start colliding.
  const rings = m.items.slice(0, 5);
  if (rings.length === 0) return svgWrap(200, "Onion", "", "");
  const core = m.outcome;
  const H = 480;
  const CX = 280;
  const CY = 220;
  // Outer radius shrinks if we have many rings to keep proportions
  // similar to a sliced onion section.
  const OUTER_R = 180;
  const INNER_R = 40;
  const step = (OUTER_R - INNER_R) / rings.length;

  const PALETTES = [C.blue, C.teal, C.amber, C.purple, C.gray];

  const ringEls = rings
    .map((r, i) => {
      const pal = PALETTES[i % PALETTES.length];
      const radius = OUTER_R - i * step;
      const inner = radius - step;
      // Ring band as an annulus via even-odd fill rule on two arcs is
      // overkill — use stacked circles with decreasing fill, oldest
      // ring (outer) painted first.
      return `
        <circle cx="${CX}" cy="${CY}" r="${radius}" fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="1.5" opacity="${0.85 - i * 0.08}"/>
        <circle cx="${CX}" cy="${CY}" r="${radius}" fill="none" stroke="${pal.stroke}" stroke-width="0.5" opacity="0.5"/>
        <!-- Suppress non-band ring to keep concentric look on top -->
        <!-- inner radius hint for future arc work: ${inner.toFixed(1)} -->
      `;
    })
    .join("");

  // Centre core badge (the destination insight). Fill takes the deep
  // stroke of the innermost ring so the core feels continuous with the
  // surrounding palette instead of a stark black blob.
  const coreFill =
    PALETTES[(rings.length - 1) % PALETTES.length]?.stroke ?? C.amber.stroke;
  const coreEl = core
    ? `
      <circle cx="${CX}" cy="${CY}" r="${INNER_R}" fill="${coreFill}"/>
      <text x="${CX}" y="${CY + 4}" font-size="12" font-weight="500" fill="${C.paper}" text-anchor="middle">${esc(core.name.length > 10 ? core.name.slice(0, 9) + "…" : core.name)}</text>
    `
    : `<circle cx="${CX}" cy="${CY}" r="${INNER_R}" fill="${coreFill}" opacity="0.9"/>`;

  // Leader labels on the right side, one per ring.
  const LABEL_X = 510;
  const labelEls = rings
    .map((r, i) => {
      const pal = PALETTES[i % PALETTES.length];
      // Distribute label Ys evenly across the canvas right column.
      const yTop = 80;
      const yBot = 360;
      const n = rings.length;
      const ly = n === 1 ? (yTop + yBot) / 2 : yTop + ((yBot - yTop) * i) / (n - 1);
      // Leader line: from the ring on the right side to the label.
      const ringX = CX + (OUTER_R - i * step) * 0.6;
      const ringY = CY;
      const labelLines = wrap(r.name, 18, 2);
      const labelEls = labelLines
        .map(
          (l, k) =>
            `<text x="${LABEL_X}" y="${ly + k * 18}" font-size="14" font-weight="500" fill="${pal.text}">${esc(l)}</text>`
        )
        .join("");
      return `
        <line x1="${ringX}" y1="${ringY}" x2="${LABEL_X - 8}" y2="${ly - 4}" stroke="${pal.stroke}" stroke-width="1" opacity="0.6"/>
        <circle cx="${LABEL_X - 12}" cy="${ly - 4}" r="3" fill="${pal.stroke}"/>
        ${labelEls}
      `;
    })
    .join("");

  return svgWrap(
    H,
    core?.name || "Layers of depth",
    rings.map((r) => r.name).join(" → "),
    `${ringEls}${coreEl}${labelEls}`
  );
}

function renderTippingPoint(m: MetaphorPlan): string {
  // items[] are the cumulative pressures; outcome is what tips when
  // the threshold is breached; hint is an optional threshold label.
  const pressures = m.items.slice(0, 6);
  if (pressures.length === 0)
    return svgWrap(200, "Tipping point", "", "");
  const consequence = m.outcome;
  const thresholdLabel = (m.hint || "Threshold").trim();
  const H = 460;

  const BASELINE_Y = 360;
  const THRESHOLD_Y = 120;
  const BAR_TOP_FOR_LAST = THRESHOLD_Y - 24; // last bar tips ABOVE threshold
  const LEFT = 80;
  const RIGHT = 540;
  const BAR_W = 56;
  const GAP =
    pressures.length > 1
      ? (RIGHT - LEFT - BAR_W * pressures.length) / (pressures.length - 1)
      : 0;

  // Heights grow toward the threshold so the last bar visibly breaches it.
  const barEls = pressures
    .map((p, i) => {
      const x = LEFT + i * (BAR_W + GAP);
      const ratio = pressures.length === 1 ? 1 : i / (pressures.length - 1);
      const top =
        i === pressures.length - 1
          ? BAR_TOP_FOR_LAST
          : THRESHOLD_Y + 40 + (BASELINE_Y - THRESHOLD_Y - 40) * (1 - ratio);
      const h = BASELINE_Y - top;
      const pal = i === pressures.length - 1 ? C.amber : C.blue;
      const labelLines = wrap(p.name, 12, 2);
      const labelEls = labelLines
        .map(
          (l, k) =>
            `<text x="${x + BAR_W / 2}" y="${BASELINE_Y + 22 + k * 14}" font-size="11" font-weight="500" fill="${pal.text}" text-anchor="middle">${esc(l)}</text>`
        )
        .join("");
      const valueLabel = p.sub
        ? `<text x="${x + BAR_W / 2}" y="${top - 8}" font-size="11" font-weight="500" fill="${pal.stroke}" text-anchor="middle">${esc(p.sub)}</text>`
        : "";
      return `
        <rect x="${x}" y="${top}" width="${BAR_W}" height="${h}" rx="4" ry="4" fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="1.5" opacity="${0.6 + ratio * 0.4}"/>
        ${valueLabel}
        ${labelEls}
      `;
    })
    .join("");

  const threshold = `
    <line x1="40" y1="${THRESHOLD_Y}" x2="640" y2="${THRESHOLD_Y}" stroke="#C7613D" stroke-width="2" stroke-dasharray="6 6"/>
    <text x="40" y="${THRESHOLD_Y - 8}" font-size="11" font-weight="500" fill="#C7613D" letter-spacing="0.12em">${esc(thresholdLabel.toUpperCase())}</text>
  `;

  const baseline = `<line x1="${LEFT - 16}" y1="${BASELINE_Y}" x2="${RIGHT + 16}" y2="${BASELINE_Y}" stroke="${C.ink}" stroke-width="1"/>`;

  const consequenceEl = consequence
    ? `
      <line x1="${RIGHT + 32}" y1="${BAR_TOP_FOR_LAST}" x2="${RIGHT + 88}" y2="${BAR_TOP_FOR_LAST - 20}" stroke="${C.amber.stroke}" stroke-width="1.5"/>
      <text x="${RIGHT + 96}" y="${BAR_TOP_FOR_LAST - 28}" font-size="13" font-weight="500" fill="${C.amber.text}">${esc(consequence.name)}</text>
      ${consequence.sub ? `<text x="${RIGHT + 96}" y="${BAR_TOP_FOR_LAST - 12}" font-size="11" fill="${C.inkSoft}">${esc(consequence.sub)}</text>` : ""}
    `
    : "";

  return svgWrap(
    H,
    consequence?.name || "Tipping point",
    pressures.map((p) => p.name).join(" + "),
    `${threshold}${baseline}${barEls}${consequenceEl}`
  );
}
