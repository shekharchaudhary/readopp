/**
 * Panel quality audit: render every template at varied content sizes
 * (short / medium / long / overflow edge-cases), drop the SVGs to disk,
 * and emit an HTML index page so we can review them all in one view.
 *
 * Phase 1 of the panel-quality plan. Goal: produce evidence of where
 * each template breaks (overflow, weak hierarchy, off-brand color
 * choices, etc.) so Phase 2 can target real bugs, not guesses.
 *
 * Run:    npx tsx scripts/audit-panels.ts
 * Output: tmp/panel-audit/  (gitignored; index.html opens in browser)
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { renderAnthropicStat } from "../lib/render/templates/anthropicStat";
import { renderFlowchart } from "../lib/render/templates/flowchart";
import { renderStructural } from "../lib/render/templates/structural";
import { renderTimeline } from "../lib/render/templates/timeline";
import { renderMetaphor } from "../lib/render/metaphors";
import { renderGenrePanel } from "../lib/render/genrePanels";
import type { PanelPlan } from "../lib/shared/schemas";

const OUT_DIR = join(process.cwd(), "tmp", "panel-audit");
mkdirSync(OUT_DIR, { recursive: true });

interface AuditCase {
  group: string;
  label: string;
  note?: string;
  svg: string | null;
}

const cases: AuditCase[] = [];

function push(c: AuditCase) {
  cases.push(c);
}

// ------------------------------------------------------------------
// anthropicStat — single-number editorial callout
// ------------------------------------------------------------------

push({
  group: "anthropicStat",
  label: "short — NEW",
  svg: renderAnthropicStat({
    sectionId: "s1",
    heading: "Reading retention",
    caption: "Most readers abandon long articles before paragraph three.",
    stat: { value: "72%", label: "stop reading by ¶3" },
    source: "nytimes.com",
    slide: { index: 1, total: 5 },
  }).content,
});

push({
  group: "anthropicStat",
  label: "medium — NEW",
  svg: renderAnthropicStat({
    sectionId: "s2",
    heading: "Auto mode reduces approval fatigue dramatically",
    caption:
      "By approving 93% of all safe prompts automatically, the security team can finally focus on the genuinely dangerous ones — and click-through accuracy on the remaining 7% jumps from 31% to 84%.",
    stat: { value: "93%", label: "of prompts approved automatically in manual mode" },
    kicker: "the figure",
    source: "anthropic.com",
    slide: { index: 2, total: 5 },
  }).content,
});

push({
  group: "anthropicStat",
  label: "long heading + long caption — NEW",
  note: "Overflow edge case — heading is ~110 chars, caption ~400 chars. With fitText the full text should now render.",
  svg: renderAnthropicStat({
    sectionId: "s3",
    heading:
      "Even sophisticated approval workflows fail when reviewer attention becomes the bottleneck and not security itself",
    caption:
      "Across 12 weeks of telemetry covering 47,000 prompts and 38 reviewers, the team observed that median time-per-approval dropped from 22 seconds to 4 seconds — yet the number of dangerous prompts that slipped through review actually doubled. The approval gate had become rubber-stamping theater rather than meaningful oversight, and the safeguard had been transformed into a liability.",
    stat: { value: "2.1×", label: "more dangerous prompts approved under fatigue" },
    source: "engineering.notes",
    slide: { index: 3, total: 5 },
  }).content,
});

push({
  group: "anthropicStat",
  label: "edge: 1-char stat — NEW",
  note: "Tests serif scaling when the hero number is tiny.",
  svg: renderAnthropicStat({
    sectionId: "s4",
    heading: "A single bit changed everything",
    caption: "One inverted flag broke the rollout.",
    stat: { value: "1", label: "bit flipped" },
    source: "ops.notes",
    slide: { index: 4, total: 5 },
  }).content,
});

push({
  group: "anthropicStat",
  label: "edge: long stat label — NEW",
  note: "Long stat label that previously wrapped to multiple lines.",
  svg: renderAnthropicStat({
    sectionId: "s5",
    heading: "Latency dominates the user perception of quality",
    caption: "Below 200ms the response feels instant; above 1s users abandon.",
    stat: {
      value: "$2.4B/yr",
      label:
        "lost revenue across the top fifty SaaS companies attributable to p99 latency over one second",
    },
    source: "saastr.com",
    slide: { index: 5, total: 5 },
  }).content,
});

// ------------------------------------------------------------------
// flowchart — process / pipeline diagram
// ------------------------------------------------------------------

const flowchartShort: PanelPlan = {
  sectionId: "f1",
  visualType: "flowchart",
  caption: "A three-step pipeline.",
  layoutHint: "horizontal",
  nodes: [
    { id: "a", label: "Ingest", subtitle: "fetch + clean", group: null, role: "start" },
    { id: "b", label: "Understand", subtitle: "extract claims", group: null, role: "normal" },
    { id: "c", label: "Render", subtitle: "draw the panel", group: null, role: "end" },
  ],
  edges: [
    { from: "a", to: "b", label: null },
    { from: "b", to: "c", label: null },
  ],
  narrativeReason: "",
} as PanelPlan;

push({
  group: "flowchart",
  label: "3 nodes horizontal — OLD",
  svg: renderFlowchart(flowchartShort),
});
push({
  group: "flowchart",
  label: "3 nodes horizontal — NEW (with chrome)",
  svg: renderFlowchart(flowchartShort, {
    heading: "The minimum-viable explainer pipeline",
    source: "readopp.app",
    slide: { index: 1, total: 5 },
  }),
});

const flowchartVertical: PanelPlan = {
  ...flowchartShort,
  sectionId: "f2",
  layoutHint: "vertical",
  nodes: [
    { id: "a", label: "Plan", subtitle: "shape the explainer", group: null, role: "start" },
    { id: "b", label: "Comprehend", subtitle: "claim extraction", group: null, role: "normal" },
    { id: "c", label: "Outline", subtitle: "section structure", group: null, role: "normal" },
    { id: "d", label: "Render", subtitle: "panel drawing", group: null, role: "normal" },
    { id: "e", label: "Assemble", subtitle: "final export", group: null, role: "end" },
  ],
  edges: [
    { from: "a", to: "b", label: null },
    { from: "b", to: "c", label: null },
    { from: "c", to: "d", label: null },
    { from: "d", to: "e", label: null },
  ],
} as PanelPlan;

push({
  group: "flowchart",
  label: "5 nodes vertical — OLD",
  svg: renderFlowchart(flowchartVertical),
});
push({
  group: "flowchart",
  label: "5 nodes vertical — NEW (with chrome)",
  svg: renderFlowchart(flowchartVertical, {
    heading: "From source to shareable carousel: the 5-stage pipeline",
    source: "readopp.app",
    slide: { index: 2, total: 5 },
  }),
});

const flowchartHeavy: PanelPlan = {
  sectionId: "f3",
  visualType: "flowchart",
  caption:
    "The end-to-end claim verification loop runs each candidate claim through six gates before it ships to the panel writer.",
  layoutHint: "vertical",
  nodes: [
    {
      id: "a",
      label: "Extract candidate claim",
      subtitle: "with span attribution",
      group: null,
      role: "start",
    },
    {
      id: "b",
      label: "Score relevance against article",
      subtitle: "embedding cosine + heuristic",
      group: null,
      role: "normal",
    },
    {
      id: "c",
      label: "Decompose into atomic sub-claims",
      subtitle: "self-consistency check",
      group: null,
      role: "normal",
    },
    {
      id: "d",
      label: "Verify each sub-claim against source",
      subtitle: "Opus citation pass",
      group: null,
      role: "normal",
    },
    {
      id: "e",
      label: "Reconcile contradictions",
      subtitle: "and merge equivalents",
      group: null,
      role: "normal",
    },
    {
      id: "f",
      label: "Emit verified claim",
      subtitle: "with confidence band",
      group: null,
      role: "end",
    },
  ],
  edges: [
    { from: "a", to: "b", label: null },
    { from: "b", to: "c", label: null },
    { from: "c", to: "d", label: null },
    { from: "d", to: "e", label: null },
    { from: "e", to: "f", label: null },
  ],
  narrativeReason: "",
} as PanelPlan;

push({
  group: "flowchart",
  label: "6 long-label nodes — OLD",
  note: "Long labels + subtitles; check wrap and arrow spacing.",
  svg: renderFlowchart(flowchartHeavy),
});
push({
  group: "flowchart",
  label: "6 long-label nodes — NEW (with chrome)",
  note: "Same content + heading + footer.",
  svg: renderFlowchart(flowchartHeavy, {
    heading: "The 6-gate claim verification loop",
    source: "engineering.notes",
    slide: { index: 4, total: 6 },
  }),
});

// ------------------------------------------------------------------
// structural — grouped nodes (architecture / system breakdown)
// ------------------------------------------------------------------

const structuralOneGroup: PanelPlan = {
  sectionId: "st1",
  visualType: "structural",
  caption: "A single column of items.",
  nodes: [
    { id: "1", label: "Cookies", subtitle: null, group: "Inputs", role: "normal" },
    { id: "2", label: "Session", subtitle: null, group: "Inputs", role: "normal" },
    { id: "3", label: "Headers", subtitle: null, group: "Inputs", role: "normal" },
  ],
  narrativeReason: "",
} as PanelPlan;

push({
  group: "structural",
  label: "1 group, 3 nodes — OLD",
  svg: renderStructural(structuralOneGroup),
});
push({
  group: "structural",
  label: "1 group, 3 nodes — NEW (with chrome)",
  note: "Heading + footer envelope via panelChrome primitives.",
  svg: renderStructural(structuralOneGroup, {
    heading: "How an explainer flows through the pipeline",
    source: "readopp.app",
    slide: { index: 3, total: 5 },
  }),
});

const structuralTwoGroups: PanelPlan = {
  sectionId: "st2",
  visualType: "structural",
  caption: "Side-by-side comparison of two regions.",
  nodes: [
    { id: "1", label: "Cookies", subtitle: null, group: "Frontend", role: "normal" },
    { id: "2", label: "JWT", subtitle: "stateless", group: "Frontend", role: "normal" },
    { id: "3", label: "Sessions", subtitle: "in Postgres", group: "Backend", role: "normal" },
    { id: "4", label: "Rate limit", subtitle: "Redis", group: "Backend", role: "normal" },
    { id: "5", label: "Audit log", subtitle: "S3", group: "Backend", role: "normal" },
  ],
  narrativeReason: "",
} as PanelPlan;

push({
  group: "structural",
  label: "2 groups — OLD",
  svg: renderStructural(structuralTwoGroups),
});
push({
  group: "structural",
  label: "2 groups — NEW (with chrome)",
  svg: renderStructural(structuralTwoGroups, {
    heading: "Frontend vs Backend responsibilities",
    source: "engineering.notes",
    slide: { index: 2, total: 5 },
  }),
});

const structuralFourGroups: PanelPlan = {
  sectionId: "st3",
  visualType: "structural",
  caption: "Four quadrants — system overview.",
  nodes: [
    { id: "a1", label: "JWT", subtitle: null, group: "Auth", role: "normal" },
    { id: "a2", label: "Session", subtitle: null, group: "Auth", role: "normal" },
    { id: "b1", label: "Postgres", subtitle: "primary", group: "Data", role: "normal" },
    { id: "b2", label: "Redis", subtitle: "cache", group: "Data", role: "normal" },
    { id: "b3", label: "S3", subtitle: "blobs", group: "Data", role: "normal" },
    { id: "c1", label: "Stripe", subtitle: null, group: "Billing", role: "normal" },
    { id: "d1", label: "PostHog", subtitle: null, group: "Telemetry", role: "normal" },
    { id: "d2", label: "Sentry", subtitle: null, group: "Telemetry", role: "normal" },
  ],
  narrativeReason: "",
} as PanelPlan;

push({
  group: "structural",
  label: "4 groups — 2x2 grid",
  svg: renderStructural(structuralFourGroups),
});

const structuralOverflow: PanelPlan = {
  sectionId: "st4",
  visualType: "structural",
  caption: "Edge case: long labels + max nodes per group.",
  nodes: [
    { id: "1", label: "OpenTelemetry propagators", subtitle: "w3c traceparent", group: "Observability", role: "normal" },
    { id: "2", label: "Distributed structured logging", subtitle: "Pino + OTLP", group: "Observability", role: "normal" },
    { id: "3", label: "Prometheus + Grafana", subtitle: "scrape jobs", group: "Observability", role: "normal" },
    { id: "4", label: "Multi-region failover", subtitle: "active/active", group: "Resilience", role: "normal" },
    { id: "5", label: "Circuit breakers", subtitle: "Hystrix-style", group: "Resilience", role: "normal" },
    { id: "6", label: "Saga orchestration", subtitle: "compensations", group: "Resilience", role: "normal" },
  ],
  narrativeReason: "",
} as PanelPlan;

push({
  group: "structural",
  label: "long labels — OLD",
  note: "Labels that should clip or wrap; subtitles compete for room.",
  svg: renderStructural(structuralOverflow),
});
push({
  group: "structural",
  label: "long labels — NEW (with chrome)",
  note: "Same input, with heading + footer.",
  svg: renderStructural(structuralOverflow, {
    heading:
      "Observability and resilience are the two halves of system reliability work",
    source: "infra.notes",
    slide: { index: 4, total: 6 },
  }),
});

// ------------------------------------------------------------------
// timeline
// ------------------------------------------------------------------

const timelineShort: PanelPlan = {
  sectionId: "t1",
  visualType: "timeline",
  caption: "Three milestones.",
  timeline: [
    { when: "1948", what: "Shannon publishes the foundational paper." },
    { when: "1956", what: "Dartmouth workshop coins “artificial intelligence”." },
    { when: "2017", what: '"Attention is all you need" lands the transformer.' },
  ],
  narrativeReason: "",
} as PanelPlan;

push({
  group: "timeline",
  label: "3 entries — OLD",
  svg: renderTimeline(timelineShort),
});
push({
  group: "timeline",
  label: "3 entries — NEW (with chrome)",
  svg: renderTimeline(timelineShort, {
    heading: "Three moments that defined modern AI",
    source: "ai-history.com",
    slide: { index: 2, total: 5 },
  }),
});

const timelineLong: PanelPlan = {
  sectionId: "t2",
  visualType: "timeline",
  caption: "Six entries with longer descriptions.",
  timeline: [
    { when: "1948", what: "Shannon publishes A Mathematical Theory of Communication." },
    { when: "1956", what: "Dartmouth workshop coins the term artificial intelligence." },
    { when: "1986", what: "Backprop comes of age via Rumelhart, Hinton & Williams." },
    { when: "2012", what: "AlexNet wins ImageNet, kicking off the deep-learning boom." },
    { when: "2017", what: "Vaswani et al. publish the transformer architecture." },
    { when: "2022", what: "ChatGPT crosses 100M users in two months." },
  ],
  narrativeReason: "",
} as PanelPlan;

push({
  group: "timeline",
  label: "6 entries — OLD",
  svg: renderTimeline(timelineLong),
});
push({
  group: "timeline",
  label: "6 entries — NEW (with chrome)",
  svg: renderTimeline(timelineLong, {
    heading: "How the field actually arrived at the transformer era",
    source: "ai-history.com",
    slide: { index: 3, total: 6 },
  }),
});

const timelineOverflow: PanelPlan = {
  sectionId: "t3",
  visualType: "timeline",
  caption: "Edge case: very long descriptions that span multiple lines.",
  timeline: [
    {
      when: "Q1 2024",
      what: "Engineering bootstrapped the new ingest pipeline by adding a small dedicated ingest worker, a queue, and a retry policy that backed off exponentially with a 60-second ceiling, finally killing the legacy synchronous fetcher.",
    },
    {
      when: "Q2 2024",
      what: "The team rolled out automatic semantic chunking for long-form input — paragraphs longer than 1,200 tokens were split at sentence boundaries with 80-token overlaps to preserve context across chunk seams.",
    },
    {
      when: "Q4 2024",
      what: "Comprehension migrated from Claude 3 Sonnet to Claude 4 Sonnet 1M-context, eliminating the chunk-stitch reconciliation pass entirely and dropping median ingest-to-explainer latency from 47 to 19 seconds.",
    },
  ],
  narrativeReason: "",
} as PanelPlan;

push({
  group: "timeline",
  label: "long descriptions — OLD",
  svg: renderTimeline(timelineOverflow),
});
push({
  group: "timeline",
  label: "long descriptions — NEW (with chrome)",
  svg: renderTimeline(timelineOverflow, {
    heading: "How the ingest pipeline evolved over 2024",
    source: "engineering.notes",
    slide: { index: 5, total: 7 },
  }),
});

// ------------------------------------------------------------------
// metaphors — sample 4 of the most common kinds
// ------------------------------------------------------------------

function metaphorPlan(kind: string, items: string[], hub?: string): PanelPlan {
  return {
    sectionId: `m-${kind}`,
    visualType: "metaphor",
    caption: `${kind} visualization.`,
    metaphor: {
      kind: kind as never,
      poles: [],
      items: items.map((name) => ({ name, sub: null, icon: null })),
      hub: hub ? { name: hub, sub: null, icon: null } : null,
      flow: "out",
      outcome: null,
      hint: null,
    },
    narrativeReason: "",
  } as PanelPlan;
}

// ------------------------------------------------------------------
// All 26 metaphor kinds, one test plan per kind. Each renderer reads
// the fields it cares about and ignores the rest — so we feed a
// "kitchen sink" plan with poles + items + hub + outcome and let each
// metaphor pick the fields it needs. This is the audit signal for
// Phase 2E.2a: which metaphors faithfully surface items[] vs which
// silently drop them (the iceberg bug we already found).
// ------------------------------------------------------------------

const ALL_METAPHORS: Array<{
  kind: string;
  items: string[];
  itemSubs?: (string | null)[];
  poles?: [string, string];
  poleSubs?: [string | null, string | null];
  hub?: string;
  outcome?: string;
  hint?: string;
}> = [
  // Duality / tension
  { kind: "iceberg", items: ["Onboarding"], poles: ["Sticker price", "True cost"], poleSubs: ["$99/mo on the invoice", "$420/mo all-in"], hint: "76%" },
  { kind: "bridge", items: ["Refactor", "Tests", "Migration"], poles: ["Legacy monolith", "Modular services"] },
  { kind: "scale", items: ["Trust", "Speed", "Cost"], poles: ["Velocity", "Quality"] },
  { kind: "tug_of_war", items: ["Marketing", "Sales", "Support"], poles: ["Growth", "Profit"] },
  { kind: "spectrum", items: ["MVP", "Beta", "GA", "Enterprise"], poles: ["Scrappy", "Polished"] },
  // Sequence
  { kind: "mountain", items: ["Discovery", "Design", "Build", "Ship", "Scale"], outcome: "Product-market fit" },
  { kind: "staircase", items: ["Read", "Practice", "Apply", "Teach"] },
  { kind: "garden", items: ["Seed", "Sprout", "Bloom", "Harvest"] },
  { kind: "domino", items: ["First win", "Momentum", "Network effect", "Default choice"] },
  { kind: "weaving", items: ["Research", "Engineering", "Design", "Marketing"], outcome: "Coherent product" },
  // Many-to-one
  { kind: "confluence", items: ["Telemetry", "Support tickets", "Sales calls", "User research"], hub: "Roadmap" },
  { kind: "funnel", items: ["Visitors", "Signups", "Trials", "Paid"], hub: "Retained users" },
  // One-to-many
  { kind: "branching", items: ["Email", "Slack", "LinkedIn", "X"], hub: "One announcement" },
  { kind: "ripple", items: ["Team A", "Team B", "Team C"], hub: "Founder decision" },
  { kind: "crossroads", items: ["Build", "Buy", "Partner"], hub: "The next 90 days" },
  // Focus
  { kind: "lighthouse", items: ["Hot-take news", "Vanity metrics", "Office politics", "Slack noise"], hub: "True customer need" },
  { kind: "spotlight", items: ["Other quarters", "Other teams", "Other projects"], hub: "Q4 retention" },
  { kind: "orbits", items: ["Friends", "Customers", "Investors", "Press"], hub: "Founder time" },
  // Cycle
  { kind: "loop", items: ["Observe", "Orient", "Decide", "Act"] },
  { kind: "tide", items: ["Boom", "Bubble", "Bust", "Recovery"] },
  { kind: "engine", items: ["Fuel", "Compression", "Spark", "Exhaust"], outcome: "Forward motion" },
  { kind: "gears", items: ["Marketing", "Sales", "Onboarding", "Retention"] },
  // Stack / hierarchy
  { kind: "layers", items: ["Application", "Framework", "Runtime", "OS", "Hardware"] },
  { kind: "pyramid", items: ["Vision", "Strategy", "Tactics", "Execution"] },
  // Spatial
  { kind: "compass", items: ["Innovate", "Operate", "Cultivate", "Negotiate"] },
  { kind: "maze", items: ["Wrong turn 1", "Wrong turn 2", "Wrong turn 3"], outcome: "The exit" },
  // Phase 2E.2d new metaphors
  {
    kind: "quadrant",
    items: ["Hidden gems", "Stars", "Question marks", "Cash cows"],
    poles: ["Market growth", "Market share"],
    poleSubs: ["low → high", "low → high"],
  },
  {
    kind: "paradox",
    items: [],
    poles: ["Faster shipping makes us safer", "Faster shipping makes us riskier"],
    poleSubs: [
      "Anyone who's worked on velocity assumes more deploys = more bugs caught earlier.",
      "Past a threshold, each extra deploy actually reduces review attention per change.",
    ],
    outcome: "until",
  },
  {
    kind: "onion",
    items: ["Symptom", "Root cause", "Underlying belief", "First principle"],
    outcome: "Truth",
  },
  {
    kind: "tipping_point",
    items: [
      "Stress",
      "Tight deadline",
      "Bad sleep",
      "Conflicting priorities",
      "One more meeting",
    ],
    outcome: "Burnout",
    hint: "Capacity",
  },
];

for (const m of ALL_METAPHORS) {
  const plan = {
    sectionId: `m-${m.kind}`,
    visualType: "metaphor",
    caption: `${m.kind} test render.`,
    metaphor: {
      kind: m.kind as never,
      poles: m.poles
        ? [
            {
              label: m.poles[0],
              sub: m.poleSubs?.[0] ?? null,
              icon: null,
            },
            {
              label: m.poles[1],
              sub: m.poleSubs?.[1] ?? null,
              icon: null,
            },
          ]
        : [],
      items: m.items.map((name, i) => ({
        name,
        sub: m.itemSubs?.[i] ?? null,
        icon: null,
      })),
      hub: m.hub ? { name: m.hub, sub: null, icon: null } : null,
      flow: "out",
      outcome: m.outcome
        ? { name: m.outcome, sub: null, icon: null }
        : null,
      hint: m.hint ?? null,
    },
    narrativeReason: "",
  } as PanelPlan;

  push({
    group: `metaphor:${m.kind}`,
    label: `${m.items.length} items${m.hub ? " + hub" : ""}${m.outcome ? " + outcome" : ""}${m.poles ? " + poles" : ""}`,
    svg: renderMetaphor(plan, {
      heading: m.outcome
        ? `${capitalize(m.kind.replace(/_/g, " "))} → ${m.outcome}`
        : m.hub
          ? `${capitalize(m.kind.replace(/_/g, " "))} into ${m.hub}`
          : `${capitalize(m.kind.replace(/_/g, " "))} — sample render`,
      source: "audit.notes",
      slide: { index: 1, total: 5 },
    }),
  });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ------------------------------------------------------------------
// Genre / articulation templates already in the codebase but missed
// in the first audit pass: quote_card, key_findings, definition_card,
// chart (bar/donut/line). These cover content shapes the planner can
// already pick — including them tells us what we ALREADY have before
// we design new templates.
// ------------------------------------------------------------------

const quoteShort: PanelPlan = {
  sectionId: "q1",
  visualType: "quote_card",
  caption: "",
  quoteCard: {
    text: "Attention is the scarce input, not information.",
    attribution: "Herbert Simon",
    context: "1971",
  },
  narrativeReason: "",
} as PanelPlan;
push({ group: "quote_card", label: "short", svg: renderGenrePanel(quoteShort) });

const quoteLong: PanelPlan = {
  sectionId: "q2",
  visualType: "quote_card",
  caption: "",
  quoteCard: {
    text: "The most expensive choice is rarely the one that costs the most money; it is almost always the one that costs the most attention.",
    attribution: "Cal Newport",
    context: "Deep Work, Chapter 3",
  },
  narrativeReason: "",
} as PanelPlan;
push({ group: "quote_card", label: "long quote", svg: renderGenrePanel(quoteLong) });

const findingsShort: PanelPlan = {
  sectionId: "kf1",
  visualType: "key_findings",
  caption: "",
  keyFindings: {
    label: "KEY FINDINGS",
    findings: [
      { title: "Automatic approval works.", detail: "93% of safe prompts approved without human input.", figure: "93%" },
      { title: "Reviewers catch more.", detail: "Caught-rate on remaining 7% jumps from 31% → 84%.", figure: "84%" },
      { title: "Latency drops.", detail: "Median time-to-decision improved by 5×.", figure: "5×" },
    ],
  },
  narrativeReason: "",
} as PanelPlan;
push({ group: "key_findings", label: "3 findings", svg: renderGenrePanel(findingsShort) });

const findingsLong: PanelPlan = {
  sectionId: "kf2",
  visualType: "key_findings",
  caption: "",
  keyFindings: {
    label: "WHAT THE DATA SHOWS",
    findings: [
      { title: "Time per approval collapsed.", detail: "Median dropped from 22 seconds to 4 seconds across all reviewers.", figure: "5.5×" },
      { title: "But errors doubled.", detail: "Dangerous prompts approved under fatigue grew from a 4% rate to 9%.", figure: "2.1×" },
      { title: "Reviewer agreement fell.", detail: "Inter-rater agreement on the same prompt dropped from 0.78 to 0.51.", figure: "−35%" },
      { title: "Override usage rose.", detail: "Auto-approve overrides — once <1% — climbed to 6.4% of decisions.", figure: "6.4%" },
    ],
  },
  narrativeReason: "",
} as PanelPlan;
push({ group: "key_findings", label: "4 findings — overflow test", svg: renderGenrePanel(findingsLong) });

const definitionShort: PanelPlan = {
  sectionId: "d1",
  visualType: "definition_card",
  caption: "",
  definitionCard: {
    term: "Approval fatigue",
    kicker: "noun · /əˈpruːvəl fəˈtiːɡ/",
    definition:
      "The psychological state where high-frequency, low-stakes approval prompts erode reviewer attention until they reflexively approve everything.",
    analogy:
      "Think of it like a doorbell that rings every six seconds — you stop checking who's there.",
  },
  narrativeReason: "",
} as PanelPlan;
push({ group: "definition_card", label: "short", svg: renderGenrePanel(definitionShort) });

const definitionLong: PanelPlan = {
  sectionId: "d2",
  visualType: "definition_card",
  caption: "",
  definitionCard: {
    term: "Active-active replication",
    kicker: "noun · infrastructure",
    definition:
      "A data-replication topology where two or more independent clusters accept writes simultaneously and continuously converge their state via conflict-free replicated data structures or last-write-wins reconciliation.",
    analogy:
      "Think of it like two people taking notes during the same meeting and then merging their notes — both records are real, neither is primary.",
  },
  narrativeReason: "",
} as PanelPlan;
push({ group: "definition_card", label: "long — overflow test", svg: renderGenrePanel(definitionLong) });

const chartBar: PanelPlan = {
  sectionId: "ch1",
  visualType: "chart",
  caption: "Approvals by reviewer tier.",
  chart: {
    kind: "bar",
    title: "Approvals per reviewer per shift",
    xLabel: "reviewer tier",
    yLabel: "approvals",
    series: [
      {
        name: "Approvals",
        color: "blue",
        points: [
          { label: "T1", value: 18 },
          { label: "T2", value: 34 },
          { label: "T3", value: 61 },
          { label: "T4", value: 92 },
        ],
      },
    ],
  },
  narrativeReason: "",
} as PanelPlan;
push({ group: "chart", label: "bar — 4 cols", svg: renderGenrePanel(chartBar) });

const chartDonut: PanelPlan = {
  sectionId: "ch2",
  visualType: "chart",
  caption: "Origins of approved-but-unsafe prompts.",
  chart: {
    kind: "donut",
    title: "Where the bad prompts came from",
    series: [
      {
        color: "amber",
        points: [
          { label: "Internal users", value: 41 },
          { label: "Bot accounts", value: 28 },
          { label: "External API", value: 19 },
          { label: "Other", value: 12 },
        ],
      },
    ],
  },
  narrativeReason: "",
} as PanelPlan;
push({ group: "chart", label: "donut — 4 segments", svg: renderGenrePanel(chartDonut) });

const chartLine: PanelPlan = {
  sectionId: "ch3",
  visualType: "chart",
  caption: "Time-per-decision after rollout.",
  chart: {
    kind: "line",
    title: "Median time-per-decision (seconds)",
    xLabel: "week",
    yLabel: "seconds",
    series: [
      {
        name: "Manual",
        color: "gray",
        points: [
          { label: "W1", value: 22 },
          { label: "W2", value: 21 },
          { label: "W3", value: 19 },
          { label: "W4", value: 18 },
        ],
      },
      {
        name: "Auto-mode",
        color: "blue",
        points: [
          { label: "W1", value: 14 },
          { label: "W2", value: 9 },
          { label: "W3", value: 6 },
          { label: "W4", value: 4 },
        ],
      },
    ],
  },
  narrativeReason: "",
} as PanelPlan;
push({ group: "chart", label: "line — 2 series", svg: renderGenrePanel(chartLine) });

// ------------------------------------------------------------------
// Emit files + index
// ------------------------------------------------------------------

let writtenCount = 0;
let nullCount = 0;
const rows: string[] = [];

for (const c of cases) {
  const safeName = `${c.group.replace(/[^a-z0-9]+/gi, "-")}__${c.label
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()}.svg`;
  if (c.svg) {
    writeFileSync(join(OUT_DIR, safeName), c.svg, "utf8");
    writtenCount++;
    rows.push(`
      <figure>
        <figcaption>
          <strong>${c.group}</strong>
          <span>${c.label}</span>
          ${c.note ? `<small>${escape(c.note)}</small>` : ""}
        </figcaption>
        <div class="panel">
          <object data="${safeName}" type="image/svg+xml" aria-label="${c.group}: ${c.label}"></object>
        </div>
      </figure>`);
  } else {
    nullCount++;
    rows.push(`
      <figure class="null">
        <figcaption>
          <strong>${c.group}</strong>
          <span>${c.label}</span>
          <small>renderer returned null</small>
        </figcaption>
        <div class="panel"><em>(no SVG)</em></div>
      </figure>`);
  }
}

const indexHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Readopp panel-quality audit</title>
  <style>
    :root { color-scheme: light; }
    body { background: #1a1a1a; color: #FAF9F5; font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 32px; }
    h1 { font-weight: 500; letter-spacing: -0.02em; margin: 0 0 8px; }
    p.lead { color: #7A6F62; margin: 0 0 32px; max-width: 640px; }
    .stats { color: #7A6F62; margin: 0 0 24px; font-size: 14px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 24px; }
    figure { margin: 0; background: #2a2a2a; border-radius: 8px; overflow: hidden; }
    figcaption { padding: 12px 16px; border-bottom: 1px solid #3a3a3a; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    figcaption strong { color: #FAF9F5; }
    figcaption span { color: #C7613D; }
    figcaption small { color: #7A6F62; width: 100%; margin-top: 2px; font-size: 12px; }
    .panel { background: #FAF9F5; padding: 12px; }
    .panel object { width: 100%; display: block; }
    figure.null { opacity: 0.5; }
    figure.null .panel { padding: 32px; text-align: center; color: #7A6F62; }
  </style>
</head>
<body>
  <h1>Readopp panel-quality audit</h1>
  <p class="lead">Phase 1 baseline — every template rendered at short / medium / long / edge-case inputs.</p>
  <p class="stats">${writtenCount} panels emitted, ${nullCount} returned null.</p>
  <div class="grid">${rows.join("\n")}</div>
</body>
</html>`;

writeFileSync(join(OUT_DIR, "index.html"), indexHtml, "utf8");

console.log(`Wrote ${writtenCount} SVG${writtenCount === 1 ? "" : "s"} (${nullCount} null) to ${OUT_DIR}`);
console.log(`Open ${join(OUT_DIR, "index.html")} in a browser.`);

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
