/**
 * Clean carousel template family — the "editorial diagram" voice.
 *
 * Seven archetypes that render an 8-panel LinkedIn carousel in a quiet,
 * technical look (warm off-white field, thin blue accents, mono eyebrow
 * labels, regular-weight sans headings, blue line-art diagrams):
 *
 *   - cover     : bordered title card + progress dots
 *   - statement : kicker + wrapped heading + supporting line
 *   - stat      : centred giant blue number + label + attribution
 *   - flow      : horizontal axis with blue nodes (timelines / sequences)
 *   - list      : numbered blue rings + sans items
 *   - chart     : sawtooth line chart OR vertical bars in a faint plot
 *   - twoConcept: left vs right boxes with a dotted divider
 *   - outro     : two connected boxes + wordmark
 *
 * renderCleanPanel maps any PanelPlan onto one of these, parallel to
 * renderBoldPanel, so "clean" re-skins the whole deck.
 */

import type { PanelPlan, RenderedPanel } from "../../shared/schemas";
import {
  CLEAN,
  CLEAN_GRID,
  cleanWrap,
  cardFrame,
  topAccent,
  kicker,
  metaLine,
  bodyLine,
  headingBlock,
  escapeXml,
  type HeadingSegment,
} from "../system/cleanChrome";
import { FONT, wrapToWidth } from "../system/typography";

const { W, H, PAD, CONTENT_W } = CLEAN_GRID;

interface Common {
  sectionId: string;
  heading?: string;
  caption?: string;
}

function panel(common: Common, svg: string): RenderedPanel {
  return {
    sectionId: common.sectionId,
    heading: common.heading ?? "",
    caption: common.caption ?? "",
    format: "svg",
    content: svg,
    validated: true,
    fallback: false,
    edited: false,
  };
}

/** Wrap a plain string into single-colour heading lines. */
function wrapHeading(
  text: string,
  size: number,
  width = CONTENT_W
): HeadingSegment[][] {
  return wrapToWidth(text, width, size, "sans").map((line) => [{ text: line }]);
}

/** Centred multi-line grey caption; returns svg + baseline of last line. */
function captionBlock(
  text: string,
  x: number,
  y: number,
  opts: { anchor?: "start" | "middle"; size?: number; width?: number } = {}
): { svg: string; lastBaseline: number } {
  const size = opts.size ?? 17;
  const anchor = opts.anchor ?? "start";
  const width = opts.width ?? CONTENT_W;
  const lines = wrapToWidth(text, width, size, "sans");
  const step = Math.round(size * 1.4);
  const parts = lines.map((line, i) =>
    bodyLine(line, x, y + i * step, { anchor, size, color: CLEAN.ink })
  );
  return { svg: parts.join(""), lastBaseline: y + (lines.length - 1) * step };
}

// ------------------------------------------------------------------
// cover — bordered title card + progress dots
// ------------------------------------------------------------------

export interface CleanCoverInput extends Common {
  kicker?: string;
  title: string;
  footer?: string;
}

export function renderCleanCover(input: CleanCoverInput): RenderedPanel {
  const { title } = input;
  const parts: string[] = [topAccent(), cardFrame()];
  const x = PAD;

  parts.push(kicker(input.kicker ?? "Readopp · Explainer", x, 110));

  const size = 38;
  const lines = wrapToWidth(title, CONTENT_W - 24, size, "sans");
  const step = Math.round(size * 1.18);
  const startY = 248;
  lines.forEach((line, i) => {
    parts.push(
      `<text x="${x}" y="${startY + i * step}" font-family="${FONT.sans}" font-size="${size}" font-weight="600" letter-spacing="-0.01em" fill="${CLEAN.ink}">${escapeXml(
        line
      )}</text>`
    );
  });

  // Three progress dots; the first is active (blue), rest faint.
  const dotsY = startY + (lines.length - 1) * step + 34;
  for (let i = 0; i < 3; i++) {
    parts.push(
      `<circle cx="${x + 6 + i * 18}" cy="${dotsY}" r="5" fill="${i === 0 ? CLEAN.blue : CLEAN.fill}"/>`
    );
  }

  if (input.footer) {
    parts.push(metaLine(input.footer, x, H - 84));
  }

  return panel(input, cleanWrap(parts.join(""), title));
}

// ------------------------------------------------------------------
// statement — kicker + wrapped heading + supporting line
// ------------------------------------------------------------------

export interface CleanStatementInput extends Common {
  kicker?: string;
  /** Heading lines as coloured segments (lets a word render blue). */
  headingLines: HeadingSegment[][];
  sub?: string;
}

export function renderCleanStatement(input: CleanStatementInput): RenderedPanel {
  const parts: string[] = [topAccent()];
  const x = PAD;
  let y = 250;

  if (input.kicker) {
    parts.push(kicker(input.kicker, x, y));
    y += 40;
  }

  const { svg, lastBaseline } = headingBlock(input.headingLines, x, y, {
    size: 32,
  });
  parts.push(svg);

  if (input.sub) {
    const sub = captionBlock(input.sub, x, lastBaseline + 48, { size: 17 });
    parts.push(sub.svg);
  }

  const title = input.headingLines
    .flat()
    .map((s) => s.text)
    .join(" ");
  return panel(input, cleanWrap(parts.join(""), title));
}

// ------------------------------------------------------------------
// stat — centred giant blue number + label + attribution
// ------------------------------------------------------------------

export interface CleanStatInput extends Common {
  kicker?: string;
  value: string;
  unit?: string;
  /** Restatement line under the number ("…no — 23 minutes."). */
  label?: string;
  /** Body sentence under the hairline. */
  note?: string;
  attribution?: string;
}

export function renderCleanStat(input: CleanStatInput): RenderedPanel {
  const { value, unit, label, note, attribution } = input;
  const cx = W / 2;
  const parts: string[] = [topAccent()];

  if (input.kicker) {
    parts.push(metaLine(input.kicker, cx, 200, { anchor: "middle" }));
  }

  const valueSize = 150;
  const valueBaseline = 358;
  // Centre the number+unit cluster as a group.
  const valueW = value.length * valueSize * 0.6;
  const unitSize = Math.round(valueSize * 0.32);
  const unitW = unit ? unit.length * unitSize * 0.6 : 0;
  const groupW = valueW + (unit ? unitW + 6 : 0);
  const startX = cx - groupW / 2;
  parts.push(
    `<text x="${startX}" y="${valueBaseline}" font-family="${FONT.sans}" font-size="${valueSize}" font-weight="700" letter-spacing="-0.03em" fill="${CLEAN.blue}">${escapeXml(
      value
    )}</text>`
  );
  if (unit) {
    parts.push(
      `<text x="${startX + valueW + 6}" y="${valueBaseline}" font-family="${FONT.sans}" font-size="${unitSize}" font-weight="600" fill="${CLEAN.blue}">${escapeXml(
        unit
      )}</text>`
    );
  }

  if (label) {
    parts.push(
      bodyLine(label, cx, valueBaseline + 50, {
        anchor: "middle",
        size: 24,
        weight: 600,
        color: CLEAN.blue,
      })
    );
  }

  // Hairline divider.
  const dividerY = valueBaseline + 92;
  parts.push(
    `<line x1="${cx - 100}" y1="${dividerY}" x2="${cx + 100}" y2="${dividerY}" stroke="${CLEAN.hairline}" stroke-width="1"/>`
  );

  let y = dividerY + 38;
  if (note) {
    const c = captionBlock(note, cx, y, {
      anchor: "middle",
      size: 18,
      width: CONTENT_W - 40,
    });
    parts.push(c.svg);
    y = c.lastBaseline + 40;
  }
  if (attribution) {
    parts.push(metaLine(attribution, cx, y, { anchor: "middle", size: 11 }));
  }

  return panel(input, cleanWrap(parts.join(""), `${value}${unit ?? ""}`));
}

// ------------------------------------------------------------------
// flow — horizontal axis with blue nodes (timelines / sequences)
// ------------------------------------------------------------------

export interface CleanFlowInput extends Common {
  kicker?: string;
  headingText: string;
  /** Node labels along the axis. */
  nodes: string[];
  /** Optional labels for the gaps between nodes ("3 min"). */
  intervals?: string[];
  flowCaption?: string;
}

export function renderCleanFlow(input: CleanFlowInput): RenderedPanel {
  const { nodes, intervals, flowCaption } = input;
  const parts: string[] = [topAccent()];
  const x = PAD;

  if (input.kicker) parts.push(kicker(input.kicker, x, 150));
  const head = headingBlock(wrapHeading(input.headingText, 30), x, 196, {
    size: 30,
  });
  parts.push(head.svg);

  const n = Math.max(nodes.length, 2);
  const axisY = 430;
  const left = PAD + 24;
  const right = W - PAD - 24;
  parts.push(
    `<line x1="${left}" y1="${axisY}" x2="${right}" y2="${axisY}" stroke="${CLEAN.axis}" stroke-width="2"/>`
  );
  const step = n > 1 ? (right - left) / (n - 1) : 0;
  for (let i = 0; i < n; i++) {
    const nx = left + i * step;
    parts.push(`<circle cx="${nx}" cy="${axisY}" r="7" fill="${CLEAN.blue}"/>`);
    const labelText = nodes[i] ?? "";
    if (labelText) {
      parts.push(
        bodyLine(labelText, nx, axisY + 30, {
          anchor: "middle",
          size: 14,
          color: CLEAN.blue,
        })
      );
    }
    // Interval label sits above the gap to the next node.
    if (intervals && i < n - 1 && intervals[i]) {
      parts.push(
        metaLine(intervals[i], nx + step / 2, axisY - 20, {
          anchor: "middle",
          size: 11,
          color: CLEAN.muted,
        })
      );
    }
  }

  if (flowCaption) {
    parts.push(
      bodyLine(flowCaption, x, axisY + 96, { size: 16, color: CLEAN.muted })
    );
  }

  return panel(input, cleanWrap(parts.join(""), input.headingText));
}

// ------------------------------------------------------------------
// list — numbered blue rings + sans items
// ------------------------------------------------------------------

export interface CleanListInput extends Common {
  kicker: string;
  items: string[];
}

export function renderCleanList(input: CleanListInput): RenderedPanel {
  const { kicker: kick, items } = input;
  const parts: string[] = [topAccent()];
  const x = PAD;

  parts.push(kicker(kick, x, 200));

  const n = items.length;
  const startY = 280;
  const step = Math.min(86, Math.floor((H - 140 - startY) / Math.max(n - 1, 1)));
  const r = 17;
  items.forEach((text, i) => {
    const cy = startY + i * step;
    parts.push(
      `<circle cx="${x + r}" cy="${cy - 6}" r="${r}" fill="none" stroke="${CLEAN.blue}" stroke-width="1.5"/>` +
        `<text x="${x + r}" y="${cy - 1}" font-family="${FONT.sans}" font-size="15" font-weight="600" text-anchor="middle" fill="${CLEAN.blue}">${i + 1}</text>`
    );
    // Item text may wrap to a second line.
    const tx = x + 2 * r + 18;
    const lines = wrapToWidth(text, W - PAD - tx, 19, "sans");
    lines.forEach((line, li) => {
      parts.push(
        bodyLine(line, tx, cy + li * 24, { size: 19, color: CLEAN.ink })
      );
    });
  });

  return panel(input, cleanWrap(parts.join(""), kick));
}

// ------------------------------------------------------------------
// chart — sawtooth line chart OR vertical bars in a faint plot area
// ------------------------------------------------------------------

export interface CleanChartInput extends Common {
  kicker?: string;
  headingText: string;
  kind: "line" | "bar";
  values: number[];
  /** Category labels, aligned with `values`; shown under bars. */
  labels?: string[];
  xLabel?: string;
  yLabel?: string;
  chartCaption?: string;
}

export function renderCleanChart(input: CleanChartInput): RenderedPanel {
  const { kind, values, labels, xLabel, yLabel, chartCaption } = input;
  const parts: string[] = [topAccent()];
  const x = PAD;

  if (input.kicker) parts.push(kicker(input.kicker, x, 150));
  const head = headingBlock(wrapHeading(input.headingText, 30), x, 196, {
    size: 30,
  });
  parts.push(head.svg);

  // Plot box.
  const plotX = PAD;
  const plotTop = 300;
  const plotBottom = 470;
  const plotW = CONTENT_W;
  const plotH = plotBottom - plotTop;
  const peak = values.length ? Math.max(...values, 1) : 1;

  parts.push(
    `<rect x="${plotX}" y="${plotTop}" width="${plotW}" height="${plotH}" fill="${CLEAN.fill}" opacity="0.6"/>` +
      `<line x1="${plotX}" y1="${plotBottom}" x2="${plotX + plotW}" y2="${plotBottom}" stroke="${CLEAN.blue}" stroke-width="2"/>` +
      `<line x1="${plotX}" y1="${plotTop}" x2="${plotX}" y2="${plotBottom}" stroke="${CLEAN.blue}" stroke-width="2"/>`
  );
  if (yLabel)
    parts.push(
      metaLine(yLabel, plotX + 10, plotTop + 22, { size: 11, color: CLEAN.muted })
    );
  if (xLabel)
    parts.push(
      bodyLine(`${xLabel} →`, plotX + plotW, plotBottom + 24, {
        anchor: "end",
        size: 13,
        color: CLEAN.muted,
      })
    );

  if (kind === "line") {
    const n = values.length;
    const stepX = n > 1 ? plotW / (n - 1) : 0;
    const pts = values.map((v, i) => {
      const px = plotX + i * stepX;
      const py = plotBottom - (v / peak) * (plotH - 20) - 6;
      return { px, py };
    });
    const d = pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.px.toFixed(1)},${p.py.toFixed(1)}`)
      .join(" ");
    parts.push(
      `<path d="${d}" fill="none" stroke="${CLEAN.blue}" stroke-width="2.5" stroke-linejoin="round"/>`
    );
    pts.forEach((p) =>
      parts.push(`<circle cx="${p.px}" cy="${p.py}" r="4" fill="${CLEAN.blue}"/>`)
    );
  } else {
    const n = values.length;
    const gap = 20;
    const barW = (plotW - gap * (n + 1)) / n;
    values.forEach((v, i) => {
      const bh = (v / peak) * (plotH - 30);
      const bx = plotX + gap + i * (barW + gap);
      const barTop = plotBottom - bh;
      parts.push(
        `<rect x="${bx}" y="${barTop}" width="${barW}" height="${bh}" fill="${CLEAN.blue}"/>`
      );
      // Value label above each bar.
      parts.push(
        bodyLine(String(v), bx + barW / 2, barTop - 8, {
          anchor: "middle",
          size: 14,
          weight: 600,
          color: CLEAN.blueDeep,
        })
      );
      // Category label below the axis.
      const cat = labels?.[i];
      if (cat) {
        parts.push(
          bodyLine(cat, bx + barW / 2, plotBottom + 22, {
            anchor: "middle",
            size: 13,
            color: CLEAN.muted,
          })
        );
      }
    });
  }

  if (chartCaption) {
    parts.push(
      bodyLine(chartCaption, x, plotBottom + 70, { size: 16, color: CLEAN.muted })
    );
  }

  return panel(input, cleanWrap(parts.join(""), input.headingText));
}

// ------------------------------------------------------------------
// twoConcept — left vs right boxes with a dotted divider
// ------------------------------------------------------------------

export interface CleanTwoConceptInput extends Common {
  kicker?: string;
  headingText: string;
  left: string;
  right: string;
  twoCaption?: string;
}

export function renderCleanTwoConcept(input: CleanTwoConceptInput): RenderedPanel {
  const { left, right, twoCaption } = input;
  const parts: string[] = [topAccent()];
  const x = PAD;

  if (input.kicker) parts.push(kicker(input.kicker, x, 150));
  parts.push(headingBlock(wrapHeading(input.headingText, 30), x, 196, { size: 30 }).svg);

  const boxY = 320;
  const boxH = 120;
  const boxW = 196;
  const leftX = PAD;
  const rightX = W - PAD - boxW;
  const cxMid = W / 2;

  // Left: white outlined box.
  parts.push(
    `<rect x="${leftX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="14" fill="${CLEAN.card}" stroke="${CLEAN.border}" stroke-width="1.5"/>` +
      bodyLine(left, leftX + boxW / 2, boxY + boxH / 2 + 6, {
        anchor: "middle",
        size: 18,
        weight: 600,
        color: CLEAN.ink,
      })
  );

  // Dotted vertical divider.
  parts.push(
    `<line x1="${cxMid}" y1="${boxY - 6}" x2="${cxMid}" y2="${boxY + boxH + 6}" stroke="${CLEAN.axis}" stroke-width="2" stroke-dasharray="2 7"/>`
  );

  // Right: blue filled box.
  parts.push(
    `<rect x="${rightX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="14" fill="${CLEAN.blue}"/>` +
      bodyLine(right, rightX + boxW / 2, boxY + boxH / 2 + 6, {
        anchor: "middle",
        size: 18,
        weight: 600,
        color: "#FFFFFF",
      })
  );

  if (twoCaption) {
    parts.push(
      bodyLine(twoCaption, x, boxY + boxH + 70, { size: 16, color: CLEAN.muted })
    );
  }

  return panel(input, cleanWrap(parts.join(""), input.headingText));
}

// ------------------------------------------------------------------
// outro — two connected boxes + wordmark
// ------------------------------------------------------------------

export interface CleanOutroInput extends Common {
  kicker?: string;
  from: { title: string; sub?: string };
  to: { title: string; sub?: string };
  brand: string;
  domain?: string;
}

export function renderCleanOutro(input: CleanOutroInput): RenderedPanel {
  const { from, to, brand, domain } = input;
  const parts: string[] = [topAccent()];
  const x = PAD;

  parts.push(kicker(input.kicker ?? "The shortest path", x, 200));

  const boxY = 280;
  const boxH = 96;
  const boxW = 196;
  const leftX = PAD;
  const rightX = W - PAD - boxW;

  function box(bx: number, b: { title: string; sub?: string }, filled: boolean) {
    const fg = filled ? "#FFFFFF" : CLEAN.ink;
    const subFg = filled ? "#CFE0F2" : CLEAN.muted;
    const ty = b.sub ? boxY + boxH / 2 - 4 : boxY + boxH / 2 + 6;
    return (
      `<rect x="${bx}" y="${boxY}" width="${boxW}" height="${boxH}" rx="12" fill="${filled ? CLEAN.blue : CLEAN.card}" stroke="${filled ? "none" : CLEAN.border}" stroke-width="1.5"/>` +
      bodyLine(b.title, bx + boxW / 2, ty, {
        anchor: "middle",
        size: 18,
        weight: 600,
        color: fg,
      }) +
      (b.sub
        ? bodyLine(b.sub, bx + boxW / 2, ty + 26, {
            anchor: "middle",
            size: 13,
            color: subFg,
          })
        : "")
    );
  }

  parts.push(box(leftX, from, false));
  parts.push(box(rightX, to, true));

  // Dashed arrow between the boxes.
  const arrowY = boxY + boxH / 2;
  const aStart = leftX + boxW + 14;
  const aEnd = rightX - 14;
  parts.push(
    `<line x1="${aStart}" y1="${arrowY}" x2="${aEnd - 10}" y2="${arrowY}" stroke="${CLEAN.blue}" stroke-width="2" stroke-dasharray="6 6"/>` +
      `<path d="M${aEnd - 12},${arrowY - 6} L${aEnd},${arrowY} L${aEnd - 12},${arrowY + 6}" fill="none" stroke="${CLEAN.blue}" stroke-width="2"/>`
  );

  // Wordmark + domain.
  const brandY = boxY + boxH + 110;
  parts.push(
    `<circle cx="${x + 6}" cy="${brandY - 7}" r="6" fill="${CLEAN.blue}"/>` +
      `<text x="${x + 24}" y="${brandY}" font-family="${FONT.sans}" font-size="24" font-weight="700" fill="${CLEAN.ink}">${escapeXml(brand)}</text>`
  );
  if (domain) {
    parts.push(metaLine(domain, W - PAD, brandY, { anchor: "end", size: 12 }));
  }

  return panel(input, cleanWrap(parts.join(""), `${from.title} → ${to.title}`));
}

// ------------------------------------------------------------------
// renderCleanPanel — deck-level dispatcher
// ------------------------------------------------------------------

export interface CleanPanelCtx {
  heading: string;
  caption?: string;
  slide?: number;
  total?: number;
  brand?: string;
  audience?: string;
}

/** Split a leading number off a stat string: "23 min" -> {value:"23", unit:"min"}. */
function parseStat(raw: string): { value: string; unit?: string } {
  const m = raw.trim().match(/^([£$€]?[\d.,]+[%×xKkMmBb]?)\s*(.*)$/);
  if (m) return { value: m[1].trim(), unit: m[2].trim() || undefined };
  return { value: raw.trim() };
}

/** Build heading segments, optionally painting the first number blue. */
function headingSegments(text: string): HeadingSegment[][] {
  const lines = wrapToWidth(text, CONTENT_W, 32, "sans");
  let highlighted = false;
  return lines.map((line) => {
    const m = !highlighted && line.match(/^(.*?)(\b[\d.,]+%?\b)(.*)$/);
    if (m) {
      highlighted = true;
      const segs: HeadingSegment[] = [];
      if (m[1]) segs.push({ text: m[1] });
      segs.push({ text: m[2], color: CLEAN.blue });
      if (m[3]) segs.push({ text: m[3] });
      return segs;
    }
    return [{ text: line }];
  });
}

export function renderCleanPanel(plan: PanelPlan, ctx: CleanPanelCtx): RenderedPanel {
  const slide = ctx.slide ?? 0;
  const common: Common = {
    sectionId: plan.sectionId,
    heading: ctx.heading,
    caption: ctx.caption,
  };
  const hasDeck = ctx.total != null;
  const isFirst = hasDeck && slide === 0;
  const isLast = hasDeck && slide === ctx.total! - 1;
  // Short mono eyebrow for diagram panels whose heading is a full
  // sentence — mirrors the source's "PANEL 02" label so the sentence
  // isn't echoed twice.
  const eyebrow = `Panel ${String(slide + 1).padStart(2, "0")}`;

  // The Clean deck opens on a titled cover card and closes on an outro —
  // the signature bookends of this style.
  if (isFirst) {
    const footer = [
      `${ctx.total} panels`,
      ctx.audience ? `${ctx.audience} audience` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return renderCleanCover({
      ...common,
      title: ctx.heading,
      footer: footer || undefined,
    });
  }
  if (isLast) {
    return renderCleanOutro({
      ...common,
      from: { title: "A great read", sub: ctx.caption },
      to: { title: "A shared post", sub: "30 seconds" },
      brand: ctx.brand ?? "Readopp",
      domain: "readopp.com",
    });
  }

  switch (plan.visualType) {
    case "stat_callout": {
      if (plan.stat) {
        const { value, unit } = parseStat(plan.stat.value);
        return renderCleanStat({
          ...common,
          kicker: ctx.heading,
          value,
          unit,
          label: plan.stat.label,
          note: ctx.caption,
        });
      }
      break;
    }
    case "chart": {
      if (plan.chart?.series[0]?.points.length) {
        const points = plan.chart.series[0].points;
        return renderCleanChart({
          ...common,
          kicker: eyebrow,
          headingText: plan.chart.title ?? ctx.heading,
          kind: plan.chart.kind === "line" ? "line" : "bar",
          values: points.map((p) => p.value),
          labels: points.map((p) => p.label),
          xLabel: plan.chart.xLabel ?? undefined,
          yLabel: plan.chart.yLabel ?? undefined,
          chartCaption: ctx.caption,
        });
      }
      break;
    }
    case "timeline": {
      if (plan.timeline?.length) {
        return renderCleanFlow({
          ...common,
          kicker: eyebrow,
          headingText: ctx.heading,
          nodes: plan.timeline.map((t) => t.when),
          flowCaption: ctx.caption,
        });
      }
      break;
    }
    case "framework": {
      if (plan.framework?.steps.length) {
        return renderCleanList({
          ...common,
          kicker: plan.framework.label ?? ctx.heading,
          items: plan.framework.steps.map((s) => s.name),
        });
      }
      break;
    }
    case "key_findings": {
      if (plan.keyFindings?.findings.length) {
        return renderCleanList({
          ...common,
          kicker: plan.keyFindings.label ?? ctx.heading,
          items: plan.keyFindings.findings.map((f) => f.title),
        });
      }
      break;
    }
    case "comparison": {
      const cols = plan.comparison?.columns ?? [];
      if (cols.length >= 2) {
        return renderCleanTwoConcept({
          ...common,
          kicker: eyebrow,
          headingText: ctx.heading,
          left: cols[0],
          right: cols[1],
          twoCaption: ctx.caption,
        });
      }
      break;
    }
    case "before_after": {
      if (plan.beforeAfter) {
        return renderCleanTwoConcept({
          ...common,
          kicker: eyebrow,
          headingText: ctx.heading,
          left: plan.beforeAfter.before.label,
          right: plan.beforeAfter.after.label,
          twoCaption: ctx.caption,
        });
      }
      break;
    }
    case "insight": {
      if (plan.insight) {
        return renderCleanStatement({
          ...common,
          kicker: plan.insight.kicker ?? ctx.heading,
          headingLines: headingSegments(plan.insight.text),
          sub: plan.insight.attribution ?? ctx.caption,
        });
      }
      break;
    }
    case "quote_card": {
      if (plan.quoteCard) {
        return renderCleanStatement({
          ...common,
          kicker: ctx.heading,
          headingLines: headingSegments(plan.quoteCard.text),
          sub: plan.quoteCard.attribution ?? ctx.caption,
        });
      }
      break;
    }
  }

  // Generic fallback: kicker + the heading as a clean statement.
  return renderCleanStatement({
    ...common,
    kicker: ctx.heading,
    headingLines: headingSegments(ctx.heading || plan.caption || "Readopp"),
    sub: ctx.caption,
  });
}
