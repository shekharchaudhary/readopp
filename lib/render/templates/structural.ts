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
 */

import type { PanelPlan } from "../../shared/schemas";

const FONT =
  "ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif";

const C = {
  blue: { fill: "#E6F1FB", stroke: "#185FA5", text: "#0C447C" },
  teal: { fill: "#E1F5EE", stroke: "#0F6E56", text: "#085041" },
  amber: { fill: "#FAEEDA", stroke: "#854F0B", text: "#633806" },
  purple: { fill: "#EEEDFE", stroke: "#534AB7", text: "#3C3489" },
  gray: { fill: "#F1EFE8", stroke: "#5F5E5A", text: "#2C2C2A" },
  outer: { fill: "#fafaf7", stroke: "#5F5E5A" },
  ink: "#1a1a1a",
  inkMuted: "#6b6b6b",
} as const;

type Palette = { fill: string; stroke: string; text: string };

const GROUP_PALETTES: Palette[] = [C.blue, C.teal, C.amber, C.purple];

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines.slice(0, maxLines);
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

export function renderStructural(plan: PanelPlan): string | null {
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

  if (groups.length === 1) return renderSingle(groups[0]);
  if (groups.length === 2) return renderTwoCol(groups);
  return renderGrid(groups);
}

// ---------- 1 group ----------

function renderSingle(g: { name: string; items: Node[] }): string {
  const PAD = 40;
  const INNER_PAD = 24;
  const HEADER_H = 30;
  const CHIP_H = 44;
  const CHIP_GAP = 12;
  const totalChipsH =
    g.items.length * CHIP_H + (g.items.length - 1) * CHIP_GAP;
  const innerH = HEADER_H + totalChipsH + INNER_PAD * 2;
  const H = snap4(PAD * 2 + innerH);

  const outer = `<rect x="${PAD}" y="${PAD}" width="${
    680 - PAD * 2
  }" height="${innerH}" rx="12" fill="${C.outer.fill}" stroke="${C.outer.stroke}" stroke-width="1"/>`;
  const header = `<text x="${PAD + INNER_PAD}" y="${
    PAD + INNER_PAD + 6
  }" font-size="12" font-weight="500" fill="${C.inkMuted}" letter-spacing="0.08em">${esc(
    g.name.toUpperCase()
  )}</text>`;

  const palette = GROUP_PALETTES[0];
  const chipX = PAD + INNER_PAD;
  const chipW = 680 - PAD * 2 - INNER_PAD * 2;
  const chipStartY = PAD + INNER_PAD + HEADER_H;

  const chips = g.items
    .map((n, i) => renderChip(n, chipX, chipStartY + i * (CHIP_H + CHIP_GAP), chipW, CHIP_H, palette))
    .join("");

  return svg(H, "Structure", g.items.map((n) => n.label).join(" · "), `${outer}${header}${chips}`);
}

// ---------- 2 groups, side-by-side ----------

function renderTwoCol(groups: { name: string; items: Node[] }[]): string {
  const PAD = 40;
  const INNER_PAD = 20;
  const HEADER_H = 30;
  const CHIP_H = 44;
  const CHIP_GAP = 10;
  const COL_GAP = 20;

  const maxItems = Math.max(...groups.map((g) => g.items.length));
  const colInnerH = HEADER_H + maxItems * CHIP_H + (maxItems - 1) * CHIP_GAP;
  const innerH = colInnerH + INNER_PAD * 2;
  const H = snap4(PAD * 2 + innerH);

  const colW = (680 - PAD * 2 - COL_GAP) / 2;

  const outer = `<rect x="${PAD}" y="${PAD}" width="${
    680 - PAD * 2
  }" height="${innerH}" rx="12" fill="${C.outer.fill}" stroke="${C.outer.stroke}" stroke-width="1"/>`;

  const cols = groups
    .map((g, i) => {
      const palette = GROUP_PALETTES[i % GROUP_PALETTES.length];
      const colX = PAD + i * (colW + COL_GAP);
      const inX = colX + INNER_PAD;
      const inW = colW - INNER_PAD * 2;
      const headerY = PAD + INNER_PAD + 6;
      const chipStartY = PAD + INNER_PAD + HEADER_H;
      const chips = g.items
        .map((n, j) =>
          renderChip(n, inX, chipStartY + j * (CHIP_H + CHIP_GAP), inW, CHIP_H, palette)
        )
        .join("");
      const divider =
        i === 0
          ? `<line x1="${colX + colW + COL_GAP / 2}" y1="${
              PAD + INNER_PAD
            }" x2="${colX + colW + COL_GAP / 2}" y2="${
              PAD + innerH - INNER_PAD
            }" stroke="${C.outer.stroke}" stroke-width="1" stroke-dasharray="4 4" opacity="0.3"/>`
          : "";
      const header = `<text x="${inX}" y="${headerY}" font-size="12" font-weight="500" fill="${palette.stroke}" letter-spacing="0.08em">${esc(
        g.name.toUpperCase()
      )}</text>`;
      return `${header}${chips}${divider}`;
    })
    .join("");

  return svg(
    H,
    "Structure",
    groups.map((g) => g.name).join(" vs "),
    `${outer}${cols}`
  );
}

// ---------- 3-4 groups, 2x2 grid ----------

function renderGrid(groups: { name: string; items: Node[] }[]): string {
  const PAD = 40;
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
  const H = snap4(PAD * 2 + innerH);

  const colW = (680 - PAD * 2 - CELL_GAP) / COLS;

  const outer = `<rect x="${PAD}" y="${PAD}" width="${
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
        PAD + rowHeights.slice(0, r).reduce((a, b) => a + b, 0) + r * CELL_GAP;
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

  return svg(
    H,
    "Structure",
    groups.map((g) => g.name).filter((n) => n !== "—").join(" · "),
    `${outer}${cells}`
  );
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
  const labelBudget = Math.floor((w - 24) / 7);
  const labelLines = wrap(n.label, labelBudget, 1);
  const label = labelLines[0] ?? n.label.slice(0, labelBudget) + "…";
  const subtitle = n.subtitle
    ? wrap(n.subtitle, labelBudget, 1)[0] ?? ""
    : "";
  const hasSubtitle = subtitle.length > 0;
  const labelY = hasSubtitle ? y + h / 2 - 4 : y + h / 2 + 5;
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${palette.fill}" stroke="${palette.stroke}" stroke-width="1"/>
    <text x="${x + 16}" y="${labelY}" font-size="14" font-weight="500" fill="${palette.text}">${esc(label)}</text>
    ${hasSubtitle ? `<text x="${x + 16}" y="${y + h / 2 + 12}" font-size="12" fill="${palette.text}" opacity="0.75">${esc(subtitle)}</text>` : ""}`;
}

function svg(viewH: number, title: string, desc: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 ${viewH}" role="img" font-family="${FONT}"><title>${esc(
    title
  )}</title><desc>${esc(desc)}</desc>${body}</svg>`;
}
