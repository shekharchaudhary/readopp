/**
 * Curated Readopp asset library for the Excalidraw editor.
 *
 * Every item is built from native Excalidraw primitives (lines, arrows,
 * rectangles, ellipses, text) — no image elements. We tried image-based
 * icons that referenced SVG dataURL files via fileId and v0.18 silently
 * dropped them through restoreLibraryItems / failed to render thumbnails
 * in the library sidebar. Native primitives are the design center of
 * Excalidraw and render reliably in both the sidebar and on the canvas.
 *
 * Three buckets:
 *   • Annotations — callout box, label pill, banner, tag, asterisk,
 *     check, x-mark, circle highlight, underline.
 *   • Shapes — triangle, pyramid, hexagon, octagon sign, big arrow,
 *     curved arrow, return arrow.
 *   • Charts — 3-bar chart, donut, sparkline trend, axis pair.
 *
 * Buildable on the server (called from app/api/library/readopp/route.ts)
 * or client. No runtime dependencies on window / Buffer / canvas.
 */

const INK = "#1A1A1A";
const PAPER_LINE = "#D6CFC2";
const PAPER_SOFT = "#F1EFE8";
const CLAY = "#C7613D";
const BLUE = "#185FA5";
const TEAL = "#0F6E56";
const AMBER = "#854F0B";

// ---------- Public types ----------

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
}

// ---------- Builder ----------

export function buildReadoppLibrary(): ReadoppLibrary {
  const libraryItems: LibraryItem[] = [
    ...buildAnnotations(),
    ...buildShapes(),
    ...buildIcons(),
    ...buildCharts(),
  ];
  return { libraryItems };
}

// ---------- Element builders ----------

function baseElement<T extends string>(type: T, id: string) {
  return {
    id,
    type,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
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
    seed: deterministicSeed(id),
    version: 1,
    versionNonce: deterministicSeed(id + ":nonce"),
    index: null,
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    customData: null,
  };
}

interface RectArgs {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  rounded?: boolean;
}

function rectElement(args: RectArgs) {
  return {
    ...baseElement("rectangle", args.id),
    x: args.x,
    y: args.y,
    width: args.w,
    height: args.h,
    strokeColor: args.stroke ?? INK,
    backgroundColor: args.fill ?? "transparent",
    strokeWidth: args.strokeWidth ?? 2,
    roundness: args.rounded ? { type: 3 } : null,
  };
}

interface EllipseArgs {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
}

function ellipseElement(args: EllipseArgs) {
  return {
    ...baseElement("ellipse", args.id),
    x: args.x,
    y: args.y,
    width: args.w,
    height: args.h,
    strokeColor: args.stroke ?? INK,
    backgroundColor: args.fill ?? "transparent",
    strokeWidth: args.strokeWidth ?? 2,
  };
}

interface LineArgs {
  id: string;
  x: number;
  y: number;
  points: [number, number][];
  stroke?: string;
  strokeWidth?: number;
}

function lineElement(args: LineArgs) {
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

function arrowElement(args: LineArgs) {
  return {
    ...lineElement(args),
    type: "arrow" as const,
    endArrowhead: "arrow" as const,
    // v0.18 arrow element type requires `elbowed: boolean` — without it
    // restoreLibraryItems silently drops the parent library item.
    elbowed: false,
  };
}

interface TextArgs {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize?: number;
  fontFamily?: number;
  stroke?: string;
  align?: "left" | "center" | "right";
}

// Excalidraw font families (1 = Virgil hand-drawn, 2 = Helvetica, 3 = Cascadia, 5 = Assistant)
function textElement(args: TextArgs) {
  const fontSize = args.fontSize ?? 20;
  const text = args.text;
  // Rough width estimate so the bounding box isn't 0 — Excalidraw will
  // refine on first render.
  const width = Math.max(40, Math.round(text.length * fontSize * 0.6));
  const height = Math.round(fontSize * 1.25);
  return {
    ...baseElement("text", args.id),
    x: args.x,
    y: args.y,
    width,
    height,
    strokeColor: args.stroke ?? INK,
    text,
    fontSize,
    fontFamily: args.fontFamily ?? 2,
    textAlign: (args.align ?? "left") as "left" | "center" | "right",
    verticalAlign: "top" as const,
    baseline: fontSize,
    containerId: null,
    originalText: text,
    autoResize: true,
    lineHeight: 1.25,
  };
}

// ---------- Items ----------

function buildAnnotations(): LibraryItem[] {
  const items: LibraryItem[] = [];

  // Callout box — rounded rect with subtle fill, ready to type into.
  items.push(
    item("readopp-anno-callout", "Callout box", [
      rectElement({
        id: "callout-bg",
        x: 0,
        y: 0,
        w: 220,
        h: 80,
        stroke: INK,
        fill: PAPER_SOFT,
        strokeWidth: 1.5,
        rounded: true,
      }),
    ])
  );

  // Label pill — small rounded chip with placeholder text.
  items.push(
    item("readopp-anno-pill", "Label pill", [
      rectElement({
        id: "pill-bg",
        x: 0,
        y: 0,
        w: 120,
        h: 32,
        stroke: CLAY,
        fill: "transparent",
        strokeWidth: 1.5,
        rounded: true,
      }),
      textElement({
        id: "pill-text",
        x: 16,
        y: 7,
        text: "Label",
        fontSize: 16,
        stroke: CLAY,
      }),
    ])
  );

  // Banner — wide accent strip with thick top rule.
  items.push(
    item("readopp-anno-banner", "Banner strip", [
      rectElement({
        id: "banner-bg",
        x: 0,
        y: 0,
        w: 320,
        h: 56,
        stroke: PAPER_LINE,
        fill: PAPER_SOFT,
        strokeWidth: 1,
      }),
      lineElement({
        id: "banner-rule",
        x: 0,
        y: 0,
        points: [
          [0, 0],
          [320, 0],
        ],
        strokeWidth: 4,
        stroke: CLAY,
      }),
    ])
  );

  // Tag — small square corner tag.
  items.push(
    item("readopp-anno-tag", "Corner tag", [
      lineElement({
        id: "tag-shape",
        x: 0,
        y: 0,
        points: [
          [0, 0],
          [80, 0],
          [80, 30],
          [70, 40],
          [0, 40],
          [0, 0],
        ],
        strokeWidth: 1.5,
        stroke: INK,
      }),
    ])
  );

  // Asterisk — 3 crossed lines through a center point.
  items.push(
    item("readopp-anno-asterisk", "Asterisk", [
      lineElement({
        id: "ast-1",
        x: 0,
        y: 0,
        points: [
          [16, 0],
          [16, 32],
        ],
        strokeWidth: 2,
      }),
      lineElement({
        id: "ast-2",
        x: 0,
        y: 0,
        points: [
          [2, 8],
          [30, 24],
        ],
        strokeWidth: 2,
      }),
      lineElement({
        id: "ast-3",
        x: 0,
        y: 0,
        points: [
          [2, 24],
          [30, 8],
        ],
        strokeWidth: 2,
      }),
    ])
  );

  // Check mark.
  items.push(
    item("readopp-anno-check", "Check mark", [
      lineElement({
        id: "check-1",
        x: 0,
        y: 0,
        points: [
          [0, 18],
          [12, 32],
          [36, 0],
        ],
        strokeWidth: 3,
        stroke: TEAL,
      }),
    ])
  );

  // X-mark.
  items.push(
    item("readopp-anno-x", "X mark", [
      lineElement({
        id: "x-1",
        x: 0,
        y: 0,
        points: [
          [0, 0],
          [32, 32],
        ],
        strokeWidth: 3,
        stroke: CLAY,
      }),
      lineElement({
        id: "x-2",
        x: 0,
        y: 0,
        points: [
          [32, 0],
          [0, 32],
        ],
        strokeWidth: 3,
        stroke: CLAY,
      }),
    ])
  );

  // Circle highlight — empty ring you drop around an object.
  items.push(
    item("readopp-anno-circle-highlight", "Circle highlight", [
      ellipseElement({
        id: "circ-1",
        x: 0,
        y: 0,
        w: 80,
        h: 80,
        stroke: CLAY,
        fill: "transparent",
        strokeWidth: 3,
      }),
    ])
  );

  // Underline rule.
  items.push(
    item("readopp-anno-underline", "Underline rule", [
      lineElement({
        id: "und-1",
        x: 0,
        y: 0,
        points: [
          [0, 0],
          [120, 0],
        ],
        strokeWidth: 3,
        stroke: CLAY,
      }),
    ])
  );

  return items;
}

function buildShapes(): LibraryItem[] {
  const items: LibraryItem[] = [];

  // Triangle.
  items.push(
    item("readopp-shape-triangle", "Triangle", [
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
    ])
  );

  // Pyramid (3D).
  items.push(
    item("readopp-shape-pyramid", "Pyramid (3D)", [
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
    ])
  );

  // Hexagon.
  items.push(
    item("readopp-shape-hexagon", "Hexagon", [
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
    ])
  );

  // Sign (octagon).
  items.push(
    item("readopp-shape-sign", "Sign (octagon)", [
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
    ])
  );

  // Bold straight arrow.
  items.push(
    item("readopp-shape-arrow-right", "Arrow (bold right)", [
      arrowElement({
        id: "arr-r",
        x: 0,
        y: 0,
        points: [
          [0, 30],
          [120, 30],
        ],
        strokeWidth: 4,
      }),
    ])
  );

  // Down arrow.
  items.push(
    item("readopp-shape-arrow-down", "Arrow (down)", [
      arrowElement({
        id: "arr-d",
        x: 0,
        y: 0,
        points: [
          [30, 0],
          [30, 100],
        ],
        strokeWidth: 3,
      }),
    ])
  );

  // Curved/return arrow — 3-segment polyline with arrowhead.
  items.push(
    item("readopp-shape-arrow-return", "Arrow (return)", [
      arrowElement({
        id: "arr-ret",
        x: 0,
        y: 0,
        points: [
          [0, 0],
          [100, 0],
          [100, 40],
          [20, 40],
        ],
        strokeWidth: 2,
      }),
    ])
  );

  return items;
}

function buildIcons(): LibraryItem[] {
  const items: LibraryItem[] = [];

  // Lightbulb (idea) — bulb circle, base rect, rays.
  items.push(
    item("readopp-icon-lightbulb", "Lightbulb", [
      ellipseElement({
        id: "lb-bulb",
        x: 16,
        y: 0,
        w: 40,
        h: 40,
        stroke: AMBER,
        strokeWidth: 2,
      }),
      rectElement({
        id: "lb-base",
        x: 26,
        y: 42,
        w: 20,
        h: 12,
        stroke: AMBER,
        strokeWidth: 2,
      }),
      lineElement({
        id: "lb-foot",
        x: 0,
        y: 0,
        points: [
          [30, 58],
          [42, 58],
        ],
        strokeWidth: 2,
        stroke: AMBER,
      }),
    ])
  );

  // Brain — two ellipses + center divider line (stylised hemisphere).
  items.push(
    item("readopp-icon-brain", "Brain", [
      ellipseElement({
        id: "br-l",
        x: 0,
        y: 4,
        w: 36,
        h: 44,
        stroke: CLAY,
        strokeWidth: 2,
      }),
      ellipseElement({
        id: "br-r",
        x: 28,
        y: 4,
        w: 36,
        h: 44,
        stroke: CLAY,
        strokeWidth: 2,
      }),
      lineElement({
        id: "br-mid",
        x: 0,
        y: 0,
        points: [
          [32, 4],
          [32, 48],
        ],
        strokeWidth: 1,
        stroke: CLAY,
      }),
    ])
  );

  // Eye (insight) — ellipse outer, pupil circle, highlight dot.
  items.push(
    item("readopp-icon-eye", "Eye", [
      ellipseElement({
        id: "ey-outer",
        x: 0,
        y: 8,
        w: 64,
        h: 32,
        stroke: INK,
        strokeWidth: 2,
      }),
      ellipseElement({
        id: "ey-pupil",
        x: 22,
        y: 14,
        w: 20,
        h: 20,
        stroke: INK,
        fill: INK,
      }),
    ])
  );

  // Target — concentric rings + crosshair.
  items.push(
    item("readopp-icon-target", "Target", [
      ellipseElement({
        id: "tg-outer",
        x: 0,
        y: 0,
        w: 56,
        h: 56,
        stroke: CLAY,
        strokeWidth: 2,
      }),
      ellipseElement({
        id: "tg-mid",
        x: 12,
        y: 12,
        w: 32,
        h: 32,
        stroke: CLAY,
        strokeWidth: 2,
      }),
      ellipseElement({
        id: "tg-bull",
        x: 22,
        y: 22,
        w: 12,
        h: 12,
        stroke: CLAY,
        fill: CLAY,
      }),
    ])
  );

  // Lock — body rect + shackle arc (we draw as a curved polyline).
  items.push(
    item("readopp-icon-lock", "Lock", [
      rectElement({
        id: "lk-body",
        x: 4,
        y: 24,
        w: 40,
        h: 32,
        stroke: INK,
        strokeWidth: 2,
        rounded: true,
      }),
      lineElement({
        id: "lk-shackle",
        x: 0,
        y: 0,
        points: [
          [12, 24],
          [12, 12],
          [16, 4],
          [32, 4],
          [36, 12],
          [36, 24],
        ],
        strokeWidth: 2,
        stroke: INK,
      }),
      ellipseElement({
        id: "lk-hole",
        x: 20,
        y: 34,
        w: 8,
        h: 8,
        stroke: INK,
        fill: INK,
      }),
    ])
  );

  // Key — circle head + line stem with two teeth.
  items.push(
    item("readopp-icon-key", "Key", [
      ellipseElement({
        id: "ky-head",
        x: 0,
        y: 12,
        w: 24,
        h: 24,
        stroke: AMBER,
        strokeWidth: 2,
      }),
      lineElement({
        id: "ky-stem",
        x: 0,
        y: 0,
        points: [
          [24, 24],
          [60, 24],
        ],
        strokeWidth: 2,
        stroke: AMBER,
      }),
      lineElement({
        id: "ky-tooth-1",
        x: 0,
        y: 0,
        points: [
          [48, 24],
          [48, 32],
        ],
        strokeWidth: 2,
        stroke: AMBER,
      }),
      lineElement({
        id: "ky-tooth-2",
        x: 0,
        y: 0,
        points: [
          [56, 24],
          [56, 30],
        ],
        strokeWidth: 2,
        stroke: AMBER,
      }),
    ])
  );

  // Magnifier — circle + 45° handle line.
  items.push(
    item("readopp-icon-magnifier", "Magnifier", [
      ellipseElement({
        id: "mg-lens",
        x: 0,
        y: 0,
        w: 40,
        h: 40,
        stroke: INK,
        strokeWidth: 2,
      }),
      lineElement({
        id: "mg-handle",
        x: 0,
        y: 0,
        points: [
          [32, 32],
          [56, 56],
        ],
        strokeWidth: 3,
        stroke: INK,
      }),
    ])
  );

  // Document — rect + 3 horizontal lines (text).
  items.push(
    item("readopp-icon-document", "Document", [
      rectElement({
        id: "dc-frame",
        x: 0,
        y: 0,
        w: 40,
        h: 56,
        stroke: INK,
        strokeWidth: 2,
      }),
      lineElement({
        id: "dc-l1",
        x: 0,
        y: 0,
        points: [
          [8, 14],
          [32, 14],
        ],
        strokeWidth: 1.5,
        stroke: INK,
      }),
      lineElement({
        id: "dc-l2",
        x: 0,
        y: 0,
        points: [
          [8, 24],
          [32, 24],
        ],
        strokeWidth: 1.5,
        stroke: INK,
      }),
      lineElement({
        id: "dc-l3",
        x: 0,
        y: 0,
        points: [
          [8, 34],
          [24, 34],
        ],
        strokeWidth: 1.5,
        stroke: INK,
      }),
    ])
  );

  // Folder — body rect + tab notch (drawn as L on top).
  items.push(
    item("readopp-icon-folder", "Folder", [
      rectElement({
        id: "fd-body",
        x: 0,
        y: 8,
        w: 56,
        h: 40,
        stroke: AMBER,
        fill: "transparent",
        strokeWidth: 2,
      }),
      lineElement({
        id: "fd-tab",
        x: 0,
        y: 0,
        points: [
          [0, 8],
          [4, 0],
          [24, 0],
          [28, 8],
        ],
        strokeWidth: 2,
        stroke: AMBER,
      }),
    ])
  );

  // Cloud — three overlapping ellipses + rect base.
  items.push(
    item("readopp-icon-cloud", "Cloud", [
      ellipseElement({
        id: "cl-l",
        x: 0,
        y: 16,
        w: 28,
        h: 28,
        stroke: BLUE,
        strokeWidth: 2,
      }),
      ellipseElement({
        id: "cl-m",
        x: 14,
        y: 4,
        w: 36,
        h: 36,
        stroke: BLUE,
        strokeWidth: 2,
      }),
      ellipseElement({
        id: "cl-r",
        x: 36,
        y: 16,
        w: 28,
        h: 28,
        stroke: BLUE,
        strokeWidth: 2,
      }),
      lineElement({
        id: "cl-base",
        x: 0,
        y: 0,
        points: [
          [8, 44],
          [56, 44],
        ],
        strokeWidth: 2,
        stroke: BLUE,
      }),
    ])
  );

  // Gear — circle + 6 short radial spokes via lines.
  items.push((() => {
    const cx = 28,
      cy = 28,
      r1 = 18,
      r2 = 26;
    const spokes: ReturnType<typeof lineElement>[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const x1 = cx + r1 * Math.cos(a);
      const y1 = cy + r1 * Math.sin(a);
      const x2 = cx + r2 * Math.cos(a);
      const y2 = cy + r2 * Math.sin(a);
      spokes.push(
        lineElement({
          id: `gr-spoke-${i}`,
          x: 0,
          y: 0,
          points: [
            [x1, y1],
            [x2, y2],
          ],
          strokeWidth: 3,
          stroke: INK,
        })
      );
    }
    return {
      id: "readopp-icon-gear",
      status: "unpublished" as const,
      name: "Gear",
      created: Date.now(),
      elements: [
        ellipseElement({
          id: "gr-ring",
          x: 10,
          y: 10,
          w: 36,
          h: 36,
          stroke: INK,
          strokeWidth: 2,
        }),
        ellipseElement({
          id: "gr-hole",
          x: 22,
          y: 22,
          w: 12,
          h: 12,
          stroke: INK,
          strokeWidth: 2,
        }),
        ...spokes,
      ],
    };
  })());

  // Star — 5-point star as a closed polyline.
  items.push((() => {
    const cx = 28,
      cy = 28,
      rO = 26,
      rI = 11;
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? rO : rI;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    pts.push(pts[0]);
    return {
      id: "readopp-icon-star",
      status: "unpublished" as const,
      name: "Star",
      created: Date.now(),
      elements: [
        lineElement({
          id: "st-1",
          x: 0,
          y: 0,
          points: pts,
          strokeWidth: 2,
          stroke: AMBER,
        }),
      ],
    };
  })());

  // Lightning bolt — single zig-zag polyline.
  items.push(
    item("readopp-icon-bolt", "Lightning bolt", [
      lineElement({
        id: "bo-1",
        x: 0,
        y: 0,
        points: [
          [24, 0],
          [4, 30],
          [18, 30],
          [10, 56],
          [36, 22],
          [22, 22],
          [30, 0],
          [24, 0],
        ],
        strokeWidth: 2,
        stroke: AMBER,
      }),
    ])
  );

  // Speech bubble — rounded rect + small tail triangle.
  items.push(
    item("readopp-icon-speech", "Speech bubble", [
      rectElement({
        id: "sp-body",
        x: 0,
        y: 0,
        w: 60,
        h: 40,
        stroke: TEAL,
        strokeWidth: 2,
        rounded: true,
      }),
      lineElement({
        id: "sp-tail",
        x: 0,
        y: 0,
        points: [
          [16, 40],
          [12, 52],
          [26, 40],
        ],
        strokeWidth: 2,
        stroke: TEAL,
      }),
    ])
  );

  // Quote marks — two pairs of small arcs (use small ellipses as glyphs).
  items.push(
    item("readopp-icon-quote", "Quote marks", [
      textElement({
        id: "qt-text",
        x: 0,
        y: 0,
        text: "“ ”",
        fontSize: 48,
        fontFamily: 1,
        stroke: CLAY,
      }),
    ])
  );

  // ----- People / Team -----

  // Person — head circle + shoulders/torso arc as a triangle-ish outline.
  items.push(
    item("readopp-icon-person", "Person", [
      ellipseElement({
        id: "pe-head",
        x: 16,
        y: 0,
        w: 20,
        h: 20,
        stroke: INK,
        strokeWidth: 2,
      }),
      lineElement({
        id: "pe-body",
        x: 0,
        y: 0,
        points: [
          [4, 56],
          [12, 32],
          [40, 32],
          [48, 56],
        ],
        strokeWidth: 2,
        stroke: INK,
      }),
    ])
  );

  // Team (3 people) — three small persons grouped.
  items.push(
    item("readopp-icon-team", "Team (3)", [
      ellipseElement({
        id: "tm-h1",
        x: 0,
        y: 4,
        w: 14,
        h: 14,
        stroke: INK,
        strokeWidth: 2,
      }),
      ellipseElement({
        id: "tm-h2",
        x: 21,
        y: 0,
        w: 14,
        h: 14,
        stroke: INK,
        strokeWidth: 2,
      }),
      ellipseElement({
        id: "tm-h3",
        x: 42,
        y: 4,
        w: 14,
        h: 14,
        stroke: INK,
        strokeWidth: 2,
      }),
      lineElement({
        id: "tm-b1",
        x: 0,
        y: 0,
        points: [
          [-2, 36],
          [3, 22],
          [11, 22],
          [16, 36],
        ],
        strokeWidth: 2,
        stroke: INK,
      }),
      lineElement({
        id: "tm-b2",
        x: 0,
        y: 0,
        points: [
          [19, 32],
          [24, 18],
          [32, 18],
          [37, 32],
        ],
        strokeWidth: 2,
        stroke: INK,
      }),
      lineElement({
        id: "tm-b3",
        x: 0,
        y: 0,
        points: [
          [40, 36],
          [45, 22],
          [53, 22],
          [58, 36],
        ],
        strokeWidth: 2,
        stroke: INK,
      }),
    ])
  );

  // Add-person — person + small plus mark.
  items.push(
    item("readopp-icon-person-add", "Add person", [
      ellipseElement({
        id: "pa-head",
        x: 8,
        y: 4,
        w: 18,
        h: 18,
        stroke: TEAL,
        strokeWidth: 2,
      }),
      lineElement({
        id: "pa-body",
        x: 0,
        y: 0,
        points: [
          [0, 52],
          [6, 32],
          [28, 32],
          [34, 52],
        ],
        strokeWidth: 2,
        stroke: TEAL,
      }),
      lineElement({
        id: "pa-plus-h",
        x: 0,
        y: 0,
        points: [
          [42, 18],
          [58, 18],
        ],
        strokeWidth: 2,
        stroke: TEAL,
      }),
      lineElement({
        id: "pa-plus-v",
        x: 0,
        y: 0,
        points: [
          [50, 10],
          [50, 26],
        ],
        strokeWidth: 2,
        stroke: TEAL,
      }),
    ])
  );

  // Community — central circle + 4 satellite circles.
  items.push(
    item("readopp-icon-community", "Community", [
      ellipseElement({
        id: "cm-c",
        x: 22,
        y: 22,
        w: 20,
        h: 20,
        stroke: INK,
        fill: INK,
      }),
      ellipseElement({
        id: "cm-n",
        x: 24,
        y: 0,
        w: 16,
        h: 16,
        stroke: INK,
        strokeWidth: 2,
      }),
      ellipseElement({
        id: "cm-e",
        x: 48,
        y: 24,
        w: 16,
        h: 16,
        stroke: INK,
        strokeWidth: 2,
      }),
      ellipseElement({
        id: "cm-s",
        x: 24,
        y: 48,
        w: 16,
        h: 16,
        stroke: INK,
        strokeWidth: 2,
      }),
      ellipseElement({
        id: "cm-w",
        x: 0,
        y: 24,
        w: 16,
        h: 16,
        stroke: INK,
        strokeWidth: 2,
      }),
    ])
  );

  // ----- Money / Finance -----

  // Coin — circle with $ text.
  items.push(
    item("readopp-icon-coin", "Coin", [
      ellipseElement({
        id: "co-ring",
        x: 0,
        y: 0,
        w: 48,
        h: 48,
        stroke: AMBER,
        strokeWidth: 2,
      }),
      textElement({
        id: "co-text",
        x: 16,
        y: 8,
        text: "$",
        fontSize: 32,
        stroke: AMBER,
      }),
    ])
  );

  // Dollar — large $ symbol on its own.
  items.push(
    item("readopp-icon-dollar", "Dollar sign", [
      textElement({
        id: "do-text",
        x: 0,
        y: 0,
        text: "$",
        fontSize: 56,
        stroke: TEAL,
      }),
    ])
  );

  // Wallet — outer rect + smaller card hint inside.
  items.push(
    item("readopp-icon-wallet", "Wallet", [
      rectElement({
        id: "wa-body",
        x: 0,
        y: 0,
        w: 64,
        h: 44,
        stroke: AMBER,
        strokeWidth: 2,
        rounded: true,
      }),
      rectElement({
        id: "wa-card",
        x: 36,
        y: 16,
        w: 20,
        h: 12,
        stroke: AMBER,
        fill: AMBER,
        strokeWidth: 1.5,
      }),
    ])
  );

  // Growth chart — single bar set with a diagonal arrow over them.
  items.push(
    item("readopp-icon-growth", "Growth", [
      rectElement({
        id: "gw-b1",
        x: 0,
        y: 40,
        w: 12,
        h: 20,
        stroke: TEAL,
        fill: TEAL,
      }),
      rectElement({
        id: "gw-b2",
        x: 18,
        y: 24,
        w: 12,
        h: 36,
        stroke: TEAL,
        fill: TEAL,
      }),
      rectElement({
        id: "gw-b3",
        x: 36,
        y: 8,
        w: 12,
        h: 52,
        stroke: TEAL,
        fill: TEAL,
      }),
      arrowElement({
        id: "gw-arrow",
        x: 0,
        y: 0,
        points: [
          [0, 56],
          [56, 4],
        ],
        strokeWidth: 2,
        stroke: CLAY,
      }),
    ])
  );

  // Money bag — bag-shape outline + $ label.
  items.push(
    item("readopp-icon-bag", "Money bag", [
      lineElement({
        id: "ba-tie",
        x: 0,
        y: 0,
        points: [
          [16, 0],
          [12, 8],
          [40, 8],
          [36, 0],
          [16, 0],
        ],
        strokeWidth: 2,
        stroke: AMBER,
      }),
      lineElement({
        id: "ba-body",
        x: 0,
        y: 0,
        points: [
          [12, 8],
          [0, 28],
          [4, 52],
          [48, 52],
          [52, 28],
          [40, 8],
        ],
        strokeWidth: 2,
        stroke: AMBER,
      }),
      textElement({
        id: "ba-text",
        x: 18,
        y: 24,
        text: "$",
        fontSize: 24,
        stroke: AMBER,
      }),
    ])
  );

  // ----- Time / Calendar -----

  // Clock — circle + two hands + tick marks.
  items.push(
    item("readopp-icon-clock", "Clock", [
      ellipseElement({
        id: "ck-face",
        x: 0,
        y: 0,
        w: 56,
        h: 56,
        stroke: BLUE,
        strokeWidth: 2,
      }),
      lineElement({
        id: "ck-hour",
        x: 0,
        y: 0,
        points: [
          [28, 28],
          [28, 12],
        ],
        strokeWidth: 3,
        stroke: BLUE,
      }),
      lineElement({
        id: "ck-min",
        x: 0,
        y: 0,
        points: [
          [28, 28],
          [42, 28],
        ],
        strokeWidth: 2,
        stroke: BLUE,
      }),
    ])
  );

  // Calendar — rect frame + thick top accent + 2 binder lines + grid hint.
  items.push(
    item("readopp-icon-calendar", "Calendar", [
      rectElement({
        id: "ca-body",
        x: 0,
        y: 8,
        w: 56,
        h: 48,
        stroke: INK,
        strokeWidth: 2,
      }),
      lineElement({
        id: "ca-accent",
        x: 0,
        y: 0,
        points: [
          [0, 18],
          [56, 18],
        ],
        strokeWidth: 4,
        stroke: CLAY,
      }),
      lineElement({
        id: "ca-bind-l",
        x: 0,
        y: 0,
        points: [
          [14, 0],
          [14, 14],
        ],
        strokeWidth: 2,
        stroke: INK,
      }),
      lineElement({
        id: "ca-bind-r",
        x: 0,
        y: 0,
        points: [
          [42, 0],
          [42, 14],
        ],
        strokeWidth: 2,
        stroke: INK,
      }),
    ])
  );

  // Hourglass — two triangles tip-to-tip + frame lines top/bottom.
  items.push(
    item("readopp-icon-hourglass", "Hourglass", [
      lineElement({
        id: "hg-top",
        x: 0,
        y: 0,
        points: [
          [0, 0],
          [40, 0],
          [20, 28],
          [0, 0],
        ],
        strokeWidth: 2,
        stroke: AMBER,
      }),
      lineElement({
        id: "hg-bot",
        x: 0,
        y: 0,
        points: [
          [20, 28],
          [0, 56],
          [40, 56],
          [20, 28],
        ],
        strokeWidth: 2,
        stroke: AMBER,
      }),
    ])
  );

  // Stopwatch — clock face + small crown rect on top.
  items.push(
    item("readopp-icon-stopwatch", "Stopwatch", [
      rectElement({
        id: "sw-crown",
        x: 22,
        y: 0,
        w: 12,
        h: 6,
        stroke: INK,
        fill: INK,
      }),
      ellipseElement({
        id: "sw-face",
        x: 0,
        y: 8,
        w: 56,
        h: 56,
        stroke: INK,
        strokeWidth: 2,
      }),
      lineElement({
        id: "sw-hand",
        x: 0,
        y: 0,
        points: [
          [28, 36],
          [44, 22],
        ],
        strokeWidth: 2,
        stroke: CLAY,
      }),
    ])
  );

  // ----- AI / Data -----

  // Chip / CPU — center square + 4 prongs on each side.
  items.push(
    item("readopp-icon-chip", "Chip (CPU)", [
      rectElement({
        id: "ch-body",
        x: 8,
        y: 8,
        w: 40,
        h: 40,
        stroke: BLUE,
        strokeWidth: 2,
      }),
      rectElement({
        id: "ch-inner",
        x: 18,
        y: 18,
        w: 20,
        h: 20,
        stroke: BLUE,
        strokeWidth: 1.5,
      }),
      lineElement({
        id: "ch-p-tl",
        x: 0,
        y: 0,
        points: [
          [16, 0],
          [16, 8],
        ],
        strokeWidth: 2,
        stroke: BLUE,
      }),
      lineElement({
        id: "ch-p-tr",
        x: 0,
        y: 0,
        points: [
          [40, 0],
          [40, 8],
        ],
        strokeWidth: 2,
        stroke: BLUE,
      }),
      lineElement({
        id: "ch-p-bl",
        x: 0,
        y: 0,
        points: [
          [16, 48],
          [16, 56],
        ],
        strokeWidth: 2,
        stroke: BLUE,
      }),
      lineElement({
        id: "ch-p-br",
        x: 0,
        y: 0,
        points: [
          [40, 48],
          [40, 56],
        ],
        strokeWidth: 2,
        stroke: BLUE,
      }),
      lineElement({
        id: "ch-p-l1",
        x: 0,
        y: 0,
        points: [
          [0, 18],
          [8, 18],
        ],
        strokeWidth: 2,
        stroke: BLUE,
      }),
      lineElement({
        id: "ch-p-l2",
        x: 0,
        y: 0,
        points: [
          [0, 38],
          [8, 38],
        ],
        strokeWidth: 2,
        stroke: BLUE,
      }),
      lineElement({
        id: "ch-p-r1",
        x: 0,
        y: 0,
        points: [
          [48, 18],
          [56, 18],
        ],
        strokeWidth: 2,
        stroke: BLUE,
      }),
      lineElement({
        id: "ch-p-r2",
        x: 0,
        y: 0,
        points: [
          [48, 38],
          [56, 38],
        ],
        strokeWidth: 2,
        stroke: BLUE,
      }),
    ])
  );

  // Database — cylinder (top ellipse + side lines + bottom ellipse + 2 hints).
  items.push(
    item("readopp-icon-database", "Database", [
      ellipseElement({
        id: "db-top",
        x: 0,
        y: 0,
        w: 56,
        h: 16,
        stroke: BLUE,
        strokeWidth: 2,
      }),
      lineElement({
        id: "db-side-l",
        x: 0,
        y: 0,
        points: [
          [0, 8],
          [0, 50],
        ],
        strokeWidth: 2,
        stroke: BLUE,
      }),
      lineElement({
        id: "db-side-r",
        x: 0,
        y: 0,
        points: [
          [56, 8],
          [56, 50],
        ],
        strokeWidth: 2,
        stroke: BLUE,
      }),
      ellipseElement({
        id: "db-bot",
        x: 0,
        y: 42,
        w: 56,
        h: 16,
        stroke: BLUE,
        strokeWidth: 2,
      }),
      ellipseElement({
        id: "db-mid",
        x: 0,
        y: 20,
        w: 56,
        h: 12,
        stroke: BLUE,
        strokeWidth: 1.5,
      }),
    ])
  );

  // Server stack — 3 stacked rects each with a status dot.
  items.push(
    item("readopp-icon-server", "Server stack", [
      rectElement({
        id: "sv-1",
        x: 0,
        y: 0,
        w: 56,
        h: 16,
        stroke: INK,
        strokeWidth: 2,
      }),
      ellipseElement({
        id: "sv-1d",
        x: 8,
        y: 6,
        w: 4,
        h: 4,
        stroke: TEAL,
        fill: TEAL,
      }),
      rectElement({
        id: "sv-2",
        x: 0,
        y: 20,
        w: 56,
        h: 16,
        stroke: INK,
        strokeWidth: 2,
      }),
      ellipseElement({
        id: "sv-2d",
        x: 8,
        y: 26,
        w: 4,
        h: 4,
        stroke: TEAL,
        fill: TEAL,
      }),
      rectElement({
        id: "sv-3",
        x: 0,
        y: 40,
        w: 56,
        h: 16,
        stroke: INK,
        strokeWidth: 2,
      }),
      ellipseElement({
        id: "sv-3d",
        x: 8,
        y: 46,
        w: 4,
        h: 4,
        stroke: AMBER,
        fill: AMBER,
      }),
    ])
  );

  // Sparkles (AI magic) — large 4-point star + small 4-point star.
  items.push((() => {
    const big = sparklePoints(28, 22, 18, 6);
    const small = sparklePoints(48, 48, 8, 3);
    return {
      id: "readopp-icon-sparkles",
      status: "unpublished" as const,
      name: "Sparkles (AI)",
      created: Date.now(),
      elements: [
        lineElement({
          id: "sp-big",
          x: 0,
          y: 0,
          points: big,
          strokeWidth: 2,
          stroke: CLAY,
        }),
        lineElement({
          id: "sp-small",
          x: 0,
          y: 0,
          points: small,
          strokeWidth: 2,
          stroke: CLAY,
        }),
      ],
    };
  })());

  // Neural net — 3 input circles + 2 hidden + 1 output, with connecting lines.
  items.push(
    item("readopp-icon-neural", "Neural net", [
      // Layer 1
      ellipseElement({
        id: "nn-i1",
        x: 0,
        y: 4,
        w: 12,
        h: 12,
        stroke: BLUE,
        strokeWidth: 2,
      }),
      ellipseElement({
        id: "nn-i2",
        x: 0,
        y: 24,
        w: 12,
        h: 12,
        stroke: BLUE,
        strokeWidth: 2,
      }),
      ellipseElement({
        id: "nn-i3",
        x: 0,
        y: 44,
        w: 12,
        h: 12,
        stroke: BLUE,
        strokeWidth: 2,
      }),
      // Layer 2
      ellipseElement({
        id: "nn-h1",
        x: 26,
        y: 14,
        w: 12,
        h: 12,
        stroke: BLUE,
        strokeWidth: 2,
      }),
      ellipseElement({
        id: "nn-h2",
        x: 26,
        y: 34,
        w: 12,
        h: 12,
        stroke: BLUE,
        strokeWidth: 2,
      }),
      // Layer 3
      ellipseElement({
        id: "nn-o",
        x: 52,
        y: 24,
        w: 12,
        h: 12,
        stroke: BLUE,
        strokeWidth: 2,
      }),
      // Connections layer 1 → 2
      lineElement({
        id: "nn-c-i1h1",
        x: 0,
        y: 0,
        points: [
          [12, 10],
          [26, 20],
        ],
        strokeWidth: 1,
        stroke: BLUE,
      }),
      lineElement({
        id: "nn-c-i1h2",
        x: 0,
        y: 0,
        points: [
          [12, 10],
          [26, 40],
        ],
        strokeWidth: 1,
        stroke: BLUE,
      }),
      lineElement({
        id: "nn-c-i2h1",
        x: 0,
        y: 0,
        points: [
          [12, 30],
          [26, 20],
        ],
        strokeWidth: 1,
        stroke: BLUE,
      }),
      lineElement({
        id: "nn-c-i2h2",
        x: 0,
        y: 0,
        points: [
          [12, 30],
          [26, 40],
        ],
        strokeWidth: 1,
        stroke: BLUE,
      }),
      lineElement({
        id: "nn-c-i3h1",
        x: 0,
        y: 0,
        points: [
          [12, 50],
          [26, 20],
        ],
        strokeWidth: 1,
        stroke: BLUE,
      }),
      lineElement({
        id: "nn-c-i3h2",
        x: 0,
        y: 0,
        points: [
          [12, 50],
          [26, 40],
        ],
        strokeWidth: 1,
        stroke: BLUE,
      }),
      // Connections layer 2 → 3
      lineElement({
        id: "nn-c-h1o",
        x: 0,
        y: 0,
        points: [
          [38, 20],
          [52, 30],
        ],
        strokeWidth: 1,
        stroke: BLUE,
      }),
      lineElement({
        id: "nn-c-h2o",
        x: 0,
        y: 0,
        points: [
          [38, 40],
          [52, 30],
        ],
        strokeWidth: 1,
        stroke: BLUE,
      }),
    ])
  );

  // ----- Fire / Heart / Quality -----

  // Flame — closed teardrop with a wavy edge.
  items.push(
    item("readopp-icon-flame", "Flame", [
      lineElement({
        id: "fl-shape",
        x: 0,
        y: 0,
        points: [
          [24, 0],
          [10, 18],
          [16, 26],
          [4, 38],
          [12, 56],
          [36, 56],
          [44, 38],
          [32, 26],
          [38, 18],
          [24, 0],
        ],
        strokeWidth: 2,
        stroke: CLAY,
      }),
    ])
  );

  // Heart — two ellipse lobes + triangle bottom.
  items.push(
    item("readopp-icon-heart", "Heart", [
      ellipseElement({
        id: "hr-l",
        x: 0,
        y: 0,
        w: 32,
        h: 30,
        stroke: CLAY,
        strokeWidth: 2,
      }),
      ellipseElement({
        id: "hr-r",
        x: 24,
        y: 0,
        w: 32,
        h: 30,
        stroke: CLAY,
        strokeWidth: 2,
      }),
      lineElement({
        id: "hr-v",
        x: 0,
        y: 0,
        points: [
          [2, 18],
          [28, 56],
          [54, 18],
        ],
        strokeWidth: 2,
        stroke: CLAY,
      }),
    ])
  );

  // Trophy — cup body + two side handles + base.
  items.push(
    item("readopp-icon-trophy", "Trophy", [
      rectElement({
        id: "tp-cup",
        x: 12,
        y: 0,
        w: 32,
        h: 36,
        stroke: AMBER,
        strokeWidth: 2,
        rounded: true,
      }),
      lineElement({
        id: "tp-handle-l",
        x: 0,
        y: 0,
        points: [
          [12, 6],
          [4, 12],
          [4, 22],
          [12, 28],
        ],
        strokeWidth: 2,
        stroke: AMBER,
      }),
      lineElement({
        id: "tp-handle-r",
        x: 0,
        y: 0,
        points: [
          [44, 6],
          [52, 12],
          [52, 22],
          [44, 28],
        ],
        strokeWidth: 2,
        stroke: AMBER,
      }),
      lineElement({
        id: "tp-stem",
        x: 0,
        y: 0,
        points: [
          [28, 36],
          [28, 50],
        ],
        strokeWidth: 2,
        stroke: AMBER,
      }),
      rectElement({
        id: "tp-base",
        x: 16,
        y: 50,
        w: 24,
        h: 8,
        stroke: AMBER,
        fill: AMBER,
      }),
    ])
  );

  // Shield — pentagon-style outline with rounded top.
  items.push(
    item("readopp-icon-shield", "Shield", [
      lineElement({
        id: "sd-shape",
        x: 0,
        y: 0,
        points: [
          [28, 0],
          [0, 10],
          [0, 32],
          [28, 60],
          [56, 32],
          [56, 10],
          [28, 0],
        ],
        strokeWidth: 2,
        stroke: TEAL,
      }),
    ])
  );

  // Thumbs-up — closed polyline of a simplified hand+thumb.
  items.push(
    item("readopp-icon-thumbsup", "Thumbs up", [
      lineElement({
        id: "tu-shape",
        x: 0,
        y: 0,
        points: [
          [0, 30],
          [10, 30],
          [10, 16],
          [16, 4],
          [24, 4],
          [24, 18],
          [22, 24],
          [44, 24],
          [50, 28],
          [48, 56],
          [4, 56],
          [0, 50],
          [0, 30],
        ],
        strokeWidth: 2,
        stroke: TEAL,
      }),
    ])
  );

  return items;
}

function buildCharts(): LibraryItem[] {
  const items: LibraryItem[] = [];

  // 3-bar chart, ascending.
  items.push(
    item("readopp-chart-bars", "Bar chart (3 cols)", [
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
    ])
  );

  // Donut chart.
  items.push(
    item("readopp-chart-donut", "Donut chart", [
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
    ])
  );

  // Sparkline / trend.
  items.push(
    item("readopp-chart-trend", "Trend line", [
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
    ])
  );

  // Bare axis pair (X + Y).
  items.push(
    item("readopp-chart-axes", "Axes (X / Y)", [
      lineElement({
        id: "ax-h",
        x: 0,
        y: 0,
        points: [
          [0, 120],
          [200, 120],
        ],
        strokeWidth: 1.5,
        stroke: INK,
      }),
      lineElement({
        id: "ax-v",
        x: 0,
        y: 0,
        points: [
          [0, 0],
          [0, 120],
        ],
        strokeWidth: 1.5,
        stroke: INK,
      }),
    ])
  );

  return items;
}

// ---------- Helpers ----------

function item(id: string, name: string, elements: unknown[]): LibraryItem {
  return {
    id,
    status: "unpublished",
    name,
    created: Date.now(),
    elements,
  };
}

/**
 * Stable seed/nonce per element id so the library JSON is byte-identical
 * across server requests (helps with CDN caching) and dedupe in
 * Excalidraw's library merger stays predictable.
 */
/**
 * 4-point "sparkle" star centred at (cx,cy) with outer radius `outer` and
 * inner waist `inner`. Returned as a closed polyline so a single line
 * element renders it. Used by the AI/sparkles icon.
 */
function sparklePoints(
  cx: number,
  cy: number,
  outer: number,
  inner: number
): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  pts.push(pts[0]);
  return pts;
}

function deterministicSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h | 0);
}
