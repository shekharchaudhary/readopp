/**
 * Focused render check for the two metaphors touched by the current
 * uncommitted work: tug_of_war and gears. Drops SVG + PNG to
 * tmp/two-metaphors/ so the visual changes can be eyeballed.
 *
 * Run: npx tsx scripts/render-two-metaphors.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Resvg } from "@resvg/resvg-js";

import { renderMetaphor } from "../lib/render/metaphors";
import type { PanelPlan } from "../lib/shared/schemas";

const OUT = join(process.cwd(), "tmp", "two-metaphors");
mkdirSync(OUT, { recursive: true });

function tugPlan(): PanelPlan {
  return {
    sectionId: "tug",
    visualType: "metaphor",
    caption: "Growth vs profit tug of war.",
    metaphor: {
      kind: "tug_of_war" as never,
      poles: [
        { label: "Growth", sub: "Spend now", icon: null },
        { label: "Profit", sub: "Bank it", icon: null },
      ],
      items: [
        { name: "Marketing", sub: null, icon: null },
        { name: "Sales", sub: null, icon: null },
        { name: "Support", sub: null, icon: null },
        { name: "Finance", sub: null, icon: null },
      ],
      hub: null,
      flow: "out",
      outcome: { label: "Next-quarter budget", sub: null, icon: null } as never,
      hint: null,
    },
    narrativeReason: "",
  } as PanelPlan;
}

function gearsPlan(n: number): PanelPlan {
  const all = ["Marketing", "Sales", "Onboarding", "Retention"];
  return {
    sectionId: `gears-${n}`,
    visualType: "metaphor",
    caption: "Go-to-market machine.",
    metaphor: {
      kind: "gears" as never,
      poles: [],
      items: all.slice(0, n).map((name) => ({ name, sub: null, icon: null })),
      hub: null,
      flow: "out",
      outcome: null,
      hint: null,
    },
    narrativeReason: "",
  } as PanelPlan;
}

const cases: Array<{ name: string; plan: PanelPlan }> = [
  { name: "tug_of_war", plan: tugPlan() },
  { name: "gears-2", plan: gearsPlan(2) },
  { name: "gears-3", plan: gearsPlan(3) },
  { name: "gears-4", plan: gearsPlan(4) },
];

for (const c of cases) {
  const svg = renderMetaphor(c.plan, {
    heading:
      c.name === "tug_of_war"
        ? "Two forces pull on every budget"
        : "The growth machine only turns as one",
    source: "example.com",
    slide: { index: 1, total: 5 },
  });
  if (!svg) {
    console.log(`${c.name}: renderMetaphor returned null`);
    continue;
  }
  const svgPath = join(OUT, `${c.name}.svg`);
  writeFileSync(svgPath, svg);
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 1360 } })
    .render()
    .asPng();
  const pngPath = join(OUT, `${c.name}.png`);
  writeFileSync(pngPath, png);
  console.log(`${c.name}: ${svgPath}  (${(svg.length / 1024).toFixed(1)} KB svg)`);
}
console.log(`\nDone → ${OUT}`);
