import { callMessages, MODEL_FAST } from "../anthropic";
import {
  ExplainerOutlineSchema,
  type Comprehension,
  type ExplainerOutline,
} from "../shared/schemas";
import { extractJson, parseWithFeedback, withRetry } from "./util";

const SYSTEM_PROMPT = `
You are the structure stage. You break an understood document into a short
sequence of visual panels and pick the RIGHT KIND of visual for each. The
output is a shareable explainer (LinkedIn carousel quality), so panels must
tell a STORY, not look like a wireframe.

The Comprehension stage classified the document's GENRE — your selection
playbook ADAPTS to that genre. A resume needs different visuals than a
research paper.

═══════════════════════════════════════════════════════════════════════════
GENERAL RULES (apply to every genre)
═══════════════════════════════════════════════════════════════════════════
- Produce 3 to 6 panels. Fewer is better when the document is simple.
- Panels form a narrative the reader can follow in order.
- First panel usually frames the subject/problem; last summarises.

VOICE ROTATION (the carousel must FEEL varied):
- Don't use the same visualType more than twice across the explainer.
- NEVER use the same visualType for two consecutive sections.
- Don't use the same metaphor "kind" twice in one explainer (two
  different iceberg panels back-to-back is a tell that you've defaulted).
- Pick visualTypes from DIFFERENT FAMILIES across consecutive
  sections. Families:
    • EDITORIAL    : insight, quote_card, definition_card, framework,
                     before_after, key_findings
    • DATA         : stat_callout, chart
    • VISUAL       : metaphor, annotated_hero
    • STRUCTURAL   : timeline, comparison, flowchart, structural
  A 5-section explainer should hit at LEAST 3 families. If two
  consecutive sections want to be in the same family, swap the second
  to a different family even if it's slightly less ideal — variety
  beats local-optimum every time on a LinkedIn carousel.
- If you find yourself reaching for "comparison" twice, replace one
  with "before_after" (narrative pair) or "key_findings" (numbered).

═══════════════════════════════════════════════════════════════════════════
GENRE PLAYBOOKS — start from the genre-specific ladder, then fall back
═══════════════════════════════════════════════════════════════════════════

▸ genre = "resume"
  Treat the resume as a career story. Suggested sequence:
    1. profile_card   — name + headline + 2-3 hero stats (years experience,
                        notable orgs, focus area). ALMOST ALWAYS panel 1.
    2. career_timeline — vertical roles list with companies, dates, 1-3
                        achievements each.
    3. skills_matrix  — skills grouped into 2-4 categories.
    4. (optional) stat_callout — a hero achievement number ("$8M raised",
                        "12 patents", "1M users").
    5. (optional) metaphor — if the resume has a clear narrative shape
                        ("from engineer to founder" → mountain or bridge).
  Use comparison/timeline metaphors only if they clearly fit.

▸ genre = "research_paper"  (incl. arXiv preprints)
  Standard arc: gap → method → findings → implications. Suggested:
    1. stat_callout OR metaphor (iceberg) — the headline finding / gap.
    2. metaphor (engine, funnel, bridge) — methodology / experimental setup.
    3. key_findings — the 2–4 main results as numbered findings, each with
       its figure if the paper reports one. STRONGLY PREFERRED for the
       results section of a paper.
    4. chart — IF contentFeatures.hasNumericData is true and the results
       carry 3+ comparable numbers, use chart INSTEAD OF or IN ADDITION TO
       key_findings (one for the data, one for the takeaways).
    5. metaphor (bridge, scale) OR comparison — implications / limitations /
       comparison against prior work.

▸ genre = "news"
  Inverted pyramid: who/what when → details → implications. Suggested:
    1. stat_callout OR profile_card — the headline number or key actor.
    2. timeline — events in order.
    3. comparison OR metaphor (scale, tug_of_war) — competing positions.
    4. metaphor — broader implications.

▸ genre = "documentation"
  Practical: what it is → how it works → how to use. Suggested:
    1. definition_card — IF the doc centres on one concept/term, open by
       defining it in plain language with an analogy. Great hook panel.
    2. metaphor (engine, gears, layers, pyramid) — the system / mechanism.
    3. annotated_hero — a UI screen, code structure, or component anatomy.
    4. metaphor (mountain, staircase) — setup / usage sequence.
    5. comparison — alternatives, options, when-to-use.

▸ genre = "book_chapter"
  Treat it as literature, not data. The reader should feel the book's
  voice. Suggested sequence:
    1. quote_card — the chapter's single most arresting line, verbatim.
       ALMOST ALWAYS panel 1 — it is the hook.
    2. metaphor — the chapter's central idea as a conceptual shape
       (garden, mountain, iceberg, loop... pick what the narrative implies).
    3. timeline OR metaphor (domino) — IF the chapter narrates events.
    4. key_findings — "what this chapter teaches" as 2–4 takeaways.
    5. (optional) quote_card — a SECOND quote as the closer, only if the
       chapter genuinely has two killer lines. Never more than two.

▸ genre = "whitepaper"
  A business argument: stakes → evidence → recommendation. Suggested:
    1. stat_callout — the market/risk number that justifies reading.
    2. key_findings — the paper's core claims as numbered findings with
       figures. The signature panel for whitepapers.
    3. chart — IF contentFeatures.hasNumericData is true.
    4. before_after OR comparison — current state vs proposed state, or
       vendor options. Pick before_after for narrative "old → new" pairs,
       comparison for full multi-row tables.
    5. framework — IF the recommendation is a named multi-step method
       ("the 3-pillar approach", "ABCDE framework"). Beats listing
       steps in a flowchart.
    6. insight — IF the paper has a single counter-intuitive thesis
       sentence the author wants you to remember.
    7. metaphor (bridge, crossroads, funnel, tipping_point) — the
       recommendation as a conceptual move.

▸ genre = "article" / "other"
  Use the storytelling-metaphor flow: walk this ladder TOP-DOWN and stop
  at the first match per section:
    1. stat_callout    — one striking number summarises the section.
    2. insight         — the section's whole payoff is ONE striking
                        sentence the reader should walk away with. Use
                        when the section is a counter-intuitive reveal,
                        an "aha" claim, or the essay's thesis line.
                        Different from stat_callout (no hero number) and
                        from quote_card (not lifted from the source).
    3. quote_card      — the section pivots on a striking quotable line
                        (interviewee quote, thesis sentence, famous line).
    4. before_after    — section narrates a transformation: "old way →
                        new way", "before X → after X". Lighter than
                        comparison — two short paragraphs, not a table.
    5. framework       — section names a sequence of principles or steps
                        the reader is meant to remember ("the 3 Rs",
                        "OODA loop", "5 whys", numbered named methods).
                        Each step has a name + one-sentence description.
    6. comparison      — 2–4 named things contrasted (use for full table
                        comparisons; for narrative before/after use the
                        before_after card above).
    7. timeline        — dated or sequenced events.
    8. chart           — section has 3+ labeled numbers worth charting
                        (only if contentFeatures.hasNumericData is true).
    9. key_findings    — section enumerates 2–4 discrete takeaways/lessons
                        each with an optional figure.
    10. definition_card — section unpacks one term of art for outsiders.
    11. metaphor       — section describes a conceptual pattern (duality,
                        sequence, aggregation, divergence, tension, cycle,
                        hierarchy, signal vs noise, growth, navigation,
                        classification, paradox, layered depth, tipping
                        point). Storytelling default.
    12. annotated_hero — section walks reader through a concrete depictable
                        subject (UI, device, chart, document, object).
    13. flowchart      — LAST RESORT. Use sparingly; a metaphor is richer.

═══════════════════════════════════════════════════════════════════════════
WHEN TO REACH FOR chart SPECIFICALLY
═══════════════════════════════════════════════════════════════════════════
Pick "chart" when the section centres on 3+ labeled numbers that the reader
should compare or see a trend in. Examples:
  - revenue by quarter           → line or bar
  - market share by company      → bar or donut
  - user satisfaction over time  → line
  - votes per candidate          → bar
  - breakdown of a total         → donut
Don't pick chart for a single hero number — use stat_callout. Don't pick
chart when the data is purely qualitative.

IF the "Chartable data" block above lists any series with ≥4 points, you MUST
give one section a "chart" panel built on that series — a real multi-point
series is wasted as a lone stat_callout (a single number is a stat; a
sequence or breakdown is a chart). Route the section whose intent matches
that data to "chart", and prefer it over stat_callout for that section. This
overrides the ladder ordering and the data-family rotation rule: one chart is
worth breaking family variety for when the source genuinely carries the data.

═══════════════════════════════════════════════════════════════════════════
(illustrative and structural still exist for back-compat — never pick them.)

For each section set: id ("s1","s2",...), heading (short, punchy), intent
(what the reader must understand after this panel), visualType, and
sourceClaimIndexes (valid keyClaim indexes only).

Set the explainer title (can be punchier than the original document title).

Respond with ONLY JSON matching the ExplainerOutline schema:
{
  "title": "...",
  "sections": [
    { "id":"s1", "heading":"...", "intent":"...", "visualType":"...", "sourceClaimIndexes":[0,1] }
  ]
}
No fences, no commentary.
`.trim();

function userMessage(c: Comprehension): string {
  const claimsList = c.keyClaims
    .map((claim, i) => `  [${i}] ${claim}`)
    .join("\n");
  const featureFlags = Object.entries(c.contentFeatures)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(", ");
  const dataBlock =
    c.dataSeries.length > 0
      ? [
          "",
          "Chartable data extracted from the source (real, multi-point series —",
          "each of these is a strong candidate for a `chart` panel):",
          ...c.dataSeries.map((s) => {
            const unit = s.unit ? ` ${s.unit}` : "";
            return `  - ${s.name} (${s.points.length} points${unit})`;
          }),
        ].join("\n")
      : null;
  return [
    "Comprehension:",
    `- genre: ${c.genre} (confidence: ${c.genreConfidence})`,
    `- one-line summary: ${c.oneLineSummary}`,
    `- core idea: ${c.coreIdea}`,
    `- narrative arc: ${c.narrativeArc}`,
    `- audience: ${c.audienceLevel}`,
    featureFlags ? `- content features: ${featureFlags}` : null,
    dataBlock,
    "",
    "Key claims (use these indexes for sourceClaimIndexes):",
    claimsList,
    "",
    c.jargon.length > 0
      ? `Jargon worth knowing: ${c.jargon.map((j) => j.term).join(", ")}`
      : null,
    c.entities.length > 0
      ? `Notable entities: ${c.entities
          .slice(0, 8)
          .map((e) => `${e.name} (${e.kind})`)
          .join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runStructure(
  comprehension: Comprehension,
  jobId?: string
): Promise<ExplainerOutline> {
  return withRetry("structure", async (retryHint) => {
    const messages = [
      {
        role: "user" as const,
        content:
          (retryHint
            ? `${retryHint}\n\nReturn the COMPLETE corrected ExplainerOutline JSON. No fences, no commentary.\n\n---\n\n`
            : "") + userMessage(comprehension),
      },
    ];
    const res = await callMessages(
      {
        model: MODEL_FAST,
        max_tokens: 1024,
        temperature: 0.3,
        system: SYSTEM_PROMPT,
        messages,
      },
      { jobId, label: "structure" }
    );
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    const parsed = JSON.parse(extractJson(text));
    const outline = parseWithFeedback(ExplainerOutlineSchema, parsed);
    // Clamp to [3, 6]; rewrite duplicate ids defensively.
    const sections = outline.sections.slice(0, 6).map((s, i) => ({
      ...s,
      id: s.id?.trim() || `s${i + 1}`,
    }));
    const seen = new Set<string>();
    const unique = sections.map((s, i) => {
      let id = s.id;
      if (seen.has(id)) id = `s${i + 1}`;
      seen.add(id);
      return { ...s, id };
    });
    // Soft voice-rotation log. Reports same-family consecutive picks
    // and same-visualType repeats so we can spot prompt drift in the
    // smoke test without blocking the pipeline (the rule is editorial,
    // not structural — sometimes the right pick really is twice).
    const issues = scoreRotation(unique.map((s) => s.visualType));
    if (issues.length > 0) {
      // eslint-disable-next-line no-console
      console.info(
        `[readopp] structure rotation hints (jobId=${jobId ?? "—"}): ${issues.join("; ")}`
      );
    }
    return { title: outline.title, sections: unique };
  });
}

/**
 * Map of visualType → family for voice-rotation analysis. Mirrors the
 * VOICE ROTATION rule in the SYSTEM_PROMPT so the prompt and the log
 * agree on what counts as a "same family" repeat.
 */
const FAMILY_OF: Record<string, string> = {
  insight: "editorial",
  quote_card: "editorial",
  definition_card: "editorial",
  framework: "editorial",
  before_after: "editorial",
  key_findings: "editorial",
  stat_callout: "data",
  chart: "data",
  metaphor: "visual",
  annotated_hero: "visual",
  timeline: "structural",
  comparison: "structural",
  flowchart: "structural",
  structural: "structural",
};

function scoreRotation(types: string[]): string[] {
  const issues: string[] = [];
  // Same visualType twice in a row.
  for (let i = 1; i < types.length; i++) {
    if (types[i] && types[i] === types[i - 1]) {
      issues.push(
        `consecutive same visualType "${types[i]}" at sections ${i}-${i + 1}`
      );
    }
  }
  // Same family twice in a row.
  for (let i = 1; i < types.length; i++) {
    const a = FAMILY_OF[types[i - 1]];
    const b = FAMILY_OF[types[i]];
    if (a && b && a === b && types[i] !== types[i - 1]) {
      issues.push(
        `consecutive same family "${a}" (${types[i - 1]} → ${types[i]}) at sections ${i}-${i + 1}`
      );
    }
  }
  // Same visualType more than twice anywhere.
  const counts = new Map<string, number>();
  for (const t of types) counts.set(t, (counts.get(t) ?? 0) + 1);
  for (const [t, n] of counts) {
    if (n > 2) issues.push(`visualType "${t}" used ${n} times (cap is 2)`);
  }
  // Family coverage — should hit at least 3 distinct families for ≥4 panels.
  if (types.length >= 4) {
    const families = new Set(
      types.map((t) => FAMILY_OF[t]).filter(Boolean)
    );
    if (families.size < 3) {
      issues.push(
        `low family coverage: only ${families.size} family(ies) across ${types.length} sections`
      );
    }
  }
  return issues;
}

export function summarizeOutline(outline: ExplainerOutline): string {
  const headings = outline.sections.map((s) => s.heading.toLowerCase());
  return `Planned ${outline.sections.length} panels: ${headings.join(", ")}`.slice(0, 160);
}
