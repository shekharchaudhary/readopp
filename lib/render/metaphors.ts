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
import type { MetaphorKind, MetaphorPlan, PanelPlan } from "../shared/schemas";

type TemplateFn = (plan: MetaphorPlan) => string;

const REGISTRY: Partial<Record<MetaphorKind, TemplateFn>> = {
  iceberg: renderIceberg,
  mountain: renderMountain,
  confluence: renderConfluence,
  bridge: renderBridge,
  scale: renderScale,
  branching: renderBranching,
};

export function renderMetaphor(plan: PanelPlan): string | null {
  if (plan.visualType !== "metaphor" || !plan.metaphor) return null;
  const fn = REGISTRY[plan.metaphor.kind];
  return fn ? fn(plan.metaphor) : null;
}

export function hasMetaphorTemplate(kind: MetaphorKind): boolean {
  return kind in REGISTRY;
}

// ---------- helpers ----------

const FONT =
  "ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif";

function esc(s: string): string {
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
function wrap(text: string, maxChars: number, maxLines: number): string[] {
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
function textBlock(
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

function svgWrap(viewH: number, title: string, desc: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 ${viewH}" role="img" font-family="${FONT}"><title>${esc(title)}</title><desc>${esc(desc)}</desc>${body}</svg>`;
}

// Palette tokens reused across templates.
const C = {
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
  const H = 480;

  const visLines = [
    ...wrap(visible.label, 28, 1),
    ...(visible.sub ? wrap(visible.sub, 32, 2) : []),
  ];
  const hidLines = [
    ...wrap(hidden.label, 28, 1),
    ...(hidden.sub ? wrap(hidden.sub, 32, 2) : []),
  ];

  // Iceberg geometry: peak above water (~y=110), surface at y=200, mass below.
  const body = `
    <rect x="0" y="200" width="680" height="280" fill="${C.blue.fill}" opacity="0.55"/>
    <line x1="0" y1="200" x2="680" y2="200" stroke="${C.blue.stroke}" stroke-width="1" opacity="0.4"/>
    <line x1="0" y1="208" x2="680" y2="208" stroke="${C.blue.stroke}" stroke-width="1" opacity="0.18"/>
    <path d="M 300 200 L 330 108 L 366 156 L 396 200 Z" fill="#ffffff" stroke="${C.blue.stroke}" stroke-width="1.5"/>
    <path d="M 272 200 L 232 252 L 218 322 L 240 400 L 312 432 L 396 422 L 444 380 L 458 290 L 430 220 L 410 200 Z" fill="#ffffff" stroke="${C.blue.stroke}" stroke-width="1.5" opacity="0.92"/>
    ${ratio ? `<text x="338" y="316" font-size="56" font-weight="500" fill="${C.blue.stroke}" text-anchor="middle" opacity="0.18">${esc(ratio)}</text>` : ""}
    <line x1="384" y1="135" x2="490" y2="105" stroke="${C.inkMuted}" stroke-width="1"/>
    <circle cx="384" cy="135" r="2.5" fill="${C.inkMuted}"/>
    ${textBlock(500, 100, visLines, { fontSize: 14, fontWeight: 500, fill: C.blue.text, lineHeight: 18 })}
    <line x1="290" y1="340" x2="160" y2="380" stroke="${C.inkMuted}" stroke-width="1"/>
    <circle cx="290" cy="340" r="2.5" fill="${C.inkMuted}"/>
    ${textBlock(40, 376, hidLines, { fontSize: 14, fontWeight: 500, fill: C.blue.text, lineHeight: 18 })}
  `;
  return svgWrap(H, visible.label, hidden.label, body);
}

function renderMountain(m: MetaphorPlan): string {
  const stages = m.items.slice(0, 4);
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
    { cx: 480, cy: 420, labelSide: "right" },
    { cx: 380, cy: 380, labelSide: "left" },
    { cx: 396, cy: 290, labelSide: "right" },
    { cx: 360, cy: 232, labelSide: "left" },
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
  const sources = m.items.slice(0, 3);
  if (sources.length === 0) return svgWrap(200, "Confluence", "", "");
  const output = m.outcome ?? m.hub ?? { name: "Output", sub: null };
  const H = 440;
  const PALETTES = [C.blue, C.amber, C.purple];
  // Source endpoints distributed vertically on left.
  const SOURCE_Y = [110, 240, 360];
  // Confluence point on the right edge of streams.
  const CX = 396;
  const CY = 240;

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
    <text x="100" y="100" font-size="12" font-weight="500" fill="${C.gray.stroke}" text-anchor="middle">BEFORE</text>
    <text x="100" y="124" font-size="14" font-weight="500" fill="${C.ink}" text-anchor="middle">${esc(before.label)}</text>
    ${before.sub ? `<text x="100" y="142" font-size="12" fill="${C.inkSoft}" text-anchor="middle">${esc(before.sub)}</text>` : ""}
    <!-- After label -->
    <text x="580" y="100" font-size="12" font-weight="500" fill="${C.amber.stroke}" text-anchor="middle">AFTER</text>
    <text x="580" y="124" font-size="14" font-weight="500" fill="${C.ink}" text-anchor="middle">${esc(after.label)}</text>
    ${after.sub ? `<text x="580" y="142" font-size="12" fill="${C.inkSoft}" text-anchor="middle">${esc(after.sub)}</text>` : ""}
  `;
  return svgWrap(H, `${before.label} → ${after.label}`, via, body);
}

function renderScale(m: MetaphorPlan): string {
  const left = m.poles[0] ?? { label: "Side A", sub: null };
  const right = m.poles[1] ?? { label: "Side B", sub: null };
  const question = m.hint || "";
  const H = 420;

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
    <!-- Labels above pans -->
    <text x="200" y="160" font-size="14" font-weight="500" fill="${C.blue.text}" text-anchor="middle">${esc(left.label)}</text>
    ${left.sub ? `<text x="200" y="178" font-size="12" fill="${C.inkSoft}" text-anchor="middle">${esc(left.sub)}</text>` : ""}
    <text x="480" y="160" font-size="14" font-weight="500" fill="${C.amber.text}" text-anchor="middle">${esc(right.label)}</text>
    ${right.sub ? `<text x="480" y="178" font-size="12" fill="${C.inkSoft}" text-anchor="middle">${esc(right.sub)}</text>` : ""}
  `;
  return svgWrap(H, `${left.label} vs ${right.label}`, question, body);
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
