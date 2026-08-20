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

  - poll: a source-grounded LinkedIn poll package. The question must invite
          a meaningful professional judgment, not test trivia. Use 2–4
          mutually distinct options, each ≤30 characters. The question is
          ≤140 characters. intro is the short post above the poll. followUp
          is a post the user can publish after voting closes: explain what
          each result might mean without pretending results already exist.
          sourceClaimIndexes must reference 1–3 supplied key claims. Never
          invent evidence or imply that one option is factually proven when
          the source only supports a discussion.

  - documentAd: a complete LinkedIn Document Ad + Lead Gen handoff. Treat the
          explainer carousel as the downloadable document. documentTitle is
          a concrete value promise, never clickbait. adIntro is the primary
          post copy. headline and description are concise ad fields.
          formHeadline and formDetails explain exactly what the person gets
          before they submit. Pick the most honest CTA. thankYouMessage is
          shown after submission. followUpMessage is a useful, human first
          follow-up—not a hard sell. Ground the value proposition in 1–3 key
          claims through sourceClaimIndexes. Do not promise outcomes the
          source cannot support.

  - conversationAd: a branching sponsored-message experience. openingMessage
          should feel like a useful invitation from a credible person, not a
          bot or mass blast. senderGuidance explains who should send it and
          why. Create 2–4 distinct branches based on audience intent—not yes/no
          synonyms. Each choice is ≤40 chars and receives a concise, genuinely
          relevant response plus a nextStep. Choose the honest CTA destination:
          read_explainer, download_document, read_source, or start_conversation.
          noResponseFollowUp is one respectful reminder. Never fake personal
          familiarity, urgency, scarcity, or a prior relationship.

  - newsletterSeries: a three-issue editorial sequence derived from the
          source. The issues must form an arc rather than repeat the same
          summary: issue 1 explains the consequential insight, issue 2 helps
          the reader apply or evaluate it, and issue 3 explores implications
          and invites a useful action or discussion. Give each issue a strong
          subject, preview text, headline, opening, 2–4 section takeaways, CTA,
          and sourceClaimIndexes. Select a realistic cadence. Keep claims
          within the supplied evidence and do not manufacture case studies,
          quotations, data, or personal experience.

Return ONLY JSON of this shape (no fences, no commentary):
{
  "caption": "...",
  "hashtags": ["...", "...", "..."],
  "altTexts": [
    { "sectionId": "s1", "text": "Iceberg metaphor showing visible vs hidden work." },
    ...
  ],
  "sourceAttribution": "...",
  "poll": {
    "question": "...",
    "options": ["...", "...", "...", "..."],
    "intro": "...",
    "followUp": "...",
    "sourceClaimIndexes": [0, 1]
  },
  "documentAd": {
    "documentTitle": "...",
    "adIntro": "...",
    "headline": "...",
    "description": "...",
    "formHeadline": "...",
    "formDetails": "...",
    "cta": "download",
    "thankYouMessage": "...",
    "followUpMessage": "...",
    "sourceClaimIndexes": [0, 1]
  },
  "conversationAd": {
    "openingMessage": "...",
    "senderGuidance": "...",
    "branches": [
      { "id": "learn", "choice": "Understand the idea", "response": "...", "nextStep": "...", "cta": "read_explainer" },
      { "id": "apply", "choice": "Apply it to my team", "response": "...", "nextStep": "...", "cta": "start_conversation" }
    ],
    "noResponseFollowUp": "...",
    "sourceClaimIndexes": [0, 1]
  },
  "newsletterSeries": {
    "seriesTitle": "...",
    "positioning": "...",
    "cadence": "weekly",
    "issues": [
      {
        "issueNumber": 1,
        "subject": "...",
        "previewText": "...",
        "headline": "...",
        "opening": "...",
        "sections": [{ "heading": "...", "takeaway": "..." }],
        "cta": "...",
        "sourceClaimIndexes": [0, 1]
      }
    ]
  }
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
    "Key claims (all package sourceClaimIndexes refer to these):",
    ...comprehension.keyClaims.map((claim, index) => `  [${index}] ${claim}`),
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
        max_tokens: 4800,
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
    if (parsedRaw.poll && typeof parsedRaw.poll === "object") {
      const poll = parsedRaw.poll as Record<string, unknown>;
      if (Array.isArray(poll.options)) {
        poll.options = poll.options
          .map((option) => typeof option === "string" ? option.trim().slice(0, 30) : "")
          .filter(Boolean)
          .slice(0, 4);
      }
      if (Array.isArray(poll.sourceClaimIndexes)) {
        poll.sourceClaimIndexes = poll.sourceClaimIndexes
          .filter((index) => Number.isInteger(index) && Number(index) >= 0 && Number(index) < comprehension.keyClaims.length)
          .slice(0, 3);
      }
    }
    if (parsedRaw.documentAd && typeof parsedRaw.documentAd === "object") {
      const documentAd = parsedRaw.documentAd as Record<string, unknown>;
      if (Array.isArray(documentAd.sourceClaimIndexes)) {
        documentAd.sourceClaimIndexes = documentAd.sourceClaimIndexes
          .filter((index) => Number.isInteger(index) && Number(index) >= 0 && Number(index) < comprehension.keyClaims.length)
          .slice(0, 3);
      }
    }
    if (parsedRaw.conversationAd && typeof parsedRaw.conversationAd === "object") {
      const conversationAd = parsedRaw.conversationAd as Record<string, unknown>;
      if (Array.isArray(conversationAd.branches)) {
        const seen = new Set<string>();
        conversationAd.branches = conversationAd.branches
          .filter((branch) => branch && typeof branch === "object")
          .map((branch, index) => {
            const item = branch as Record<string, unknown>;
            let id = typeof item.id === "string" ? item.id.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30) : `branch-${index + 1}`;
            if (!id || seen.has(id)) id = `branch-${index + 1}`;
            seen.add(id);
            return { ...item, id, choice: typeof item.choice === "string" ? item.choice.trim().slice(0, 40) : "" };
          })
          .filter((branch) => branch.choice)
          .slice(0, 4);
      }
      if (Array.isArray(conversationAd.sourceClaimIndexes)) {
        conversationAd.sourceClaimIndexes = conversationAd.sourceClaimIndexes
          .filter((index) => Number.isInteger(index) && Number(index) >= 0 && Number(index) < comprehension.keyClaims.length)
          .slice(0, 4);
      }
    }
    if (parsedRaw.newsletterSeries && typeof parsedRaw.newsletterSeries === "object") {
      const newsletter = parsedRaw.newsletterSeries as Record<string, unknown>;
      if (Array.isArray(newsletter.issues)) {
        newsletter.issues = newsletter.issues.slice(0, 3).map((issue, index) => {
          if (!issue || typeof issue !== "object") return issue;
          const item = issue as Record<string, unknown>;
          if (Array.isArray(item.sourceClaimIndexes)) {
            item.sourceClaimIndexes = item.sourceClaimIndexes
              .filter((claimIndex) => Number.isInteger(claimIndex) && Number(claimIndex) >= 0 && Number(claimIndex) < comprehension.keyClaims.length)
              .slice(0, 3);
          }
          if (Array.isArray(item.sections)) item.sections = item.sections.slice(0, 4);
          return { ...item, issueNumber: index + 1 };
        });
      }
    }

    return parseWithFeedback(SocialPackSchema, parsedRaw);
  });
}
