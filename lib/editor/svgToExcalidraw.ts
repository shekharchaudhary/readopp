/**
 * SVG → Excalidraw element converter for the panel editor seed scene.
 *
 * The pipeline's panel SVGs are made of <text>, <rect>, <line>, <circle>,
 * <ellipse>, <polygon>, <polyline>, <path>, and nested <g> groups with
 * translate / rotate transforms. We walk the tree, accumulate transforms,
 * and emit native Excalidraw elements the user can select and edit
 * individually — without this they'd just see one locked image.
 *
 * Runs in the browser only (uses DOMParser). Returns [] on any failure
 * so the caller can fall back to the image-embed path.
 */

const EXCALIDRAW_INK = "#1A1A1A";

interface Transform {
  // 2D affine transform matrix [a, b, c, d, e, f] where:
  // x' = a*x + c*y + e, y' = b*x + d*y + f
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

const IDENTITY: Transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function multiply(t1: Transform, t2: Transform): Transform {
  return {
    a: t1.a * t2.a + t1.c * t2.b,
    b: t1.b * t2.a + t1.d * t2.b,
    c: t1.a * t2.c + t1.c * t2.d,
    d: t1.b * t2.c + t1.d * t2.d,
    e: t1.a * t2.e + t1.c * t2.f + t1.e,
    f: t1.b * t2.e + t1.d * t2.f + t1.f,
  };
}

function applyPoint(t: Transform, x: number, y: number): [number, number] {
  return [t.a * x + t.c * y + t.e, t.b * x + t.d * y + t.f];
}

function parseTransformAttr(attr: string | null): Transform {
  if (!attr) return IDENTITY;
  let out: Transform = IDENTITY;
  const re = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attr)) !== null) {
    const name = m[1];
    const args = m[2]
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    let next: Transform = IDENTITY;
    switch (name) {
      case "translate":
        next = { a: 1, b: 0, c: 0, d: 1, e: args[0] || 0, f: args[1] || 0 };
        break;
      case "scale":
        next = {
          a: args[0] ?? 1,
          b: 0,
          c: 0,
          d: args[1] ?? args[0] ?? 1,
          e: 0,
          f: 0,
        };
        break;
      case "rotate": {
        const a = ((args[0] || 0) * Math.PI) / 180;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const cx = args[1] || 0;
        const cy = args[2] || 0;
        const tr1: Transform = { a: 1, b: 0, c: 0, d: 1, e: cx, f: cy };
        const rot: Transform = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
        const tr2: Transform = { a: 1, b: 0, c: 0, d: 1, e: -cx, f: -cy };
        next = multiply(multiply(tr1, rot), tr2);
        break;
      }
      case "matrix":
        next = {
          a: args[0] ?? 1,
          b: args[1] ?? 0,
          c: args[2] ?? 0,
          d: args[3] ?? 1,
          e: args[4] ?? 0,
          f: args[5] ?? 0,
        };
        break;
    }
    out = multiply(out, next);
  }
  return out;
}

function n(value: string | null, fallback = 0): number {
  if (value == null) return fallback;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// ---------- Excalidraw element base ----------

interface BaseArgs {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor?: string;
  backgroundColor?: string;
  strokeWidth?: number;
  angle?: number;
  groupIds?: string[];
}

let uid = 0;
function nextId(prefix: string): string {
  uid += 1;
  return `${prefix}-${uid}-${Math.floor(Math.random() * 1_000_000).toString(36)}`;
}

function baseElement(args: BaseArgs) {
  return {
    id: args.id,
    type: args.type,
    x: args.x,
    y: args.y,
    width: Math.max(1, args.width),
    height: Math.max(1, args.height),
    angle: args.angle ?? 0,
    strokeColor: args.strokeColor ?? EXCALIDRAW_INK,
    backgroundColor: args.backgroundColor ?? "transparent",
    fillStyle: "solid" as const,
    strokeWidth: args.strokeWidth ?? 2,
    strokeStyle: "solid" as const,
    roughness: 0,
    opacity: 100,
    groupIds: args.groupIds ?? [],
    frameId: null as null | string,
    roundness: null as null | { type: number },
    seed: Math.floor(Math.random() * 1_000_000),
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

// ---------- Style resolution ----------

interface StyleContext {
  stroke: string;
  fill: string;
  strokeWidth: number;
  fontSize: number;
  fontFamily: number;
  fontWeight: number;
  letterSpacing: number;
  textAnchor: "start" | "middle" | "end";
  opacity: number;
}

const DEFAULT_STYLE: StyleContext = {
  // SVG spec defaults stroke to "none". A non-transparent default here
  // would paint a phantom outline on every fill-only shape (e.g. the
  // lighthouse roof, which has fill="#1a1a1a" but no stroke). Text
  // colour falls back to INK separately via resolveTextColor.
  stroke: "transparent",
  fill: "transparent",
  strokeWidth: 1,
  fontSize: 14,
  fontFamily: 2,
  fontWeight: 400,
  letterSpacing: 0,
  textAnchor: "start",
  opacity: 100,
};

function colorOrTransparent(c: string | null | undefined): string | null {
  if (!c) return null;
  const v = c.trim().toLowerCase();
  if (v === "none" || v === "transparent") return "transparent";
  return c;
}

function inheritStyle(parent: StyleContext, el: Element): StyleContext {
  const stroke = colorOrTransparent(el.getAttribute("stroke"));
  const fill = colorOrTransparent(el.getAttribute("fill"));
  const sw = el.getAttribute("stroke-width");
  const fontSize = el.getAttribute("font-size");
  const fontFamily = el.getAttribute("font-family");
  const fontWeight = el.getAttribute("font-weight");
  const letterSpacing = el.getAttribute("letter-spacing");
  const textAnchor = el.getAttribute("text-anchor") as
    | StyleContext["textAnchor"]
    | null;
  const opacity = el.getAttribute("opacity");
  return {
    stroke: stroke ?? parent.stroke,
    fill: fill ?? parent.fill,
    strokeWidth: sw != null ? parseFloat(sw) : parent.strokeWidth,
    fontSize: fontSize != null ? parseFloat(fontSize) : parent.fontSize,
    fontFamily: mapFontFamily(fontFamily ?? null, parent.fontFamily),
    fontWeight: fontWeight != null ? parseFloat(fontWeight) : parent.fontWeight,
    letterSpacing:
      letterSpacing != null ? parseFloat(letterSpacing) : parent.letterSpacing,
    textAnchor: textAnchor ?? parent.textAnchor,
    opacity: opacity != null ? Math.round(parseFloat(opacity) * 100) : parent.opacity,
  };
}

/**
 * Map an SVG font-family string to Excalidraw's font family enum.
 *  1 = Virgil (hand-drawn)
 *  2 = Helvetica (sans-serif)
 *  3 = Cascadia (mono)
 *  4 = Lilita (serif display) — closest to Georgia / Times serif headers.
 *
 * The Anthropic stat template renders its big stat number in Georgia.
 * Coercing that to Helvetica killed the editorial serif aesthetic in
 * the canvas; mapping serif fonts to family 4 preserves it.
 */
function mapFontFamily(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const v = value.toLowerCase();
  if (/(mono|consolas|menlo|courier|cascadia)/.test(v)) return 3;
  if (/(virgil|cursive|caveat|hand)/.test(v)) return 1;
  if (/(serif|georgia|times|tiempos|caslon|bookerly|playfair|fraunces)/.test(v))
    return 4;
  return 2;
}

// ---------- Walkers ----------

interface WalkContext {
  transform: Transform;
  style: StyleContext;
  groupIds: string[];
}

function pushTransformFromEl(ctx: WalkContext, el: Element): WalkContext {
  const local = parseTransformAttr(el.getAttribute("transform"));
  return {
    ...ctx,
    transform: multiply(ctx.transform, local),
  };
}

function pushStyleFromEl(ctx: WalkContext, el: Element): WalkContext {
  return { ...ctx, style: inheritStyle(ctx.style, el) };
}

function walk(
  el: Element,
  ctx: WalkContext,
  out: unknown[]
): void {
  const tag = el.tagName.toLowerCase();
  const childCtx = pushStyleFromEl(pushTransformFromEl(ctx, el), el);
  switch (tag) {
    case "svg":
    case "g": {
      for (const child of Array.from(el.children)) {
        walk(child, childCtx, out);
      }
      break;
    }
    case "text":
      emitText(el, childCtx, out);
      break;
    case "rect":
      emitRect(el, childCtx, out);
      break;
    case "line":
      emitLine(el, childCtx, out);
      break;
    case "circle":
      emitCircle(el, childCtx, out);
      break;
    case "ellipse":
      emitEllipse(el, childCtx, out);
      break;
    case "polygon":
    case "polyline":
      emitPoly(el, childCtx, out, tag === "polygon");
      break;
    case "path":
      emitPath(el, childCtx, out);
      break;
    // <defs>, <style>, <title>, <desc>, etc. — ignore.
    default:
      // Recurse into unknown wrappers in case they contain renderables.
      for (const child of Array.from(el.children)) {
        walk(child, childCtx, out);
      }
  }
}

function emitText(el: Element, ctx: WalkContext, out: unknown[]) {
  const xAttr = n(el.getAttribute("x"));
  const yAttr = n(el.getAttribute("y"));

  // Gather <tspan> children — each one becomes a separate Excalidraw text
  // element so multi-line headings remain editable line-by-line.
  const tspans = Array.from(el.children).filter(
    (c) => c.tagName.toLowerCase() === "tspan"
  );

  if (tspans.length > 0) {
    for (const ts of tspans) {
      emitTextNode(ts as Element, ctx, out, xAttr, yAttr);
    }
    // If the text element ALSO has direct text content (rare), skip — the
    // tspans cover it. If only direct content with no tspans, fall through.
    return;
  }

  const direct = (el.textContent ?? "").trim();
  if (!direct) return;
  emitTextDirect(direct, ctx, out, xAttr, yAttr);
}

function emitTextNode(
  ts: Element,
  ctx: WalkContext,
  out: unknown[],
  parentX: number,
  parentY: number
) {
  const style = inheritStyle(ctx.style, ts);
  const x = ts.hasAttribute("x") ? n(ts.getAttribute("x")) : parentX;
  const y = ts.hasAttribute("y")
    ? n(ts.getAttribute("y"))
    : parentY +
      (ts.hasAttribute("dy")
        ? n(ts.getAttribute("dy"))
        : 0);
  const text = (ts.textContent ?? "").trim();
  if (!text) return;
  emitTextDirect(text, { ...ctx, style }, out, x, y);
}

function emitTextDirect(
  text: string,
  ctx: WalkContext,
  out: unknown[],
  xRaw: number,
  yRaw: number
) {
  const fontSize = ctx.style.fontSize;
  const charW = fontSize * 0.55;
  const widthRaw = Math.max(8, text.length * charW);
  const heightRaw = fontSize * 1.25;

  // SVG <text> y is the baseline; Excalidraw text y is the top of the box.
  // Approximate ascent ≈ 0.8 × fontSize.
  let xLeftRaw = xRaw;
  if (ctx.style.textAnchor === "middle") xLeftRaw = xRaw - widthRaw / 2;
  else if (ctx.style.textAnchor === "end") xLeftRaw = xRaw - widthRaw;
  const yTopRaw = yRaw - fontSize * 0.8;

  const [x, y] = applyPoint(ctx.transform, xLeftRaw, yTopRaw);

  out.push({
    ...baseElement({
      id: nextId("svg-text"),
      type: "text",
      x,
      y,
      width: widthRaw,
      height: heightRaw,
      strokeColor: resolveTextColor(ctx.style),
      strokeWidth: 1,
      groupIds: ctx.groupIds,
      angle: rotationOf(ctx.transform),
    }),
    opacity: ctx.style.opacity,
    text,
    fontSize,
    fontFamily: ctx.style.fontFamily,
    textAlign: alignFromAnchor(ctx.style.textAnchor),
    verticalAlign: "top" as const,
    baseline: fontSize,
    containerId: null,
    originalText: text,
    autoResize: true,
    lineHeight: 1.25,
  });
}

function resolveTextColor(style: StyleContext): string {
  // Text in SVG is filled, not stroked — fill takes precedence.
  if (style.fill && style.fill !== "transparent") return style.fill;
  if (style.stroke && style.stroke !== "transparent") return style.stroke;
  return EXCALIDRAW_INK;
}

function alignFromAnchor(
  anchor: StyleContext["textAnchor"]
): "left" | "center" | "right" {
  if (anchor === "middle") return "center";
  if (anchor === "end") return "right";
  return "left";
}

function emitRect(el: Element, ctx: WalkContext, out: unknown[]) {
  const x = n(el.getAttribute("x"));
  const y = n(el.getAttribute("y"));
  const w = n(el.getAttribute("width"));
  const h = n(el.getAttribute("height"));
  if (w <= 0 || h <= 0) return;
  const rxAttr = el.getAttribute("rx") ?? el.getAttribute("ry");
  const rounded = rxAttr != null && parseFloat(rxAttr) > 0;
  const [tx, ty] = applyPoint(ctx.transform, x, y);
  out.push({
    ...baseElement({
      id: nextId("svg-rect"),
      type: "rectangle",
      x: tx,
      y: ty,
      width: w * scaleX(ctx.transform),
      height: h * scaleY(ctx.transform),
      strokeColor:
        ctx.style.stroke && ctx.style.stroke !== "transparent"
          ? ctx.style.stroke
          : "transparent",
      backgroundColor: ctx.style.fill ?? "transparent",
      strokeWidth: ctx.style.strokeWidth || 1,
      groupIds: ctx.groupIds,
      angle: rotationOf(ctx.transform),
    }),
    opacity: ctx.style.opacity,
    roundness: rounded ? { type: 3 } : null,
  });
}

function emitLine(el: Element, ctx: WalkContext, out: unknown[]) {
  const x1 = n(el.getAttribute("x1"));
  const y1 = n(el.getAttribute("y1"));
  const x2 = n(el.getAttribute("x2"));
  const y2 = n(el.getAttribute("y2"));
  const [a1, b1] = applyPoint(ctx.transform, x1, y1);
  const [a2, b2] = applyPoint(ctx.transform, x2, y2);
  out.push(
    linePolylineElement(
      [
        [0, 0],
        [a2 - a1, b2 - b1],
      ],
      a1,
      b1,
      ctx,
      "line"
    )
  );
}

function emitCircle(el: Element, ctx: WalkContext, out: unknown[]) {
  const cx = n(el.getAttribute("cx"));
  const cy = n(el.getAttribute("cy"));
  const r = n(el.getAttribute("r"));
  if (r <= 0) return;
  emitEllipseAt(cx, cy, r, r, ctx, out);
}

function emitEllipse(el: Element, ctx: WalkContext, out: unknown[]) {
  const cx = n(el.getAttribute("cx"));
  const cy = n(el.getAttribute("cy"));
  const rx = n(el.getAttribute("rx"));
  const ry = n(el.getAttribute("ry"));
  if (rx <= 0 || ry <= 0) return;
  emitEllipseAt(cx, cy, rx, ry, ctx, out);
}

function emitEllipseAt(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  ctx: WalkContext,
  out: unknown[]
) {
  const sx = scaleX(ctx.transform);
  const sy = scaleY(ctx.transform);
  const w = rx * 2 * sx;
  const h = ry * 2 * sy;
  const [x, y] = applyPoint(ctx.transform, cx - rx, cy - ry);
  out.push({
    ...baseElement({
      id: nextId("svg-ellipse"),
      type: "ellipse",
      x,
      y,
      width: w,
      height: h,
      strokeColor:
        ctx.style.stroke && ctx.style.stroke !== "transparent"
          ? ctx.style.stroke
          : "transparent",
      backgroundColor: ctx.style.fill ?? "transparent",
      strokeWidth: ctx.style.strokeWidth || 1,
      groupIds: ctx.groupIds,
      angle: rotationOf(ctx.transform),
    }),
    opacity: ctx.style.opacity,
  });
}

function emitPoly(
  el: Element,
  ctx: WalkContext,
  out: unknown[],
  closed: boolean
) {
  const pts = parsePoints(el.getAttribute("points") ?? "");
  if (pts.length < 2) return;
  const closedPts = closed && pts.length > 2 ? [...pts, pts[0]] : pts;
  const transformed: [number, number][] = closedPts.map(([x, y]) =>
    applyPoint(ctx.transform, x, y)
  );
  const [ox, oy] = transformed[0];
  const local: [number, number][] = transformed.map(([x, y]) => [x - ox, y - oy]);
  out.push(linePolylineElement(local, ox, oy, ctx, "line"));
}

function parsePoints(str: string): [number, number][] {
  const nums = str.trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push([nums[i], nums[i + 1]]);
  }
  return pts;
}

/**
 * Sample an SVG path into a polyline. Cubic and quadratic Béziers get
 * sampled at SAMPLES_PER_CURVE intermediate points so curves remain
 * smooth-looking after conversion. Arcs are approximated with a flat
 * fallback (line to endpoint) — none of our templates use A commands.
 */
function emitPath(el: Element, ctx: WalkContext, out: unknown[]) {
  const d = el.getAttribute("d") ?? "";
  const points = samplePath(d);
  if (points.length < 2) return;
  // Path may contain disjoint subpaths from M commands mid-stream. For
  // simplicity we emit a single polyline — subpath jumps render as a
  // straight line between them, which is rare in our templates.
  const transformed: [number, number][] = points.map(([x, y]) =>
    applyPoint(ctx.transform, x, y)
  );
  const [ox, oy] = transformed[0];
  const local: [number, number][] = transformed.map(([x, y]) => [x - ox, y - oy]);
  out.push(linePolylineElement(local, ox, oy, ctx, "line"));
}

const SAMPLES_PER_CURVE = 24;
// Sampling density for SVG arc (A) commands — each arc is sliced into N
// segments along its angular span. 1° per sample at the limit; ~28
// per quarter-turn handles the donut-chart slices cleanly.
const SAMPLES_PER_ARC = 28;

function samplePath(d: string): [number, number][] {
  // Tokenise SVG path: commands and numbers.
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[+-]?\d+)?/g);
  if (!tokens) return [];
  const out: [number, number][] = [];
  let cmd = "M";
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let prevCtrlX = 0;
  let prevCtrlY = 0;
  let i = 0;
  const readNum = () => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[a-zA-Z]/.test(t)) {
      cmd = t;
      i++;
      // Z/z takes no arguments — execute the close immediately. Without
      // this, the letter-switch branch swallows the Z and the `case "Z"`
      // below never runs, leaving polygons open by their closing edge.
      if (t === "Z" || t === "z") {
        x = startX;
        y = startY;
        out.push([startX, startY]);
      }
      continue;
    }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    switch (C) {
      case "M": {
        x = readNum() + (rel ? x : 0);
        y = readNum() + (rel ? y : 0);
        startX = x;
        startY = y;
        out.push([x, y]);
        cmd = rel ? "l" : "L";
        break;
      }
      case "L": {
        x = readNum() + (rel ? x : 0);
        y = readNum() + (rel ? y : 0);
        out.push([x, y]);
        break;
      }
      case "H": {
        x = readNum() + (rel ? x : 0);
        out.push([x, y]);
        break;
      }
      case "V": {
        y = readNum() + (rel ? y : 0);
        out.push([x, y]);
        break;
      }
      case "C": {
        const x1 = readNum() + (rel ? x : 0);
        const y1 = readNum() + (rel ? y : 0);
        const x2 = readNum() + (rel ? x : 0);
        const y2 = readNum() + (rel ? y : 0);
        const x3 = readNum() + (rel ? x : 0);
        const y3 = readNum() + (rel ? y : 0);
        sampleCubic(x, y, x1, y1, x2, y2, x3, y3, out);
        prevCtrlX = x2;
        prevCtrlY = y2;
        x = x3;
        y = y3;
        break;
      }
      case "S": {
        const x1 = 2 * x - prevCtrlX;
        const y1 = 2 * y - prevCtrlY;
        const x2 = readNum() + (rel ? x : 0);
        const y2 = readNum() + (rel ? y : 0);
        const x3 = readNum() + (rel ? x : 0);
        const y3 = readNum() + (rel ? y : 0);
        sampleCubic(x, y, x1, y1, x2, y2, x3, y3, out);
        prevCtrlX = x2;
        prevCtrlY = y2;
        x = x3;
        y = y3;
        break;
      }
      case "Q": {
        const x1 = readNum() + (rel ? x : 0);
        const y1 = readNum() + (rel ? y : 0);
        const x2 = readNum() + (rel ? x : 0);
        const y2 = readNum() + (rel ? y : 0);
        sampleQuad(x, y, x1, y1, x2, y2, out);
        prevCtrlX = x1;
        prevCtrlY = y1;
        x = x2;
        y = y2;
        break;
      }
      case "T": {
        const x1 = 2 * x - prevCtrlX;
        const y1 = 2 * y - prevCtrlY;
        const x2 = readNum() + (rel ? x : 0);
        const y2 = readNum() + (rel ? y : 0);
        sampleQuad(x, y, x1, y1, x2, y2, out);
        prevCtrlX = x1;
        prevCtrlY = y1;
        x = x2;
        y = y2;
        break;
      }
      case "A": {
        const rx = readNum();
        const ry = readNum();
        const xRot = readNum();
        const largeArc = readNum();
        const sweep = readNum();
        const x2 = readNum() + (rel ? x : 0);
        const y2 = readNum() + (rel ? y : 0);
        // Used to flatten arcs to a straight line — completely broke
        // the donut-chart slices in genrePanels.ts. Now we sample.
        sampleArc(x, y, rx, ry, xRot, largeArc, sweep, x2, y2, out);
        x = x2;
        y = y2;
        break;
      }
      case "Z": {
        x = startX;
        y = startY;
        out.push([startX, startY]);
        break;
      }
      default:
        i++;
    }
  }
  return out;
}

function sampleCubic(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  out: [number, number][]
) {
  for (let k = 1; k <= SAMPLES_PER_CURVE; k++) {
    const t = k / SAMPLES_PER_CURVE;
    const mt = 1 - t;
    const bx =
      mt * mt * mt * x0 +
      3 * mt * mt * t * x1 +
      3 * mt * t * t * x2 +
      t * t * t * x3;
    const by =
      mt * mt * mt * y0 +
      3 * mt * mt * t * y1 +
      3 * mt * t * t * y2 +
      t * t * t * y3;
    out.push([bx, by]);
  }
}

function sampleQuad(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  out: [number, number][]
) {
  for (let k = 1; k <= SAMPLES_PER_CURVE; k++) {
    const t = k / SAMPLES_PER_CURVE;
    const mt = 1 - t;
    const bx = mt * mt * x0 + 2 * mt * t * x1 + t * t * x2;
    const by = mt * mt * y0 + 2 * mt * t * y1 + t * t * y2;
    out.push([bx, by]);
  }
}

/**
 * Sample an SVG elliptical arc (A command) into a polyline.
 *
 * Implements the endpoint-to-center conversion from the SVG spec
 * (https://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes):
 * given the two endpoints, the rx/ry radii, the x-axis rotation, and
 * the large-arc + sweep flags, compute the centre point and the start
 * + sweep angles in the ellipse's local frame, then walk the angle
 * range emitting points back in world space.
 *
 * Degenerate cases (zero radius, identical endpoints) fall back to a
 * single straight segment so a malformed arc never breaks the import.
 */
function sampleArc(
  x1: number,
  y1: number,
  rxRaw: number,
  ryRaw: number,
  xAxisRotationDeg: number,
  largeArcFlag: number,
  sweepFlag: number,
  x2: number,
  y2: number,
  out: [number, number][]
) {
  if (
    (x1 === x2 && y1 === y2) ||
    rxRaw === 0 ||
    ryRaw === 0
  ) {
    out.push([x2, y2]);
    return;
  }
  let rx = Math.abs(rxRaw);
  let ry = Math.abs(ryRaw);
  const phi = (xAxisRotationDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // Step 1: compute (x1', y1') — endpoints in the ellipse's frame.
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  // Step 2: scale radii up if the endpoints don't fit (per spec).
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }

  // Step 3: compute (cx', cy') — centre in the ellipse's frame.
  const rxSq = rx * rx;
  const rySq = ry * ry;
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;
  const num = rxSq * rySq - rxSq * y1pSq - rySq * x1pSq;
  const den = rxSq * y1pSq + rySq * x1pSq;
  const sign = largeArcFlag === sweepFlag ? -1 : 1;
  const factor = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = factor * ((rx * y1p) / ry);
  const cyp = factor * (-(ry * x1p) / rx);

  // Step 4: rotate centre back into world frame.
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  // Step 5: compute start angle + sweep delta in the ellipse's frame.
  const angleStart = vectorAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let angleDelta = vectorAngle(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry
  );
  if (sweepFlag === 0 && angleDelta > 0) angleDelta -= 2 * Math.PI;
  if (sweepFlag === 1 && angleDelta < 0) angleDelta += 2 * Math.PI;

  for (let k = 1; k <= SAMPLES_PER_ARC; k++) {
    const t = k / SAMPLES_PER_ARC;
    const theta = angleStart + t * angleDelta;
    const ex = rx * Math.cos(theta);
    const ey = ry * Math.sin(theta);
    const px = cosPhi * ex - sinPhi * ey + cx;
    const py = sinPhi * ex + cosPhi * ey + cy;
    out.push([px, py]);
  }
}

function vectorAngle(
  ux: number,
  uy: number,
  vx: number,
  vy: number
): number {
  const sign = ux * vy - uy * vx < 0 ? -1 : 1;
  const dot = ux * vx + uy * vy;
  const mag = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
  const cosTheta = Math.min(1, Math.max(-1, dot / mag));
  return sign * Math.acos(cosTheta);
}

function linePolylineElement(
  localPoints: [number, number][],
  ox: number,
  oy: number,
  ctx: WalkContext,
  type: "line" | "arrow"
) {
  const xs = localPoints.map((p) => p[0]);
  const ys = localPoints.map((p) => p[1]);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const base = baseElement({
    id: nextId(`svg-${type}`),
    type,
    x: ox,
    y: oy,
    width,
    height,
    // SVG paths and polygons commonly have NO stroke but a coloured
    // fill. When stroke is missing, drop to transparent so we don't
    // hallucinate a black outline on a filled body shape.
    strokeColor:
      ctx.style.stroke && ctx.style.stroke !== "transparent"
        ? ctx.style.stroke
        : "transparent",
    // Preserve fill — polygons (cones, polygon icons) and closed paths
    // (trapezoid tower body) need their interior color or they vanish.
    backgroundColor:
      ctx.style.fill && ctx.style.fill !== "transparent"
        ? ctx.style.fill
        : "transparent",
    strokeWidth: ctx.style.strokeWidth || 1,
    groupIds: ctx.groupIds,
  });
  return {
    ...base,
    opacity: ctx.style.opacity,
    points: localPoints,
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: null,
  };
}

// ---------- Transform helpers ----------

function scaleX(t: Transform): number {
  return Math.hypot(t.a, t.b);
}
function scaleY(t: Transform): number {
  return Math.hypot(t.c, t.d);
}
function rotationOf(t: Transform): number {
  // Returns rotation in radians. Approximate — ignores skew.
  return Math.atan2(t.b, t.a);
}

// ---------- Public entry ----------

export interface ConvertOptions {
  /** Translate every emitted element by this offset — used to inset the
   *  panel inside the editor canvas with a margin. */
  offsetX?: number;
  offsetY?: number;
  /** Group id stamped on every emitted element so they select as a unit
   *  on first click; the user can ungroup to edit individual pieces. */
  groupId?: string;
}

export function svgToExcalidrawElements(
  svg: string,
  opts: ConvertOptions = {}
): { elements: unknown[]; width: number; height: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");
    if (doc.querySelector("parsererror")) return null;
    const root = doc.querySelector("svg");
    if (!root) return null;

    const { width, height } = extractDims(root);

    const out: unknown[] = [];
    const baseTransform: Transform = {
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      e: opts.offsetX ?? 0,
      f: opts.offsetY ?? 0,
    };
    walk(root, {
      transform: baseTransform,
      style: DEFAULT_STYLE,
      groupIds: opts.groupId ? [opts.groupId] : [],
    }, out);
    return { elements: out, width, height };
  } catch {
    return null;
  }
}

function extractDims(root: Element): { width: number; height: number } {
  const vb = root.getAttribute("viewBox");
  if (vb) {
    const parts = vb.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      return { width: parts[2], height: parts[3] };
    }
  }
  const w = n(root.getAttribute("width"), 680);
  const h = n(root.getAttribute("height"), 480);
  return { width: w, height: h };
}
