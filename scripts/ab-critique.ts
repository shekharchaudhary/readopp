/**
 * A/B test for the vision-critique loop.
 *
 * Renders the same set of LLM-path PanelPlans twice — once with critique
 * disabled (baseline = current production behavior) and once with
 * critique enabled (treatment = 1 baseline + up to 2 critique-driven
 * retries). Writes both SVGs + critique scores side-by-side into an HTML
 * report so we can eyeball whether the loop actually moves quality.
 *
 * Only annotated_hero plans are exercised — they always fall through to
 * the Opus draw path (no deterministic template intercepts them) and
 * have the most visual variance, which is precisely where critique
 * should pay off the most.
 *
 *   npx tsx scripts/ab-critique.ts
 *
 * Costs real tokens. With critique enabled, each panel can fire up to
 * 3× Opus draws + 3× Sonnet vision critiques (~$0.30–0.90 per panel
 * upper-bound, more typically ~$0.30–0.45).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Inline .env.local loader so the script runs without dotenv. Same
// pattern as smoke-test-pipeline.ts.
loadEnvFile(join(process.cwd(), ".env.local"));

function loadEnvFile(path: string) {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    if (key in process.env) continue;
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

import { renderPanel } from "../lib/pipeline/render";
import type { PanelPlan, RenderedPanel } from "../lib/shared/schemas";

const OUT_DIR = join(process.cwd(), "tmp", "ab-critique");
mkdirSync(OUT_DIR, { recursive: true });

interface Trial {
  label: string;
  heading: string;
  plan: PanelPlan;
}

function heroPlan(
  sectionId: string,
  caption: string,
  hero: NonNullable<PanelPlan["annotatedHero"]>
): PanelPlan {
  return {
    sectionId,
    visualType: "annotated_hero",
    caption,
    annotatedHero: hero,
    narrativeReason: "AB test case — annotated hero variance",
  };
}

// Five planned cases that cover different visual challenges. All
// annotated_hero so they hit the LLM draw path deterministically.
const TRIALS: Trial[] = [
  {
    label: "smartphone-app",
    heading: "How a chat app routes a message",
    plan: heroPlan(
      "s1",
      "Tap to send and the message rides through four hops before it lights up the other person's screen.",
      {
        subject: "smartphone showing chat app with message bubble",
        subjectHint: "centered, large enough to anchor the panel",
        annotations: [
          { targetHint: "outgoing message bubble", label: "1. Compose", sub: "Local draft" },
          { targetHint: "phone antenna", label: "2. Send", sub: "Over LTE/Wi-Fi" },
          { targetHint: "cloud above phone", label: "3. Relay", sub: "Server routing" },
          { targetHint: "recipient's screen", label: "4. Deliver", sub: "Push + render" },
        ],
      }
    ),
  },
  {
    label: "iceberg-leadership",
    heading: "What good leadership actually looks like",
    plan: heroPlan(
      "s2",
      "The decisions you see are a fraction of the work — listening, modeling, weighing tradeoffs sits below the waterline.",
      {
        subject: "iceberg cross-section with waterline visible",
        subjectHint: "cool blues; clear horizontal waterline at the 30% mark",
        annotations: [
          { targetHint: "tip above water", label: "Decisions" },
          { targetHint: "just below waterline", label: "Listening" },
          { targetHint: "middle depth", label: "Modeling" },
          { targetHint: "deep base", label: "Weighing tradeoffs" },
        ],
      }
    ),
  },
  {
    label: "growth-chart",
    heading: "Three inflection points",
    plan: heroPlan(
      "s3",
      "The S-curve looks smooth in hindsight — but the team felt three distinct shifts that bent the line.",
      {
        subject: "S-curve growth chart with three labeled inflection points",
        annotations: [
          { targetHint: "first inflection (early)", label: "PMF", sub: "Q2" },
          { targetHint: "middle steepening", label: "Distribution", sub: "Q3" },
          { targetHint: "upper flattening", label: "Saturation", sub: "Q4" },
        ],
      }
    ),
  },
  {
    label: "coffee-anatomy",
    heading: "Where the flavor actually comes from",
    plan: heroPlan(
      "s4",
      "A pour-over isn't magic — it's four variables you control at the dripper.",
      {
        subject: "pour-over coffee dripper cross-section",
        subjectHint: "vertical orientation, water flowing top to bottom",
        annotations: [
          { targetHint: "water at top", label: "Water temp", sub: "92–96°C" },
          { targetHint: "filter walls", label: "Grind size", sub: "Medium-fine" },
          { targetHint: "coffee bed", label: "Bloom", sub: "30s, 2× weight" },
          { targetHint: "drip at bottom", label: "Pour rate", sub: "Steady spiral" },
        ],
      }
    ),
  },
  {
    label: "neural-net",
    heading: "What a transformer actually does",
    plan: heroPlan(
      "s5",
      "Tokens go in, attention shuffles them, and out comes the next token — a loop you run again and again.",
      {
        subject: "simplified transformer block with input tokens and attention arrows",
        subjectHint: "left-to-right flow, clean horizontal layout",
        annotations: [
          { targetHint: "token row on left", label: "Tokenize" },
          { targetHint: "embedding cells", label: "Embed" },
          { targetHint: "attention crossover arrows", label: "Attend" },
          { targetHint: "output token on right", label: "Predict" },
        ],
      }
    ),
  },
];

interface Run {
  panel: RenderedPanel;
  ms: number;
}

async function runOnce(
  plan: PanelPlan,
  heading: string,
  critique: boolean
): Promise<Run> {
  const start = Date.now();
  const panel = await renderPanel(
    plan,
    "general",
    heading,
    undefined,
    { source: "Readopp Lab", slide: { index: 1, total: 1 } },
    { critique }
  );
  return { panel, ms: Date.now() - start };
}

interface PairResult {
  label: string;
  baseline: Run;
  treatment: Run;
}

async function main() {
  const results: PairResult[] = [];
  for (const t of TRIALS) {
    console.log(`\n[${t.label}] baseline (no critique)…`);
    const baseline = await runOnce(t.plan, t.heading, false);
    console.log(
      `  └─ ${baseline.ms}ms · ${baseline.panel.format} · fallback=${baseline.panel.fallback}`
    );
    console.log(`[${t.label}] treatment (critique on)…`);
    const treatment = await runOnce(t.plan, t.heading, true);
    console.log(
      `  └─ ${treatment.ms}ms · ${treatment.panel.format} · fallback=${treatment.panel.fallback}` +
        (treatment.panel.critique
          ? ` · overall=${treatment.panel.critique.overall.toFixed(2)} · pass=${treatment.panel.critique.pass}`
          : "")
    );
    results.push({ label: t.label, baseline, treatment });
  }

  const html = buildReport(results);
  const out = join(OUT_DIR, "index.html");
  writeFileSync(out, html);
  console.log(`\nReport: ${out}`);
}

function buildReport(results: PairResult[]): string {
  const rows = results.map((r) => renderRow(r)).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Vision-critique A/B</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; background: #F6F4ED; color: #1A1A1A; margin: 0; padding: 32px; }
  h1 { font-weight: 500; letter-spacing: -0.02em; margin: 0 0 24px; }
  .meta { color: #6b6b6b; font-size: 13px; margin-bottom: 32px; }
  .pair { background: white; border: 1px solid #e8e4d8; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
  .pair h2 { margin: 0 0 16px; font-size: 16px; font-weight: 500; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .col { border: 1px solid #ede9dc; border-radius: 8px; padding: 14px; background: #FFFEF7; }
  .col h3 { margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #8a8a8a; font-weight: 600; }
  .panel { background: white; border: 1px solid #e8e4d8; border-radius: 6px; padding: 8px; }
  .panel svg { display: block; max-width: 100%; height: auto; }
  .meta-row { font-size: 12px; color: #6b6b6b; margin-top: 10px; display: flex; gap: 16px; flex-wrap: wrap; }
  .pass { color: #1f7a3a; font-weight: 600; }
  .fail { color: #b03a2e; font-weight: 600; }
  .scores { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 11px; margin-top: 8px; line-height: 1.6; }
  .issues { font-size: 12px; color: #555; margin-top: 8px; padding-left: 18px; }
  .suggestion { font-size: 12px; color: #1a1a1a; margin-top: 8px; padding: 8px 10px; background: #fff8e1; border-left: 3px solid #c89b2c; border-radius: 0 4px 4px 0; }
</style>
</head>
<body>
<h1>Vision-critique loop · A/B</h1>
<p class="meta">Each row renders the same PanelPlan twice. Baseline runs the legacy 2-attempt structural-only loop; treatment runs up to 3 attempts with vision critique between them. Same Opus model both sides.</p>
${rows}
</body>
</html>`;
}

function renderRow(r: PairResult): string {
  return `<div class="pair">
  <h2>${escape(r.label)}</h2>
  <div class="cols">
    ${renderCol("baseline (no critique)", r.baseline)}
    ${renderCol("treatment (critique on)", r.treatment)}
  </div>
</div>`;
}

function renderCol(title: string, run: Run): string {
  const c = run.panel.critique;
  const scores = c
    ? `<div class="scores">
        hierarchy:&nbsp;&nbsp;&nbsp;${c.scores.hierarchy}/5<br>
        alignment:&nbsp;&nbsp;&nbsp;${c.scores.alignment}/5<br>
        density:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${c.scores.density}/5<br>
        readability:&nbsp;${c.scores.readability}/5<br>
        narrativeFit:&nbsp;${c.scores.narrativeFit}/5<br>
        <strong>overall: ${c.overall.toFixed(2)} · ${c.pass ? '<span class="pass">PASS</span>' : '<span class="fail">FAIL</span>'}</strong>
      </div>`
    : "";
  const issues =
    c && c.issues.length > 0
      ? `<ul class="issues">${c.issues.map((i) => `<li>${escape(i)}</li>`).join("")}</ul>`
      : "";
  const suggestion =
    c && c.suggestion
      ? `<div class="suggestion"><strong>Suggestion:</strong> ${escape(c.suggestion)}</div>`
      : "";
  return `<div class="col">
    <h3>${escape(title)}</h3>
    <div class="panel">${run.panel.content}</div>
    <div class="meta-row">
      <span>${run.ms}ms</span>
      <span>${run.panel.format}</span>
      ${run.panel.fallback ? '<span class="fail">fallback</span>' : ""}
    </div>
    ${scores}
    ${issues}
    ${suggestion}
  </div>`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
