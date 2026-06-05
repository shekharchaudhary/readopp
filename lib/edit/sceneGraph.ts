/**
 * Scene graph: a parsed SVG document with stable `data-edit-id` attributes on
 * every editable element. All panel-edit mutations go through this module so
 * we have ONE place that knows how to find an element and change it.
 *
 * Browser-only (uses DOMParser / XMLSerializer). All functions are pure with
 * respect to the input scene — they return a NEW scene or boolean status.
 * Callers serialize the scene to a string when they want to persist.
 */

const EDIT_ID_ATTR = "data-edit-id";

/** Tags considered "editable" — we attach IDs to these. */
const EDITABLE_TAGS = new Set([
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "path",
  "text",
  "tspan",
  "g",
]);

export interface SceneGraph {
  doc: XMLDocument;
  root: SVGSVGElement;
}

export function parseScene(content: string): SceneGraph | null {
  if (typeof window === "undefined" || !content) return null;
  const doc = new DOMParser().parseFromString(content, "image/svg+xml");
  if (doc.querySelector("parsererror")) return null;
  const root = doc.documentElement as unknown as SVGSVGElement;
  if (!root || root.nodeName.toLowerCase() !== "svg") return null;
  return { doc, root };
}

export function serializeScene(scene: SceneGraph): string {
  return new XMLSerializer().serializeToString(scene.root);
}

/** Deep-clone the scene so mutations don't mutate the caller's reference. */
export function cloneScene(scene: SceneGraph): SceneGraph {
  const serialized = serializeScene(scene);
  const next = parseScene(serialized);
  if (!next) throw new Error("cloneScene: failed to re-parse serialized SVG");
  return next;
}

/**
 * Walks every editable descendant and ensures each has a unique
 * data-edit-id. IDs already present are kept (so subsequent calls are
 * idempotent and existing references survive).
 */
export function assignStableIds(scene: SceneGraph): void {
  const seen = new Set<string>();
  scene.root.querySelectorAll("*").forEach((node) => {
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (!EDITABLE_TAGS.has(tag)) return;
    let id = el.getAttribute(EDIT_ID_ATTR);
    if (id && !seen.has(id)) {
      seen.add(id);
      return;
    }
    do {
      id = randomId();
    } while (seen.has(id));
    el.setAttribute(EDIT_ID_ATTR, id);
    seen.add(id);
  });
}

function randomId(): string {
  // 6 url-safe chars; collision-resistant enough for one panel.
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 6; i++)
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function findById(scene: SceneGraph, id: string): Element | null {
  return scene.root.querySelector(`[${EDIT_ID_ATTR}="${cssEscape(id)}"]`);
}

function cssEscape(s: string): string {
  // jsdom-safe escape for selector strings.
  return s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

export function getEditableIds(scene: SceneGraph): string[] {
  const out: string[] = [];
  scene.root.querySelectorAll(`[${EDIT_ID_ATTR}]`).forEach((el) => {
    const id = el.getAttribute(EDIT_ID_ATTR);
    if (id) out.push(id);
  });
  return out;
}

export function getViewBox(scene: SceneGraph): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  const vb = scene.root.getAttribute("viewBox") || "";
  const m = vb.match(
    /^\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/
  );
  if (!m) return null;
  return {
    x: Number(m[1]),
    y: Number(m[2]),
    width: Number(m[3]),
    height: Number(m[4]),
  };
}

// ---------- mutations ----------

/** Returns true if the element existed and was updated. */
export function setAttr(
  scene: SceneGraph,
  id: string,
  name: string,
  value: string
): boolean {
  const el = findById(scene, id);
  if (!el) return false;
  el.setAttribute(name, value);
  return true;
}

export function setText(
  scene: SceneGraph,
  id: string,
  text: string
): boolean {
  const el = findById(scene, id);
  if (!el) return false;
  // For multiline <text> with <tspan> children, replace tspans with one line
  // for the new text and drop the rest. For simple <text>, just set textContent.
  const tag = el.tagName.toLowerCase();
  if (tag === "text") {
    const firstTspan = el.querySelector("tspan");
    if (firstTspan) {
      firstTspan.textContent = text;
      const siblings = Array.from(el.querySelectorAll("tspan")).slice(1);
      siblings.forEach((s) => s.remove());
    } else {
      el.textContent = text;
    }
  } else {
    el.textContent = text;
  }
  return true;
}

export function deleteElement(scene: SceneGraph, id: string): boolean {
  const el = findById(scene, id);
  if (!el) return false;
  el.remove();
  return true;
}

/**
 * Move an element by (dx, dy). Handles rect/text/circle/ellipse via direct
 * attribute math; line via x1/y1/x2/y2; polyline+polygon via the points
 * attribute; path via translate transform (since rewriting `d` would require
 * a full SVG path tokenizer).
 */
export function moveBy(
  scene: SceneGraph,
  id: string,
  dx: number,
  dy: number
): boolean {
  const el = findById(scene, id);
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "rect") {
    const x = parseFloat(el.getAttribute("x") || "0");
    const y = parseFloat(el.getAttribute("y") || "0");
    el.setAttribute("x", String(snap(x + dx)));
    el.setAttribute("y", String(snap(y + dy)));
    return true;
  }
  if (tag === "circle" || tag === "ellipse") {
    const cx = parseFloat(el.getAttribute("cx") || "0");
    const cy = parseFloat(el.getAttribute("cy") || "0");
    el.setAttribute("cx", String(snap(cx + dx)));
    el.setAttribute("cy", String(snap(cy + dy)));
    return true;
  }
  if (tag === "text") {
    const x = parseFloat(el.getAttribute("x") || "0");
    const y = parseFloat(el.getAttribute("y") || "0");
    el.setAttribute("x", String(snap(x + dx)));
    el.setAttribute("y", String(snap(y + dy)));
    return true;
  }
  if (tag === "line") {
    for (const attr of ["x1", "x2"] as const) {
      const v = parseFloat(el.getAttribute(attr) || "0");
      el.setAttribute(attr, String(snap(v + dx)));
    }
    for (const attr of ["y1", "y2"] as const) {
      const v = parseFloat(el.getAttribute(attr) || "0");
      el.setAttribute(attr, String(snap(v + dy)));
    }
    return true;
  }
  if (tag === "polyline" || tag === "polygon") {
    const pts = (el.getAttribute("points") || "").trim();
    if (pts) {
      const next = pts
        .split(/\s+/)
        .map((pair) => {
          const [x, y] = pair.split(",").map((s) => parseFloat(s));
          if (!Number.isFinite(x) || !Number.isFinite(y)) return pair;
          return `${snap(x + dx)},${snap(y + dy)}`;
        })
        .join(" ");
      el.setAttribute("points", next);
      return true;
    }
  }
  // Path or other — fold dx/dy into an existing translate, or set a new one.
  const existing = el.getAttribute("transform") || "";
  const merged = mergeTranslate(existing, dx, dy);
  if (merged) el.setAttribute("transform", merged);
  return true;
}

/**
 * If `existing` already ends with `translate(tx ty)`, return a new transform
 * with that translate adjusted by (dx, dy). Otherwise append a fresh translate.
 * Keeps the history clean instead of accumulating identical transforms.
 */
function mergeTranslate(
  existing: string,
  dx: number,
  dy: number
): string {
  const m = existing.match(/translate\(\s*(-?\d+(?:\.\d+)?)[ ,]+(-?\d+(?:\.\d+)?)\s*\)\s*$/);
  if (m) {
    const tx = parseFloat(m[1]) + dx;
    const ty = parseFloat(m[2]) + dy;
    return (
      existing.slice(0, m.index).trim() +
      ` translate(${snap(tx)} ${snap(ty)})`
    ).trim();
  }
  return `${existing} translate(${snap(dx)} ${snap(dy)})`.trim();
}

/** Resize a rect to a new position + dimensions. Returns false if not a rect. */
export function resizeRect(
  scene: SceneGraph,
  id: string,
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  const el = findById(scene, id);
  if (!el || el.tagName.toLowerCase() !== "rect") return false;
  el.setAttribute("x", String(snap(x)));
  el.setAttribute("y", String(snap(y)));
  el.setAttribute("width", String(Math.max(8, snap(width))));
  el.setAttribute("height", String(Math.max(8, snap(height))));
  return true;
}

function snap(v: number, grid = 4): number {
  return Math.round(v / grid) * grid;
}

/**
 * Resize the canvas (viewBox height). Width is locked to 680 by design.
 * Returns the new height, or null if viewBox couldn't be parsed.
 */
export function setCanvasHeight(
  scene: SceneGraph,
  newHeight: number
): number | null {
  const vb = getViewBox(scene);
  if (!vb) return null;
  const h = Math.max(80, Math.min(1600, snap(newHeight, 20)));
  scene.root.setAttribute("viewBox", `${vb.x} ${vb.y} 680 ${h}`);
  return h;
}

/**
 * Return the element type for an element by id. Used by the toolbar to
 * decide what controls to show.
 */
export type ElementKind =
  | "rect"
  | "text"
  | "tspan"
  | "path"
  | "line"
  | "polyline"
  | "polygon"
  | "circle"
  | "ellipse"
  | "g"
  | "unknown";

export function getKind(scene: SceneGraph, id: string): ElementKind {
  const el = findById(scene, id);
  if (!el) return "unknown";
  const tag = el.tagName.toLowerCase();
  if (
    tag === "rect" ||
    tag === "text" ||
    tag === "tspan" ||
    tag === "path" ||
    tag === "line" ||
    tag === "polyline" ||
    tag === "polygon" ||
    tag === "circle" ||
    tag === "ellipse" ||
    tag === "g"
  )
    return tag;
  return "unknown";
}

export function getAttr(
  scene: SceneGraph,
  id: string,
  name: string
): string | null {
  const el = findById(scene, id);
  if (!el) return null;
  return el.getAttribute(name);
}

// ---------- Style adjustments (opacity, stroke-width, corner radius) ----------

export function readOpacity(scene: SceneGraph, id: string): number {
  const v = getAttr(scene, id, "opacity");
  if (v == null) return 1;
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
}

export function setOpacity(
  scene: SceneGraph,
  id: string,
  opacity: number
): boolean {
  const el = findById(scene, id);
  if (!el) return false;
  const v = Math.max(0, Math.min(1, opacity));
  if (Math.abs(v - 1) < 0.001) el.removeAttribute("opacity");
  else el.setAttribute("opacity", String(round2(v)));
  return true;
}

export function readStrokeWidth(scene: SceneGraph, id: string): number {
  const v = getAttr(scene, id, "stroke-width");
  if (v == null) return 1;
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : 1;
}

export function setStrokeWidth(
  scene: SceneGraph,
  id: string,
  width: number
): boolean {
  const el = findById(scene, id);
  if (!el) return false;
  const v = Math.max(0, Math.min(40, width));
  el.setAttribute("stroke-width", String(round2(v)));
  return true;
}

export function readCornerRadius(scene: SceneGraph, id: string): number {
  const v = getAttr(scene, id, "rx") ?? getAttr(scene, id, "ry");
  if (v == null) return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function setCornerRadius(
  scene: SceneGraph,
  id: string,
  radius: number
): boolean {
  const el = findById(scene, id);
  if (!el || el.tagName.toLowerCase() !== "rect") return false;
  const v = Math.max(0, Math.min(64, Math.round(radius)));
  el.setAttribute("rx", String(v));
  el.setAttribute("ry", String(v));
  return true;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------- Typography ----------

const FALLBACK_FONT_STACK =
  "ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif";

const FONT_STACKS: Record<string, string> = {
  sans: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif",
  serif: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
  display:
    "ui-sans-serif, system-ui, 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
};

export type FontFamilyKey = "sans" | "serif" | "mono" | "display";

/** Lookup a friendly key from an existing font-family attribute. */
export function fontFamilyKey(raw: string | null): FontFamilyKey | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v.includes("mono")) return "mono";
  if (v.includes("serif") && !v.includes("sans")) return "serif";
  if (v.includes("display") || v.includes("sf pro")) return "display";
  if (v.includes("sans") || v.includes("system")) return "sans";
  return null;
}

export function setFontFamily(
  scene: SceneGraph,
  id: string,
  key: FontFamilyKey
): boolean {
  const el = findById(scene, id);
  if (!el) return false;
  el.setAttribute("font-family", FONT_STACKS[key] ?? FALLBACK_FONT_STACK);
  return true;
}

export function setFontSize(
  scene: SceneGraph,
  id: string,
  size: number
): boolean {
  const el = findById(scene, id);
  if (!el) return false;
  const v = Math.max(6, Math.min(96, Math.round(size)));
  el.setAttribute("font-size", String(v));
  return true;
}

export function setFontWeight(
  scene: SceneGraph,
  id: string,
  weight: number
): boolean {
  const el = findById(scene, id);
  if (!el) return false;
  el.setAttribute("font-weight", String(weight));
  return true;
}

export function setFontStyle(
  scene: SceneGraph,
  id: string,
  italic: boolean
): boolean {
  const el = findById(scene, id);
  if (!el) return false;
  if (italic) el.setAttribute("font-style", "italic");
  else el.removeAttribute("font-style");
  return true;
}

export function setTextAnchor(
  scene: SceneGraph,
  id: string,
  anchor: "start" | "middle" | "end"
): boolean {
  const el = findById(scene, id);
  if (!el) return false;
  el.setAttribute("text-anchor", anchor);
  return true;
}

/** Read the effective font-size for an element, walking parents if missing. */
export function readFontSize(scene: SceneGraph, id: string): number {
  let el: Element | null = findById(scene, id);
  while (el) {
    const v = el.getAttribute?.("font-size");
    if (v) {
      const n = parseFloat(v);
      if (Number.isFinite(n) && n > 0) return n;
    }
    el = (el.parentElement as unknown as Element) || null;
  }
  return 14;
}

/** Read the effective font-weight walking parents. */
export function readFontWeight(scene: SceneGraph, id: string): number {
  let el: Element | null = findById(scene, id);
  while (el) {
    const v = el.getAttribute?.("font-weight");
    if (v) {
      const n = parseInt(v, 10);
      if (Number.isFinite(n) && n > 0) return n;
      if (/bold/i.test(v)) return 700;
      if (/normal/i.test(v)) return 400;
    }
    el = (el.parentElement as unknown as Element) || null;
  }
  return 400;
}

export function readFontStyle(scene: SceneGraph, id: string): "italic" | "normal" {
  let el: Element | null = findById(scene, id);
  while (el) {
    const v = el.getAttribute?.("font-style");
    if (v === "italic") return "italic";
    el = (el.parentElement as unknown as Element) || null;
  }
  return "normal";
}

export function readTextAnchor(
  scene: SceneGraph,
  id: string
): "start" | "middle" | "end" {
  let el: Element | null = findById(scene, id);
  while (el) {
    const v = el.getAttribute?.("text-anchor");
    if (v === "start" || v === "middle" || v === "end") return v;
    el = (el.parentElement as unknown as Element) || null;
  }
  return "start";
}

export function readFontFamily(scene: SceneGraph, id: string): FontFamilyKey {
  let el: Element | null = findById(scene, id);
  while (el) {
    const v = el.getAttribute?.("font-family");
    const key = fontFamilyKey(v ?? null);
    if (key) return key;
    el = (el.parentElement as unknown as Element) || null;
  }
  return "sans";
}

export function getTextContent(
  scene: SceneGraph,
  id: string
): string {
  const el = findById(scene, id);
  if (!el) return "";
  return (el.textContent || "").trim();
}

export { EDIT_ID_ATTR };
