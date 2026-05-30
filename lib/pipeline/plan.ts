import { z } from "zod";
import { anthropic, MODEL_STRONG } from "../anthropic";
import {
  AudienceLevelSchema,
  PanelPlanSchema,
  type AudienceLevel,
  type CleanArticle,
  type PanelPlan,
} from "../shared/schemas";

export const ExplainerPlanSchema = z.object({
  title: z.string().min(3).max(120),
  summary: z.string().min(3).max(220),
  audienceLevel: AudienceLevelSchema,
  panels: z.array(PanelPlanSchema).min(3).max(6),
});
export type ExplainerPlan = z.infer<typeof ExplainerPlanSchema>;

const SYSTEM_PROMPT = `
You are the planning stage of a pipeline that turns a published article into a short,
visual explainer of 3-6 panels. You combine three jobs into one structured output:

1. COMPREHENSION — extract the article's core idea, key claims, and narrative arc.
2. STRUCTURE — break the explainer into 3-6 sections; choose the right visual TYPE per section.
3. PLAN — for each section, output a render-agnostic PanelPlan (nodes/edges, comparison rows,
   timeline entries, illustrative brief, or stat callout) plus a caption.

Hard rules:
- Output ONLY JSON matching the schema below. No prose, no markdown fences, no preamble.
- Produce 3-6 panels total. Fewer is better when the article is simple. Never more than 6.
- First panel usually frames the PROBLEM or core idea. Last often resolves or summarizes.
- Each panel must have visualType from: flowchart | illustrative | structural | comparison | timeline | stat_callout.
- Each panel must have a sectionId (e.g. "s1", "s2", ...) and a caption (1-3 plain sentences).
- Calibrate to the audience level (general | student | professional | technical):
    general      = no domain knowledge assumed; use everyday metaphors.
    student      = basic literacy; define key terms.
    professional = working knowledge; sharper claims.
    technical    = expert; precise component names.

How to choose visualType:
- flowchart    -> a process, sequence of steps, or decision flow.
- illustrative -> a concept/mechanism where intuition matters; a spatial metaphor beats boxes.
- structural   -> architecture / things-inside-things.
- comparison   -> two or more things contrasted (use 2-3 columns, 2-5 rows).
- timeline     -> events or stages over time (3-6 entries).
- stat_callout -> a single striking number or fact.

PanelPlan shape (mix only what applies to its visualType):
{
  "sectionId": "s1",
  "visualType": "flowchart" | "illustrative" | "structural" | "comparison" | "timeline" | "stat_callout",
  "caption": "1-3 sentences of prose shown beneath the panel.",
  "nodes": [{ "id":"n1", "label":"...", "subtitle":"...?", "group":"...?", "role":"start|end|normal|highlight?" }],   // flowchart/structural
  "edges": [{ "from":"n1", "to":"n2", "label":"...?" }],                                                              // flowchart/structural
  "comparison": { "columns":["A","B"], "rows":[{ "label":"row 1", "cells":["...","..."] }] },                         // comparison
  "timeline": [{ "when":"2019", "what":"..." }],                                                                       // timeline
  "illustrativeBrief": "2-4 sentences telling the renderer what spatial metaphor to draw.",                            // illustrative
  "stat": { "value":"73%", "label":"of users churn in week 1" },                                                       // stat_callout
  "layoutHint": "horizontal" | "vertical"                                                                              // optional
}

Top-level shape to return:
{
  "title": "Explainer title (can be punchier than the article title) <=120 chars",
  "summary": "One plain sentence summary <=220 chars",
  "audienceLevel": "<the audience level you were given>",
  "panels": [ <PanelPlan>, ... ]
}

Keep it tight. A good panel has few elements and one clear idea. Resist cramming.
Output ONLY the JSON object. No fences. No commentary.
`.trim();

function userMessage(article: CleanArticle, audience: AudienceLevel): string {
  // Keep the article body trimmed to a reasonable size so we don't blow context.
  const MAX_CHARS = 24_000;
  const body =
    article.text.length > MAX_CHARS
      ? article.text.slice(0, MAX_CHARS) + "\n\n[…truncated…]"
      : article.text;

  return [
    `Audience level: ${audience}`,
    `Source URL: ${article.url}`,
    `Article title: ${article.title}`,
    article.byline ? `Byline: ${article.byline}` : null,
    `Word count: ${article.wordCount}`,
    "",
    "Article body:",
    body,
  ]
    .filter(Boolean)
    .join("\n");
}

function extractJson(text: string): string {
  let s = text.trim();
  // strip ```json fences if present
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (fence) s = fence[1].trim();
  // if model added prose, isolate the outermost {...}
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }
  return s;
}

export async function planExplainer(
  article: CleanArticle,
  audience: AudienceLevel
): Promise<ExplainerPlan> {
  const client = anthropic();
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const messages = [
      {
        role: "user" as const,
        content:
          (lastError
            ? `Your previous output failed validation: ${lastError}\nReturn ONLY corrected JSON matching the schema, nothing else.\n\n`
            : "") + userMessage(article, audience),
      },
    ];

    const res = await client.messages.create({
      model: MODEL_STRONG,
      max_tokens: 4096,
      temperature: 0.4,
      system: SYSTEM_PROMPT,
      messages,
    });

    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    try {
      const parsed = JSON.parse(extractJson(text));
      // Ensure audienceLevel matches what we asked for
      if (parsed && typeof parsed === "object") {
        (parsed as Record<string, unknown>).audienceLevel = audience;
      }
      const plan = ExplainerPlanSchema.parse(parsed);
      // Ensure sectionIds are unique; rewrite if not
      const seen = new Set<string>();
      plan.panels = plan.panels.map((p, i) => {
        let id = p.sectionId?.trim() || `s${i + 1}`;
        if (seen.has(id)) id = `s${i + 1}`;
        seen.add(id);
        return { ...p, sectionId: id };
      });
      return plan;
    } catch (e) {
      lastError = (e as Error).message.slice(0, 600);
      // loop & retry
    }
  }

  throw new Error(
    `Planner failed after retries. Last error: ${lastError ?? "unknown"}`
  );
}
