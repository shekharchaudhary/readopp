/**
 * Deterministic structural-diagram renderer.
 *
 * Renders an outer "container" rect with named sub-regions inside it, each
 * holding a small stack of node chips. Groups come from plan.nodes[].group;
 * a one-group plan becomes a single-column list, two groups become side-by-
 * side columns, three or four become a 2×2 grid.
 *
 * Returns null when the plan doesn't fit cleanly: missing groups, too many
 * nodes per group, or pathological label lengths. Opus picks up the rest.
 *
 * Phase 2A: now wraps the body in a panelChrome envelope — the panel
 * carries its own heading + source footer instead of being a headless
 * box. The optional `chrome` arg threads through heading, source, and
 * slide position; when omitted (callers haven't been migrated yet), the
 * envelope is skipped and the body renders as before so production
 * isn't disrupted mid-refactor.
 */

import type { PanelPlan } from "../../shared/schemas";
import {
  COLOR,
  GRID,
  footerBlock,
  headingBlock,
  svgWrap,
  escapeXml as esc,
} from "../system/panelChrome";
import { fitText } from "../system/typography";

const C = {
  blue: { fill: "#E6F1FB", stroke: "#185FA5", text: "#0C447C" },
  teal: { fill: "#E1F5EE", stroke: "#0F6E56", text: "#085041" },
  amber: { fill: "#FAEEDA", stroke: "#854F0B", text: "#633806" },
  purple: { fill: "#EEEDFE", stroke: "#534AB7", text: "#3C3489" },
  gray: { fill: "#F1EFE8", stroke: "#5F5E5A", text: "#2C2C2A" },
  outer: { fill: "#fafaf7", stroke: "#5F5E5A" },
} as const;

type Palette = { fill: string; stroke: string; text: string };

const GROUP_PALETTES: Palette[] = [C.blue, C.teal, C.amber, C.purple];

export interface ChromeOptions {
  heading?: string;
  source?: string;
  slide?: { index: number; total: number };
}

function snap4(n: number): number {
  return Math.round(n / 4) * 4;
}

interface Node {
  id: string;
  label: string;
  subtitle?: string | null;
  group?: string | null;
}

export function renderStructural(
  plan: PanelPlan,
  chrome: ChromeOptions = {}
): string | null {
  const nodes = (plan.nodes ?? []) as Node[];
  if (nodes.length < 2 || nodes.length > 14) return null;

  // Bucket nodes by group. Anything without a group goes into "Other".
  const buckets = new Map<string, Node[]>();
  for (const n of nodes) {
    const k = (n.group ?? "Other").trim() || "Other";
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(n);
  }
  const groups = Array.from(buckets.entries()).map(([name, items]) => ({
    name,
    items: items.slice(0, 5),
  }));

  if (groups.length < 1 || groups.length > 4) return null;
  if (groups.some((g) => g.items.some((n) => n.label.length > 50))) return null;

  // 1. Header block — heading + optional kicker.
  const head = chrome.heading
    ? headingBlock({ heading: chrome.heading, kicker: "STRUCTURE" })
    : null;
  const bodyStartY = head ? head.bottomY + 24 : GRID.PAD_TOP;

  // 2. Body — pick layout by group count.
  let body: { svg: string; endY: number };
  if (groups.length === 1) body = renderSingle(groups[0], bodyStartY);
  else if (groups.length === 2) body = renderTwoCol(groups, bodyStartY);
  else body = renderGrid(groups, bodyStartY);

  // 3. Footer + final height.
  const FOOTER_GAP = 32;
  let totalH: number;
  let footerSvg = "";
  if (head || chrome.source || chrome.slide) {
    const footerY = body.endY + FOOTER_GAP;
    const foot = footerBlock({
      topY: footerY,
      source: chrome.source,
      slide: chrome.slide,
      templateLabel: "structural",
    });
    footerSvg = foot.svg;
    totalH = snap4(foot.bottomY + GRID.PAD_BOTTOM);
  } else {
    totalH = snap4(body.endY + 40);
  }

  const title = chrome.heading ?? "Structure";
  const desc = groups.map((g) => g.name).join(" · ");
  const inner = (head?.svg ?? "") + body.svg + footerSvg;
  return svgWrap(inner, { height: totalH, title, desc });
}

// ---------- 1 group ----------

function renderSingle(
  g: { name: string; items: Node[] },
  startY: number
): { svg: string; endY: number } {
  const PAD = GRID.PAD_X;
  const INNER_PAD = 24;
  const HEADER_H = 30;
  const CHIP_H = 44;
  const CHIP_GAP = 12;
  const totalChipsH =
    g.items.length * CHIP_H + (g.items.length - 1) * CHIP_GAP;
  const innerH = HEADER_H + totalChipsH + INNER_PAD * 2;

  const outer = `<rect x="${PAD}" y="${startY}" width="${
    680 - PAD * 2
  }" height="${innerH}" rx="12" fill="${C.outer.fill}" stroke="${C.outer.stroke}" stroke-width="1"/>`;
  const header = `<text x="${PAD + INNER_PAD}" y="${
    startY + INNER_PAD + 6
  }" font-size="12" font-weight="500" fill="${COLOR.inkMuted}" letter-spacing="0.08em">${esc(
    g.name.toUpperCase()
  )}</text>`;

  const palette = GROUP_PALETTES[0];
  const chipX = PAD + INNER_PAD;
  const chipW = 680 - PAD * 2 - INNER_PAD * 2;
  const chipStartY = startY + INNER_PAD + HEADER_H;

  const chips = g.items
    .map((n, i) => renderChip(n, chipX, chipStartY + i * (CHIP_H + CHIP_GAP), chipW, CHIP_H, palette))
    .join("");

  return { svg: `${outer}${header}${chips}`, endY: startY + innerH };
}

// ---------- 2 groups, side-by-side ----------

function renderTwoCol(
  groups: { name: string; items: Node[] }[],
  startY: number
): { svg: string; endY: number } {
  const PAD = GRID.PAD_X;
  const INNER_PAD = 20;
  const HEADER_H = 30;
  const CHIP_H = 44;
  const CHIP_GAP = 10;
  const COL_GAP = 20;

  const maxItems = Math.max(...groups.map((g) => g.items.length));
  const colInnerH = HEADER_H + maxItems * CHIP_H + (maxItems - 1) * CHIP_GAP;
  const innerH = colInnerH + INNER_PAD * 2;

  const colW = (680 - PAD * 2 - COL_GAP) / 2;

  const outer = `<rect x="${PAD}" y="${startY}" width="${
    680 - PAD * 2
  }" height="${innerH}" rx="12" fill="${C.outer.fill}" stroke="${C.outer.stroke}" stroke-width="1"/>`;

  const cols = groups
    .map((g, i) => {
      const palette = GROUP_PALETTES[i % GROUP_PALETTES.length];
      const colX = PAD + i * (colW + COL_GAP);
      const inX = colX + INNER_PAD;
      const inW = colW - INNER_PAD * 2;
      const headerY = startY + INNER_PAD + 6;
      const chipStartY = startY + INNER_PAD + HEADER_H;
      const chips = g.items
        .map((n, j) =>
          renderChip(n, inX, chipStartY + j * (CHIP_H + CHIP_GAP), inW, CHIP_H, palette)
        )
        .join("");
      const divider =
        i === 0
          ? `<line x1="${colX + colW + COL_GAP / 2}" y1="${
              startY + INNER_PAD
            }" x2="${colX + colW + COL_GAP / 2}" y2="${
              startY + innerH - INNER_PAD
            }" stroke="${C.outer.stroke}" stroke-width="1" stroke-dasharray="4 4" opacity="0.3"/>`
          : "";
      const header = `<text x="${inX}" y="${headerY}" font-size="12" font-weight="500" fill="${palette.stroke}" letter-spacing="0.08em">${esc(
        g.name.toUpperCase()
      )}</text>`;
      return `${header}${chips}${divider}`;
    })
    .join("");

  return { svg: `${outer}${cols}`, endY: startY + innerH };
}

// ---------- 3-4 groups, 2x2 grid ----------

function renderGrid(
  groups: { name: string; items: Node[] }[],
  startY: number
): { svg: string; endY: number } {
  const PAD = GRID.PAD_X;
  const INNER_PAD = 20;
  const HEADER_H = 28;
  const CHIP_H = 40;
  const CHIP_GAP = 8;
  const CELL_GAP = 16;
  const ROWS = 2;
  const COLS = 2;

  // Pad groups to fill the grid.
  while (groups.length < ROWS * COLS) groups.push({ name: "—", items: [] });

  const rowMaxItems: number[] = [];
  for (let r = 0; r < ROWS; r++) {
    let max = 0;
    for (let c = 0; c < COLS; c++) {
      const g = groups[r * COLS + c];
      if (g) max = Math.max(max, g.items.length);
    }
    rowMaxItems.push(max);
  }
  const rowH = (n: number) =>
    HEADER_H + n * CHIP_H + (n - 1) * CHIP_GAP + INNER_PAD * 2;
  const rowHeights = rowMaxItems.map(rowH);
  const innerH =
    rowHeights.reduce((a, b) => a + b, 0) + CELL_GAP * (ROWS - 1);

  const colW = (680 - PAD * 2 - CELL_GAP) / COLS;

  const outer = `<rect x="${PAD}" y="${startY}" width="${
    680 - PAD * 2
  }" height="${innerH}" rx="12" fill="${C.outer.fill}" stroke="${C.outer.stroke}" stroke-width="1"/>`;

  const cells = groups
    .slice(0, ROWS * COLS)
    .map((g, i) => {
      if (g.items.length === 0) return "";
      const r = Math.floor(i / COLS);
      const c = i % COLS;
      const palette = GROUP_PALETTES[i % GROUP_PALETTES.length];
      const cellX = PAD + c * (colW + CELL_GAP);
      const cellY =
        startY + rowHeights.slice(0, r).reduce((a, b) => a + b, 0) + r * CELL_GAP;
      const inX = cellX + INNER_PAD;
      const inY = cellY + INNER_PAD;
      const inW = colW - INNER_PAD * 2;
      const header = `<text x="${inX}" y="${inY + 6}" font-size="12" font-weight="500" fill="${palette.stroke}" letter-spacing="0.08em">${esc(
        g.name.toUpperCase()
      )}</text>`;
      const chips = g.items
        .map((n, j) =>
          renderChip(
            n,
            inX,
            inY + HEADER_H + j * (CHIP_H + CHIP_GAP),
            inW,
            CHIP_H,
            palette
          )
        )
        .join("");
      return `${header}${chips}`;
    })
    .join("");

  return { svg: `${outer}${cells}`, endY: startY + innerH };
}

// ---------- Chip ----------

function renderChip(
  n: Node,
  x: number,
  y: number,
  w: number,
  h: number,
  palette: Palette
): string {
  const innerW = w - 32;
  // fitText keeps single-line chips on one line; long labels shrink
  // 14 → 11 before falling back to ellipsis. Old behaviour silently
  // ellipsis-truncated with a hard char budget.
  const labelFit = fitText(n.label, {
    width: innerW,
    height: 14 * 1.2,
    minSize: 11,
    maxSize: 14,
    lineHeight: 1.2,
    family: "sans",
  });
  const label = labelFit.lines[0] ?? n.label.slice(0, 24) + "…";
  const subtitle = n.subtitle
    ? fitText(n.subtitle, {
        width: innerW,
        height: 12 * 1.2,
        minSize: 10,
        maxSize: 12,
        lineHeight: 1.2,
        family: "sans",
      }).lines[0] ?? ""
    : "";
  const hasSubtitle = subtitle.length > 0;
  const labelY = hasSubtitle ? y + h / 2 - 4 : y + h / 2 + 5;
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${palette.fill}" stroke="${palette.stroke}" stroke-width="1"/>
    <text x="${x + 16}" y="${labelY}" font-size="${labelFit.size}" font-weight="500" fill="${palette.text}">${esc(label)}</text>
    ${hasSubtitle ? `<text x="${x + 16}" y="${y + h / 2 + 12}" font-size="12" fill="${palette.text}" opacity="0.75">${esc(subtitle)}</text>` : ""}`;
}
