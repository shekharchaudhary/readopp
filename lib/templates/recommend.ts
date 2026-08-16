import type { Explainer, TemplateId } from "../shared/schemas";

export interface TemplateRecommendation {
  id: TemplateId;
  reason: string;
}

/** Deterministic recommendations: fast, explainable, and stable in the UI. */
export function recommendTemplates(explainer: Explainer): TemplateRecommendation[] {
  const visualTypes = new Set(explainer.panels.map((p) => p.plan?.visualType).filter(Boolean));
  const technical = explainer.audienceLevel === "technical" || visualTypes.has("flowchart") || visualTypes.has("structural");
  const dataLed = visualTypes.has("chart") || visualTypes.has("stat_callout") || visualTypes.has("key_findings");

  if (technical) return [
    { id: "engineering-spec", reason: "Built for technical systems and precise evidence" },
    { id: "terminal-brutalist", reason: "A strong developer-native publishing voice" },
    { id: "bento-grid", reason: "Keeps complex information modular and scannable" },
  ];
  if (explainer.publishingGoal === "promote_source") return [
    { id: "magazine-cover", reason: "Creates curiosity without replacing the original" },
    { id: "aurora-glass", reason: "High-impact launch styling for promotion" },
    { id: "new-yorker-frame", reason: "Signals a thoughtful long-form read" },
  ];
  if (explainer.publishingGoal === "start_discussion") return [
    { id: "editorial-brutalist", reason: "Makes the central tension impossible to miss" },
    { id: "sticky-notes", reason: "Feels conversational and open-ended" },
    { id: "galaxy-brain", reason: "A playful format designed for reactions" },
  ];
  if (explainer.publishingGoal === "make_argument") return [
    { id: "swiss-poster", reason: "Clear, disciplined hierarchy for a strong point of view" },
    { id: "editorial-broadsheet", reason: "Balances claims, evidence, and editorial authority" },
    { id: "tabloid-splash", reason: "Best for a provocative argument" },
  ];
  if (dataLed || explainer.publishingGoal === "key_findings") return [
    { id: "bento-grid", reason: "Turns findings into distinct, readable modules" },
    { id: "editorial-broadsheet", reason: "Frames evidence with editorial credibility" },
    { id: "receipt", reason: "Makes a list of findings feel memorable" },
  ];
  return [
    { id: "aurora-glass", reason: "Polished and versatile for educational carousels" },
    { id: "swiss-poster", reason: "Makes one idea clear at a glance" },
    { id: "sticky-notes", reason: "Friendly and approachable for teaching" },
  ];
}
