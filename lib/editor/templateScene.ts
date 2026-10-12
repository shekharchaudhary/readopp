import type { BrandKit, Explainer, RenderedPanel, TemplateId } from "../shared/schemas";
import { sourceLabel } from "../shared/source";
import { panelItems, panelKicker, panelPrimary } from "../templates/panelCopy";
import {
  chooseTemplatePanelLayout,
  type PanelLayoutId,
} from "../templates/panelLayouts";
import { getTemplate } from "../templates/registry";

type SceneElement = Record<string, unknown>;

interface SceneStyle {
  identity: TemplateId;
  paper: string;
  ink: string;
  muted: string;
  accent: string;
  sans: number;
  serif: number;
  headingFamily: number;
  labelFamily: number;
  headingScale: number;
}

interface SceneInput {
  explainer: Explainer;
  panel: RenderedPanel;
  panelIndex: number;
  totalPanels: number;
  template: TemplateId;
  brand?: BrandKit | null;
}

let elementSequence = 0;

function id(prefix: string): string {
  elementSequence += 1;
  return `template-${prefix}-${elementSequence}`;
}

function base(
  type: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: Partial<SceneElement> = {}
): SceneElement {
  return {
    id: id(type),
    type,
    x,
    y,
    width: Math.max(1, width),
    height: Math.max(1, height),
    angle: 0,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: elementSequence * 7919,
    version: 1,
    versionNonce: elementSequence * 3571,
    index: null,
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    customData: { readoppTemplateElement: true },
    ...options,
  };
}

function text(
  value: string,
  x: number,
  y: number,
  width: number,
  fontSize: number,
  color: string,
  options: {
    align?: "left" | "center" | "right";
    family?: number;
    bold?: boolean;
    lineHeight?: number;
    maxLines?: number;
  } = {}
): SceneElement {
  const lineHeight = options.lineHeight ?? 1.08;
  const family = options.family ?? 2;
  let wrapped = wrapSceneText(value, width, fontSize, family);
  if (options.maxLines && wrapped.length > options.maxLines) {
    wrapped = wrapped.slice(0, options.maxLines);
    const last = wrapped.length - 1;
    wrapped[last] = `${wrapped[last].replace(/[\s.,;:!?-]+$/u, "")}…`;
  }
  const displayText = wrapped.join("\n");
  const lineCount = Math.max(1, wrapped.length);
  return base("text", x, y, width, fontSize * lineHeight * lineCount, {
    strokeColor: color,
    // Excalidraw stores the visually wrapped copy separately from the source
    // string. Keeping originalText intact means double-click editing starts
    // with the user's real sentence while the selection box still matches
    // the lines visible in the panel.
    text: displayText,
    originalText: value,
    fontSize,
    fontFamily: family,
    textAlign: options.align ?? "left",
    verticalAlign: "top",
    baseline: fontSize,
    containerId: null,
    autoResize: false,
    lineHeight,
    fontWeight: options.bold ? 700 : 400,
  });
}

function wrapSceneText(
  value: string,
  width: number,
  fontSize: number,
  family: number
): string[] {
  const averageWidth =
    fontSize * (family === 3 ? 0.62 : family === 4 ? 0.54 : 0.55);
  const maxChars = Math.max(4, Math.floor(width / Math.max(1, averageWidth)));
  const lines: string[] = [];
  for (const paragraph of value.split("\n")) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (!current || candidate.length <= maxChars) current = candidate;
      else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [""];
}

function fittedFontSize(
  value: string,
  width: number,
  desired: number,
  maxLines: number,
  family: number,
  minimum: number
): number {
  let size = desired;
  while (
    size > minimum &&
    wrapSceneText(value, width, size, family).length > maxLines
  ) {
    size -= 2;
  }
  return Math.max(minimum, size);
}

function fittedFontSizeWithinHeight(
  value: string,
  width: number,
  desired: number,
  maxLines: number,
  family: number,
  minimum: number,
  maxHeight: number,
  lineHeight: number
): number {
  let size = fittedFontSize(
    value,
    width,
    desired,
    maxLines,
    family,
    minimum
  );
  while (size > minimum) {
    const lineCount = Math.min(
      maxLines,
      wrapSceneText(value, width, size, family).length
    );
    if (lineCount * size * lineHeight <= maxHeight) break;
    size -= 2;
  }
  return Math.max(minimum, size);
}

function negativeDataColor(accent: string): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(accent);
  if (!match) return accent;
  const [, red, green, blue] = match;
  const r = Number.parseInt(red, 16);
  const g = Number.parseInt(green, 16);
  const b = Number.parseInt(blue, 16);
  // A green accent is ideal for positive values but cannot also communicate
  // decline. Switch only that collision to a warm, accessible negative hue.
  return g > r * 1.12 && g > b * 1.12 ? "#D5524A" : accent;
}

function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  stroke = "transparent",
  radius = 0
): SceneElement {
  return base("rectangle", x, y, width, height, {
    backgroundColor: fill,
    strokeColor: stroke,
    strokeWidth: stroke === "transparent" ? 0 : 2,
    roundness: radius ? { type: 3 } : null,
  });
}

function ellipse(x: number, y: number, width: number, height: number, fill: string, stroke: string): SceneElement {
  return base("ellipse", x, y, width, height, {
    backgroundColor: fill,
    strokeColor: stroke,
    strokeWidth: 2,
  });
}

function line(x: number, y: number, dx: number, dy: number, color: string, width = 2, dashed = false): SceneElement {
  return base("line", x, y, Math.abs(dx) || 1, Math.abs(dy) || 1, {
    strokeColor: color,
    strokeWidth: width,
    strokeStyle: dashed ? "dashed" : "solid",
    points: [[0, 0], [dx, dy]],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: null,
  });
}

function styleFor(input: SceneInput): SceneStyle {
  const preview = getTemplate(input.template).preview;
  const identity = input.template;
  const mutedByIdentity: Partial<Record<TemplateId, string>> = {
    "editorial-report": "#625E57",
    "modern-technical": "#5D6E78",
    "data-story": "#5F7167",
    "bold-social": "#B8B0A5",
  };
  return {
    identity,
    paper: preview.background || "#F5F2EA",
    ink: preview.foreground || "#101010",
    muted: mutedByIdentity[identity] ?? "#716E67",
    accent: input.panel.themeColor ?? input.brand?.color ?? preview.accent ?? "#E8422F",
    sans: 2,
    serif: 4,
    headingFamily:
      identity === "editorial-report"
        ? 4
        : identity === "modern-technical"
          ? 3
          : 2,
    labelFamily: identity === "modern-technical" ? 3 : 2,
    headingScale: identity === "bold-social" ? 1.08 : 1,
  };
}

function copyItems(panel: RenderedPanel) {
  const items = panelItems(panel);
  return items.length ? items : [{ title: panel.heading, detail: panel.caption }];
}

function header(elements: SceneElement[], panel: RenderedPanel, style: SceneStyle, kicker: string, headingSize = 70): number {
  const dataHeader = style.identity === "data-story";
  const headerX = dataHeader ? 92 : 72;
  const headerWidth = dataHeader ? 852 : 930;
  const desiredSize = headingSize * style.headingScale;
  const resolvedSize = fittedFontSize(
    panel.heading,
    headerWidth,
    desiredSize,
    4,
    style.headingFamily,
    Math.min(34, desiredSize)
  );
  const heading = text(panel.heading, headerX, 112, headerWidth, resolvedSize, dataHeader ? style.paper : style.ink, {
    family: style.headingFamily,
    bold: true,
    lineHeight: 0.96,
    maxLines: 4,
  });
  if (dataHeader) {
    const headerBottom = Math.min(
      330,
      Math.max(260, 112 + Number(heading.height ?? resolvedSize) + 36)
    );
    elements.push(rect(48, 48, 984, headerBottom - 48, style.ink));
    elements.push(rect(48, 48, 14, headerBottom - 48, style.accent));
  }
  elements.push(text(panelKicker(panel, kicker).toUpperCase(), headerX, 72, 840, 21, dataHeader ? "#8DDAA8" : style.accent, { family: style.labelFamily, bold: true }));
  elements.push(heading);
  return 112 + Number(heading.height ?? resolvedSize);
}

/** Identity-specific structure that stays editable and sits behind content. */
function identityDecoration(elements: SceneElement[], style: SceneStyle) {
  if (style.identity === "editorial-report") {
    elements.push(line(72, 48, 936, 0, style.accent, 3));
    elements.push(line(72, 990, 936, 0, "#D8D2C8", 1));
    return;
  }
  if (style.identity === "modern-technical") {
    for (let x = 90; x < 1080; x += 90) {
      elements.push(line(x, 0, 0, 1080, "#DCE8EF", 1));
    }
    for (let y = 90; y < 1080; y += 90) {
      elements.push(line(0, y, 1080, 0, "#DCE8EF", 1));
    }
    elements.push(line(6, 6, 1068, 0, style.accent, 10));
    elements.push(line(1074, 6, 0, 1068, style.accent, 10));
    elements.push(line(1074, 1074, -1068, 0, style.accent, 10));
    elements.push(line(6, 1074, 0, -1068, style.accent, 10));
    return;
  }
  if (style.identity === "data-story") {
    for (let y = 360; y < 1010; y += 120) {
      elements.push(line(0, y, 1080, 0, "#DDE5DE", 1));
    }
    elements.push(rect(36, 360, 10, 570, style.accent));
    return;
  }
  if (style.identity === "bold-social") {
    elements.push(ellipse(760, 710, 430, 430, "transparent", style.accent));
    elements.push(rect(900, 0, 180, 180, style.accent));
    elements.push(line(8, 8, 1064, 0, style.accent, 14));
    elements.push(line(1072, 8, 0, 1064, style.accent, 14));
    elements.push(line(1072, 1072, -1064, 0, style.accent, 14));
    elements.push(line(8, 1072, 0, -1064, style.accent, 14));
    return;
  }
  for (let x = 216; x < 1080; x += 216) {
    elements.push(line(x, 0, 0, 1080, "#E7E3D9", 1));
  }
}

function cover(elements: SceneElement[], panel: RenderedPanel, style: SceneStyle) {
  header(elements, panel, style, "THE READ", 88);
  elements.push(line(72, 650, 480, 0, style.ink));
  elements.push(text(panelPrimary(panel), 72, 680, 470, 29, style.ink, { lineHeight: 1.22, maxLines: 7 }));
  elements.push(rect(620, 580, 388, 360, style.accent));
  elements.push(ellipse(690, 520, 285, 480, "transparent", style.ink));
  elements.push(line(620, 670, 220, 0, style.ink, 10));
  elements.push(line(760, 800, 248, 0, style.ink, 10));
  elements.push(line(620, 890, 160, 0, style.ink, 10));
}

function priorities(elements: SceneElement[], panel: RenderedPanel, style: SceneStyle) {
  header(elements, panel, style, "THE KEY POINTS", 60);
  const items = copyItems(panel).slice(0, 5);
  const rowHeight = Math.min(156, Math.floor(600 / Math.max(1, items.length)));
  items.forEach((item, index) => {
    const y = 340 + index * rowHeight;
    const titleSize = fittedFontSize(
      item.title,
      780,
      28,
      2,
      style.sans,
      22
    );
    const titleLines = Math.min(
      2,
      wrapSceneText(item.title, 780, titleSize, style.sans).length
    );
    const titleHeight = titleSize * 1.08 * titleLines;
    elements.push(line(72, y, 936, 0, style.ink, 1));
    elements.push(ellipse(72, y + 22, 54, 54, style.paper, style.ink));
    elements.push(text(String(index + 1), 72, y + 32, 54, 22, style.ink, { align: "center", bold: true }));
    elements.push(
      text(item.title, 154, y + 18, 780, titleSize, style.ink, {
        bold: true,
        maxLines: 2,
      })
    );
    if (item.detail) {
      elements.push(
        text(
          item.detail,
          154,
          y + 18 + titleHeight + 8,
          790,
          titleLines > 1 ? 16 : 18,
          style.muted,
          { lineHeight: 1.2, maxLines: 2 }
        )
      );
    }
  });
}

function hierarchy(elements: SceneElement[], panel: RenderedPanel, style: SceneStyle) {
  const headerBottom = header(elements, panel, style, "A STRUCTURED VIEW", 58);
  const items = copyItems(panel).slice(0, 4);
  const pyramidTop = Math.max(330, headerBottom + 38);
  const pyramidStep = Math.min(105, Math.max(82, (775 - pyramidTop) / Math.max(1, items.length)));
  items.forEach((item, index) => {
    const width = 300 + index * 115;
    const x = 540 - width / 2;
    const y = pyramidTop + index * pyramidStep;
    elements.push(rect(x, y, width, 70, style.accent, style.ink, 8));
    elements.push(text(item.title, x + 20, y + 21, width - 40, 20, "#FFFFFF", { align: "center", bold: true, maxLines: 2 }));
  });
  items.forEach((item, index) => {
    const x = index % 2 === 0 ? 72 : 560;
    const y = 820 + Math.floor(index / 2) * 95;
    elements.push(line(x, y, 448, 0, style.ink, 1));
    elements.push(text(String(index + 1).padStart(2, "0"), x, y + 14, 44, 18, style.accent, { bold: true }));
    elements.push(text(item.detail || item.title, x + 55, y + 12, 380, 17, style.ink));
  });
}

function radial(elements: SceneElement[], panel: RenderedPanel, style: SceneStyle) {
  elements.push(text(panelKicker(panel, "THE SYSTEM").toUpperCase(), 72, 72, 370, 21, style.accent, { family: style.labelFamily, bold: true }));
  const headingSize = fittedFontSize(panel.heading, 360, 52 * style.headingScale, 5, style.headingFamily, 32);
  elements.push(text(panel.heading, 72, 112, 360, headingSize, style.ink, {
    family: style.headingFamily,
    bold: true,
    lineHeight: 0.96,
    maxLines: 5,
  }));
  const cx = 700;
  const cy = 585;
  elements.push(ellipse(cx - 205, cy - 205, 410, 410, "transparent", style.muted));
  elements.push(ellipse(cx - 82, cy - 82, 164, 164, style.accent, style.accent));
  elements.push(text(panel.plan?.stat?.value ?? "CORE", cx - 66, cy - 13, 132, 23, "#FFFFFF", { align: "center", bold: true, maxLines: 1 }));
  const items = copyItems(panel).slice(0, 6);
  items.forEach((item, index) => {
    const angle = -Math.PI / 2 + index * (Math.PI * 2 / Math.max(1, items.length));
    const x = cx + Math.cos(angle) * 255;
    const y = cy + Math.sin(angle) * 255;
    elements.push(line(cx, cy, x - cx, y - cy, style.muted, 1, true));
    elements.push(ellipse(x - 16, y - 16, 32, 32, style.ink, style.paper));
    elements.push(text(item.title, x - 82, y + 24, 164, 17, style.ink, { align: "center", bold: true, maxLines: 2 }));
    if (item.detail) elements.push(text(item.detail, x - 86, y + 65, 172, 13, style.muted, { align: "center", maxLines: 2 }));
  });
}

function architecture(elements: SceneElement[], panel: RenderedPanel, style: SceneStyle) {
  if (style.identity === "editorial-report") {
    editorialArchitecture(elements, panel, style);
    return;
  }
  const headerBottom = header(elements, panel, style, "SYSTEM MAP", 56);
  const items = copyItems(panel).slice(0, 8);
  const columns = items.length <= 1 ? 1 : items.length <= 4 ? 2 : 3;
  const rows = Math.max(1, Math.ceil(items.length / columns));
  const compactGrid = rows >= 3;
  const cardWidth = columns === 1 ? 520 : columns === 2 ? 390 : 270;
  const cardHeight = compactGrid ? 110 : 122;
  const gapX = columns === 1 ? 0 : columns === 2 ? 58 : 34;
  const gapY = compactGrid ? 26 : 84;
  const figureTop = Math.max(310, headerBottom + 36);
  const figureBottom = 930;
  const innerTop = figureTop + 68;
  const innerBottom = figureBottom - 112;
  const contentHeight = rows * cardHeight + (rows - 1) * gapY;
  const startY = innerTop + Math.max(0, (innerBottom - innerTop - contentHeight) / 2);
  const positions = items.map((_, index) => {
    const row = Math.floor(index / columns);
    const rowStart = row * columns;
    const countInRow = Math.min(columns, items.length - rowStart);
    const rowWidth = countInRow * cardWidth + (countInRow - 1) * gapX;
    const naturalCol = index - rowStart;
    // Alternate row direction so sequential flows form a readable path
    // around the grid instead of drawing avoidable diagonal crossings.
    const col = row % 2 === 1 ? countInRow - 1 - naturalCol : naturalCol;
    return {
      x: (1080 - rowWidth) / 2 + col * (cardWidth + gapX),
      y: startY + row * (cardHeight + gapY),
      width: cardWidth,
      height: cardHeight,
    };
  });

  elements.push(rect(60, figureTop, 960, figureBottom - figureTop, "transparent", style.muted, 16));
  elements.push(
    text(
      `CONNECTED SYSTEM · ${items.length} PART${items.length === 1 ? "" : "S"}`,
      84,
      figureTop + 20,
      500,
      16,
      style.accent,
      { family: style.labelFamily, bold: true }
    )
  );

  const nodes = panel.plan?.nodes ?? [];
  const edges = panel.plan?.edges ?? [];
  if (nodes.length && edges.length) {
    edges.forEach((edge) => {
      const fromIndex = nodes.findIndex((node) => node.id === edge.from);
      const toIndex = nodes.findIndex((node) => node.id === edge.to);
      const from = positions[fromIndex];
      const to = positions[toIndex];
      if (!from || !to) return;
      const x = from.x + from.width / 2;
      const y = from.y + from.height / 2;
      elements.push(
        line(
          x,
          y,
          to.x + to.width / 2 - x,
          to.y + to.height / 2 - y,
          style.muted,
          2
        )
      );
    });
  } else {
    positions.slice(0, -1).forEach((from, index) => {
      const to = positions[index + 1];
      const x = from.x + from.width / 2;
      const y = from.y + from.height / 2;
      elements.push(
        line(
          x,
          y,
          to.x + to.width / 2 - x,
          to.y + to.height / 2 - y,
          style.muted,
          2
        )
      );
    });
  }

  items.forEach((item, index) => {
    const { x, y, width } = positions[index];
    const featured = index === 0;
    elements.push(
      rect(
        x,
        y,
        width,
        cardHeight,
        featured ? style.accent : style.paper,
        featured ? style.accent : style.ink,
        18
      )
    );
    elements.push(
      text(item.title, x + 22, y + 18, width - 44, compactGrid ? 20 : 22, featured ? "#FFFFFF" : style.ink, {
        align: "center",
        bold: true,
        maxLines: 2,
      })
    );
    if (item.detail) {
      elements.push(
        text(item.detail, x + 22, y + 70, width - 44, compactGrid ? 14 : 15, featured ? "#FFFFFF" : style.muted, {
          align: "center",
          maxLines: 2,
        })
      );
    }
  });
  elements.push(line(84, figureBottom - 82, 912, 0, style.muted, 1));
  elements.push(
    text(panel.caption, 84, figureBottom - 60, 912, 17, style.muted, {
      maxLines: 2,
    })
  );
}

function editorialArchitecture(
  elements: SceneElement[],
  panel: RenderedPanel,
  style: SceneStyle
) {
  const headerBottom = header(elements, panel, style, "SYSTEM MAP", 56);
  const items = copyItems(panel).slice(0, 6);
  const figureTop = Math.max(330, headerBottom + 46);
  const figureBottom = 874;
  const centerX = 540;
  const centerY = figureTop + 190;
  const positions = items.map((_, index) => {
    const topRow = index < 3;
    const rowCount = topRow ? Math.min(3, items.length) : items.length - 3;
    const rowIndex = topRow ? index : index - 3;
    const step = rowCount > 1 ? 660 / (rowCount - 1) : 0;
    return {
      x: rowCount === 1 ? 410 : 80 + rowIndex * step,
      y: topRow ? figureTop + 56 : figureTop + 320,
    };
  });

  elements.push(rect(72, figureTop, 936, figureBottom - figureTop, "transparent", "#D8D2C8"));
  elements.push(
    text("FIGURE · RELATIONSHIP MAP", 94, figureTop + 18, 420, 16, style.accent, {
      family: style.labelFamily,
      bold: true,
    })
  );
  positions.forEach(({ x, y }) => {
    elements.push(line(centerX, centerY, x + 130 - centerX, y + 46 - centerY, style.muted, 1));
  });
  elements.push(rect(410, centerY - 48, 260, 96, style.paper, style.accent));
  elements.push(
    text(
      panel.plan?.framework?.label ?? panel.plan?.definitionCard?.term ?? "SHARED SYSTEM",
      430,
      centerY - 17,
      220,
      18,
      style.ink,
      { align: "center", family: style.serif, bold: true, maxLines: 2 }
    )
  );
  items.forEach((item, index) => {
    const { x, y } = positions[index];
    elements.push(rect(x, y, 260, 92, style.paper, style.ink));
    elements.push(
      text(item.title, x + 16, y + 18, 228, 18, style.ink, {
        align: "center",
        family: style.serif,
        bold: true,
        maxLines: 2,
      })
    );
    if (item.detail) {
      elements.push(
        text(item.detail, x + 16, y + 56, 228, 12, style.muted, {
          align: "center",
          maxLines: 2,
        })
      );
    }
  });
  elements.push(line(94, figureBottom - 64, 892, 0, style.muted, 1));
  elements.push(
    text(`Figure. ${panel.caption}`, 94, figureBottom - 45, 892, 14, style.muted, {
      family: style.serif,
      maxLines: 2,
    })
  );
}

function chart(elements: SceneElement[], panel: RenderedPanel, style: SceneStyle, diverging = false) {
  header(elements, panel, style, panel.plan?.chart?.title ?? "THE DATA", 56);
  const points = panel.plan?.chart?.series.flatMap((series) => series.points).slice(0, 8) ?? [];
  const overrides = panel.copyOverrides?.items;
  const data = (points.length ? points : copyItems(panel).map((item, index) => ({ label: item.title, value: index + 1 }))).slice(0, 8);
  const values = data.map((point, index) => {
    const match = overrides?.[index]?.detail.match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : point.value;
  });
  const max = Math.max(...values.map((value) => Math.abs(value)), 1);
  const negativeColor = negativeDataColor(style.accent);
  const editorialFigure = style.identity === "editorial-report";
  if (editorialFigure) {
    elements.push(rect(72, 326, 936, 572, "transparent", "#D8D2C8"));
    elements.push(
      text("FIGURE · EVIDENCE DISTRIBUTION", 94, 346, 430, 16, style.accent, {
        family: style.labelFamily,
        bold: true,
      })
    );
    elements.push(text("BASELINE", 516, 346, 108, 13, style.muted, { align: "center" }));
  }
  data.forEach((point, index) => {
    const y = (editorialFigure ? 405 : 365) + index * (editorialFigure ? 72 : 76);
    const value = values[index];
    const label = overrides?.[index]?.title ?? point.label;
    const display = overrides?.[index]?.detail ?? `${value}${panel.plan?.chart?.unit ?? ""}`;
    elements.push(text(label, 72, y + 5, 230, 18, style.ink, { maxLines: 2 }));
    if (diverging) {
      elements.push(line(570, y, 0, 48, style.ink, 1));
      const width = Math.max(12, Math.abs(value) / max * 250);
      elements.push(rect(value < 0 ? 570 - width : 570, y + 7, width, 34, value < 0 ? negativeColor : "#258A55"));
    } else {
      elements.push(rect(320, y + 7, 560, 34, "#E2DED4"));
      elements.push(rect(320, y + 7, Math.max(12, Math.abs(value) / max * 560), 34, value < 0 ? negativeColor : style.accent));
    }
    elements.push(text(display, 900, y + 4, 108, 20, style.ink, { bold: true }));
  });
  if (editorialFigure) {
    elements.push(line(94, 820, 892, 0, style.muted, 1));
    elements.push(
      text(`Figure. ${panel.caption}`, 94, 842, 892, 14, style.muted, {
        family: style.serif,
        maxLines: 2,
      })
    );
  }
}

function report(elements: SceneElement[], panel: RenderedPanel, style: SceneStyle) {
  const reportFamily =
    style.identity === "editorial-report" ? style.serif : style.headingFamily;
  const dataHeader = style.identity === "data-story";
  if (dataHeader) {
    elements.push(rect(48, 48, 984, 245, style.ink));
    elements.push(rect(48, 48, 14, 245, style.accent));
  }
  elements.push(text(panelKicker(panel, "THE FIELD NOTE"), dataHeader ? 92 : 72, 60, dataHeader ? 852 : 936, 18, dataHeader ? "#8DDAA8" : style.ink, { align: dataHeader ? "left" : "center", family: style.labelFamily, bold: dataHeader }));
  const reportHeadingSize = fittedFontSize(
    panel.heading,
    880,
    55 * style.headingScale,
    4,
    style.headingFamily,
    36
  );
  elements.push(text(panel.heading, dataHeader ? 92 : 100, 105, dataHeader ? 852 : 880, reportHeadingSize, dataHeader ? style.paper : style.ink, { align: dataHeader ? "left" : "center", family: style.headingFamily, bold: true }));
  const items = panelItems(panel).slice(0, 4);
  const primary = panelPrimary(panel).trim();

  if (items.length === 0) {
    // A report identity can still carry a single insight. Give that idea a
    // publication-like thesis frame instead of inventing a one-node diagram.
    elements.push(line(190, 350, 700, 0, style.ink, 1));
    elements.push(rect(175, 405, 730, 330, style.paper, style.ink, 18));
    elements.push(rect(175, 405, 18, 330, style.accent));
    const primarySize = fittedFontSizeWithinHeight(
      primary,
      620,
      38 * style.headingScale,
      7,
      reportFamily,
      25,
      215,
      1.16
    );
    elements.push(
      text(primary, 230, 465, 620, primarySize, style.ink, {
        align: "center",
        family: reportFamily,
        bold: true,
        lineHeight: 1.16,
        maxLines: 7,
      })
    );
    elements.push(line(360, 790, 360, 0, style.accent, 4));
    return;
  }

  const centerLabel =
    panel.plan?.definitionCard?.term ??
    panel.plan?.framework?.label ??
    (panel.plan?.nodes?.length ? "Relationship map" : "Key points");
  elements.push(
    text(`FRAMEWORK · ${centerLabel}`.toUpperCase(), 72, 300, 936, 16, style.accent, {
      family: style.labelFamily,
      bold: true,
      maxLines: 1,
    })
  );

  const cardWidth = 456;
  const cardHeight = 150;
  const cardGapX = 24;
  const cardGapY = 22;
  const gridTop = 336;
  items.forEach((item, index) => {
    const x = 72 + (index % 2) * (cardWidth + cardGapX);
    const y = gridTop + Math.floor(index / 2) * (cardHeight + cardGapY);
    elements.push(rect(x, y, cardWidth, cardHeight, style.paper, "#D8D2C8", 10));
    elements.push(rect(x, y, 8, cardHeight, style.accent));
    elements.push(
      text(String(index + 1).padStart(2, "0"), x + 24, y + 20, 36, 16, style.accent, {
        family: style.labelFamily,
        bold: true,
      })
    );
    elements.push(
      text(item.title, x + 70, y + 18, 354, 22, style.ink, {
        family: reportFamily,
        bold: true,
        maxLines: 2,
      })
    );
    if (item.detail) {
      elements.push(
        text(item.detail, x + 70, y + 72, 354, 17, style.muted, {
          family: style.sans,
          lineHeight: 1.18,
          maxLines: 3,
        })
      );
    }
  });

  const gridRows = Math.ceil(items.length / 2);
  const gridBottom = gridTop + gridRows * cardHeight + (gridRows - 1) * cardGapY;
  const summaryLineY = gridBottom + 42;
  elements.push(line(72, summaryLineY, 936, 0, style.ink));
  elements.push(
    text("SUMMARY", 72, summaryLineY + 24, 180, 15, style.accent, {
      family: style.labelFamily,
      bold: true,
    })
  );
  const primarySize = fittedFontSizeWithinHeight(
    primary,
    760,
    30 * style.headingScale,
    5,
    reportFamily,
    21,
    180,
    1.16
  );
  elements.push(
    text(primary, 248, summaryLineY + 20, 760, primarySize, style.ink, {
      family: reportFamily,
      bold: true,
      lineHeight: 1.16,
      maxLines: 5,
    })
  );
}

function contents(elements: SceneElement[], panel: RenderedPanel, style: SceneStyle) {
  header(elements, panel, style, "FIELD GUIDE", 54);
  elements.push(text("Contents", 72, 330, 480, 34, style.ink, { bold: true }));
  copyItems(panel).slice(0, 7).forEach((item, index) => {
    const y = 400 + index * 78;
    elements.push(line(72, y, 480, 0, style.ink, index === 0 ? 2 : 1));
    elements.push(text(String(index + 1).padStart(2, "0"), 72, y + 18, 45, 18, style.accent, { bold: true }));
    elements.push(text(item.title, 130, y + 15, 405, 20, style.ink, { bold: true }));
  });
  elements.push(rect(610, 320, 398, 590, style.ink, "transparent", 80));
  elements.push(ellipse(730, 420, 360, 360, "transparent", "#FFFFFF"));
  elements.push(ellipse(660, 680, 180, 180, style.accent, style.accent));
  elements.push(text(panel.plan?.definitionCard?.term ?? "READ", 650, 835, 300, 30, "#FFFFFF", { bold: true }));
}

function essay(elements: SceneElement[], panel: RenderedPanel, style: SceneStyle) {
  header(elements, panel, style, "THE ARGUMENT", 62);
  elements.push(line(72, 320, 936, 0, style.muted, 1));
  const primary = panelPrimary(panel).trim();
  const items = panelItems(panel).slice(0, 3);
  const normalizedPrimary = primary.replace(/\s+/g, " ").toLowerCase();
  const normalizedCaption = panel.caption.trim().replace(/\s+/g, " ").toLowerCase();
  const captionAddsContext =
    normalizedCaption.length > 0 &&
    normalizedCaption !== normalizedPrimary &&
    !items.some((item) =>
      [item.title, item.detail]
        .map((value) => value.trim().replace(/\s+/g, " ").toLowerCase())
        .includes(normalizedCaption)
    );

  if (items.length === 0) {
    // Itemless insight panels should read like a composed editorial thesis,
    // not a list whose fallback repeats the heading and caption.
    elements.push(rect(72, 382, 12, 320, style.accent));
    const primarySize = fittedFontSize(
      primary,
      790,
      44 * style.headingScale,
      8,
      style.headingFamily,
      28
    );
    elements.push(
      text(primary, 126, 375, 790, primarySize, style.ink, {
        family: style.headingFamily,
        bold: true,
        lineHeight: 1.12,
        maxLines: 8,
      })
    );
    elements.push(line(126, 765, 520, 0, style.accent, 4));
  } else {
    elements.push(
      text(primary, 72, 380, 300, 24, style.ink, {
        lineHeight: 1.28,
        maxLines: 14,
      })
    );
    items.forEach((item, index) => {
      const y = 370 + index * 150;
      elements.push(line(430, y, 578, 0, style.ink, 1));
      elements.push(
        text(item.title, 430, y + 24, 520, 28, style.ink, {
          bold: true,
          maxLines: 2,
        })
      );
      if (item.detail) {
        elements.push(
          text(item.detail, 430, y + 66, 550, 17, style.muted, {
            lineHeight: 1.25,
            maxLines: 3,
          })
        );
      }
    });
  }

  if (captionAddsContext) {
    elements.push(line(72, 875, 936, 0, style.ink, 7, true));
    const captionSize = fittedFontSize(
      panel.caption,
      900,
      22,
      4,
      style.headingFamily,
      16
    );
    elements.push(
      text(panel.caption, 72, 900, 900, captionSize, style.ink, {
        bold: true,
        family: style.headingFamily,
        lineHeight: 1.08,
        maxLines: 4,
      })
    );
  }
}

function footer(elements: SceneElement[], input: SceneInput, style: SceneStyle) {
  elements.push(line(72, 1015, 936, 0, style.ink, 2));
  elements.push(text(sourceLabel(input.explainer.url), 72, 1030, 330, 15, style.ink, { maxLines: 1 }));
  elements.push(text(`${String(input.panelIndex).padStart(2, "0")} / ${String(input.totalPanels).padStart(2, "0")}`, 470, 1030, 140, 15, style.accent, { align: "center", bold: true }));
  elements.push(text("readopp", 820, 1030, 188, 15, style.ink, { align: "right", bold: true }));
}

/** Build a suggested-layout panel entirely from native, editable elements. */
export function createEditableTemplateScene(input: SceneInput): Record<string, unknown> {
  elementSequence = 0;
  const style = styleFor(input);
  const sequencePanels = input.explainer.panels.map((candidate, index) =>
    index === input.panelIndex - 1 ? input.panel : candidate
  );
  const layout = chooseTemplatePanelLayout(
    sequencePanels,
    input.panelIndex,
    input.panel,
    input.template
  );
  const elements: SceneElement[] = [rect(0, 0, 1080, 1080, style.paper)];
  identityDecoration(elements, style);

  if (layout === "cover") cover(elements, input.panel, style);
  else if (layout === "priorities") priorities(elements, input.panel, style);
  else if (layout === "hierarchy") hierarchy(elements, input.panel, style);
  else if (layout === "radial") radial(elements, input.panel, style);
  else if (layout === "architecture") architecture(elements, input.panel, style);
  else if (layout === "chart") chart(elements, input.panel, style);
  else if (layout === "diverging") chart(elements, input.panel, style, true);
  else if (layout === "contents") contents(elements, input.panel, style);
  else if (layout === "essay") essay(elements, input.panel, style);
  else report(elements, input.panel, style);
  footer(elements, input, style);

  return {
    type: "excalidraw",
    version: 2,
    source: "readopp-template",
    readoppLayout: layout,
    elements,
    appState: { viewBackgroundColor: style.paper },
    files: {},
  };
}
