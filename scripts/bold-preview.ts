/**
 * Render the 8-panel Bold carousel deck and drop SVG + PNG to
 * tmp/bold-preview/ so it can be compared against the design source.
 *
 * Run: npx tsx scripts/bold-preview.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Resvg } from "@resvg/resvg-js";

import {
  renderBoldStatement,
  renderBoldStat,
  renderBoldBars,
  renderBoldList,
  renderBoldOutro,
} from "../lib/render/templates/bold";

const OUT = join(process.cwd(), "tmp", "bold-preview");
mkdirSync(OUT, { recursive: true });

const deck = [
  renderBoldStatement({
    sectionId: "p1",
    bg: "ink",
    kicker: "The hidden tax",
    lines: [
      { text: "Context", color: "white" },
      { text: "switching", color: "white" },
      { text: "is robbing", color: "white" },
      { text: "you.", color: "white" },
    ],
  }),
  renderBoldStatement({
    sectionId: "p2",
    bg: "paper",
    lines: [
      { text: "Every", color: "fg" },
      { text: "3 minutes,", color: "fg" },
      { text: "you switch.", color: "red" },
    ],
    sub: "Email. Slack. A tab. Repeat.",
  }),
  renderBoldStat({
    sectionId: "p3",
    bg: "red",
    kicker: "The damage",
    value: "23",
    unit: "min",
    lines: ["To refocus.", "After one ping."],
  }),
  renderBoldBars({
    sectionId: "p4",
    bg: "ink",
    headingLines: ["Your brain", "doesn't", "snap back."],
    bars: 4,
    barCaption: "Focus drops with every interruption.",
  }),
  renderBoldStat({
    sectionId: "p5",
    bg: "amber",
    value: "40",
    unit: "%",
    lines: ["Gone."],
    note: "Not the work — the switching.",
  }),
  renderBoldStatement({
    sectionId: "p6",
    bg: "paper",
    lines: [
      { text: "Stop", color: "fg" },
      { text: "juggling.", color: "fg" },
      { text: "Start", color: "red" },
      { text: "batching.", color: "red" },
    ],
  }),
  renderBoldList({
    sectionId: "p7",
    bg: "ink",
    kicker: "3 fixes",
    items: [
      "Batch shallow work into 2 windows.",
      "One screen. One task. Close the rest.",
      "Guard a 90-min deep block. Daily.",
    ],
  }),
  renderBoldOutro({
    sectionId: "p8",
    bg: "red",
    lines: ["Share", "this."],
    brand: "Readopp",
    sub: "Made from a 12-min read.",
  }),
];

deck.forEach((p, i) => {
  const n = String(i + 1).padStart(2, "0");
  const svgPath = join(OUT, `bold-${n}.svg`);
  writeFileSync(svgPath, p.content);
  const png = new Resvg(p.content, { fitTo: { mode: "width", value: 720 } })
    .render()
    .asPng();
  writeFileSync(join(OUT, `bold-${n}.png`), png);
});
console.log(`rendered ${deck.length} panels -> ${OUT}`);
