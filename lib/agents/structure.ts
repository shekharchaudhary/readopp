import { anthropic, MODEL_FAST } from "../anthropic";
import {
  ExplainerOutlineSchema,
  type Comprehension,
  type ExplainerOutline,
} from "../shared/schemas";
import { extractJson, withRetry } from "./util";

const SYSTEM_PROMPT = `
You are the structure stage. You decide how to break an understood article into a short
sequence of visual panels, and you choose the RIGHT KIND of visual for each.

Rules:
- Produce 3 to 6 panels. Fewer is better if the article is simple. Never more than 6.
- The panels should form a narrative the reader can follow in order.
- Bias: the first panel usually frames the PROBLEM or core idea; the last often resolves or summarizes.

How to choose visualType:
- flowchart    -> a process, sequence of steps, or decision flow
- illustrative -> a concept or mechanism where intuition matters; a spatial metaphor beats boxes
- structural   -> architecture / things-inside-things
- comparison   -> two or more things contrasted
- timeline     -> events or stages over time
- stat_callout -> a single striking number or fact

For each section set: id ("s1","s2",...), heading (short), intent (what the reader must understand after seeing this panel),
visualType (one of the above), sourceClaimIndexes (which keyClaims it draws from — valid indexes only).

Also set the explainer title (can be punchier than the original article title).

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
  return [
    "Comprehension:",
    `- one-line summary: ${c.oneLineSummary}`,
    `- core idea: ${c.coreIdea}`,
    `- narrative arc: ${c.narrativeArc}`,
    `- audience: ${c.audienceLevel}`,
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
  comprehension: Comprehension
): Promise<ExplainerOutline> {
  const client = anthropic();
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
    const res = await client.messages.create({
      model: MODEL_FAST,
      max_tokens: 1024,
      temperature: 0.3,
      system: SYSTEM_PROMPT,
      messages,
    });
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
