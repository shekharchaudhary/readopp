/**
 * Deterministic SVG templates for the genre-specific visual types
 * introduced in Phase 7b: profile_card, career_timeline, skills_matrix,
 * and chart (bar / donut / line).
 *
 * Same conventions as lib/render/metaphors.ts: each renderer takes the
 * panel's structured plan and returns a self-contained <svg> string with
 * viewBox="0 0 680 H". No model calls — the planner fills the slots, the
 * template draws.
 */
import type {
  CareerTimelinePlan,
  ChartPlan,
  DefinitionCardPlan,
  KeyFindingsPlan,
  PanelPlan,
  ProfileCardPlan,
  QuoteCardPlan,
  SkillsMatrixPlan,
} from "../shared/schemas";

const FONT =
  "ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif";

const C = {
  blue: { fill: "#E6F1FB", stroke: "#185FA5", text: "#0C447C" },
  teal: { fill: "#E1F5EE", stroke: "#0F6E56", text: "#085041" },
  amber: { fill: "#FAEEDA", stroke: "#854F0B", text: "#633806" },
  purple: { fill: "#EEEDFE", stroke: "#534AB7", text: "#3C3489" },
  gray: { fill: "#F1EFE8", stroke: "#5F5E5A", text: "#2C2C2A" },
  ink: "#1a1a1a",
  inkSoft: "#3a3a3a",
  inkMuted: "#6b6b6b",
  inkFaint: "#a3a3a3",
  line: "#e3e1d8",
  paper: "#fafaf7",
  accent: "#1F97DC",
  accentSoft: "#E2F0FB",
  accentDeep: "#0D5786",
} as const;

const PALETTE_BY_NAME: Record<
  string,
  { fill: string; stroke: string; text: string }
> = {
  blue: C.blue,
  teal: C.teal,
  amber: C.amber,
  purple: C.purple,
  gray: C.gray,
};

// ---------- Dispatcher ----------

export function renderGenrePanel(plan: PanelPlan): string | null {
  switch (plan.visualType) {
    case "profile_card":
      return plan.profileCard ? renderProfileCard(plan.profileCard) : null;
    case "career_timeline":
      return plan.careerTimeline
        ? renderCareerTimeline(plan.careerTimeline)
        : null;
    case "skills_matrix":
      return plan.skillsMatrix ? renderSkillsMatrix(plan.skillsMatrix) : null;
    case "chart":
      return plan.chart ? renderChart(plan.chart) : null;
    case "quote_card":
      return plan.quoteCard ? renderQuoteCard(plan.quoteCard) : null;
    case "key_findings":
      return plan.keyFindings ? renderKeyFindings(plan.keyFindings) : null;
    case "definition_card":
      return plan.definitionCard
        ? renderDefinitionCard(plan.definitionCard)
        : null;
    default:
      return null;
  }
}

// ---------- Helpers ----------

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
    if (next.length <= maxChars) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines.slice(0, maxLines);
}

function svgWrap(
  viewH: number,
  title: string,
  desc: string,
  body: string
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 ${viewH}" role="img" font-family="${FONT}"><title>${esc(title)}</title><desc>${esc(desc)}</desc>${body}</svg>`;
}

// ---------- profile_card ----------

function renderProfileCard(p: ProfileCardPlan): string {
  const H = 280;
  const initials = p.name
    .split(/\s+/)
    .map((s) => s[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Hero block on the left: monogram + name + headline + location.
  // Stats stack on the right.
  const headlineLines = p.headline ? wrap(p.headline, 38, 2) : [];

  const statsX = 380;
  const statBoxW = 260;
  const statBoxH = 56;
  const statGap = 8;
  const statsTopY = 64;
  const statEls = p.stats.slice(0, 3).map((s, i) => {
    const y = statsTopY + i * (statBoxH + statGap);
    return `
      <rect x="${statsX}" y="${y}" width="${statBoxW}" height="${statBoxH}" rx="8" ry="8" fill="${C.paper}" stroke="${C.line}" stroke-width="1"/>
      <text x="${statsX + 16}" y="${y + 22}" font-size="12" font-weight="500" fill="${C.inkMuted}">${esc(s.label)}</text>
      <text x="${statsX + 16}" y="${y + 42}" font-size="18" font-weight="500" fill="${C.ink}">${esc(s.value)}</text>
    `;
  });

  const body = `
    <!-- Monogram -->
    <circle cx="100" cy="110" r="48" fill="${C.accentSoft}" stroke="${C.accent}" stroke-width="1.5"/>
    <text x="100" y="118" font-size="28" font-weight="500" fill="${C.accentDeep}" text-anchor="middle">${esc(initials)}</text>
    <!-- Name + headline -->
    <text x="170" y="92" font-size="22" font-weight="500" fill="${C.ink}">${esc(p.name)}</text>
    ${headlineLines
      .map(
        (l, i) =>
          `<text x="170" y="${118 + i * 18}" font-size="14" fill="${C.inkSoft}">${esc(l)}</text>`
      )
      .join("")}
    ${
      p.location
        ? `<text x="170" y="${118 + headlineLines.length * 18 + 4}" font-size="12" fill="${C.inkMuted}">${esc(p.location)}</text>`
        : ""
    }
    ${statEls.join("")}
  `;
  return svgWrap(
    H,
    p.name,
    [p.headline, p.location].filter(Boolean).join(" · "),
    body
  );
}

// ---------- career_timeline ----------

function renderCareerTimeline(p: CareerTimelinePlan): string {
  const roles = p.roles.slice(0, 6);
  // Per-role height varies with number of achievements.
  function roleHeight(r: { achievements: string[] }) {
    return 70 + Math.min(r.achievements.length, 3) * 22;
  }
  const heights = roles.map(roleHeight);
  const totalRolesH = heights.reduce((a, b) => a + b, 0);
  const PAD_TOP = 40;
  const PAD_BOT = 40;
  const H = PAD_TOP + totalRolesH + PAD_BOT;

  const RAIL_X = 90;
  const TEXT_X = 130;

  let cursorY = PAD_TOP;
  const roleEls = roles.map((r, i) => {
    const top = cursorY;
    cursorY += heights[i];
    const dotY = top + 12;
    const wins = r.achievements.slice(0, 3);
    return `
      <!-- Dot -->
      <circle cx="${RAIL_X}" cy="${dotY}" r="6" fill="${C.accent}"/>
      <circle cx="${RAIL_X}" cy="${dotY}" r="10" fill="none" stroke="${C.accentSoft}" stroke-width="2"/>
      <!-- Period (above title) -->
      ${
        r.period
          ? `<text x="${TEXT_X}" y="${top + 4}" font-size="11" font-weight="500" fill="${C.inkMuted}" letter-spacing="0.04em">${esc(r.period.toUpperCase())}</text>`
          : ""
      }
      <!-- Title -->
      <text x="${TEXT_X}" y="${top + 22}" font-size="16" font-weight="500" fill="${C.ink}">${esc(r.title)}</text>
      <!-- Company -->
      <text x="${TEXT_X}" y="${top + 40}" font-size="13" fill="${C.inkSoft}">${esc(r.company)}</text>
      <!-- Achievements -->
      ${wins
        .map((w, j) => {
          const y = top + 60 + j * 22;
          const lines = wrap(w, 64, 2);
          return `
          <circle cx="${TEXT_X + 4}" cy="${y - 4}" r="1.5" fill="${C.inkMuted}"/>
          <text x="${TEXT_X + 14}" y="${y}" font-size="12" fill="${C.inkSoft}">${esc(lines[0] ?? "")}</text>
        `;
        })
        .join("")}
    `;
  });

  const railTop = PAD_TOP + 12;
  const railBottom = PAD_TOP + totalRolesH - heights[heights.length - 1] + 12;

  const body = `
    <!-- Vertical rail -->
    <line x1="${RAIL_X}" y1="${railTop}" x2="${RAIL_X}" y2="${railBottom}" stroke="${C.line}" stroke-width="2"/>
    ${roleEls.join("")}
  `;
  return svgWrap(
    H,
    "Career timeline",
    roles.map((r) => `${r.title} @ ${r.company}`).join(" · "),
    body
  );
}

// ---------- skills_matrix ----------

function renderSkillsMatrix(p: SkillsMatrixPlan): string {
  const groups = p.groups.slice(0, 4);
  const cols = groups.length <= 2 ? groups.length : 2;
  const rows = Math.ceil(groups.length / cols);
  const COL_W = (680 - 40 - 40 - (cols - 1) * 20) / cols;
  const ROW_GAP = 28;
  const HEADER_H = 28;
  const CHIP_H = 28;
  const CHIP_GAP = 6;
  const PAD_TOP = 40;
  const PAD_BOT = 40;

  // Compute heights by row
  const groupHeights = groups.map((g) => {
    const skills = g.skills.slice(0, 8);
    const rowsOfChips = Math.ceil(skills.length / 3);
    return HEADER_H + rowsOfChips * (CHIP_H + CHIP_GAP);
  });
  const rowMaxes: number[] = [];
  for (let r = 0; r < rows; r++) {
    let max = 0;
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= groups.length) continue;
      max = Math.max(max, groupHeights[idx]);
    }
    rowMaxes.push(max);
  }
  const totalH = rowMaxes.reduce((a, b) => a + b, 0) + (rows - 1) * ROW_GAP;
  const H = PAD_TOP + totalH + PAD_BOT;

  const LEVEL_STYLE: Record<
    "expert" | "strong" | "familiar",
    { fill: string; stroke: string; text: string }
  > = {
    expert: C.blue,
    strong: C.teal,
    familiar: C.gray,
  };

  const groupEls = groups.map((g, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = 40 + c * (COL_W + 20);
    const yTop =
      PAD_TOP +
      rowMaxes.slice(0, r).reduce((a, b) => a + b, 0) +
      r * ROW_GAP;
    const chips = g.skills.slice(0, 8);

    const chipEls: string[] = [];
    chips.forEach((s, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const chipW = (COL_W - 12) / 3;
      const cx = x + col * (chipW + 6);
      const cy = yTop + HEADER_H + row * (CHIP_H + CHIP_GAP);
      const pal = s.level ? LEVEL_STYLE[s.level] : C.gray;
      chipEls.push(`
        <rect x="${cx}" y="${cy}" width="${chipW}" height="${CHIP_H}" rx="14" ry="14" fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="1"/>
        <text x="${cx + chipW / 2}" y="${cy + 18}" font-size="12" font-weight="500" fill="${pal.text}" text-anchor="middle">${esc(s.name.length > 14 ? s.name.slice(0, 13) + "…" : s.name)}</text>
      `);
    });

    return `
      <text x="${x}" y="${yTop + 16}" font-size="12" font-weight="500" fill="${C.inkMuted}" letter-spacing="0.04em">${esc(g.name.toUpperCase())}</text>
      ${chipEls.join("")}
    `;
  });

  return svgWrap(
    H,
    "Skills",
    groups.map((g) => g.name).join(" · "),
    groupEls.join("")
  );
}

// ---------- chart ----------

function renderChart(p: ChartPlan): string {
  if (p.kind === "donut") return renderDonutChart(p);
  if (p.kind === "line") return renderLineChart(p);
  return renderBarChart(p);
}

function formatValue(v: number, unit: string | null | undefined): string {
  let s = Number.isInteger(v) ? String(v) : v.toFixed(1);
  if (unit) s += unit;
  return s;
}

function chartHeaderEls(
  title: string | null | undefined
): { headerH: number; el: string } {
  if (!title) return { headerH: 24, el: "" };
  return {
    headerH: 56,
    el: `<text x="40" y="44" font-size="16" font-weight="500" fill="${C.ink}">${esc(title)}</text>`,
  };
}

function pickPaletteByIndex(
  hint: string | null | undefined,
  i: number
): { fill: string; stroke: string; text: string } {
  if (hint && PALETTE_BY_NAME[hint]) return PALETTE_BY_NAME[hint];
  const order = [C.blue, C.teal, C.amber, C.purple, C.gray];
  return order[i % order.length];
}

// ----- bar -----
function renderBarChart(p: ChartPlan): string {
  const H = 420;
  const { headerH, el: headerEl } = chartHeaderEls(p.title);
  const series = p.series[0];
  const points = series.points.slice(0, 12);
  const pal = pickPaletteByIndex(series.color ?? null, 0);

  const left = 80;
  const right = 640;
  const top = headerH + 12;
  const bottom = H - 60;
  const innerW = right - left;
  const innerH = bottom - top;

  const max = Math.max(0, ...points.map((p) => p.value));
  const min = Math.min(0, ...points.map((p) => p.value));
  const range = max - min || 1;

  // y ticks: 4 ticks across the range
  const tickCount = 4;
  const ticks: number[] = [];
  for (let i = 0; i <= tickCount; i++) {
    ticks.push(min + (range * i) / tickCount);
  }
  const yToPx = (v: number) =>
    bottom - ((v - min) / range) * innerH;

  const gridEls = ticks
    .map((t) => {
      const y = yToPx(t);
      return `
        <line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="${C.line}" stroke-width="0.8"/>
        <text x="${left - 8}" y="${y + 4}" font-size="11" fill="${C.inkMuted}" text-anchor="end">${esc(formatValue(t, p.unit))}</text>
      `;
    })
    .join("");

  const gap = innerW * 0.04;
  const barW = (innerW - gap * (points.length + 1)) / points.length;
  const baselineY = yToPx(0);

  const barEls = points
    .map((pt, i) => {
      const x = left + gap + i * (barW + gap);
      const y = yToPx(Math.max(pt.value, 0));
      const h = Math.max(2, Math.abs(yToPx(pt.value) - baselineY));
      const lab = pt.label.length > 12 ? pt.label.slice(0, 11) + "…" : pt.label;
      return `
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3" ry="3" fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="1"/>
        <text x="${(x + barW / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" font-size="11" font-weight="500" fill="${pal.text}" text-anchor="middle">${esc(formatValue(pt.value, p.unit))}</text>
        <text x="${(x + barW / 2).toFixed(1)}" y="${bottom + 16}" font-size="11" fill="${C.inkSoft}" text-anchor="middle">${esc(lab)}</text>
      `;
    })
    .join("");

  const yAxisLabel = p.yLabel
    ? `<text x="${left - 48}" y="${(top + bottom) / 2}" font-size="11" fill="${C.inkMuted}" transform="rotate(-90 ${left - 48} ${(top + bottom) / 2})" text-anchor="middle">${esc(p.yLabel)}</text>`
    : "";
  const xAxisLabel = p.xLabel
    ? `<text x="${(left + right) / 2}" y="${H - 16}" font-size="11" fill="${C.inkMuted}" text-anchor="middle">${esc(p.xLabel)}</text>`
    : "";

  return svgWrap(
    H,
    p.title || "Bar chart",
    points.map((pt) => `${pt.label}=${pt.value}`).join(", "),
    `${headerEl}${gridEls}${barEls}${yAxisLabel}${xAxisLabel}<line x1="${left}" y1="${baselineY}" x2="${right}" y2="${baselineY}" stroke="${C.inkMuted}" stroke-width="1"/>`
  );
}

// ----- donut -----
function renderDonutChart(p: ChartPlan): string {
  const H = 360;
  const { headerH, el: headerEl } = chartHeaderEls(p.title);
  const slices = p.series[0].points.slice(0, 6);
  const total = slices.reduce((a, b) => a + Math.max(0, b.value), 0) || 1;

  const cx = 220;
  const cy = headerH + 130;
  const rOuter = 100;
  const rInner = 58;

  let startAngle = -Math.PI / 2; // start at 12 o'clock
  const SLICE_COLORS = [C.blue, C.amber, C.teal, C.purple, C.gray];

  function arcPath(cx: number, cy: number, r1: number, r2: number, a1: number, a2: number) {
    const large = a2 - a1 > Math.PI ? 1 : 0;
    const x1 = cx + r2 * Math.cos(a1);
    const y1 = cy + r2 * Math.sin(a1);
    const x2 = cx + r2 * Math.cos(a2);
    const y2 = cy + r2 * Math.sin(a2);
    const x3 = cx + r1 * Math.cos(a2);
    const y3 = cy + r1 * Math.sin(a2);
    const x4 = cx + r1 * Math.cos(a1);
    const y4 = cy + r1 * Math.sin(a1);
    return [
      `M ${x1.toFixed(1)} ${y1.toFixed(1)}`,
      `A ${r2} ${r2} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`,
      `L ${x3.toFixed(1)} ${y3.toFixed(1)}`,
      `A ${r1} ${r1} 0 ${large} 0 ${x4.toFixed(1)} ${y4.toFixed(1)}`,
      "Z",
    ].join(" ");
  }

  const sliceEls: string[] = [];
  const legendEls: string[] = [];
  const legendX = 360;
  const legendStartY = headerH + 36;
  const legendGap = 32;

  slices.forEach((s, i) => {
    const v = Math.max(0, s.value);
    const frac = v / total;
    const endAngle = startAngle + frac * Math.PI * 2;
    const pal = SLICE_COLORS[i % SLICE_COLORS.length];
    sliceEls.push(
      `<path d="${arcPath(cx, cy, rInner, rOuter, startAngle, endAngle)}" fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="1"/>`
    );
    const ly = legendStartY + i * legendGap;
    legendEls.push(`
      <rect x="${legendX}" y="${ly - 10}" width="14" height="14" rx="3" ry="3" fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="1"/>
      <text x="${legendX + 22}" y="${ly + 2}" font-size="13" font-weight="500" fill="${C.ink}">${esc(s.label.length > 26 ? s.label.slice(0, 25) + "…" : s.label)}</text>
      <text x="${legendX + 22}" y="${ly + 18}" font-size="11" fill="${C.inkMuted}">${esc(formatValue(s.value, p.unit))} · ${(frac * 100).toFixed(0)}%</text>
    `);
    startAngle = endAngle;
  });

  const totalEl = `
    <text x="${cx}" y="${cy - 4}" font-size="11" font-weight="500" fill="${C.inkMuted}" text-anchor="middle" letter-spacing="0.04em">TOTAL</text>
    <text x="${cx}" y="${cy + 18}" font-size="22" font-weight="500" fill="${C.ink}" text-anchor="middle">${esc(formatValue(total, p.unit))}</text>
  `;

  return svgWrap(
    H,
    p.title || "Donut chart",
    slices.map((s) => `${s.label}=${s.value}`).join(", "),
    `${headerEl}${sliceEls.join("")}${totalEl}${legendEls.join("")}`
  );
}

// ----- line -----
function renderLineChart(p: ChartPlan): string {
  const H = 380;
  const { headerH, el: headerEl } = chartHeaderEls(p.title);
  const seriesList = p.series.slice(0, 3);
  const left = 80;
  const right = 640;
  const top = headerH + 16;
  const bottom = H - 60;
  const innerW = right - left;
  const innerH = bottom - top;

  // X axis aligns to the longest series; assume points are in order.
  const maxLen = Math.max(...seriesList.map((s) => s.points.length));
  const allValues = seriesList.flatMap((s) => s.points.map((p) => p.value));
  const max = Math.max(0, ...allValues);
  const min = Math.min(0, ...allValues);
  const range = max - min || 1;

  const tickCount = 4;
  const ticks: number[] = [];
  for (let i = 0; i <= tickCount; i++) ticks.push(min + (range * i) / tickCount);
  const yToPx = (v: number) => bottom - ((v - min) / range) * innerH;
  const xToPx = (i: number) =>
    maxLen <= 1
      ? left + innerW / 2
      : left + (i / (maxLen - 1)) * innerW;

  const gridEls = ticks
    .map((t) => {
      const y = yToPx(t);
      return `
        <line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="${C.line}" stroke-width="0.8"/>
        <text x="${left - 8}" y="${y + 4}" font-size="11" fill="${C.inkMuted}" text-anchor="end">${esc(formatValue(t, p.unit))}</text>
      `;
    })
    .join("");

  const xLabels = seriesList[0].points
    .map((pt, i) => {
      const x = xToPx(i);
      const lab = pt.label.length > 10 ? pt.label.slice(0, 9) + "…" : pt.label;
      return `<text x="${x.toFixed(1)}" y="${bottom + 16}" font-size="11" fill="${C.inkSoft}" text-anchor="middle">${esc(lab)}</text>`;
    })
    .join("");

  const seriesEls: string[] = [];
  const legendEls: string[] = [];
  seriesList.forEach((series, sIdx) => {
    const pal = pickPaletteByIndex(series.color ?? null, sIdx);
    const pts = series.points
      .map((pt, i) => `${xToPx(i).toFixed(1)},${yToPx(pt.value).toFixed(1)}`)
      .join(" ");
    const dots = series.points
      .map(
        (pt, i) =>
          `<circle cx="${xToPx(i).toFixed(1)}" cy="${yToPx(pt.value).toFixed(1)}" r="3" fill="${pal.stroke}"/>`
      )
      .join("");
    seriesEls.push(`
      <polyline points="${pts}" fill="none" stroke="${pal.stroke}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
    `);
    if (series.name) {
      const lx = left + sIdx * 140;
      legendEls.push(`
        <line x1="${lx}" y1="${headerH - 6}" x2="${lx + 18}" y2="${headerH - 6}" stroke="${pal.stroke}" stroke-width="2"/>
        <text x="${lx + 24}" y="${headerH - 2}" font-size="11" fill="${C.inkSoft}">${esc(series.name)}</text>
      `);
    }
  });

  const yAxisLabel = p.yLabel
    ? `<text x="${left - 48}" y="${(top + bottom) / 2}" font-size="11" fill="${C.inkMuted}" transform="rotate(-90 ${left - 48} ${(top + bottom) / 2})" text-anchor="middle">${esc(p.yLabel)}</text>`
    : "";
  const xAxisLabel = p.xLabel
    ? `<text x="${(left + right) / 2}" y="${H - 16}" font-size="11" fill="${C.inkMuted}" text-anchor="middle">${esc(p.xLabel)}</text>`
    : "";

  return svgWrap(
    H,
    p.title || "Line chart",
    seriesList
      .map(
        (s) =>
          `${s.name || "series"}: ${s.points.map((pt) => `${pt.label}=${pt.value}`).join(",")}`
      )
      .join(" | "),
    `${headerEl}${legendEls.join("")}${gridEls}${seriesEls.join("")}${xLabels}${yAxisLabel}${xAxisLabel}`
  );
}

// ---------- quote_card ----------

const SERIF_FONT =
  "Georgia, 'Iowan Old Style', 'Times New Roman', ui-serif, serif";

function renderQuoteCard(p: QuoteCardPlan): string {
  // Scale type with quote length so short quotes feel like posters and
  // long ones stay readable.
  const len = p.text.length;
  const fontSize = len <= 90 ? 28 : len <= 170 ? 24 : 20;
  const wrapChars = len <= 90 ? 34 : len <= 170 ? 42 : 50;
  const lineH = fontSize * 1.45;
  const lines = wrap(p.text, wrapChars, 7);

  const TEXT_X = 120;
  const quoteTopY = 96;
  const quoteBottomY = quoteTopY + (lines.length - 1) * lineH;

  const attribution = p.attribution?.trim();
  const context = p.context?.trim();
  const metaY = quoteBottomY + 52;
  const metaH = attribution || context ? 40 + (attribution && context ? 20 : 0) : 0;
  const H = Math.max(260, metaY + metaH + 24);

  const lineEls = lines
    .map(
      (l, i) =>
        `<text x="${TEXT_X}" y="${quoteTopY + i * lineH}" font-family="${SERIF_FONT}" font-size="${fontSize}" fill="${C.ink}">${esc(l)}</text>`
    )
    .join("");

  const metaEls = [
    attribution
      ? `<line x1="${TEXT_X}" y1="${metaY - 18}" x2="${TEXT_X + 36}" y2="${metaY - 18}" stroke="${C.accent}" stroke-width="2"/>
         <text x="${TEXT_X}" y="${metaY + 4}" font-size="14" font-weight="500" fill="${C.inkSoft}">${esc(attribution)}</text>`
      : "",
    context
      ? `<text x="${TEXT_X}" y="${metaY + (attribution ? 24 : 4)}" font-size="12" fill="${C.inkMuted}">${esc(context)}</text>`
      : "",
  ].join("");

  const body = `
    <!-- Oversized quotation mark -->
    <text x="44" y="${quoteTopY + 18}" font-family="${SERIF_FONT}" font-size="96" fill="${C.accentSoft}">&#8220;</text>
    <text x="46" y="${quoteTopY + 16}" font-family="${SERIF_FONT}" font-size="96" fill="${C.accent}" opacity="0.35">&#8220;</text>
    ${lineEls}
    ${metaEls}
  `;
  return svgWrap(
    H,
    "Quote",
    `${p.text}${attribution ? ` — ${attribution}` : ""}`,
    body
  );
}

// ---------- key_findings ----------

function renderKeyFindings(p: KeyFindingsPlan): string {
  const findings = p.findings.slice(0, 4);
  const label = p.label?.trim();
  const PAD_TOP = label ? 72 : 40;
  const ROW_GAP = 14;

  function rowHeight(f: { detail?: string | null }) {
    const detailLines = f.detail ? wrap(f.detail, 58, 2).length : 0;
    return 56 + detailLines * 18;
  }
  const heights = findings.map(rowHeight);
  const totalH = heights.reduce((a, b) => a + b, 0) + (findings.length - 1) * ROW_GAP;
  const H = PAD_TOP + totalH + 36;

  const labelEl = label
    ? `<text x="40" y="44" font-size="12" font-weight="500" fill="${C.accentDeep}" letter-spacing="0.12em">${esc(label.toUpperCase())}</text>
       <line x1="40" y1="54" x2="120" y2="54" stroke="${C.accent}" stroke-width="2"/>`
    : "";

  let cursorY = PAD_TOP;
  const rowEls = findings.map((f, i) => {
    const top = cursorY;
    cursorY += heights[i] + ROW_GAP;
    const num = String(i + 1).padStart(2, "0");
    const figure = f.figure?.trim();
    const titleMax = figure ? 44 : 56;
    const title =
      f.title.length > titleMax ? f.title.slice(0, titleMax - 1) + "…" : f.title;
    const detailLines = f.detail ? wrap(f.detail, 58, 2) : [];
    return `
      <rect x="40" y="${top}" width="600" height="${heights[i]}" rx="10" ry="10" fill="${C.paper}" stroke="${C.line}" stroke-width="1"/>
      <rect x="40" y="${top}" width="4" height="${heights[i]}" rx="2" ry="2" fill="${C.accent}"/>
      <text x="66" y="${top + 34}" font-size="20" font-weight="500" fill="${C.accent}" opacity="0.85">${num}</text>
      <text x="108" y="${top + 33}" font-size="16" font-weight="500" fill="${C.ink}">${esc(title)}</text>
      ${detailLines
        .map(
          (l, j) =>
            `<text x="108" y="${top + 56 + j * 18}" font-size="12.5" fill="${C.inkSoft}">${esc(l)}</text>`
        )
        .join("")}
      ${
        figure
          ? `<text x="616" y="${top + 36}" font-size="24" font-weight="500" fill="${C.accentDeep}" text-anchor="end">${esc(figure)}</text>`
          : ""
      }
    `;
  });

  return svgWrap(
    H,
    label || "Key findings",
    findings.map((f) => f.title).join(" · "),
    `${labelEl}${rowEls.join("")}`
  );
}

// ---------- definition_card ----------

function renderDefinitionCard(p: DefinitionCardPlan): string {
  const defLines = wrap(p.definition, 56, 4);
  const analogy = p.analogy?.trim();
  const analogyLines = analogy ? wrap(analogy, 52, 3) : [];

  const TERM_Y = 92;
  const RULE_Y = TERM_Y + 28;
  const DEF_Y = RULE_Y + 36;
  const defBottom = DEF_Y + (defLines.length - 1) * 24;
  const analogyTop = defBottom + 36;
  const analogyH = analogy ? 34 + analogyLines.length * 20 : 0;
  const H = Math.max(280, (analogy ? analogyTop + analogyH : defBottom) + 44);

  const kicker = p.kicker?.trim();

  const analogyEl = analogy
    ? `
      <rect x="56" y="${analogyTop}" width="568" height="${analogyH}" rx="10" ry="10" fill="${C.accentSoft}" stroke="${C.accent}" stroke-width="1" stroke-opacity="0.35"/>
      <text x="76" y="${analogyTop + 24}" font-size="11" font-weight="500" fill="${C.accentDeep}" letter-spacing="0.1em">THINK OF IT LIKE</text>
      ${analogyLines
        .map(
          (l, i) =>
            `<text x="76" y="${analogyTop + 24 + 20 + i * 20}" font-size="13" fill="${C.accentDeep}">${esc(l)}</text>`
        )
        .join("")}
    `
    : "";

  const body = `
    <text x="56" y="${TERM_Y}" font-family="${SERIF_FONT}" font-size="34" font-weight="500" fill="${C.ink}">${esc(p.term)}</text>
    ${
      kicker
        ? `<text x="${56 + p.term.length * 19 + 16}" y="${TERM_Y}" font-size="13" font-style="italic" fill="${C.inkMuted}">${esc(kicker)}</text>`
        : ""
    }
    <line x1="56" y1="${RULE_Y}" x2="624" y2="${RULE_Y}" stroke="${C.line}" stroke-width="1"/>
    <line x1="56" y1="${RULE_Y}" x2="128" y2="${RULE_Y}" stroke="${C.accent}" stroke-width="2"/>
    ${defLines
      .map(
        (l, i) =>
          `<text x="56" y="${DEF_Y + i * 24}" font-size="15" fill="${C.inkSoft}">${esc(l)}</text>`
      )
      .join("")}
    ${analogyEl}
  `;
  return svgWrap(
    H,
    p.term,
    p.definition,
    body
  );
}
