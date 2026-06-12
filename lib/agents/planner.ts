import { callMessages, MODEL_STRONG } from "../anthropic";
import { ICON_CATALOG_LINE } from "../render/icons";
import {
  PanelPlanSchema,
  type AudienceLevel,
  type Comprehension,
  type OutlineSection,
  type PanelPlan,
} from "../shared/schemas";
import { extractJson, withRetry } from "./util";

const SYSTEM_PROMPT = `
You are the visual planning stage. Given ONE section of an explainer plus the article's
comprehension, design a concrete, render-agnostic plan for ONE visual panel.

You are choosing the CONTENT and STRUCTURE of the visual, not drawing it. Output a PanelPlan.

═══════════════════════════════════════════════════════════════════════════
FILL FIELDS BY VISUALTYPE
═══════════════════════════════════════════════════════════════════════════

• stat_callout -> "stat" { value, label }. Value is a short string like "90%", "$2.4B", "3×".

• comparison   -> "comparison" with 2–3 columns and 2–5 rows. Cell text short.
  "columns" is REQUIRED: the name of each thing being compared
  (e.g. ["Remote work", "Office work"]). Never leave it empty.
  Also fill "columnIcons": one icon per column from the ICON LIBRARY below,
  picking the icon that best embodies each side (e.g. ["rocket","shield"] for
  speed vs safety). Use null for a column with no good fit.

• timeline     -> "timeline" items (when, what), 3–6 entries.

• flowchart / structural / illustrative -> legacy. Provide "nodes" + "edges"
  (3–6 nodes, labels ≤24 chars, subtitles ≤5 words, group related nodes).

• annotated_hero -> "annotatedHero" with:
    - subject: a concrete depictable noun ("smartphone with chat app",
      "open book", "coffee brewer cross-section", "growth chart with three peaks").
      NOT abstract ("trust", "scalability").
    - subjectHint?: optional details about how the renderer should draw it.
    - annotations: 2–5 numbered callouts, each with targetHint (where to point —
      "send button bottom-right", "summit of the curve"), label (≤6 words),
      and optional sub (≤14 words).

• profile_card -> "profileCard" with:
    - name: the person's full name (resume hero).
    - headline?: their role + focus area, ≤120 chars
      ("Staff engineer · open-source maintainer").
    - location?: city/country, ≤60 chars.
    - stats: up to 3 hero metrics — { label (≤30 chars), value (≤20 chars) }.
      Pick the 3 most impressive numbers (years experience, products shipped,
      orgs founded, etc.). Skip stats if the resume doesn't surface clear ones.

• career_timeline -> "careerTimeline" with:
    - roles: 1–6 entries, most recent FIRST. Each:
      - title: the job title (≤60 chars).
      - company: the org (≤60 chars).
      - period?: date range ("2021–2024", "2019–Now") (≤40 chars).
      - achievements: up to 3 short, concrete wins per role (≤140 chars each).
    Aim for 3–5 roles total; over 6 becomes a wall of text.

• skills_matrix -> "skillsMatrix" with:
    - groups: 1–4 category buckets, each with:
      - name: category label, ≤40 chars ("Languages", "Cloud & infra",
        "Design tools").
      - skills: 1–8 entries per group. Each skill: { name, level? }.
        level optional, one of "expert" | "strong" | "familiar".
    Don't list every skill on the resume — pick what matters for the story.

• chart -> "chart" with:
    - kind: "bar" | "donut" | "line".
        • bar    : compare a single dimension across 2–12 named items.
        • donut  : show parts of a whole, 2–6 slices.
        • line   : show change over a sequence (time, version, etc.),
                   2–12 points; up to 3 series for comparison.
    - title?: ≤80 chars, optional.
    - xLabel? / yLabel?: axis labels, ≤30 chars each.
    - series: 1–3 named series. Donut/bar use series[0]; line can render
      multiple. Each series: { name?, color? (blue/teal/amber/purple/gray),
      points[] }. Points: 2–12 per series, each { label, value (number) }.
    - unit?: optional suffix shown on tick labels ("%", "k", "M", "$").
    Only emit numbers actually present in the source document or directly
    derivable from it. Never fabricate data.

• quote_card -> "quoteCard" with:
    - text: the quote VERBATIM from the source (light trims with … allowed),
      ≤280 chars. Never paraphrase — the power is in the original words.
    - attribution?: who said/wrote it ("Annie Dillard", "the author",
      an interviewee's name). Omit if unknown.
    - context?: where it sits ("Chapter 3", "closing paragraph",
      "interview, 2024"). Omit if it adds nothing.

• key_findings -> "keyFindings" with:
    - label?: optional kicker ≤40 chars ("KEY FINDINGS", "WHAT CHANGED").
    - findings: 2–4 entries. Each:
      - title: the finding in one punchy line (≤70 chars).
      - detail?: one supporting sentence (≤140 chars).
      - figure?: the hero number attached to it ("3.2×", "41%", "$2B") —
        ONLY if the source states it. Never fabricate figures.
    Order findings by importance, strongest first.

• definition_card -> "definitionCard" with:
    - term: the concept being unpacked (≤60 chars).
    - kicker?: part-of-speech / category sub ("noun", "protocol", "metric").
    - definition: plain-language explanation a stranger gets in one read
      (≤220 chars). No circular definitions, no jargon inside the definition.
    - analogy?: a "think of it like…" comparison to something everyday
      (≤160 chars). Strongly encouraged — it's what makes the card land.

• metaphor -> "metaphor" with:
    - kind: pick ONE of the 26 below.
    - Fill the fields that kind needs (see the recipe below). Leave irrelevant
      fields empty / omit them.
    - Each pole, item, and hub may carry an "icon" from the ICON LIBRARY below.
      Pick the icon that depicts the THING the label names, not the metaphor
      shape itself. Omit "icon" when nothing fits — a wrong icon is worse
      than none.

═══════════════════════════════════════════════════════════════════════════
ICON LIBRARY — the only valid values for any "icon" / "columnIcons" field
═══════════════════════════════════════════════════════════════════════════

${ICON_CATALOG_LINE}

═══════════════════════════════════════════════════════════════════════════
METAPHOR PICK RULES — walk this ladder TOP-DOWN, stop at the first match
═══════════════════════════════════════════════════════════════════════════

Duality / tension (two-pole — fill poles[0] and poles[1]):
  iceberg     : surface vs depth, visible vs hidden, the 10% vs the 90%.
                hint? = ratio like "90%".
  bridge      : before-state vs after-state with a transition between them.
                outcome.name = the transition/mechanism label (e.g. "rewrite").
  scale       : two ideas being weighed against each other; trade-off question.
                hint? = the question being weighed ("which matters more?").
  tug_of_war  : two active forces directly opposing each other for a prize/outcome.
                outcome? = what's at stake.
  spectrum    : a continuous range between two poles, often with a marker on it.
                hint? = where the marker sits ("today: 60% toward right pole").

Sequence (ordered list — fill items[] 2–6, outcome? = final summit/result):
  mountain    : a multi-stage climb toward a goal; each stage is a camp.
  staircase   : discrete escalating levels; each step strictly higher than the last.
  garden      : organic growth across phases (seed → sprout → bloom).
  domino      : causal cascade where each event triggers the next.
  weaving     : independent threads interleaving into a unified fabric.
                outcome = the resulting fabric.

Many-to-one (fill hub, items[] = sources, flow="in"):
  confluence  : multiple sources merging into one downstream output.
  funnel      : broad input narrowing through stages to a specific output.
                items = the narrowing stages.

One-to-many (fill hub = root, items[] = branches, flow="out"):
  branching   : one root splitting into multiple paths/options/categories.
  ripple      : a single event with propagating second-order effects.
  crossroads  : a decision point with multiple paths going forward.

Focus (one signal vs many distractions — fill hub = focus, items[] = others, flow="out"):
  lighthouse  : a signal cutting through noise.
  spotlight   : one thing picked out from a crowd.
  orbits      : a central concept with supporting concepts orbiting it.

Cycle (fill items[] = phases in cycle order):
  loop        : a feedback cycle where each phase feeds the next, ending back at the first.
  tide        : ebb and flow; cyclical oscillation between two states.
  engine      : input → process → output → feedback; transformation cycle.
                hub = the process, items = the phases.
  gears       : 2–4 interlocking mechanisms that turn together.

Stack / hierarchy (fill items[] = layers BOTTOM TO TOP):
  layers      : strata of accumulated stuff (geology, tech stack).
  pyramid     : hierarchical narrowing-toward-top (Maslow-style).

Spatial / navigation:
  compass     : orientation with N/E/S/W principles or directions.
                hub = the center, items = the 2–4 directions.
  maze        : navigating uncertainty from a start toward a goal.
                hub = start, outcome = goal, items = key choice points.

═══════════════════════════════════════════════════════════════════════════
GENRE VOICE — match the panel's wording to the document's genre
═══════════════════════════════════════════════════════════════════════════

The user message tells you the document's GENRE. Write labels and captions
in that genre's native register:

  research_paper : precise and quantified. Use the paper's own method terms
                   and reported numbers. Captions may name the dataset,
                   sample size, or benchmark. Never soften a finding.
  book_chapter   : evocative and narrative. Borrow the author's imagery.
                   Captions read like a book review pull — voice over data.
  resume         : achievement-first. Verbs + numbers ("Shipped", "Scaled",
                   "Led"). No fluff adjectives.
  news           : factual and dated. Who/what/when up front, attribute
                   claims to their source.
  documentation  : instructional and concrete. Second person OK ("you
                   configure…"). Name the actual commands/components.
  whitepaper     : business-consequence framing. Tie findings to cost,
                   risk, or opportunity.
  article/other  : conversational but sharp — LinkedIn-native phrasing.

═══════════════════════════════════════════════════════════════════════════
HARD RULES
═══════════════════════════════════════════════════════════════════════════

1. ALWAYS fill "caption": 1–3 sentences of prose shown beneath the panel, written
   for the audience level. The caption alone should let a stranger understand.

2. ALWAYS fill "narrativeReason": ONE short sentence (≤25 words) explaining
   WHY this visualType (and metaphor kind, if metaphor) fits THIS section.
   This is used for debugging selection quality.

3. ALWAYS echo "sectionId" and copy the section's "visualType".

4. Keep labels TIGHT. A label is ≤6 words. A sub is ≤14 words. The visual reads
   in 2 seconds — long labels kill that.

5. For metaphors, fill ONLY the slots the kind needs. Don't fill unrelated fields.

6. Names are sentence case. No emoji. No ALL CAPS. No quotes around labels.

7. If the section truly doesn't fit any storytelling shape, fall back to flowchart
   and explain in narrativeReason why nothing else worked.

Respond with ONLY JSON matching the PanelPlan schema. No fences, no commentary.
`.trim();

function userMessage(
  section: OutlineSection,
  comprehension: Comprehension,
  audience: AudienceLevel
): string {
  const sourceClaims = section.sourceClaimIndexes
    .map((i) => comprehension.keyClaims[i])
    .filter(Boolean)
    .map((c, i) => `  - ${c}`)
    .join("\n");

  const featureFlags = Object.entries(comprehension.contentFeatures)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(", ");

  return [
    `Audience level: ${audience}`,
    `Genre: ${comprehension.genre} (confidence: ${comprehension.genreConfidence})`,
    featureFlags ? `Content features: ${featureFlags}` : null,
    "",
    "Section to design:",
    `  id: ${section.id}`,
    `  heading: ${section.heading}`,
    `  intent: ${section.intent}`,
    `  visualType: ${section.visualType}`,
    "",
    "Source claims for this section:",
    sourceClaims || "  (none — use coreIdea below)",
    "",
    "Article context (do not invent beyond this):",
    `  core idea: ${comprehension.coreIdea}`,
    `  narrative arc: ${comprehension.narrativeArc}`,
    comprehension.entities.length > 0
      ? `  notable entities: ${comprehension.entities
          .slice(0, 8)
          .map((e) => `${e.name} (${e.kind})`)
          .join(", ")}`
      : null,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

export async function runPlanner(
  section: OutlineSection,
  comprehension: Comprehension,
  audience: AudienceLevel,
  jobId?: string
): Promise<PanelPlan> {
  return withRetry(`planner[${section.id}]`, async (retryHint) => {
    const messages = [
      {
        role: "user" as const,
        content:
          (retryHint
            ? `Your previous output failed validation: ${retryHint}\nReturn ONLY corrected JSON.\n\n`
            : "") + userMessage(section, comprehension, audience),
      },
    ];
    const res = await callMessages(
      {
        model: MODEL_STRONG,
        max_tokens: 2048,
        temperature: 0.4,
        system: SYSTEM_PROMPT,
        messages,
      },
      { jobId, label: `planner[${section.id}]` }
    );
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    const parsed = JSON.parse(extractJson(text)) as Record<string, unknown>;
    parsed.sectionId = section.id;
    parsed.visualType = section.visualType;
    const plan = PanelPlanSchema.parse(parsed);

    // Sanity: the articulation types are slot-driven — a missing slot would
    // fall through to freeform AI render, which for quotes means fabrication.
    // Force a retry instead.
    if (plan.visualType === "quote_card" && !plan.quoteCard) {
      throw new Error('visualType "quote_card" requires the "quoteCard" field');
    }
    if (plan.visualType === "key_findings" && !plan.keyFindings) {
      throw new Error(
        'visualType "key_findings" requires the "keyFindings" field'
      );
    }
    if (plan.visualType === "definition_card" && !plan.definitionCard) {
      throw new Error(
        'visualType "definition_card" requires the "definitionCard" field'
      );
    }

    // Sanity: edges reference existing node ids; if not, drop the bad ones.
    if (plan.nodes && plan.edges) {
      const ids = new Set(plan.nodes.map((n) => n.id));
      plan.edges = plan.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
    }

    // Sanity: drop comparison rows missing either a label or any cells. If the
    // table collapses to fewer than two real rows, the plan is degenerate —
    // throw a clear retry hint so the model can re-emit a valid table.
    if (plan.comparison) {
      const realRows = plan.comparison.rows.filter(
        (r) =>
          r.label.trim().length > 0 ||
          r.cells.some((c) => c.trim().length > 0)
      );
      if (realRows.length < 2 && section.visualType === "comparison") {
        throw new Error(
          "comparison.rows must contain at least 2 rows, each with a non-empty label and at least one non-empty cell"
        );
      }
      if (
        section.visualType === "comparison" &&
        plan.comparison.columns.filter((c) => c.trim()).length < 2
      ) {
        throw new Error(
          'comparison.columns must name each side being compared, e.g. ["Remote work", "Office work"]'
        );
      }
      plan.comparison = { ...plan.comparison, rows: realRows };
    }

    return plan;
  });
}
