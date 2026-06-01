import { callMessages, MODEL_STRONG } from "../anthropic";
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

Follow the section's visualType:
- flowchart / structural -> provide nodes and edges. 3-6 nodes max. Labels <=24 chars,
  subtitles <=5 words. Group related nodes via "group" (same group => same color).
- comparison -> provide "comparison" with 2-3 columns and 2-5 rows. Keep cell text short.
- timeline -> provide "timeline" items (when, what), 3-6 entries.
- illustrative -> provide "illustrativeBrief": 2-4 sentences telling the renderer what spatial
  metaphor to draw and what each part represents. Make the metaphor reveal the mechanism.
- stat_callout -> provide "stat" { value, label }.

ALWAYS provide "caption": 1-3 sentences of prose shown beneath the panel, written for the
target audience level. The caption should let someone understand the panel without prior knowledge.

ALWAYS echo the section id as "sectionId" and copy the section's "visualType".

Keep it tight. A good panel has few elements and one clear idea. Resist cramming.
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

  return [
    `Audience level: ${audience}`,
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
  ].join("\n");
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
        max_tokens: 1536,
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
      plan.comparison = { ...plan.comparison, rows: realRows };
    }

    return plan;
  });
}
