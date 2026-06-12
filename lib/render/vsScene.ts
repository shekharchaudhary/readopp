import { iconSvg, isIconName, type IconName } from "./icons";
import { C, esc, svgWrap, textBlock, wrap } from "./metaphors";
import type { PanelPlan } from "../shared/schemas";

/**
 * Napkin-style "A vs B" scene for two-column comparisons: two tinted icon
 * medallions facing off across a "vs" mark, with each row of the comparison
 * laid out side-by-side beneath them. Deterministic — no model call.
 *
 * Returns null when the comparison doesn't fit the scene (3+ columns, too
 * many rows, long cell text); the caller falls back to the HTML table.
 */
export function renderVsScene(plan: PanelPlan): string | null {
  const cmp = plan.comparison;
  if (!cmp) return null;
  if (cmp.columns.length !== 2) return null;

  const rows = cmp.rows
    .map((r) => ({
      label: r.label.trim(),
      a: (r.cells[0] ?? "").trim(),
      b: (r.cells[1] ?? "").trim(),
    }))
    .filter((r) => r.a || r.b);
  if (rows.length < 2 || rows.length > 5) return null;
  // Long prose cells read better as a table.
  if (rows.some((r) => r.a.length > 90 || r.b.length > 90)) return null;

  const [colA, colB] = cmp.columns;
  const icons = cmp.columnIcons ?? [];
  const iconA = isIconName(icons[0] ?? null) ? (icons[0] as IconName) : null;
  const iconB = isIconName(icons[1] ?? null) ? (icons[1] as IconName) : null;

  const ax = 170;
  const bx = 510;
  const cy = 92;
  const r = 46;
  const pa = C.blue;
  const pb = C.amber;

  const labelAY = cy + r + 30;
  const aLabel = wrap(colA, 22, 2);
  const bLabel = wrap(colB, 22, 2);
  const labelLines = Math.max(aLabel.length, bLabel.length);

  const rowsTop = labelAY + labelLines * 19 + 18;
  const ROW_H = 58;
  const H = rowsTop + rows.length * ROW_H + 8;

  const medallion = (
    cx: number,
    pal: { fill: string; stroke: string; text: string },
    icon: IconName | null,
    initial: string
  ) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="1.5"/>` +
    (icon
      ? iconSvg(icon, {
          x: cx - 22,
          y: cy - 22,
          size: 44,
          stroke: pal.stroke,
          strokeWidth: 1.6,
        })
      : `<text x="${cx}" y="${cy + 10}" font-size="28" font-weight="500" fill="${pal.stroke}" text-anchor="middle">${esc(initial)}</text>`);

  const rowsSvg = rows
    .map((row, i) => {
      const y = rowsTop + i * ROW_H;
      const labelLinesW = row.label ? wrap(row.label, 16, 2) : [];
      const aLines = wrap(row.a || "—", 26, 2);
      const bLines = wrap(row.b || "—", 26, 2);
      const sep =
        i > 0
          ? `<line x1="60" y1="${y - 10}" x2="620" y2="${y - 10}" stroke="${C.line}" stroke-width="1"/>`
          : "";
      return (
        sep +
        textBlock(340, y + 16, labelLinesW, {
          fontSize: 12,
          fill: C.inkMuted,
          anchor: "middle",
          lineHeight: 15,
        }) +
        textBlock(ax, y + 16, aLines, {
          fontSize: 14,
          fontWeight: 500,
          fill: pa.text,
          anchor: "middle",
          lineHeight: 18,
        }) +
        textBlock(bx, y + 16, bLines, {
          fontSize: 14,
          fontWeight: 500,
          fill: pb.text,
          anchor: "middle",
          lineHeight: 18,
        })
      );
    })
    .join("");

  const body = `
    ${medallion(ax, pa, iconA, colA.charAt(0).toUpperCase())}
    ${medallion(bx, pb, iconB, colB.charAt(0).toUpperCase())}
    <circle cx="340" cy="${cy}" r="22" fill="${C.paper}" stroke="${C.line}" stroke-width="1.5"/>
    <text x="340" y="${cy + 5}" font-size="14" font-weight="500" fill="${C.inkSoft}" text-anchor="middle">vs</text>
    <line x1="${ax + r + 14}" y1="${cy}" x2="316" y2="${cy}" stroke="${C.line}" stroke-width="1.5"/>
    <line x1="364" y1="${cy}" x2="${bx - r - 14}" y2="${cy}" stroke="${C.line}" stroke-width="1.5"/>
    ${textBlock(ax, labelAY, aLabel, { fontSize: 14, fontWeight: 500, fill: pa.text, anchor: "middle", lineHeight: 19 })}
    ${textBlock(bx, labelAY, bLabel, { fontSize: 14, fontWeight: 500, fill: pb.text, anchor: "middle", lineHeight: 19 })}
    ${rowsSvg}
  `;

  return svgWrap(H, `${colA} vs ${colB}`, plan.caption, body);
}
