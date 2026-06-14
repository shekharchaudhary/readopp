/**
 * Deterministic timeline renderer for plan.timeline entries.
 *
 * Vertical rail with dotted segments between entries, each row stamped with a
 * "when" pill on the left and a "what" description on the right. Drawn in the
 * same visual family as the career_timeline genre panel but for any narrative
 * sequence of moments, not just job history.
 *
 * Returns null if there are fewer than two entries or any single entry is
 * unreasonably long — Opus picks up the slack in that case.
 */

import type { PanelPlan } from "../../shared/schemas";

const FONT =
  "ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif";

const C = {
  ink: "#1a1a1a",
  inkSoft: "#3a3a3a",
  inkMuted: "#6b6b6b",
  line: "#e3e1d8",
  paper: "#fafaf7",
  accent: "#185FA5",
  accentSoft: "#E6F1FB",
} as const;

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

export function renderTimeline(plan: PanelPlan): string | null {
  const entries = (plan.timeline ?? []).filter(
    (e): e is { when: string; what: string } =>
      typeof e.when === "string" && typeof e.what === "string"
  );
  if (entries.length < 2 || entries.length > 6) return null;
  if (entries.some((e) => e.what.length > 240)) return null;

  const RAIL_X = 130;
  const TEXT_X = 162;
  const TEXT_W = 680 - TEXT_X - 40;
  const PAD_TOP = 48;
  const ROW_GAP = 28;
  const labelBudget = Math.floor(TEXT_W / 7);

  const rows = entries.map((e) => {
    const lines = wrap(e.what, labelBudget, 3);
    const h = 24 + lines.length * 20;
    return { when: e.when, lines, h };
  });

  let y = PAD_TOP;
  const positions: { y: number; h: number }[] = [];
  for (const r of rows) {
    positions.push({ y, h: r.h });
    y += r.h + ROW_GAP;
  }
  const H = snap4(y - ROW_GAP + 40);

  const railTop = positions[0].y + 8;
  const railBottom = positions[positions.length - 1].y + 8;

  const rail = `<line x1="${RAIL_X}" y1="${railTop}" x2="${RAIL_X}" y2="${railBottom}" stroke="${C.line}" stroke-width="2" stroke-dasharray="2 6" stroke-linecap="round"/>`;

  const rowEls = rows
    .map((r, i) => {
      const top = positions[i].y;
      const dotY = top + 8;
      const whenY = top + 12;
      const tspans = r.lines
        .map(
          (l, j) =>
            `<tspan x="${TEXT_X}" dy="${j === 0 ? 0 : 20}">${esc(l)}</tspan>`
        )
        .join("");
      return `
        <circle cx="${RAIL_X}" cy="${dotY}" r="10" fill="${C.accentSoft}"/>
        <circle cx="${RAIL_X}" cy="${dotY}" r="5" fill="${C.accent}"/>
        <text x="116" y="${whenY}" font-size="12" font-weight="500" fill="${C.inkMuted}" text-anchor="end" letter-spacing="0.04em">${esc(
          r.when.toUpperCase()
        )}</text>
        <text x="${TEXT_X}" y="${top + 14}" font-size="14" font-weight="400" fill="${C.ink}">${tspans}</text>`;
    })
    .join("");

  const body = `${rail}${rowEls}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 ${H}" role="img" font-family="${FONT}"><title>Timeline</title><desc>${esc(
    entries.map((e) => `${e.when}: ${e.what}`).join(" · ").slice(0, 220)
  )}</desc>${body}</svg>`;
}
