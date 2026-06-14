/**
 * Deterministic flowchart renderer — vertical chain or horizontal sequence,
 * chosen from plan.layoutHint and node count. Same C palette + helpers as
 * lib/render/genrePanels.ts so flowcharts read as part of the same visual
 * family as charts, profile cards, quote cards, etc.
 *
 * Returns null for any plan it can't render cleanly (branching trees,
 * over-long labels). The pipeline falls back to Opus in that case.
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
  edge: "#6B6B6B",
  ink: "#1a1a1a",
  inkSoft: "#3a3a3a",
} as const;

type Palette = { fill: string; stroke: string; text: string };

function paletteForRole(
  role: "start" | "end" | "normal" | "highlight" | null | undefined
): Palette {
  switch (role) {
    case "start":
      return C.amber;
    case "end":
      return C.blue;
    case "highlight":
      return C.purple;
    default:
      return C.gray;
  }
}

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

const DEFS = `<defs><marker id="chev" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10" fill="none" stroke="${C.edge}" stroke-width="1.4"/></marker></defs>`;

interface Node {
  id: string;
  label: string;
  subtitle?: string | null;
  role?: "start" | "end" | "normal" | "highlight" | null;
}

interface Edge {
  from: string;
  to: string;
  label?: string | null;
}

/** Render a flowchart from plan.nodes + plan.edges + plan.layoutHint. */
export function renderFlowchart(plan: PanelPlan): string | null {
  const nodes = (plan.nodes ?? []) as Node[];
  const edges = (plan.edges ?? []) as Edge[];

  if (nodes.length < 2 || nodes.length > 6) return null;

  // Only linear chains for this template — anything branching falls back to Opus.
  if (!isLinearChain(nodes, edges)) return null;

  const ordered = orderByEdges(nodes, edges);
  if (!ordered) return null;

  const horizontal =
    plan.layoutHint === "horizontal" ||
    (plan.layoutHint == null && ordered.length <= 4);

  return horizontal
    ? renderHorizontal(ordered, edges, plan.caption)
    : renderVertical(ordered, edges, plan.caption);
}

function isLinearChain(nodes: Node[], edges: Edge[]): boolean {
  if (edges.length === 0) return false;
  if (edges.length !== nodes.length - 1) return false;
  const outDeg = new Map<string, number>();
  const inDeg = new Map<string, number>();
  for (const e of edges) {
    outDeg.set(e.from, (outDeg.get(e.from) ?? 0) + 1);
    inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1);
  }
  for (const n of nodes) {
    if ((outDeg.get(n.id) ?? 0) > 1) return false;
    if ((inDeg.get(n.id) ?? 0) > 1) return false;
  }
  return true;
}

function orderByEdges(nodes: Node[], edges: Edge[]): Node[] | null {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const next = new Map(edges.map((e) => [e.from, e.to]));
  const hasInbound = new Set(edges.map((e) => e.to));
  const start = nodes.find((n) => !hasInbound.has(n.id));
  if (!start) return null;
  const out: Node[] = [];
  const seen = new Set<string>();
  let cur: string | undefined = start.id;
  while (cur) {
    if (seen.has(cur)) return null;
    seen.add(cur);
    const n = byId.get(cur);
    if (!n) return null;
    out.push(n);
    cur = next.get(cur);
  }
  return out.length === nodes.length ? out : null;
}

// ---------- Vertical chain ----------

function renderVertical(nodes: Node[], edges: Edge[], caption: string): string {
  const NODE_W = 280;
  const X = (680 - NODE_W) / 2; // 200
  const PAD_TOP = 40;
  const ARROW_GAP = 56;
  const EDGE_LABEL_X = X + NODE_W + 24;

  // Pre-compute heights per node from label/subtitle length.
  const layouts = nodes.map((n) => layoutNode(n, NODE_W));
  let y = PAD_TOP;
  const positions: { y: number; h: number; nodeY: number }[] = [];
  for (const l of layouts) {
    positions.push({ y, h: l.h, nodeY: y });
    y += l.h + ARROW_GAP;
  }
  const H = snap4(y - ARROW_GAP + PAD_TOP);

  const nodeEls = nodes
    .map((n, i) => renderNodeRect(n, X, positions[i].nodeY, NODE_W, layouts[i]))
    .join("");

  const edgeById = new Map<string, Edge>();
  for (const e of edges) edgeById.set(`${e.from}->${e.to}`, e);

  const arrowEls = nodes
    .slice(0, -1)
    .map((n, i) => {
      const top = positions[i].nodeY + positions[i].h;
      const bot = positions[i + 1].nodeY - 6;
      const e = edgeById.get(`${n.id}->${nodes[i + 1].id}`);
      const labelEl = e?.label
        ? `<text x="${EDGE_LABEL_X}" y="${(top + bot) / 2 + 4}" font-size="12" fill="${C.inkSoft}">${esc(
            e.label
          )}</text>`
        : "";
      return `
        <line x1="340" y1="${top}" x2="340" y2="${bot}" stroke="${C.edge}" stroke-width="1.4" marker-end="url(#chev)" stroke-linecap="round"/>
        ${labelEl}`;
    })
    .join("");

  const body = `${DEFS}${nodeEls}${arrowEls}`;
  return svgWrap(
    H,
    "Flow",
    nodes.map((n) => n.label).join(" → ") + (caption ? ` · ${caption.slice(0, 80)}` : ""),
    body
  );
}

// ---------- Horizontal sequence ----------

function renderHorizontal(nodes: Node[], edges: Edge[], caption: string): string {
  const PAD = 40;
  const COUNT = nodes.length;
  const GAP = 36;
  const innerW = 680 - PAD * 2;
  const NODE_W = Math.min(
    180,
    Math.floor((innerW - GAP * (COUNT - 1)) / COUNT)
  );
  const layouts = nodes.map((n) => layoutNode(n, NODE_W));
  const maxH = Math.max(...layouts.map((l) => l.h));
  const totalW = NODE_W * COUNT + GAP * (COUNT - 1);
  const startX = (680 - totalW) / 2;
  const nodeY = 56;

  const nodeEls = nodes
    .map((n, i) =>
      renderNodeRect(
        n,
        startX + i * (NODE_W + GAP),
        nodeY,
        NODE_W,
        layouts[i],
        maxH
      )
    )
    .join("");

  const edgeById = new Map<string, Edge>();
  for (const e of edges) edgeById.set(`${e.from}->${e.to}`, e);

  const arrowEls = nodes
    .slice(0, -1)
    .map((n, i) => {
      const x1 = startX + (i + 1) * NODE_W + i * GAP;
      const x2 = startX + (i + 1) * (NODE_W + GAP) - 6;
      const yLine = nodeY + maxH / 2;
      const e = edgeById.get(`${n.id}->${nodes[i + 1].id}`);
      const labelEl = e?.label
        ? `<text x="${(x1 + x2) / 2}" y="${yLine - 10}" font-size="12" fill="${C.inkSoft}" text-anchor="middle">${esc(
            e.label
          )}</text>`
        : "";
      return `
        <line x1="${x1}" y1="${yLine}" x2="${x2}" y2="${yLine}" stroke="${C.edge}" stroke-width="1.4" marker-end="url(#chev)" stroke-linecap="round"/>
        ${labelEl}`;
    })
    .join("");

  let H = snap4(nodeY + maxH + 40);
  if (caption) H += 0; // caption is rendered outside the SVG by PanelCard

  const body = `${DEFS}${nodeEls}${arrowEls}`;
  return svgWrap(
    H,
    "Flow",
    nodes.map((n) => n.label).join(" → "),
    body
  );
}

// ---------- Node rendering ----------

interface NodeLayout {
  h: number;
  labelLines: string[];
  subtitleLines: string[];
}

function layoutNode(n: Node, w: number): NodeLayout {
  const labelBudget = Math.floor((w - 32) / 7); // ~7px per char at 14px font
  const labelLines = wrap(n.label, labelBudget, 2);
  const subtitleLines = n.subtitle ? wrap(n.subtitle, labelBudget, 1) : [];
  const baseH =
    labelLines.length * 18 + (subtitleLines.length > 0 ? 18 : 0) + 32;
  const h = Math.max(64, baseH);
  return { h, labelLines, subtitleLines };
}

function renderNodeRect(
  n: Node,
  x: number,
  y: number,
  w: number,
  layout: NodeLayout,
  forcedH?: number
): string {
  const h = forcedH ?? layout.h;
  const palette = paletteForRole(n.role);
  const cx = x + w / 2;
  const totalText =
    layout.labelLines.length * 18 + (layout.subtitleLines.length > 0 ? 18 : 0);
  const top = y + (h - totalText) / 2 + 14;
  const labelTspans = layout.labelLines
    .map(
      (l, i) =>
        `<tspan x="${cx}" dy="${i === 0 ? 0 : 18}">${esc(l)}</tspan>`
    )
    .join("");
  const subtitleEl = layout.subtitleLines[0]
    ? `<text x="${cx}" y="${top + layout.labelLines.length * 18 + 2}" font-size="12" font-weight="400" fill="${palette.text}" text-anchor="middle" opacity="0.75">${esc(layout.subtitleLines[0])}</text>`
    : "";
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" ry="10" fill="${palette.fill}" stroke="${palette.stroke}" stroke-width="1"/>
    <text x="${cx}" y="${top}" font-size="14" font-weight="500" fill="${palette.text}" text-anchor="middle">${labelTspans}</text>
    ${subtitleEl}`;
}

function svgWrap(viewH: number, title: string, desc: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 ${viewH}" role="img" font-family="${FONT}"><title>${esc(title)}</title><desc>${esc(desc)}</desc>${body}</svg>`;
}
