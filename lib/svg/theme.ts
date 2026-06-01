import type { ColorTriple } from "@/components/NodeEditPopover";

/**
 * Recolor every meaningful element of a panel SVG to a single color theme:
 * - <rect> with a real fill → fill = triple.fill, stroke = triple.stroke
 * - <text>/<tspan> → fill = triple.text
 * - stroked <path>/<line>/<polyline> → stroke = triple.stroke
 *
 * Client-only (uses DOMParser). Returns content unchanged on parse failure.
 */
export function themeSvg(content: string, triple: ColorTriple): string {
  if (typeof window === "undefined" || !content) return content;

  const doc = new DOMParser().parseFromString(content, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== "svg") return content;
  if (root.querySelector("parsererror")) return content;

  root.querySelectorAll("rect").forEach((r) => {
    const fill = r.getAttribute("fill") || "";
    if (isMeaningful(fill)) r.setAttribute("fill", triple.fill);
    const stroke = r.getAttribute("stroke") || "";
    if (isMeaningful(stroke)) r.setAttribute("stroke", triple.stroke);
  });

  root.querySelectorAll("text, tspan").forEach((t) => {
    t.setAttribute("fill", triple.text);
  });

  root.querySelectorAll("path, line, polyline").forEach((p) => {
    const stroke = p.getAttribute("stroke") || "";
    if (isMeaningful(stroke)) p.setAttribute("stroke", triple.stroke);
  });

  return new XMLSerializer().serializeToString(root);
}

function isMeaningful(c: string): boolean {
  const v = c.trim().toLowerCase();
  return v.length > 0 && v !== "none" && v !== "transparent";
}
