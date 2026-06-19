/**
 * Diagnostic: walk the lighthouse-template SVG through svgToExcalidraw
 * outside the browser to see exactly what the converter emits. Use this
 * whenever the canvas decomposition looks visually wrong; it's faster
 * than capturing the same data from the browser.
 *
 * Run with:
 *   npx tsx scripts/test-svg-converter.ts
 */

import { JSDOM } from "jsdom";
import { renderMetaphor } from "../lib/render/metaphors";
import type { MetaphorPlan, PanelPlan } from "../lib/shared/schemas";

// The converter guards with `typeof window === "undefined"` to skip
// running server-side. We pretend to be a browser by exporting jsdom's
// window + DOMParser as globals.
const dom = new JSDOM(`<!doctype html><html><body></body></html>`);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).window = dom.window;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).DOMParser = dom.window.DOMParser;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).Image = dom.window.Image;

// Stable plan to keep the SVG deterministic between runs.
const plan: MetaphorPlan = {
  kind: "lighthouse",
  poles: [],
  items: [
    { name: "Overeager behavior", sub: null, icon: null },
    { name: "Honest mistakes", sub: null, icon: null },
    { name: "Prompt injection", sub: null, icon: null },
    { name: "Model misalignment", sub: null, icon: null },
  ],
  hub: { name: "Dangerous action", sub: null, icon: null },
  flow: "out",
  outcome: null,
  hint: null,
};

// Wrap the metaphor plan in a minimal PanelPlan so renderMetaphor's
// dispatcher accepts it.
const panelPlan = {
  visualType: "metaphor",
  metaphor: plan,
} as unknown as PanelPlan;

const svg = renderMetaphor(panelPlan);

if (svg == null) {
  console.error("renderMetaphor returned null — check the plan shape.");
  process.exit(1);
}

console.log("== source SVG ==");
console.log(svg);
console.log();

// Lazy-import the converter so the globals above are already set.
import("../lib/editor/svgToExcalidraw").then(
  ({ svgToExcalidrawElements }) => {
    const result = svgToExcalidrawElements(svg, {
      offsetX: 120,
      offsetY: 80,
    });
    if (!result) {
      console.log("CONVERTER RETURNED NULL");
      process.exit(1);
    }
    console.log(
      `== converter emitted ${result.elements.length} elements ==\n`
    );
    for (const el of result.elements) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = el as any;
      const tag = `${String(e.type ?? "?").padEnd(10)}`;
      const pos = `x=${fmt(e.x)} y=${fmt(e.y)} w=${fmt(e.width)} h=${fmt(e.height)}`;
      const stroke = e.strokeColor ?? "—";
      const fill = e.backgroundColor ?? "—";
      const extra =
        e.type === "text"
          ? `  "${(e.text ?? "").slice(0, 40)}"`
          : e.type === "line" || e.type === "arrow"
            ? `  pts=${(e.points as [number, number][]).length}`
            : "";
      console.log(
        `${tag} ${pos.padEnd(48)} stroke=${stroke.padEnd(9)} fill=${fill.padEnd(11)}${extra}`
      );
    }
  }
);

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(1).padStart(7, " ") : "    NaN";
}
