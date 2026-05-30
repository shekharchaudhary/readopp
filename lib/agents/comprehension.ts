import { anthropic, MODEL_STRONG } from "../anthropic";
import {
  ComprehensionSchema,
  type AudienceLevel,
  type CleanArticle,
  type Comprehension,
} from "../shared/schemas";
import { extractJson, withRetry } from "./util";

const SYSTEM_PROMPT = `
You are the comprehension stage of a pipeline that turns articles into visual explanations.
Your only job is to deeply understand this article and express that understanding as structured data.
You are NOT designing visuals. You are NOT writing the final captions.

Read the article and produce JSON matching the Comprehension schema exactly:
- oneLineSummary: <=180 chars, plain language, no hype.
- coreIdea: the single most important takeaway in 1-2 sentences.
- keyClaims: 3-7 distinct, concrete claims or findings. Each standalone and specific.
- entities: the important named things (concepts, tools, people, orgs, metrics) with a one-line note each.
- jargon: terms the audience likely won't know, each with a plain-language definition.
- narrativeArc: one sentence describing how the article is structured (e.g. "problem then two-part solution then open questions").
- audienceLevel: echo back the audience level you were given.

Calibrate to the audience level:
- general:      assume no domain knowledge; flag lots of jargon; keep claims concrete and concept-level.
- student:      assume curiosity and basic literacy in the field; define key terms.
- professional: assume working knowledge; flag only specialized jargon; keep claims sharp.
- technical:    assume expert; minimal jargon flagging; claims can be precise and detailed.

Respond with ONLY the JSON. No markdown fences, no commentary.
`.trim();

function userMessage(article: CleanArticle, audience: AudienceLevel): string {
  const MAX_CHARS = 24_000;
  const body =
    article.text.length > MAX_CHARS
      ? article.text.slice(0, MAX_CHARS) + "\n\n[…truncated…]"
      : article.text;
  return [
    `Audience level: ${audience}`,
    `Source URL: ${article.url}`,
    `Title: ${article.title}`,
    article.byline ? `Byline: ${article.byline}` : null,
    `Word count: ${article.wordCount}`,
    "",
    "Article body:",
    body,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runComprehension(
  article: CleanArticle,
  audience: AudienceLevel
): Promise<Comprehension> {
  const client = anthropic();
  return withRetry("comprehension", async (retryHint) => {
    const messages = [
      {
        role: "user" as const,
        content:
          (retryHint
            ? `Your previous output failed validation: ${retryHint}\nReturn ONLY corrected JSON.\n\n`
            : "") + userMessage(article, audience),
      },
    ];
    const res = await client.messages.create({
      model: MODEL_STRONG,
      max_tokens: 2048,
      temperature: 0.3,
      system: SYSTEM_PROMPT,
      messages,
    });
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    const parsed = JSON.parse(extractJson(text)) as Record<string, unknown>;
    parsed.audienceLevel = audience;
    return ComprehensionSchema.parse(parsed);
  });
}

/**
 * Tight one-liner used for the agent.done event summary.
 */
export function summarizeComprehension(c: Comprehension): string {
  const n = c.keyClaims.length;
  return `Identified ${n} key claim${n === 1 ? "" : "s"} — ${c.narrativeArc.toLowerCase()}`.slice(0, 140);
}
