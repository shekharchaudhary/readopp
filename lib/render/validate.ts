import { JSDOM } from "jsdom";

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Strip any markdown fences / leading commentary the model may have added,
 * keeping just the SVG or HTML block.
 */
export function stripFences(raw: string): string {
  let s = raw.trim();

  const fence = s.match(/^```(?:svg|html|xml)?\s*([\s\S]*?)```\s*$/i);
  if (fence) s = fence[1].trim();

  // If the model wrapped with prose, find the first <svg or <div / <table
  const svgStart = s.indexOf("<svg");
  const htmlStart = (() => {
    const candidates = ["<div", "<table", "<ul", "<ol", "<section", "<article"];
    let min = -1;
    for (const c of candidates) {
      const i = s.indexOf(c);
      if (i !== -1 && (min === -1 || i < min)) min = i;
    }
    return min;
  })();

  if (svgStart !== -1 && (htmlStart === -1 || svgStart < htmlStart)) {
    const end = s.lastIndexOf("</svg>");
    if (end !== -1) s = s.slice(svgStart, end + 6);
  } else if (htmlStart !== -1) {
    s = s.slice(htmlStart).trim();
  }
  return s.trim();
}

const ALLOWED_FONT_SIZES = new Set([12, 14, 56]);

export function validateSvg(svg: string): ValidationResult {
  if (!/^<svg[\s>]/i.test(svg.trim())) {
    return { ok: false, reason: "Output does not start with an <svg> tag." };
  }
  if (!/<\/svg>\s*$/i.test(svg.trim())) {
    return { ok: false, reason: "Output does not end with </svg>." };
  }
  try {
    const dom = new JSDOM(
      `<!doctype html><html><body>${svg}</body></html>`,
      { contentType: "text/html" }
    );
    const root = dom.window.document.querySelector("svg");
    if (!root) return { ok: false, reason: "No <svg> root parseable." };

    // viewBox shape + dimensions
    const viewBox = root.getAttribute("viewBox") || "";
    const m = viewBox.match(
      /^\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/
    );
    if (!m) return { ok: false, reason: "viewBox missing or malformed." };
    const w = Number(m[3]);
    const h = Number(m[4]);
    if (Math.abs(w - 680) > 0.5) {
      return { ok: false, reason: `viewBox width must be 680 (got ${w}).` };
    }
    if (h < 80 || h > 1200) {
      return {
        ok: false,
        reason: `viewBox height ${h} outside reasonable range [80, 1200].`,
      };
    }

    // At least one visible thing
    const drawable = root.querySelectorAll(
      "rect, path, line, polyline, polygon, circle, ellipse, text"
    );
    if (drawable.length === 0) {
      return { ok: false, reason: "SVG has no visible elements." };
    }

    // Every <text> must have non-empty content
    const texts = Array.from(root.querySelectorAll("text"));
    for (const t of texts) {
      if (!(t.textContent || "").trim()) {
        return { ok: false, reason: "Empty <text> element found." };
      }
    }

    // Font sizes restricted to the design system's allowed set
    const all = Array.from(root.querySelectorAll("text, tspan"));
    for (const t of all) {
      const fs = t.getAttribute("font-size");
      if (!fs) continue;
      const n = parseFloat(fs);
      if (Number.isFinite(n) && !ALLOWED_FONT_SIZES.has(Math.round(n))) {
        return {
          ok: false,
          reason: `font-size ${n} is not allowed (use 12, 14, or 56 for stat callouts).`,
        };
      }
    }

    // Banned: foreignObject, script (defence in depth — fixer also strips)
    if (root.querySelector("foreignObject")) {
      return { ok: false, reason: "<foreignObject> is not allowed." };
    }
    if (root.querySelector("script")) {
      return { ok: false, reason: "<script> is not allowed." };
    }

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: `SVG could not be parsed: ${(e as Error).message}`,
    };
  }
}

export function validateHtmlPanel(html: string): ValidationResult {
  const t = html.trim();
  if (!t.startsWith("<")) {
    return { ok: false, reason: "HTML panel must start with an element." };
  }
  if (/<script\b/i.test(t)) {
    return { ok: false, reason: "Script tags are not allowed." };
  }
  try {
    const dom = new JSDOM(`<!doctype html><html><body>${t}</body></html>`);
    const root = dom.window.document.body.firstElementChild;
    if (!root) return { ok: false, reason: "No root element." };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: `HTML could not be parsed: ${(e as Error).message}`,
    };
  }
}
