/**
 * Render a mixed set of real-shaped PanelPlans through renderCleanPanel
 * (the deck-level Clean dispatcher) to tmp/clean-deck/ as SVG + PNG, so
 * the per-visualType routing + cover/outro bookends can be eyeballed
 * against tmp/carousel-shots/style3-*.png.
 *
 * Run: npx tsx scripts/clean-deck-preview.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Resvg } from "@resvg/resvg-js";

import { renderCleanPanel } from "../lib/render/templates/clean";
import type { PanelPlan } from "../lib/shared/schemas";

const OUT = join(process.cwd(), "tmp", "clean-deck");
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
    plan: base({ sectionId: "p1", visualType: "insight", insight: { text: "" } }),
    heading: "The hidden tax of context switching",
  },
  {
    plan: base({
      sectionId: "p2",
      visualType: "timeline",
      timeline: [
        { when: "email", what: "" },
        { when: "slack", what: "" },
        { when: "tab", what: "" },
        { when: "ping", what: "" },
        { when: "work?", what: "" },
      ],
    }),
    heading: "You switch tasks every 3 minutes.",
    caption: "Email. Slack. A tab. Repeat.",
  },
  {
    plan: base({
      sectionId: "p3",
      visualType: "stat_callout",
      stat: { value: "23 min", label: "to fully refocus" },
    }),
    heading: "The cost of one",
    caption: "The time to fully refocus after a single interruption.",
  },
  {
    plan: base({
      sectionId: "p4",
      visualType: "chart",
      chart: {
        kind: "line",
        title: "Focus recovers less after each switch.",
        yLabel: "focus",
        xLabel: "time",
        series: [
          {
            points: [
              { label: "0", value: 40 },
              { label: "1", value: 95 },
              { label: "2", value: 22 },
              { label: "3", value: 78 },
              { label: "4", value: 18 },
              { label: "5", value: 60 },
              { label: "6", value: 30 },
            ],
          },
        ],
      },
    }),
    heading: "Focus recovers less after each switch.",
    caption: "Each interruption leaves residue — the peaks keep falling.",
  },
  {
    plan: base({
      sectionId: "p5",
      visualType: "before_after",
      beforeAfter: {
        before: { label: "Juggling" },
        after: { label: "Batching" },
      },
    }),
    heading: "Don't juggle. Batch.",
    caption: "One mode at a time beats five half-modes at once.",
  },
  {
    plan: base({
      sectionId: "p6",
      visualType: "chart",
      chart: {
        kind: "bar",
        title: "Up to 40% of focused time, gone.",
        series: [
          {
            points: [
              { label: "lost", value: 40 },
              { label: "real work", value: 60 },
            ],
          },
        ],
      },
    }),
    heading: "Up to 40% of focused time, gone.",
    caption: "Lost to switching — not to the tasks themselves.",
  },
  {
    plan: base({
      sectionId: "p7",
      visualType: "framework",
      framework: {
        label: "Three fixes",
        steps: [
          { name: "Batch shallow work into two daily windows." },
          { name: "One screen, one task. Close the rest." },
          { name: "Protect one 90-minute deep block, daily." },
        ],
      },
    }),
    heading: "How to claw it back",
  },
  {
    plan: base({ sectionId: "p8", visualType: "insight", insight: { text: "Share this." } }),
    heading: "Share this.",
    caption: "12 minutes",
  },
];

const total = plans.length;
plans.forEach(({ plan, heading, caption }, i) => {
  const rp = renderCleanPanel(plan, {
    heading,
    caption,
    slide: i,
    total,
    brand: "Readopp",
    audience: "general",
  });
  const n = String(i + 1).padStart(2, "0");
  writeFileSync(join(OUT, `clean-${n}.svg`), rp.content);
  const png = new Resvg(rp.content, { fitTo: { mode: "width", value: 720 } })
    .render()
    .asPng();
  writeFileSync(join(OUT, `clean-${n}.png`), png);
});
console.log(`rendered ${plans.length} clean-deck panels -> ${OUT}`);
