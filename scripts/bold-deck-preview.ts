/**
 * Render a mixed set of real-shaped PanelPlans through renderBoldPanel
 * (the deck-level Bold dispatcher) to tmp/bold-deck/ as SVG + PNG, so
 * the per-visualType routing + bg rotation can be eyeballed.
 *
 * Run: npx tsx scripts/bold-deck-preview.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Resvg } from "@resvg/resvg-js";

import { renderBoldPanel } from "../lib/render/templates/bold";
import type { PanelPlan } from "../lib/shared/schemas";

const OUT = join(process.cwd(), "tmp", "bold-deck");
mkdirSync(OUT, { recursive: true });

const base = (over: Partial<PanelPlan>): PanelPlan => ({
  sectionId: over.sectionId ?? "s",
  visualType: over.visualType ?? "insight",
  caption: over.caption ?? "",
  narrativeReason: "",
  ...over,
});

const plans: Array<{ plan: PanelPlan; heading: string; caption?: string }> = [
  {
    plan: base({
      sectionId: "p1",
      visualType: "insight",
      insight: { text: "Context switching is robbing you.", kicker: "The hidden tax" },
    }),
    heading: "Context switching is robbing you.",
  },
  {
    plan: base({
      sectionId: "p2",
      visualType: "stat_callout",
      stat: { value: "23 min", label: "to refocus after one ping" },
    }),
    heading: "The cost of one interruption",
    caption: "Every ping resets your focus.",
  },
  {
    plan: base({
      sectionId: "p3",
      visualType: "chart",
      chart: {
        kind: "bar",
        title: "Focus drops with every interruption",
        series: [
          {
            points: [
              { label: "0", value: 100 },
              { label: "1", value: 72 },
              { label: "2", value: 48 },
              { label: "3", value: 30 },
            ],
          },
        ],
      },
    }),
    heading: "Your brain doesn't snap back",
  },
  {
    plan: base({
      sectionId: "p4",
      visualType: "stat_callout",
      stat: { value: "40%", label: "of productive time, gone" },
    }),
    heading: "The switching tax",
    caption: "Not the work — the switching.",
  },
  {
    plan: base({
      sectionId: "p5",
      visualType: "framework",
      framework: {
        label: "3 fixes",
        steps: [
          { name: "Batch shallow work into 2 windows" },
          { name: "One screen, one task, close the rest" },
          { name: "Guard a 90-min deep block daily" },
        ],
      },
    }),
    heading: "How to claw it back",
  },
  {
    plan: base({
      sectionId: "p6",
      visualType: "key_findings",
      keyFindings: {
        label: "What the data shows",
        findings: [
          { title: "Multitasking cuts output by 40%" },
          { title: "Recovery takes 23 minutes" },
          { title: "Deep blocks beat fragmented hours" },
        ],
      },
    }),
    heading: "The evidence",
  },
  {
    plan: base({
      sectionId: "p7",
      visualType: "quote_card",
      quoteCard: {
        text: "You can do two things at once, but you can't focus on two things at once.",
        attribution: "Gary Keller",
      },
    }),
    heading: "On attention",
  },
  {
    plan: base({ sectionId: "p8", visualType: "insight", insight: { text: "Share this." } }),
    heading: "Share this.",
    caption: "Made from a 12-min read.",
  },
];

const total = plans.length;
plans.forEach(({ plan, heading, caption }, i) => {
  const rp = renderBoldPanel(plan, { heading, caption, slide: i, total, brand: "Readopp" });
  const n = String(i + 1).padStart(2, "0");
  writeFileSync(join(OUT, `deck-${n}.svg`), rp.content);
  const png = new Resvg(rp.content, { fitTo: { mode: "width", value: 720 } })
    .render()
    .asPng();
  writeFileSync(join(OUT, `deck-${n}.png`), png);
});
console.log(`rendered ${plans.length} bold-deck panels -> ${OUT}`);
