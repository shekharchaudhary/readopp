/**
 * Sanity check for parseWithFeedback: build a couple of deliberately-
 * bad PanelPlan JSON blobs (the exact shapes the planner has produced
 * and failed on in the wild) and print the formatted retry hint.
 *
 *   npx tsx scripts/test-zod-feedback.ts
 */

import { parseWithFeedback } from "../lib/agents/util";
import { PanelPlanSchema } from "../lib/shared/schemas";

const CASES: Array<{ label: string; input: unknown }> = [
  {
    label: "definitionCard.analogy too long (real failure from smoke test)",
    input: {
      sectionId: "s3",
      visualType: "definition_card",
      caption: "What an abstraction is.",
      definitionCard: {
        term: "Abstraction",
        kicker: "noun",
        definition:
          "A simplifying model that hides underlying complexity behind a clean interface.",
        analogy:
          "A".repeat(170), // > 160 char cap
      },
      narrativeReason: "Opening with a definition lands the topic.",
    },
  },
  {
    label: "metaphor.items[0].name missing (real failure from smoke test)",
    input: {
      sectionId: "s5",
      visualType: "metaphor",
      caption: "The forces pulling on the team.",
      metaphor: {
        kind: "tug_of_war",
        poles: [
          { label: "Speed", sub: null },
          { label: "Quality", sub: null },
        ],
        items: [
          { sub: "missing name field" },
          { name: "Real item", sub: null },
        ],
        hub: null,
        flow: "out",
        outcome: null,
        hint: null,
      },
      narrativeReason: "",
    },
  },
  {
    label: "framework with too few steps + wrong type",
    input: {
      sectionId: "s4",
      visualType: "framework",
      caption: "Three steps to debug a pipeline.",
      framework: {
        label: "THE 1-STEP",
        steps: [{ name: "Only one", description: 42 }],
      },
      narrativeReason: "",
    },
  },
];

for (const c of CASES) {
  console.log(`\n=== ${c.label} ===`);
  try {
    parseWithFeedback(PanelPlanSchema, c.input);
    console.log("  (unexpectedly passed validation)");
  } catch (e) {
    console.log((e as Error).message);
  }
}
