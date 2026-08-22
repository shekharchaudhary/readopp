import type { BrandStyle, ContentFeatures, Explainer, Genre, TemplateId, VisualType } from "../shared/schemas";
import { listAvailableTemplates } from "./registry";

export interface TemplateRecommendation { id: TemplateId; reason: string; score: number; }
export interface DesignSignals { genre?: Genre; contentFeatures?: ContentFeatures; requestedStyle?: BrandStyle; }
interface ScoreNote { points: number; reason: string; }

/** Rank visual identities from editorial signals, not aesthetic randomness. */
export function recommendTemplates(
  explainer: Explainer,
  signals: DesignSignals = {},
  allowedIds?: ReadonlySet<TemplateId>
): TemplateRecommendation[] {
  const visualTypes = new Set(explainer.panels.map((panel) => panel.plan?.visualType).filter(Boolean));
  const hasAny = (types: VisualType[]) => types.some((type) => visualTypes.has(type));
  const notes = new Map<TemplateId, ScoreNote[]>();
  const add = (ids: TemplateId[], points: number, reason: string) => {
    for (const id of ids) {
      if (allowedIds && !allowedIds.has(id)) continue;
      notes.set(id, [...(notes.get(id) ?? []), { points, reason }]);
    }
  };

  // Swiss Social is the mature product system. Other identities remain as
  // optional experiments, so their topical fit should not outrank the
  // system's mobile legibility and cross-panel consistency.
  add(["swiss-poster"], 24, "Built for clear, mobile-first social publishing");
  add(["tachyon", "highlighter-reader"], 1, "A versatile fit for clear visual explanation");

  if (signals.requestedStyle === "clean") add(["tachyon", "swiss-poster", "new-yorker-frame"], 5, "Matches the requested clean, restrained visual voice");
  else if (signals.requestedStyle === "bold") add(["editorial-brutalist", "tabloid-splash", "risograph-zine", "sticky-notes"], 5, "Matches the requested bold, feed-first visual voice");
  else if (signals.requestedStyle === "editorial") add(["highlighter-reader", "editorial-broadsheet", "kindle-highlight", "new-yorker-frame"], 5, "Matches the requested editorial reading voice");

  const genre = signals.genre;
  if (genre === "research_paper") add(["editorial-broadsheet", "bento-grid", "engineering-spec"], 7, "Gives research evidence a credible, structured frame");
  else if (genre === "whitepaper") add(["bento-grid", "editorial-broadsheet", "swiss-poster"], 7, "Balances business evidence with a clear recommendation");
  else if (genre === "documentation") add(["engineering-spec", "notebook-cell", "terminal-brutalist"], 7, "Speaks in the source’s technical document language");
  else if (genre === "book_chapter") add(["highlighter-reader", "kindle-highlight", "new-yorker-frame"], 7, "Keeps the source feeling like a reading artifact");
  else if (genre === "news") add(["editorial-broadsheet", "tabloid-splash", "magazine-cover"], 7, "Uses a familiar publication frame for a timely story");
  else if (genre === "resume") add(["bento-grid", "tachyon", "swiss-poster"], 6, "Keeps career information modular and easy to scan");

  const features = signals.contentFeatures;
  if (features?.hasCode) add(["notebook-cell", "terminal-brutalist", "engineering-spec"], 7, "The source contains code and benefits from developer-native framing");
  if (features?.hasNumericData || features?.hasCharts) add(["bento-grid", "editorial-broadsheet", "receipt", "swiss-poster"], 6, "Makes the source’s numbers and comparisons easy to scan");
  if (features?.hasDates) add(["editorial-broadsheet", "boarding-pass", "swiss-poster"], 3, "Supports the source’s chronological structure");

  if (hasAny(["chart", "stat_callout", "key_findings", "comparison"])) {
    add(["bento-grid", "editorial-broadsheet", "receipt", "swiss-poster"], 6, "The panel plan is evidence-led and needs strong information hierarchy");
  }
  if (hasAny(["quote_card", "insight", "definition_card"])) {
    add(["highlighter-reader", "kindle-highlight", "new-yorker-frame", "magazine-cover"], 5, "The story is carried by language, quotes, and a central idea");
  }
  if (explainer.audienceLevel === "technical" || hasAny(["flowchart", "structural", "annotated_hero"])) {
    add(["engineering-spec", "terminal-brutalist", "notebook-cell", "bento-grid", "tachyon"], 6, "Fits a technical audience and system-oriented panel plan");
  }
  if (hasAny(["metaphor", "framework", "before_after"])) {
    add(["swiss-poster", "sticky-notes", "highlighter-reader"], 4, "Lets a conceptual narrative stay simple and memorable");
  }

  if (explainer.publishingGoal === "promote_source") add(["magazine-cover", "aurora-glass", "new-yorker-frame"], 7, "Creates curiosity without replacing the original source");
  else if (explainer.publishingGoal === "start_discussion") add(["sticky-notes", "editorial-brutalist", "tabloid-splash"], 7, "Makes the central tension conversational and hard to ignore");
  else if (explainer.publishingGoal === "make_argument") add(["swiss-poster", "editorial-broadsheet", "editorial-brutalist"], 7, "Gives a point of view disciplined hierarchy and authority");
  else if (explainer.publishingGoal === "key_findings") add(["editorial-broadsheet", "bento-grid", "receipt"], 7, "Organizes findings as evidence rather than decoration");
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
      const reasons = [...new Set(contributions.map((item) => item.reason))].slice(0, 2);
      return { id: template.id, score, reason: reasons.join(" · ") || template.tagline, stableIndex };
    })
    .sort((a, b) => b.score - a.score || a.stableIndex - b.stableIndex)
    .map(({ stableIndex: _stableIndex, ...recommendation }) => recommendation);
}
