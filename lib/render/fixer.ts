import { JSDOM } from "jsdom";

const PAPER = "#fafaf7";
const NEUTRAL_STROKE = "#6B6B6B";

const CHEV_MARKER = `<marker id="chev" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10" fill="none" stroke="currentColor" stroke-width="1"/></marker>`;

const FONT_STACK =
  "ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif";

const SAFE_X_MIN = 0;
const SAFE_X_MAX = 680;
const VIEWBOX_W = 680;

/**
 * Cheap, deterministic auto-fixes for model-rendered SVG. Catches the
 * mistakes the model keeps making despite the prompt — missing chev marker,
 * black text, decorative attributes that violate the design system — so we
 * don't waste a re-prompt round trip on solvable issues.
 *
 * Runs BEFORE validateSvg. If a fix can be applied, we apply it; otherwise
 * the validator will reject and the renderer re-prompts.
 *
 * Idempotent — re-running the fixer on already-clean SVG is a no-op.
 */
export function fixSvg(raw: string): string {
  if (!raw) return raw;
  const trimmed = raw.trim();
  if (!/^<svg[\s>]/i.test(trimmed)) return raw;

  let dom: JSDOM;
  try {
    dom = new JSDOM(
      `<!doctype html><html><body>${trimmed}</body></html>`,
      { contentType: "text/html" }
    );
  } catch {
    return raw;
  }

  const doc = dom.window.document;
  const root = doc.querySelector("svg");
  if (!root) return raw;

  fixRoot(root);
  stripBannedNodes(root);
  stripBannedAttrs(root);
  ensureDefs(root, doc);
  ensureTitleDesc(root, doc);
  normalizeText(root);
  normalizeConnectors(root);
  normalizeRects(root);
  clampCoords(root);
  dedupeIds(root);
  stripComments(root);

  return root.outerHTML;
}

// ---------- individual fixes ----------

function fixRoot(svg: Element): void {
  if (!svg.getAttribute("xmlns")) {
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }
  if (!svg.getAttribute("role")) svg.setAttribute("role", "img");
  if (!svg.getAttribute("font-family")) {
    svg.setAttribute("font-family", FONT_STACK);
  }
  // Force viewBox width to 680 if the model picked a different one but the
  // height looks reasonable. We don't reflow — we only correct off-by-one.
  const vb = svg.getAttribute("viewBox") || "";
  const m = vb.match(
    /^\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/
  );
  if (m) {
    const w = Number(m[3]);
    const h = Number(m[4]);
    if (Math.abs(w - VIEWBOX_W) <= 4 && Math.abs(w - VIEWBOX_W) > 0) {
      svg.setAttribute("viewBox", `0 0 ${VIEWBOX_W} ${Math.round(h)}`);
    }
  }
  // Remove width/height attributes that would lock display size.
  svg.removeAttribute("width");
  svg.removeAttribute("height");
}

function stripBannedNodes(svg: Element): void {
  const selectors = [
    "script",
    "foreignObject",
    "filter",
    "mask",
    "clipPath",
    "pattern",
    "linearGradient",
    "radialGradient",
    "image",
  ];
  selectors.forEach((sel) => {
    svg.querySelectorAll(sel).forEach((el) => el.remove());
  });
}

function stripBannedAttrs(svg: Element): void {
  // Walk every element once.
  const walker = svg.ownerDocument!.createTreeWalker(svg, 1 /* NodeFilter.SHOW_ELEMENT */);
  let node: Node | null = walker.currentNode;
  while (node) {
    const el = node as Element;
    el.removeAttribute("filter");
    el.removeAttribute("mask");
    el.removeAttribute("clip-path");
    el.removeAttribute("style"); // inline styles often hide gradients / shadows
    node = walker.nextNode();
  }
}

function ensureDefs(svg: Element, doc: Document): void {
  let defs = svg.querySelector(":scope > defs");
  if (!defs) {
    defs = doc.createElement("defs");
    svg.insertBefore(defs, svg.firstChild);
  }
  if (!defs.querySelector("#chev")) {
    const wrap = doc.createElement("template");
    wrap.innerHTML = CHEV_MARKER;
    const marker = wrap.content.firstElementChild;
    if (marker) defs.appendChild(marker);
  }
}

function ensureTitleDesc(svg: Element, doc: Document): void {
  if (!svg.querySelector(":scope > title")) {
    const t = doc.createElement("title");
    t.textContent = "Diagram";
    svg.insertBefore(t, svg.firstChild);
  }
  if (!svg.querySelector(":scope > desc")) {
    const d = doc.createElement("desc");
    d.textContent = "";
    const title = svg.querySelector(":scope > title");
    if (title && title.nextSibling) {
      svg.insertBefore(d, title.nextSibling);
    } else {
      svg.appendChild(d);
    }
  }
}

function normalizeText(svg: Element): void {
  svg.querySelectorAll("text, tspan").forEach((node) => {
    const el = node as Element;
    // Pure black text → swap to ink token
    const fill = (el.getAttribute("fill") || "").toLowerCase();
    if (fill === "#000" || fill === "#000000" || fill === "black") {
      el.setAttribute("fill", "#1a1a1a");
    }
    // Bold → medium
    const w = el.getAttribute("font-weight") || "";
    if (/^(600|700|800|900|bold)$/i.test(w)) {
      el.setAttribute("font-weight", "500");
    }
    // Italic style banned
    const style = el.getAttribute("font-style");
    if (style && /italic/i.test(style)) el.removeAttribute("font-style");
  });
}

function normalizeConnectors(svg: Element): void {
  svg.querySelectorAll("path, line").forEach((node) => {
    const el = node as Element;
    const stroke = (el.getAttribute("stroke") || "").trim();
    if (!stroke || stroke.toLowerCase() === "none") return;
    if (!el.getAttribute("fill")) el.setAttribute("fill", "none");
    if (!el.getAttribute("stroke-width")) el.setAttribute("stroke-width", "1");
    if (!el.getAttribute("stroke-linecap")) {
      el.setAttribute("stroke-linecap", "round");
    }
    if (!el.getAttribute("stroke-linejoin")) {
      el.setAttribute("stroke-linejoin", "round");
    }
    if (!el.getAttribute("marker-end")) {
      el.setAttribute("marker-end", "url(#chev)");
    }
    // Normalize stroke to neutral if a near-black stroke was used
    const s = stroke.toLowerCase();
    if (s === "#000" || s === "#000000" || s === "black") {
      el.setAttribute("stroke", NEUTRAL_STROKE);
    }
  });
}

function normalizeRects(svg: Element): void {
  svg.querySelectorAll("rect").forEach((node) => {
    const el = node as Element;
    // Skip canvas backgrounds — only style content rects.
    const fill = (el.getAttribute("fill") || "").toLowerCase();
    if (!fill || fill === "none" || fill === "transparent") return;
    if (!el.getAttribute("rx")) el.setAttribute("rx", "8");
    if (!el.getAttribute("ry")) el.setAttribute("ry", "8");
    if (!el.getAttribute("stroke-width")) el.setAttribute("stroke-width", "1");
    // If fill is a pure white background covering the whole canvas,
    // strip it so the page paper colour shows through.
    const x = parseFloat(el.getAttribute("x") || "0");
    const y = parseFloat(el.getAttribute("y") || "0");
    const w = parseFloat(el.getAttribute("width") || "0");
    if ((fill === "#ffffff" || fill === "#fff" || fill === PAPER) && x <= 1 && y <= 1 && w >= 678) {
      el.remove();
    }
  });
}

function clampCoords(svg: Element): void {
  // Only clamp clearly-out-of-bounds rect x positions — don't shift y/height
  // because that would reflow the panel.
  svg.querySelectorAll("rect").forEach((node) => {
    const el = node as Element;
    const x = parseFloat(el.getAttribute("x") || "");
    const w = parseFloat(el.getAttribute("width") || "");
    if (Number.isFinite(x) && Number.isFinite(w)) {
      if (x < SAFE_X_MIN) el.setAttribute("x", String(SAFE_X_MIN));
      if (x + w > SAFE_X_MAX) {
        const nx = Math.max(SAFE_X_MIN, SAFE_X_MAX - w);
        el.setAttribute("x", String(nx));
      }
    }
  });
}

function dedupeIds(svg: Element): void {
  const seen = new Set<string>();
  svg.querySelectorAll("[id]").forEach((node) => {
    const el = node as Element;
    const id = el.getAttribute("id") || "";
    if (!id) return;
    if (!seen.has(id)) {
      seen.add(id);
      return;
    }
    // Rename collisions deterministically; references to the old id may
    // break, but it's better than invalid DOM.
    let i = 2;
    let next = `${id}-${i}`;
    while (seen.has(next)) next = `${id}-${++i}`;
    el.setAttribute("id", next);
    seen.add(next);
  });
}

function stripComments(svg: Element): void {
  const doc = svg.ownerDocument!;
  // NodeFilter.SHOW_COMMENT = 128
  const walker = doc.createTreeWalker(svg, 128);
  const toRemove: Node[] = [];
  let node: Node | null = walker.currentNode;
  while ((node = walker.nextNode())) toRemove.push(node);
  toRemove.forEach((n) => n.parentNode?.removeChild(n));
}
