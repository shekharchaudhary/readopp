/**
 * Curated Readopp asset library for the Excalidraw editor.
 *
 * Three buckets, all auto-loaded into the editor's Library sidebar when the
 * canvas mounts:
 *
 *   • Icons — every entry from lib/render/icons.ts wrapped into an
 *     Excalidraw image element. Brand-consistent stroke weight, drops in
 *     at a uniform 64 px so two icons sit comfortably side by side.
 *   • Shape primitives — native Excalidraw line / polygon elements so the
 *     user can recolor / resize / restyle freely. Pyramid, hexagon, sign,
 *     bold arrow.
 *   • Chart templates — pre-composed 3-bar chart, donut, sparkline using
 *     native rect/ellipse/line elements so they remain fully editable.
 *
 * Buildable purely on the client (uses btoa for the icon data URLs) — call
 * inside a useMemo on the editor route.
 */

import { ICON_NAMES, iconSvg, type IconName } from "../render/icons";

const INK = "#1A1A1A";
const PAPER_LINE = "#D6CFC2";
const CLAY = "#C7613D";
const BLUE = "#185FA5";
const TEAL = "#0F6E56";
const AMBER = "#854F0B";

const ICON_PX = 64;

// ---------- Public types ----------

export interface LibraryFile {
  id: string;
  mimeType: "image/svg+xml" | "image/png";
  dataURL: string;
  created: number;
  lastRetrieved: number;
}

export interface LibraryItem {
  id: string;
  status: "published" | "unpublished";
  name: string;
  elements: unknown[];
  // Required by Excalidraw v0.18+ — items without `created` are silently
  // dropped from the Library sidebar.
  created: number;
}

export interface ReadoppLibrary {
  libraryItems: LibraryItem[];
  files: Record<string, LibraryFile>;
}

// ---------- Builder ----------

export function buildReadoppLibrary(): ReadoppLibrary {
  const libraryItems: LibraryItem[] = [];
  const files: Record<string, LibraryFile> = {};

  // Icons.
  for (const name of ICON_NAMES) {
    const fileId = `readopp-icon-${name}`;
    const svg = wrapIconSvg(name);
    files[fileId] = {
      id: fileId,
      mimeType: "image/svg+xml",
      dataURL: svgDataUrl(svg),
      created: Date.now(),
      lastRetrieved: Date.now(),
    };
    libraryItems.push({
      id: `readopp-icon-${name}-item`,
      status: "unpublished",
      name: humanize(name),
      created: Date.now(),
      elements: [imageElement({ id: `el-${name}`, fileId, size: ICON_PX })],
    });
  }

  // Shape primitives.
  libraryItems.push(...buildShapePrimitives());

  // Chart templates.
  libraryItems.push(...buildChartTemplates());

  return { libraryItems, files };
}

function humanize(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ---------- Icon SVG helpers ----------

function wrapIconSvg(name: IconName): string {
  const inner = iconSvg(name, {
    x: 0,
    y: 0,
    size: ICON_PX,
    stroke: INK,
    strokeWidth: 2,
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ICON_PX} ${ICON_PX}">${inner}</svg>`;
}

function svgDataUrl(svg: string): string {
  const encoded =
    typeof window === "undefined"
      ? Buffer.from(svg).toString("base64")
      : window.btoa(unescape(encodeURIComponent(svg)));
  return "data:image/svg+xml;base64," + encoded;
}

// ---------- Excalidraw element builders ----------

function baseElement<T extends string>(type: T, id: string) {
  return {
    id,
    type,
    angle: 0,
    strokeColor: INK,
    backgroundColor: "transparent" as const,
    fillStyle: "solid" as const,
    strokeWidth: 2,
    strokeStyle: "solid" as const,
    roughness: 1,
    opacity: 100,
    groupIds: [] as string[],
    frameId: null as null | string,
    roundness: null as null | { type: number },
    seed: Math.floor(Math.random() * 1_000_000),
    // v0.18 requires version, versionNonce, AND index. Omitting any of
    // them silently drops the element from the library sidebar.
    version: 1,
    versionNonce: Math.floor(Math.random() * 1_000_000),
    index: null,
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    customData: null,
  };
}

function imageElement(args: { id: string; fileId: string; size: number }) {
  return {
    ...baseElement("image", args.id),
    x: 0,
    y: 0,
    width: args.size,
    height: args.size,
    strokeColor: "transparent",
    strokeWidth: 1,
    fileId: args.fileId,
    status: "saved" as const,
    scale: [1, 1] as [number, number],
    crop: null,
    locked: false,
  };
}

function rectElement(args: {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  stroke?: string;
  fill?: string;
  roundness?: boolean;
}) {
  return {
    ...baseElement("rectangle", args.id),
    x: args.x,
    y: args.y,
    width: args.w,
    height: args.h,
    strokeColor: args.stroke ?? INK,
    backgroundColor: args.fill ?? "transparent",
    fillStyle: "solid" as const,
    roundness: args.roundness ? { type: 3 } : null,
  };
}

function ellipseElement(args: {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  stroke?: string;
  fill?: string;
}) {
  return {
    ...baseElement("ellipse", args.id),
    x: args.x,
    y: args.y,
    width: args.w,
    height: args.h,
    strokeColor: args.stroke ?? INK,
    backgroundColor: args.fill ?? "transparent",
  };
}

function lineElement(args: {
  id: string;
  x: number;
  y: number;
  points: [number, number][];
  stroke?: string;
  strokeWidth?: number;
}) {
  const xs = args.points.map((p) => p[0]);
  const ys = args.points.map((p) => p[1]);
  return {
    ...baseElement("line", args.id),
    x: args.x,
    y: args.y,
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
    points: args.points,
    strokeColor: args.stroke ?? INK,
    strokeWidth: args.strokeWidth ?? 2,
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: null,
  };
}

function arrowElement(args: {
  id: string;
  x: number;
  y: number;
  points: [number, number][];
  stroke?: string;
  strokeWidth?: number;
}) {
  return {
    ...lineElement(args),
    type: "arrow" as const,
    endArrowhead: "arrow" as const,
  };
}

// ---------- Shape primitives ----------

function buildShapePrimitives(): LibraryItem[] {
  const items: LibraryItem[] = [];

  // Triangle / pyramid silhouette: bottom-left, bottom-right, apex, close.
  items.push({
    id: "readopp-shape-triangle",
    status: "unpublished",
    name: "Triangle",
    created: Date.now(),
    elements: [
      lineElement({
        id: "tri-1",
        x: 0,
        y: 0,
        points: [
          [0, 100],
          [100, 100],
          [50, 0],
          [0, 100],
        ],
      }),
    ],
  });

  // 3-faced pyramid (front triangle + right side hint).
  items.push({
    id: "readopp-shape-pyramid",
    status: "unpublished",
    name: "Pyramid (3D)",
    created: Date.now(),
    elements: [
      lineElement({
        id: "pyr-1",
        x: 0,
        y: 0,
        points: [
          [0, 110],
          [80, 110],
          [50, 0],
          [0, 110],
        ],
      }),
      lineElement({
        id: "pyr-2",
        x: 80,
        y: 110,
        points: [
          [0, 0],
          [20, -10],
          [-30, -110],
        ],
        strokeWidth: 1.5,
      }),
    ],
  });

  // Hexagon — 6-sided closed polyline.
  items.push({
    id: "readopp-shape-hexagon",
    status: "unpublished",
    name: "Hexagon",
    created: Date.now(),
    elements: [
      lineElement({
        id: "hex-1",
        x: 0,
        y: 0,
        points: [
          [25, 0],
          [75, 0],
          [100, 43],
          [75, 87],
          [25, 87],
          [0, 43],
          [25, 0],
        ],
      }),
    ],
  });

  // Stop-sign (octagon).
  items.push({
    id: "readopp-shape-sign",
    status: "unpublished",
    name: "Sign (octagon)",
    created: Date.now(),
    elements: [
      lineElement({
        id: "sign-1",
        x: 0,
        y: 0,
        points: [
          [30, 0],
          [70, 0],
          [100, 30],
          [100, 70],
          [70, 100],
          [30, 100],
          [0, 70],
          [0, 30],
          [30, 0],
        ],
        strokeWidth: 2.5,
        stroke: CLAY,
      }),
    ],
  });

  // Big chevron arrow.
  items.push({
    id: "readopp-shape-bigarrow",
    status: "unpublished",
    name: "Arrow (bold)",
    created: Date.now(),
    elements: [
      arrowElement({
        id: "arr-1",
        x: 0,
        y: 0,
        points: [
          [0, 30],
          [120, 30],
        ],
        strokeWidth: 4,
      }),
    ],
  });

  return items;
}

// ---------- Chart templates ----------

function buildChartTemplates(): LibraryItem[] {
  const items: LibraryItem[] = [];

  // 3-bar chart, ascending. Each bar is its own rect so the user can
  // resize each value independently after dropping.
  items.push({
    id: "readopp-chart-bars",
    status: "unpublished",
    name: "Bar chart (3 cols)",
    created: Date.now(),
    elements: [
      // Axis lines
      lineElement({
        id: "bars-axis-h",
        x: 0,
        y: 0,
        points: [
          [0, 160],
          [220, 160],
        ],
        strokeWidth: 1.5,
        stroke: PAPER_LINE,
      }),
      lineElement({
        id: "bars-axis-v",
        x: 0,
        y: 0,
        points: [
          [0, 0],
          [0, 160],
        ],
        strokeWidth: 1.5,
        stroke: PAPER_LINE,
      }),
      // Bars
      rectElement({
        id: "bar-1",
        x: 24,
        y: 100,
        w: 40,
        h: 60,
        stroke: BLUE,
        fill: BLUE,
      }),
      rectElement({
        id: "bar-2",
        x: 90,
        y: 60,
        w: 40,
        h: 100,
        stroke: TEAL,
        fill: TEAL,
      }),
      rectElement({
        id: "bar-3",
        x: 156,
        y: 24,
        w: 40,
        h: 136,
        stroke: AMBER,
        fill: AMBER,
      }),
    ],
  });

  // Donut chart — single ring with a notch hint via a smaller paper ellipse.
  items.push({
    id: "readopp-chart-donut",
    status: "unpublished",
    name: "Donut chart",
    created: Date.now(),
    elements: [
      ellipseElement({
        id: "donut-outer",
        x: 0,
        y: 0,
        w: 160,
        h: 160,
        stroke: BLUE,
        fill: BLUE,
      }),
      ellipseElement({
        id: "donut-inner",
        x: 36,
        y: 36,
        w: 88,
        h: 88,
        stroke: "transparent",
        fill: "#FAF9F5",
      }),
    ],
  });

  // Sparkline — trending up.
  items.push({
    id: "readopp-chart-trend",
    status: "unpublished",
    name: "Trend line",
    created: Date.now(),
    elements: [
      lineElement({
        id: "trend-1",
        x: 0,
        y: 0,
        points: [
          [0, 80],
          [40, 70],
          [80, 50],
          [120, 55],
          [160, 30],
          [200, 10],
        ],
        strokeWidth: 3,
        stroke: CLAY,
      }),
    ],
  });

  return items;
}
