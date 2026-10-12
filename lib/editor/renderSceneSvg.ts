/**
 * Render the native suggested-layout scene without loading Excalidraw.
 *
 * The panel preview and the canvas now consume the same scene graph. This
 * small renderer only implements the primitives emitted by templateScene
 * (text, rectangle, ellipse, and line); imported/user-authored scenes still
 * use Excalidraw's own exporter when the user presses Save or Export.
 */

type SceneElement = Record<string, unknown>;

const FONT_STACKS: Record<number, string> = {
  1: '"Comic Sans MS", "Bradley Hand", cursive',
  2: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  3: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
  4: 'Georgia, "Times New Roman", serif',
};

export function renderEditableSceneSvg(scene: unknown): string {
  const record = asRecord(scene);
  const elements = Array.isArray(record?.elements)
    ? (record.elements as SceneElement[]).filter((element) => !element.isDeleted)
    : [];
  const background =
    asRecord(record?.appState)?.viewBackgroundColor?.toString() || "#FAF9F5";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080" role="img" aria-label="Editable panel preview">
  <rect width="1080" height="1080" fill="${escapeAttr(background)}"/>
  ${elements.map(renderElement).join("\n  ")}
</svg>`;
}

export function renderEditableSceneHtml(scene: unknown): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>
  *{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#fff}svg{display:block;width:100%;height:100%}
  </style></head><body>${renderEditableSceneSvg(scene)}</body></html>`;
}

function renderElement(element: SceneElement): string {
  const type = stringValue(element.type);
  if (type === "rectangle") return renderRectangle(element);
  if (type === "ellipse") return renderEllipse(element);
  if (type === "line" || type === "arrow") return renderLine(element);
  if (type === "text") return renderText(element);
  return "";
}

function renderRectangle(element: SceneElement): string {
  const x = numberValue(element.x);
  const y = numberValue(element.y);
  const width = Math.max(0, numberValue(element.width));
  const height = Math.max(0, numberValue(element.height));
  const radius = element.roundness ? Math.min(30, width / 8, height / 8) : 0;
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" rx="${n(radius)}" ${paint(element)}/>`;
}

function renderEllipse(element: SceneElement): string {
  const x = numberValue(element.x);
  const y = numberValue(element.y);
  const width = Math.max(0, numberValue(element.width));
  const height = Math.max(0, numberValue(element.height));
  return `<ellipse cx="${n(x + width / 2)}" cy="${n(y + height / 2)}" rx="${n(width / 2)}" ry="${n(height / 2)}" ${paint(element)}/>`;
}

function renderLine(element: SceneElement): string {
  const x = numberValue(element.x);
  const y = numberValue(element.y);
  const points = Array.isArray(element.points)
    ? element.points
        .map((point) =>
          Array.isArray(point) && point.length >= 2
            ? `${n(x + numberValue(point[0]))},${n(y + numberValue(point[1]))}`
            : null
        )
        .filter(Boolean)
        .join(" ")
    : "";
  if (!points) return "";
  const dash = element.strokeStyle === "dashed" ? ' stroke-dasharray="10 9"' : "";
  return `<polyline points="${points}" fill="none" stroke="${escapeAttr(colorValue(element.strokeColor, "#111111"))}" stroke-width="${n(Math.max(1, numberValue(element.strokeWidth, 1)))}" stroke-linecap="round" stroke-linejoin="round"${dash}${opacityAttr(element)}/>`;
}

function renderText(element: SceneElement): string {
  const value = stringValue(element.text || element.originalText);
  if (!value) return "";
  const x = numberValue(element.x);
  const y = numberValue(element.y);
  const width = Math.max(1, numberValue(element.width, 300));
  const fontSize = Math.max(8, numberValue(element.fontSize, 20));
  const family = numberValue(element.fontFamily, 2);
  const align = stringValue(element.textAlign) || "left";
  const anchor = align === "center" ? "middle" : align === "right" ? "end" : "start";
  const textX = align === "center" ? x + width / 2 : align === "right" ? x + width : x;
  const lineHeight = Math.max(0.8, numberValue(element.lineHeight, 1.2));
  const lines = wrapText(value, width, fontSize, family);
  const weight = numberValue(element.fontWeight, 400);
  const style = stringValue(element.fontStyle) || "normal";
  const fill = colorValue(element.strokeColor, "#111111");

  return `<text x="${n(textX)}" y="${n(y + fontSize)}" text-anchor="${anchor}" fill="${escapeAttr(fill)}" font-family="${escapeAttr(FONT_STACKS[family] || FONT_STACKS[2])}" font-size="${n(fontSize)}" font-weight="${n(weight)}" font-style="${escapeAttr(style)}"${opacityAttr(element)}>${lines
    .map(
      (line, index) =>
        `<tspan x="${n(textX)}" dy="${index === 0 ? 0 : n(fontSize * lineHeight)}">${escapeText(line)}</tspan>`
    )
    .join("")}</text>`;
}

function wrapText(
  value: string,
  width: number,
  fontSize: number,
  family: number
): string[] {
  const averageWidth = fontSize * (family === 3 ? 0.62 : family === 4 ? 0.54 : 0.55);
  const maxChars = Math.max(4, Math.floor(width / Math.max(1, averageWidth)));
  const output: string[] = [];
  for (const paragraph of value.split("\n")) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      output.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length <= maxChars || !line) {
        line = candidate;
      } else {
        output.push(line);
        line = word;
      }
    }
    if (line) output.push(line);
  }
  return output.slice(0, 12);
}

function paint(element: SceneElement): string {
  const fill = colorValue(element.backgroundColor, "transparent");
  const stroke = colorValue(element.strokeColor, "transparent");
  const strokeWidth = stroke === "transparent" ? 0 : Math.max(1, numberValue(element.strokeWidth, 1));
  return `fill="${escapeAttr(fill === "transparent" ? "none" : fill)}" stroke="${escapeAttr(stroke === "transparent" ? "none" : stroke)}" stroke-width="${n(strokeWidth)}"${opacityAttr(element)}`;
}

function opacityAttr(element: SceneElement): string {
  const opacity = Math.max(0, Math.min(100, numberValue(element.opacity, 100))) / 100;
  return opacity < 1 ? ` opacity="${n(opacity)}"` : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function colorValue(value: unknown, fallback: string): string {
  const color = stringValue(value);
  return color || fallback;
}

function n(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function escapeText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value: string): string {
  return escapeText(value).replaceAll('"', "&quot;");
}
