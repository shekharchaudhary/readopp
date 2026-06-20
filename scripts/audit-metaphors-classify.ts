/**
 * Metaphor faithfulness check.
 *
 * For each of the 26 metaphor kinds we sent a known test plan with
 * items + poles + hub + outcome. Read each rendered SVG back and
 * count which inputs actually appear in the SVG text. Produces a
 * per-metaphor verdict:
 *
 *   FAITHFUL  — surfaces all items + every named slot it should
 *   PARTIAL   — surfaces most but drops some
 *   POLES_ONLY — duality metaphor renders pole labels but ignores items
 *   BROKEN    — renders almost nothing identifiable
 *
 * Use this to pick Phase 2E.2 targets: which metaphors need fixes
 * (items[] ignored) vs which need only the chrome envelope vs which
 * should be demoted in the planner.
 *
 * Run: npx tsx scripts/audit-metaphors-classify.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "tmp", "panel-audit");

interface Expect {
  kind: string;
  items: string[];
  poles?: [string, string];
  hub?: string;
  outcome?: string;
}

// Same test plans as scripts/audit-panels.ts. Keep in sync.
const PLANS: Expect[] = [
  { kind: "iceberg", items: ["Onboarding"], poles: ["Sticker price", "True cost"] },
  { kind: "bridge", items: ["Refactor", "Tests", "Migration"], poles: ["Legacy monolith", "Modular services"] },
  { kind: "scale", items: ["Trust", "Speed", "Cost"], poles: ["Velocity", "Quality"] },
  { kind: "tug_of_war", items: ["Marketing", "Sales", "Support"], poles: ["Growth", "Profit"] },
  { kind: "spectrum", items: ["MVP", "Beta", "GA", "Enterprise"], poles: ["Scrappy", "Polished"] },
  { kind: "mountain", items: ["Discovery", "Design", "Build", "Ship", "Scale"], outcome: "Product-market fit" },
  { kind: "staircase", items: ["Read", "Practice", "Apply", "Teach"] },
  { kind: "garden", items: ["Seed", "Sprout", "Bloom", "Harvest"] },
  { kind: "domino", items: ["First win", "Momentum", "Network effect", "Default choice"] },
  { kind: "weaving", items: ["Research", "Engineering", "Design", "Marketing"], outcome: "Coherent product" },
  { kind: "confluence", items: ["Telemetry", "Support tickets", "Sales calls", "User research"], hub: "Roadmap" },
  { kind: "funnel", items: ["Visitors", "Signups", "Trials", "Paid"], hub: "Retained users" },
  { kind: "branching", items: ["Email", "Slack", "LinkedIn", "X"], hub: "One announcement" },
  { kind: "ripple", items: ["Team A", "Team B", "Team C"], hub: "Founder decision" },
  { kind: "crossroads", items: ["Build", "Buy", "Partner"], hub: "The next 90 days" },
  { kind: "lighthouse", items: ["Hot-take news", "Vanity metrics", "Office politics", "Slack noise"], hub: "True customer need" },
  { kind: "spotlight", items: ["Other quarters", "Other teams", "Other projects"], hub: "Q4 retention" },
  { kind: "orbits", items: ["Friends", "Customers", "Investors", "Press"], hub: "Founder time" },
  { kind: "loop", items: ["Observe", "Orient", "Decide", "Act"] },
  { kind: "tide", items: ["Boom", "Bubble", "Bust", "Recovery"] },
  { kind: "engine", items: ["Fuel", "Compression", "Spark", "Exhaust"], outcome: "Forward motion" },
  { kind: "gears", items: ["Marketing", "Sales", "Onboarding", "Retention"] },
  { kind: "layers", items: ["Application", "Framework", "Runtime", "OS", "Hardware"] },
  { kind: "pyramid", items: ["Vision", "Strategy", "Tactics", "Execution"] },
  { kind: "compass", items: ["Innovate", "Operate", "Cultivate", "Negotiate"] },
  { kind: "maze", items: ["Wrong turn 1", "Wrong turn 2", "Wrong turn 3"], outcome: "The exit" },
  // Phase 2E.2d
  {
    kind: "quadrant",
    items: ["Hidden gems", "Stars", "Question marks", "Cash cows"],
    poles: ["Market growth", "Market share"],
  },
  {
    kind: "paradox",
    items: [],
    poles: [
      "Faster shipping makes us safer",
      "Faster shipping makes us riskier",
    ],
    outcome: "until",
  },
  { kind: "onion", items: ["Symptom", "Root cause", "Underlying belief", "First principle"], outcome: "Truth" },
  {
    kind: "tipping_point",
    items: ["Stress", "Tight deadline", "Bad sleep", "Conflicting priorities", "One more meeting"],
    outcome: "Burnout",
  },
];

interface Score {
  kind: string;
  items: { expected: number; found: number };
  poles?: { expected: number; found: number };
  hub?: { expected: 1; found: 0 | 1 };
  outcome?: { expected: 1; found: 0 | 1 };
  verdict: "FAITHFUL" | "PARTIAL" | "POLES_ONLY" | "BROKEN";
  notes: string[];
}

function svgFilename(kind: string, p: Expect): string {
  const hubSuffix = p.hub ? "-hub" : "";
  const outcomeSuffix = p.outcome ? "-outcome" : "";
  const polesSuffix = p.poles ? "-poles" : "";
  // Audit script names: metaphor:<kind> + label like "4 items + hub + poles"
  // After slug: metaphor-<kind>__N-items[-hub][-outcome][-poles].svg
  return `metaphor-${kind}__${p.items.length}-items${hubSuffix}${outcomeSuffix}${polesSuffix}.svg`;
}

function scoreOne(p: Expect): Score {
  // The audit script labels render with " + hub" or " + outcome" or " + poles".
  // Slug:  /[^a-z0-9]+/gi -> "-", lowercased. So "4 items + hub" -> "4-items-hub".
  // Build the exact slug we use in audit-panels.ts.
  const label = `${p.items.length} items${p.hub ? " + hub" : ""}${p.outcome ? " + outcome" : ""}${p.poles ? " + poles" : ""}`;
  const slug = label.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  // audit-panels.ts slugs the GROUP (`metaphor:tug_of_war`) the same way it
  // slugs the label, so underscores in kind names collapse to hyphens.
  const kindSlug = p.kind.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const filename = `metaphor-${kindSlug}__${slug}.svg`;
  const path = join(OUT_DIR, filename);

  let svg: string;
  try {
    svg = readFileSync(path, "utf8");
  } catch {
    return {
      kind: p.kind,
      items: { expected: p.items.length, found: 0 },
      verdict: "BROKEN",
      notes: [`SVG missing at ${filename}`],
    };
  }
  // Strip everything inside <title>, <desc>, and SVG comments — they often
  // include item names for accessibility but aren't visible.
  const visible = svg
    .replace(/<title>[\s\S]*?<\/title>/gi, "")
    .replace(/<desc>[\s\S]*?<\/desc>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Wrap may split a multi-word label across separate <text> elements,
  // so a strict substring check (which expects "Tight deadline" intact)
  // gives false negatives. Instead: an item is "found" when every word
  // in its name appears anywhere in the SVG text. Case-insensitive so
  // metaphors that render labels in caps (quadrant axis labels, etc.)
  // still pass.
  const visibleLower = visible.toLowerCase();
  const containsAllWords = (label: string): boolean => {
    return label
      .trim()
      .split(/\s+/)
      .every((word) => visibleLower.includes(word.toLowerCase()));
  };
  const itemsFound = p.items.filter(containsAllWords).length;
  const polesFound = p.poles
    ? p.poles.filter(containsAllWords).length
    : null;
  const hubFound = p.hub ? (containsAllWords(p.hub) ? 1 : 0) : null;
  const outcomeFound = p.outcome
    ? containsAllWords(p.outcome)
      ? 1
      : 0
    : null;

  const notes: string[] = [];
  if (itemsFound < p.items.length) {
    notes.push(`drops ${p.items.length - itemsFound}/${p.items.length} items`);
  }
  if (p.hub && hubFound === 0) notes.push("drops hub");
  if (p.outcome && outcomeFound === 0) notes.push("drops outcome");
  if (p.poles && polesFound !== null && polesFound < p.poles.length) {
    notes.push(`drops ${p.poles.length - polesFound}/${p.poles.length} pole labels`);
  }

  let verdict: Score["verdict"];
  const allItemsDropped = itemsFound === 0 && p.items.length > 0;
  const someItemsDropped = itemsFound < p.items.length;
  const polesOK = !p.poles || polesFound === p.poles.length;
  const hubOK = !p.hub || hubFound === 1;
  const outcomeOK = !p.outcome || outcomeFound === 1;

  if (allItemsDropped && polesOK && p.poles) {
    verdict = "POLES_ONLY";
  } else if (allItemsDropped && !polesOK) {
    verdict = "BROKEN";
  } else if (someItemsDropped || !polesOK || !hubOK || !outcomeOK) {
    verdict = "PARTIAL";
  } else {
    verdict = "FAITHFUL";
  }

  return {
    kind: p.kind,
    items: { expected: p.items.length, found: itemsFound },
    poles: p.poles
      ? { expected: p.poles.length, found: polesFound ?? 0 }
      : undefined,
    hub: p.hub ? { expected: 1, found: hubFound as 0 | 1 } : undefined,
    outcome: p.outcome
      ? { expected: 1, found: outcomeFound as 0 | 1 }
      : undefined,
    verdict,
    notes,
  };
}

const scores = PLANS.map(scoreOne);

const buckets: Record<Score["verdict"], string[]> = {
  FAITHFUL: [],
  PARTIAL: [],
  POLES_ONLY: [],
  BROKEN: [],
};
for (const s of scores) buckets[s.verdict].push(s.kind);

console.log("\n=== Per-metaphor verdict ===\n");
for (const s of scores) {
  const ratio = `${s.items.found}/${s.items.expected} items`;
  const extras = [
    s.poles ? `${s.poles.found}/${s.poles.expected} poles` : "",
    s.hub ? `${s.hub.found}/1 hub` : "",
    s.outcome ? `${s.outcome.found}/1 outcome` : "",
  ]
    .filter(Boolean)
    .join(", ");
  const note = s.notes.length ? `  — ${s.notes.join("; ")}` : "";
  console.log(
    `  ${s.verdict.padEnd(10)} ${s.kind.padEnd(12)} ${ratio.padEnd(12)} ${extras}${note}`
  );
}

console.log("\n=== Buckets ===\n");
for (const v of ["FAITHFUL", "PARTIAL", "POLES_ONLY", "BROKEN"] as const) {
  console.log(
    `  ${v.padEnd(10)} (${buckets[v].length}): ${buckets[v].join(", ") || "—"}`
  );
}
