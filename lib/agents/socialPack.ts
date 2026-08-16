import { callMessages, MODEL_FAST } from "../anthropic";
import {
  SocialPackSchema,
  type Comprehension,
  type Explainer,
  type SocialPack,
} from "../shared/schemas";
import { sourceLabel } from "../shared/source";
import { extractJson, parseWithFeedback, withRetry } from "./util";

/**
 * Phase 8 week 1 — the agent that turns a finished explainer into something
 * the user can actually POST: a 2-line caption in their voice, hashtag
 * suggestions inferred from genre + entities, alt-text per panel, and a
 * source attribution line.
 *
 * Cheaper model than the rest of the pipeline because the work is
 * mostly copywriting from already-structured data. Fast tier is plenty.
 */

const SYSTEM_PROMPT = `
You are the social pack stage. The pipeline has already produced an
explainer (title, panels, captions, comprehension) from the user's source.
Your job is to write the bits that go AROUND the post when the user
actually shares the carousel:

  - caption: 2 lines max, written as if the USER is posting it. Curious,
             specific, not hype-y. Should reference what they read and
             invite engagement (a question or a "what do you think?").
             Plain text only. No emojis. No "🚀 just dropped a thread on…".
             Use sentence case. ≤ 600 chars total.

  - hashtags: 3 suggested hashtags. Lowercase, no spaces, no leading "#"
              (we add it client-side). Inferred from genre + key entities
              + the topic. Mix one broad (e.g. "leadership", "engineering")
              with two specific ones (entity names or specific terms).
              Skip if nothing useful applies — better empty than generic.

  - altTexts: one per panel. Plain-language description of what the panel
              shows so screen readers can read it. ≤ 200 chars each.

  - sourceAttribution: short string for the source-attribution slide,
                       like "Read at example.com" or "Source: arxiv.org".

Return ONLY JSON of this shape (no fences, no commentary):
{
  "caption": "...",
  "hashtags": ["...", "...", "..."],
  "altTexts": [
    { "sectionId": "s1", "text": "Iceberg metaphor showing visible vs hidden work." },
    ...
  ],
  "sourceAttribution": "..."
}
`.trim();

function userMessage(input: {
  explainer: Explainer;
  comprehension: Comprehension;
}): string {
  const { explainer, comprehension } = input;
  const panelSummary = explainer.panels
    .map(
      (p, i) =>
        `  [${p.sectionId}] (${i + 1}) "${p.heading || ""}" — ${
          p.caption?.slice(0, 160) ?? ""
        }`
    )
    .join("\n");
  const entityList = comprehension.entities
    .slice(0, 8)
    .map((e) => `${e.name} (${e.kind})`)
    .join(", ");
  return [
    `Source: ${sourceLabel(explainer.url)}`,
    `Title: ${explainer.title}`,
    `Audience level: ${explainer.audienceLevel}`,
    `Publishing goal: ${explainer.publishingGoal}`,
    "Match the caption CTA to the publishing goal; do not use a generic engagement question unless the goal is start_discussion.",
    `Genre: ${comprehension.genre}`,
    `One-line summary: ${comprehension.oneLineSummary}`,
    `Core idea: ${comprehension.coreIdea}`,
    "",
    "Panels (use sectionId for altTexts):",
    panelSummary,
    "",
    entityList ? `Notable entities: ${entityList}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export interface SocialPackOptions {
  /** Free-text guidance threaded into the user message ahead of the
   *  PanelPlan + comprehension dump. Used by the on-demand regeneration
   *  endpoint so the user can steer the caption ("shorter", "more
   *  skeptical", "lead with the stat", "no questions"). */
  hint?: string;
  voiceInstruction?: string;
}

export async function runSocialPack(
  explainer: Explainer,
  comprehension: Comprehension,
  jobId?: string,
  opts: SocialPackOptions = {}
): Promise<SocialPack> {
  const hint = opts.hint?.trim();
  return withRetry("socialPack", async (retryHint) => {
    const res = await callMessages(
      {
        model: MODEL_FAST,
        max_tokens: 1024,
        // Bump temperature a touch when the user supplies a hint so the
        // model actually swings off the default voice rather than
        // returning a near-clone of the prior caption.
        temperature: hint ? 0.7 : 0.5,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content:
              (retryHint
                ? `${retryHint}\n\nReturn the COMPLETE corrected SocialPack JSON. No fences, no commentary.\n\n---\n\n`
                : "") +
              (hint
                ? `EXTRA GUIDANCE FROM THE USER (apply this on top of the system rules):\n  ${hint}\n\n---\n\n`
                : "") +
              (opts.voiceInstruction
                ? `EDITORIAL VOICE (apply to caption wording):\n  ${opts.voiceInstruction}\n\n---\n\n`
                : "") +
              userMessage({ explainer, comprehension }),
          },
        ],
      },
      { jobId, label: "socialPack" }
    );
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    const parsedRaw = JSON.parse(extractJson(text)) as Record<string, unknown>;

    // Cleanup before zod parse — normalize hashtag formatting and drop alt
    // entries that don't map to a real section id.
    if (Array.isArray(parsedRaw.hashtags)) {
      parsedRaw.hashtags = (parsedRaw.hashtags as unknown[])
        .map((h) => (typeof h === "string" ? h.replace(/^#/, "").trim() : ""))
        .filter((h) => h.length > 0)
        .slice(0, 5);
    } else {
      parsedRaw.hashtags = [];
    }
    const validIds = new Set(explainer.panels.map((p) => p.sectionId));
    if (Array.isArray(parsedRaw.altTexts)) {
      parsedRaw.altTexts = (parsedRaw.altTexts as unknown[])
        .map((a) => {
          if (!a || typeof a !== "object") return null;
          const r = a as Record<string, unknown>;
          const sectionId =
            typeof r.sectionId === "string" ? r.sectionId : "";
          const text = typeof r.text === "string" ? r.text.trim() : "";
          if (!sectionId || !text || !validIds.has(sectionId)) return null;
          return { sectionId, text };
        })
        .filter(Boolean);
    } else {
      parsedRaw.altTexts = [];
    }

    return parseWithFeedback(SocialPackSchema, parsedRaw);
  });
}
