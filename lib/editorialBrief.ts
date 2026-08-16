import type {
  AudienceLevel,
  CleanArticle,
  Comprehension,
  EditorialBrief,
  PublishingGoal,
} from "./shared/schemas";

const GOAL_OUTCOME: Record<PublishingGoal, string> = {
  teach: "Make the central idea easy to understand and remember.",
  key_findings: "Surface the strongest evidence and most useful findings.",
  make_argument: "Build a persuasive, evidence-led point of view.",
  promote_source: "Create curiosity while preserving the source's substance.",
  start_discussion: "Give the audience a sharp premise worth responding to.",
};

export function buildEditorialBrief(input: {
  article: CleanArticle;
  comprehension: Comprehension;
  audience: AudienceLevel;
  publishingGoal: PublishingGoal;
}): EditorialBrief {
  const { article, comprehension, audience, publishingGoal } = input;
  const claims = comprehension.keyClaims.filter(Boolean);
  const core = comprehension.coreIdea || comprehension.oneLineSummary;
  const directions = [
    {
      id: "essential",
      name: "Essential insight",
      hook: core.slice(0, 220),
      angle: `Explain the source through its single most important idea, then support it with ${Math.min(3, claims.length)} concrete claims.`,
      outcome: GOAL_OUTCOME[publishingGoal],
    },
    {
      id: "evidence",
      name: "Evidence first",
      hook: (claims[0] || core).slice(0, 220),
      angle: "Lead with the strongest specific finding, show what supports it, and close with what the evidence changes.",
      outcome: "Give skeptical readers a credible, source-grounded reason to care.",
    },
    {
      id: "contrarian",
      name: "Tension & consequence",
      hook: `The important part isn't the headline — it's what follows from it.`.slice(0, 220),
      angle: `Frame the tension inside “${article.title}”, reveal the less-obvious implication, and invite the reader to reconsider the default view.`,
      outcome: "Create a distinctive narrative with a strong discussion hook.",
    },
  ];
  return {
    sourceTitle: article.title,
    sourceSummary: comprehension.oneLineSummary,
    audience,
    publishingGoal,
    directions,
    selectedDirectionId: directions[0].id,
  };
}
