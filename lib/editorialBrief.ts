import type {
  AudienceLevel,
  CleanArticle,
  Comprehension,
  EditorialBrief,
  PublishingGoal,
} from "./shared/schemas";
import { recommendedPanelCountRange } from "./storyLength";

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
  const consequenceHook = combineGroundedClaims(
    claims[1] || core,
    claims[2] || comprehension.narrativeArc || comprehension.oneLineSummary
  );
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
      name: "Consequence & action",
      hook: consequenceHook,
      angle: `Begin with the less-obvious implication inside “${article.title}”, connect it to the practical response in the source, and close with what the reader can do differently.`,
      outcome: "Turn the source's consequence into a specific, useful action.",
    },
  ];
  return {
    sourceTitle: article.title,
    sourceSummary: comprehension.oneLineSummary,
    audience,
    publishingGoal,
    storyLength: recommendedPanelCountRange(
      comprehension,
      article.wordCount
    ),
    directions,
    selectedDirectionId: directions[0].id,
  };
}

function combineGroundedClaims(first: string, second: string): string {
  const primary = compact(first);
  const followUp = compact(second);
  const combined =
    followUp && followUp.toLocaleLowerCase() !== primary.toLocaleLowerCase()
      ? `${primary} The practical consequence: ${lowerFirst(followUp)}`
      : primary;
  return truncateBrief(combined, 220);
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function lowerFirst(value: string): string {
  return value ? value.charAt(0).toLocaleLowerCase() + value.slice(1) : value;
}

function truncateBrief(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const clipped = value.slice(0, maxLength - 1);
  const boundary = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, boundary > maxLength * 0.65 ? boundary : undefined).trimEnd()}…`;
}
