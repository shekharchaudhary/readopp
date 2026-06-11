import { callMessages, MODEL_FAST } from "../anthropic";
import {
  ExplainerOutlineSchema,
  type Comprehension,
  type ExplainerOutline,
} from "../shared/schemas";
import { extractJson, withRetry } from "./util";

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
- Don't use the same visualType more than twice unless absolutely necessary.

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
    4. comparison — current state vs proposed state, or vendor options.
    5. metaphor (bridge, crossroads, funnel) — the recommendation.

▸ genre = "article" / "other"
  Use the storytelling-metaphor flow: walk this ladder TOP-DOWN and stop
  at the first match per section:
    1. stat_callout    — one striking number summarises the section.
    2. quote_card      — the section pivots on a striking quotable line
                        (interviewee quote, thesis sentence, famous line).
    3. comparison      — 2–4 named things contrasted.
    4. timeline        — dated or sequenced events.
    5. chart           — section has 3+ labeled numbers worth charting
                        (only if contentFeatures.hasNumericData is true).
    6. key_findings    — section enumerates 2–4 discrete takeaways/lessons.
    7. definition_card — section unpacks one term of art for outsiders.
    8. metaphor        — section describes a conceptual pattern (duality,
                        sequence, aggregation, divergence, tension, cycle,
                        hierarchy, signal vs noise, growth, navigation).
                        Storytelling default.
    9. annotated_hero  — section walks reader through a concrete depictable
                        subject (UI, device, chart, document, object).
    10. flowchart      — LAST RESORT. Use sparingly; a metaphor is richer.

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
  return [
    "Comprehension:",
    `- genre: ${c.genre} (confidence: ${c.genreConfidence})`,
    `- one-line summary: ${c.oneLineSummary}`,
    `- core idea: ${c.coreIdea}`,
    `- narrative arc: ${c.narrativeArc}`,
    `- audience: ${c.audienceLevel}`,
    featureFlags ? `- content features: ${featureFlags}` : null,
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
            ? `Your previous output failed validation: ${retryHint}\nReturn ONLY corrected JSON.\n\n`
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
    const outline = ExplainerOutlineSchema.parse(parsed);
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
    return { title: outline.title, sections: unique };
  });
}

export function summarizeOutline(outline: ExplainerOutline): string {
  const headings = outline.sections.map((s) => s.heading.toLowerCase());
  return `Planned ${outline.sections.length} panels: ${headings.join(", ")}`.slice(0, 160);
}
