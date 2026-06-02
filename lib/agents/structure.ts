import { callMessages, MODEL_FAST } from "../anthropic";
import {
  ExplainerOutlineSchema,
  type Comprehension,
  type ExplainerOutline,
} from "../shared/schemas";
import { extractJson, withRetry } from "./util";

const SYSTEM_PROMPT = `
You are the structure stage. You decide how to break an understood article into a short
sequence of visual panels, and you choose the RIGHT KIND of visual for each. The output
will become a shareable visual explainer (think LinkedIn carousel quality), so the
panels should tell a STORY, not look like a wireframe.

Rules:
- Produce 3 to 6 panels. Fewer is better if the article is simple. Never more than 6.
- The panels should form a narrative the reader can follow in order.
- First panel usually frames the PROBLEM or core idea; last often resolves or summarizes.
- A document MUST NOT use the same visualType more than twice; if it must repeat,
  prefer a different visualType that fits the section.

How to choose visualType — walk this ladder TOP-DOWN and stop at the first match:

1. stat_callout    -> one striking number that summarises the section (e.g. "$2.4B raised", "90% reduction")
2. comparison      -> 2–4 named things contrasted across the same dimensions
3. timeline        -> dated or sequenced events as a chronological list
4. metaphor        -> the section describes a CONCEPTUAL PATTERN: duality, sequence,
                      aggregation, divergence, tension, cycle, hierarchy, signal vs noise,
                      growth, or navigation. The planner will pick the specific metaphor.
                      This is the storytelling default — prefer it whenever the section
                      has a clean conceptual shape.
5. annotated_hero  -> the section walks the reader through a CONCRETE DEPICTABLE thing:
                      a UI screen, a device, a chart, a document, a physical object.
                      The planner will label parts of it with numbered callouts.
6. flowchart       -> LAST RESORT: a literal process or decision flow that doesn't fit
                      any of the above. Use sparingly — a metaphor is almost always richer.

(illustrative and structural still exist for back-compat but you should never pick them;
treat them as deprecated in favour of metaphor.)

For each section set: id ("s1","s2",...), heading (short, punchy), intent (what the reader
must understand after seeing this panel), visualType (one of the above), sourceClaimIndexes
(which keyClaims it draws from — valid indexes only).

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
