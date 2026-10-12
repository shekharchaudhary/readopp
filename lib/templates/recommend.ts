import type { BrandStyle, ContentFeatures, Explainer, Genre, TemplateId, VisualType } from "../shared/schemas";
import { listAvailableTemplates } from "./registry";

export interface TemplateRecommendation {
  id: TemplateId;
  /** The strongest story signal that influenced this recommendation. */
  signal: string;
  /** The concrete visual outcome this identity produces. */
  outcome: string;
  /** Compact backwards-compatible summary for non-picker consumers. */
  reason: string;
  score: number;
}
export interface DesignSignals { genre?: Genre; contentFeatures?: ContentFeatures; requestedStyle?: BrandStyle; }
interface ScoreNote {
  points: number;
  reason: string;
  /** Baseline confidence keeps mature systems ahead of experiments, but it
   * should not be presented as the explanation when a story-specific signal
   * is available. */
  baseline?: boolean;
}

const IDENTITY_OUTCOMES: Partial<Record<TemplateId, string>> = {
  "adaptive-editorial":
    "Varies the composition panel by panel while keeping one calm, coherent carousel.",
  "editorial-report":
    "Adds research-paper authority, disciplined typography, and an evidence-first reading order.",
  "modern-technical":
    "Turns systems and frameworks into restrained technical diagrams without visual clutter.",
  "data-story":
    "Makes charts, comparisons, and findings fast to scan on a phone.",
  "bold-social":
    "Gives the central argument a large hook and decisive feed contrast.",
};

const VISUAL_TYPE_LABELS: Partial<Record<VisualType, string>> = {
  chart: "evidence and chart",
  stat_callout: "key-number",
  key_findings: "key-finding",
  comparison: "comparison",
  flowchart: "process",
  structural: "system",
  annotated_hero: "annotated visual",
  quote_card: "quote-led",
  insight: "insight",
  definition_card: "definition",
  metaphor: "conceptual",
  framework: "framework",
  before_after: "before-and-after",
  timeline: "timeline",
  career_timeline: "career-progression",
  profile_card: "profile",
  skills_matrix: "capability-matrix",
};

function fallbackStorySignal(visualTypes: Set<VisualType>): string {
  const labels = [...visualTypes]
    .map((type) => VISUAL_TYPE_LABELS[type])
    .filter((label): label is string => Boolean(label));
  if (labels.length > 1) {
    return `Your panel plan mixes ${labels.slice(0, 2).join(" and ")} ideas, so it needs varied composition with consistent hierarchy.`;
  }
  if (labels.length === 1) {
    return `Your story is built around a ${labels[0]} idea and needs a clear mobile reading order.`;
  }
  return "Your story needs a clear hierarchy that stays coherent from the opening hook to the final takeaway.";
}

function quotedLabel(value: string | undefined, fallback: string): string {
  const compact = (value || fallback).replace(/\s+/g, " ").trim();
  const clipped = compact.length > 58 ? `${compact.slice(0, 55).trimEnd()}…` : compact;
  return `“${clipped}”`;
}

/** Rank visual identities from editorial signals, not aesthetic randomness. */
export function recommendTemplates(
  explainer: Explainer,
  signals: DesignSignals = {},
  allowedIds?: ReadonlySet<TemplateId>
): TemplateRecommendation[] {
  const visualTypes = new Set<VisualType>(
    explainer.panels
      .map((panel) => panel.plan?.visualType)
      .filter((type): type is VisualType => Boolean(type))
  );
  const hasAny = (types: VisualType[]) => types.some((type) => visualTypes.has(type));
  const storyLabel = quotedLabel(
    explainer.title,
    explainer.panels[0]?.heading || "this story"
  );
  const panelSignal = (types: VisualType[], consequence: string) => {
    const match = explainer.panels.find(
      (panel) => panel.plan?.visualType && types.includes(panel.plan.visualType)
    );
    if (!match?.plan?.visualType) return `This story ${consequence}.`;
    const label = VISUAL_TYPE_LABELS[match.plan.visualType] ?? "editorial";
    return `The ${label} panel ${quotedLabel(match.heading, explainer.title)} ${consequence}.`;
  };
  const notes = new Map<TemplateId, ScoreNote[]>();
  const add = (
    ids: TemplateId[],
    points: number,
    reason: string,
    baseline = false
  ) => {
    for (const id of ids) {
      if (allowedIds && !allowedIds.has(id)) continue;
      notes.set(id, [
        ...(notes.get(id) ?? []),
        { points, reason, baseline },
      ]);
    }
  };

  // Mature adaptive systems start with a quality baseline; source genre,
  // evidence shape, audience, and publishing intent then determine the
  // recommendation order. Legacy experiments can still be scored by other
  // callers without displacing the mature picker shortlist.
  add(["adaptive-editorial"], 14, "Selects a strong composition for every panel while keeping the carousel coherent", true);
  add(["editorial-report", "modern-technical", "data-story", "bold-social"], 10, "A mature content-led publishing system", true);
  add(["swiss-poster"], 24, "Built for clear, mobile-first social publishing", true);
  add(["tachyon", "highlighter-reader"], 1, "A versatile fit for clear visual explanation", true);

  if (signals.requestedStyle === "clean") add(["adaptive-editorial", "data-story", "modern-technical", "tachyon", "swiss-poster", "new-yorker-frame"], 5, `The visual brief for ${storyLabel} requests a clean, restrained visual voice`);
  // Bold is an intentional, high-contrast direction rather than a neutral
  // formatting preference. Give it enough authority to beat a generic
  // evidence-layout match; otherwise the UI appears to ignore the user's
  // explicit brief whenever the source also contains findings or a chart.
  else if (signals.requestedStyle === "bold") add(["bold-social", "editorial-brutalist", "tabloid-splash", "risograph-zine", "sticky-notes"], 13, `The visual brief for ${storyLabel} requests a bold, feed-first visual voice`);
  else if (signals.requestedStyle === "editorial") add(["editorial-report", "adaptive-editorial", "highlighter-reader", "editorial-broadsheet", "kindle-highlight", "new-yorker-frame"], 8, `The visual brief for ${storyLabel} requests an editorial reading voice`);

  const genre = signals.genre;
  if (genre === "research_paper") add(["editorial-report", "adaptive-editorial", "editorial-broadsheet", "bento-grid", "engineering-spec"], 10, `The research story ${storyLabel} needs a credible, structured evidence frame`);
  else if (genre === "whitepaper") add(["editorial-report", "data-story", "adaptive-editorial", "bento-grid", "editorial-broadsheet", "swiss-poster"], 9, `The whitepaper ${storyLabel} needs business evidence to lead to a clear recommendation`);
  else if (genre === "documentation") add(["modern-technical", "engineering-spec", "notebook-cell", "terminal-brutalist"], 10, `The technical source ${storyLabel} needs a precise, document-native visual language`);
  else if (genre === "book_chapter") add(["highlighter-reader", "kindle-highlight", "new-yorker-frame"], 7, `The chapter ${storyLabel} should retain the feeling of a considered reading artifact`);
  else if (genre === "news") add(["editorial-broadsheet", "tabloid-splash", "magazine-cover"], 7, `The timely story ${storyLabel} benefits from a familiar publication frame`);
  else if (genre === "resume") {
    add(["editorial-report", "adaptive-editorial"], 7, `${storyLabel} needs a credible career narrative rather than a generic résumé page`);
    add(["modern-technical", "data-story"], 5, `${storyLabel} needs roles and capabilities organized for quick professional scanning`);
    add(["bento-grid", "tachyon", "swiss-poster"], 6, "Keeps career information modular and easy to scan");
  }

  const features = signals.contentFeatures;
  if (features?.hasCode) add(["notebook-cell", "terminal-brutalist", "engineering-spec"], 7, `${storyLabel} contains code and benefits from developer-native framing`);
  if (features?.hasNumericData || features?.hasCharts) {
    // A source-level chart signal is stronger than a panel that merely happens
    // to use a chart. Let the purpose-built data identity win that distinction
    // while editorial-report remains the close, evidence-heavy alternative.
    add(["data-story"], 11, `${storyLabel} contains numbers or charts that need a scan-first evidence hierarchy`);
    add(["editorial-report", "bento-grid", "editorial-broadsheet", "receipt", "swiss-poster"], 9, `${storyLabel} contains numbers or charts that need a scan-first evidence hierarchy`);
  }
  if (features?.hasDates) add(["editorial-broadsheet", "boarding-pass", "swiss-poster"], 3, "Supports the source’s chronological structure");
  if (features?.hasRoles) add(["editorial-report", "adaptive-editorial"], 5, `${storyLabel} contains career progression that benefits from an editorial sequence`);
  if (features?.hasSkills) add(["modern-technical", "data-story", "adaptive-editorial"], 5, `${storyLabel} contains grouped capabilities that need a structured visual hierarchy`);

  if (hasAny(["chart", "stat_callout", "key_findings", "comparison"])) {
    add(["data-story", "editorial-report", "adaptive-editorial", "bento-grid", "editorial-broadsheet", "receipt", "swiss-poster"], 8, panelSignal(["chart", "stat_callout", "key_findings", "comparison"], "needs a scan-first evidence hierarchy"));
  }
  if (hasAny(["quote_card", "insight", "definition_card"])) {
    add(["highlighter-reader", "kindle-highlight", "new-yorker-frame", "magazine-cover"], 5, panelSignal(["quote_card", "insight", "definition_card"], "needs typography that carries the central idea"));
  }
  if (explainer.audienceLevel === "technical" || hasAny(["flowchart", "structural", "annotated_hero"])) {
    add(["modern-technical", "engineering-spec", "terminal-brutalist", "notebook-cell", "bento-grid", "tachyon"], 9, panelSignal(["flowchart", "structural", "annotated_hero"], "needs a precise diagram language for its technical audience"));
  }
  if (hasAny(["metaphor", "framework", "before_after"])) {
    add(["swiss-poster", "sticky-notes", "highlighter-reader"], 4, panelSignal(["metaphor", "framework", "before_after"], "needs a simple visual sequence people can remember"));
  }
  if (hasAny(["career_timeline"])) {
    add(["editorial-report"], 14, panelSignal(["career_timeline"], "needs an editorial progression that makes growth and evidence visible"));
    add(["adaptive-editorial"], 8, panelSignal(["career_timeline"], "needs a clear sequence without losing the wider story"));
  }
  if (hasAny(["skills_matrix"])) {
    add(["modern-technical"], 16, panelSignal(["skills_matrix"], "needs a precise hierarchy for grouped capabilities"));
    add(["data-story", "adaptive-editorial"], 8, panelSignal(["skills_matrix"], "needs grouped strengths that remain quick to scan"));
  }
  if (hasAny(["profile_card"])) {
    add(["editorial-report"], 10, panelSignal(["profile_card"], "needs a credible editorial introduction with room for proof"));
    add(["bold-social", "adaptive-editorial"], 7, panelSignal(["profile_card"], "needs a confident opening identity"));
  }

  if (explainer.publishingGoal === "promote_source") add(["magazine-cover", "aurora-glass", "new-yorker-frame"], 7, `${storyLabel} needs curiosity without replacing the original source`);
  else if (explainer.publishingGoal === "start_discussion") add(["bold-social", "sticky-notes", "editorial-brutalist", "tabloid-splash"], 9, `${storyLabel} is meant to start a discussion, so its central tension must be visible in the feed`);
  else if (explainer.publishingGoal === "make_argument") add(["bold-social", "adaptive-editorial", "editorial-report", "swiss-poster", "editorial-broadsheet", "editorial-brutalist"], 8, `${storyLabel} makes an argument that needs disciplined hierarchy and authority`);
  else if (explainer.publishingGoal === "key_findings") add(["data-story", "editorial-report", "editorial-broadsheet", "bento-grid", "receipt"], 9, `${storyLabel} needs its findings organized as evidence rather than decoration`);
  else add(["highlighter-reader", "tachyon", "sticky-notes"], 4, "Keeps an educational story approachable and source-aware");

  if (explainer.audienceLevel === "student") add(["sticky-notes", "highlighter-reader", "notebook-cell"], 3, "Feels approachable for learning and recall");
  else if (explainer.audienceLevel === "professional") add(["swiss-poster", "editorial-broadsheet", "bento-grid"], 3, "Fits a professional audience without losing personality");
  else if (explainer.audienceLevel === "general") add(["highlighter-reader", "tachyon", "sticky-notes"], 3, "Keeps the visual language familiar and easy to enter");

  if (explainer.voiceProfileId === "technical" || explainer.voiceProfileId === "analyst") add(["engineering-spec", "bento-grid", "editorial-broadsheet"], 3, "Matches the selected precise, analytical voice");
  else if (explainer.voiceProfileId === "bold_creator" || explainer.voiceProfileId === "founder") add(["swiss-poster", "editorial-brutalist", "sticky-notes"], 3, "Matches the selected direct, personality-led voice");
  else if (explainer.voiceProfileId === "educator") add(["highlighter-reader", "sticky-notes", "tachyon"], 3, "Matches the selected teaching voice");

  return listAvailableTemplates()
    .filter((template) => !allowedIds || allowedIds.has(template.id))
    .map((template, stableIndex) => {
      const contributions = (notes.get(template.id) ?? []).sort((a, b) => b.points - a.points);
      const score = contributions.reduce((sum, item) => sum + item.points, 0);
      const contextual = contributions.filter((item) => !item.baseline);
      const signal = contextual[0]?.reason ?? fallbackStorySignal(visualTypes);
      const outcome = IDENTITY_OUTCOMES[template.id] ?? template.tagline;
      return {
        id: template.id,
        score,
        signal,
        outcome,
        reason: `${signal} — ${outcome}`,
        stableIndex,
      };
    })
    .sort((a, b) => b.score - a.score || a.stableIndex - b.stableIndex)
    .map(({ stableIndex: _stableIndex, ...recommendation }) => recommendation);
}
