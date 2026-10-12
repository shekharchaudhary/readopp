import type { RenderedPanel, TemplateId } from "../shared/schemas";
import { panelItems, panelPrimary } from "./panelCopy";

export const PANEL_LAYOUT_IDS = [
  "cover",
  "priorities",
  "hierarchy",
  "radial",
  "architecture",
  "chart",
  "diverging",
  "report",
  "contents",
  "essay",
] as const;

export type PanelLayoutId = (typeof PANEL_LAYOUT_IDS)[number];

export interface PanelLayoutChoice {
  id: PanelLayoutId;
  name: string;
  description: string;
}

export const PANEL_LAYOUTS: Record<PanelLayoutId, PanelLayoutChoice> = {
  cover: { id: "cover", name: "Editorial cover", description: "Oversized hook with a strong visual field." },
  priorities: { id: "priorities", name: "Numbered framework", description: "A mature sequence for steps and takeaways." },
  hierarchy: { id: "hierarchy", name: "Hierarchy infographic", description: "Levels, tiers, and structured comparisons." },
  radial: { id: "radial", name: "Radial system", description: "One central idea with connected concepts." },
  architecture: { id: "architecture", name: "System architecture", description: "Grouped components and directional flow." },
  chart: { id: "chart", name: "Data story", description: "A clean evidence-led chart composition." },
  diverging: { id: "diverging", name: "Rising and falling", description: "Positive and negative change around a baseline." },
  report: { id: "report", name: "Research report", description: "Editorial density for sourced explanations." },
  contents: { id: "contents", name: "Editorial contents", description: "A publication-style index with a strong visual crop." },
  essay: { id: "essay", name: "Editorial essay", description: "Large argument-led typography with a clear reading rhythm." },
};

const ADAPTIVE_TEMPLATES = new Set<TemplateId>([
  "adaptive-editorial",
  "editorial-report",
  "modern-technical",
  "data-story",
  "bold-social",
]);

const SEMANTIC_PANEL_LAYOUTS = new Set<PanelLayoutId>([
  "chart",
  "diverging",
  "architecture",
  "radial",
]);

function layoutMetrics(panel: RenderedPanel) {
  const plan = panel.plan;
  const points = plan?.chart?.series.flatMap((series) => series.points) ?? [];
  const items = panelItems(panel);
  return {
    plan,
    points,
    itemCount: items.length,
    nodeCount: Math.max(plan?.nodes?.length ?? 0, items.length),
    primaryLength: panelPrimary(panel).trim().length,
  };
}

export function templateSupportsPanelLayouts(template?: TemplateId): boolean {
  return Boolean(template && ADAPTIVE_TEMPLATES.has(template));
}

export function panelLayoutCompatibility(
  panel: RenderedPanel,
  layout: PanelLayoutId
): { compatible: boolean; reason?: string } {
  const { points, itemCount, nodeCount } = layoutMetrics(panel);

  if (layout === "chart" && points.length < 2) {
    return { compatible: false, reason: "Needs numeric evidence" };
  }
  if (
    layout === "diverging" &&
    !(points.some((point) => point.value > 0) && points.some((point) => point.value < 0))
  ) {
    return { compatible: false, reason: "Needs positive and negative values" };
  }
  if (layout === "architecture" && nodeCount < 3) {
    return { compatible: false, reason: "Needs at least three system nodes" };
  }
  if (layout === "radial" && Math.max(nodeCount, itemCount) < 3) {
    return { compatible: false, reason: "Needs at least three connected ideas" };
  }
  if (["priorities", "hierarchy", "contents"].includes(layout) && itemCount < 2) {
    return { compatible: false, reason: "Needs a list, framework, or comparison" };
  }
  return { compatible: true };
}

/** A concise, content-specific explanation shown beside recommended layouts. */
export function panelLayoutRecommendationReason(
  panel: RenderedPanel,
  layout: PanelLayoutId,
  panelIndex: number
): string {
  const { plan, points, itemCount, nodeCount } = layoutMetrics(panel);

  switch (layout) {
    case "diverging":
      return `Makes your ${points.length} positive and negative values easy to compare`;
    case "chart":
      return `Turns ${points.length} numeric data points into the visual evidence`;
    case "architecture":
      return `Shows how ${nodeCount} system components connect`;
    case "radial":
      return `Organizes ${Math.max(nodeCount, itemCount)} ideas around one central concept`;
    case "priorities":
      if (plan?.careerTimeline) return `Turns ${itemCount} career chapters into a clear visual sequence`;
      if (plan?.timeline) return `Makes ${itemCount} milestones easy to follow in order`;
      if (plan?.framework) return `Turns all ${itemCount} steps into a scannable framework`;
      if (plan?.keyFindings) return `Gives ${itemCount} sourced findings a clear reading order`;
      return `Gives ${itemCount} takeaways a clear reading order`;
    case "hierarchy":
      if (plan?.skillsMatrix) return `Groups ${itemCount} skill areas into a structured visual system`;
      if (plan?.comparison || plan?.beforeAfter) return "Makes the contrast and progression immediately visible";
      return `Clarifies the levels across ${itemCount} structured points`;
    case "contents":
      return `Presents ${itemCount} sections with an editorial publication rhythm`;
    case "cover":
      if (plan?.stat) return `Gives ${plan.stat.value} the visual emphasis it deserves`;
      if (plan?.definitionCard) return `Makes “${plan.definitionCard.term}” instantly understandable`;
      if (plan?.quoteCard) return "Lets the source's strongest line carry the panel";
      if (plan?.profileCard) return `Introduces ${plan.profileCard.name} with a strong editorial profile`;
      return panelIndex === 1
        ? "Creates a strong opening hook for the carousel"
        : "Gives this panel's central claim maximum emphasis";
    case "essay":
      return "Fits a nuanced argument with supporting context";
    case "report":
      return "Balances the source argument, evidence, and supporting detail";
  }
}

/**
 * Short, human-readable signals for the layout picker. These expose the
 * evidence behind Readopp's ranking without asking the user to understand
 * visual-type enums or an opaque score.
 */
export function panelLayoutSignalLabels(panel: RenderedPanel): string[] {
  const { plan, points, itemCount, nodeCount } = layoutMetrics(panel);
  const signals: string[] = [];

  if (points.length >= 2) signals.push(`${points.length} data points`);
  if (plan?.careerTimeline) signals.push(`${plan.careerTimeline.roles.length} career chapters`);
  else if (plan?.timeline) signals.push(`${plan.timeline.length} milestones`);
  else if (plan?.skillsMatrix) {
    const skills = plan.skillsMatrix.groups.reduce(
      (total, group) => total + group.skills.length,
      0
    );
    signals.push(`${skills} skills in ${plan.skillsMatrix.groups.length} groups`);
  } else if (plan?.annotatedHero) {
    signals.push(`${plan.annotatedHero.annotations.length} annotations`);
  } else if (plan?.profileCard?.stats.length) {
    signals.push(`${plan.profileCard.stats.length} profile facts`);
  } else if (nodeCount >= 3) signals.push(`${nodeCount} connected nodes`);
  else if (itemCount >= 2) signals.push(`${itemCount} structured points`);

  if (plan?.comparison || plan?.beforeAfter) signals.push("comparison");
  else if (
    plan?.visualType === "insight" ||
    plan?.visualType === "quote_card" ||
    plan?.visualType === "definition_card"
  ) {
    signals.push("one core idea");
  } else if (
    plan?.visualType === "flowchart" ||
    plan?.visualType === "structural" ||
    plan?.visualType === "annotated_hero"
  ) {
    signals.push("system structure");
  } else if (!signals.length) {
    signals.push("editorial argument");
  }

  return [...new Set(signals)].slice(0, 3);
}

/** The exact automatic layout used by the renderer. panelIndex is one-based. */
export function chooseAdaptivePanelLayout(
  panel: RenderedPanel,
  panelIndex: number
): PanelLayoutId {
  const requested = panel.layoutVariant;
  if (requested && requested !== "auto") {
    const compatibility = panelLayoutCompatibility(panel, requested);
    if (compatibility.compatible) return requested;
  }

  const { plan, points, itemCount, nodeCount, primaryLength } = layoutMetrics(panel);
  if (points.some((point) => point.value < 0) && points.some((point) => point.value > 0)) return "diverging";
  if (points.length >= 2) return "chart";
  if ((plan?.nodes?.length ?? 0) >= 4 && (plan?.edges?.length ?? 0) >= 3) return "architecture";
  if (plan?.visualType === "annotated_hero" && itemCount >= 3) return "radial";
  if (
    (plan?.visualType === "metaphor" || (plan?.nodes?.length ?? 0) >= 4) &&
    nodeCount >= 3 &&
    nodeCount <= 7
  ) return "radial";
  if (plan?.visualType === "skills_matrix" && itemCount >= 2) return "hierarchy";
  if (
    itemCount >= 2 &&
    (plan?.visualType === "career_timeline" ||
      plan?.visualType === "timeline" ||
      plan?.visualType === "framework" ||
      plan?.visualType === "key_findings")
  ) {
    return "priorities";
  }
  if (plan?.comparison || plan?.beforeAfter) return "hierarchy";
  if (
    panelIndex === 1 ||
    plan?.visualType === "insight" ||
    plan?.visualType === "quote_card" ||
    plan?.visualType === "definition_card" ||
    plan?.visualType === "stat_callout" ||
    plan?.visualType === "profile_card"
  ) return "cover";
  return primaryLength >= 240 ? "essay" : "report";
}

/**
 * Resolve automatic layouts as a sequence, not a collection of isolated
 * cards. Highly semantic diagrams keep their best-fit composition; flexible
 * editorial panels rotate between equally suitable choices when they would
 * otherwise repeat back-to-back. Explicit user choices are never changed.
 */
export function chooseCarouselPanelLayouts(
  panels: readonly RenderedPanel[]
): PanelLayoutId[] {
  const resolved: PanelLayoutId[] = [];
  const usage = new Map<PanelLayoutId, number>();

  panels.forEach((panel, index) => {
    const panelIndex = index + 1;
    const explicit = panel.layoutVariant && panel.layoutVariant !== "auto";
    const automaticPanel = explicit
      ? panel
      : { ...panel, layoutVariant: "auto" as const };
    const base = chooseAdaptivePanelLayout(automaticPanel, panelIndex);
    let selected = base;
    const previous = resolved[index - 1];

    if (!explicit && !SEMANTIC_PANEL_LAYOUTS.has(base) && previous === base) {
      const alternatives = suggestedPanelLayouts(automaticPanel, panelIndex)
        .slice(0, 3)
        .map((choice) => choice.id)
        .filter((layout) => layout !== previous)
        .filter((layout) => base === "cover" || layout !== "cover")
        .sort(
          (a, b) =>
            (usage.get(a) ?? 0) - (usage.get(b) ?? 0)
        );
      selected = alternatives[0] ?? base;
    }

    resolved.push(selected);
    usage.set(selected, (usage.get(selected) ?? 0) + 1);
  });

  return resolved;
}

export function chooseCarouselPanelLayout(
  panels: readonly RenderedPanel[],
  panelIndex: number,
  /**
   * Streaming pages can render slot 3 before slots 1–2 have arrived, so the
   * compact list of ready panels does not yet contain `panelIndex - 1`.
   * Supplying the visible panel preserves its real slot-aware layout without
   * asking the sequence resolver to read an undefined array entry.
   */
  visiblePanel?: RenderedPanel
): PanelLayoutId {
  const sequenceLayout = chooseCarouselPanelLayouts(panels)[panelIndex - 1];
  if (sequenceLayout) return sequenceLayout;
  const target = panels[panelIndex - 1] ?? visiblePanel;
  if (target) return chooseAdaptivePanelLayout(target, panelIndex);
  // Fail visibly but safely for an incomplete caller. Once the panel arrives,
  // React recomputes the real content-aware choice.
  return panelIndex === 1 ? "cover" : "report";
}

const IDENTITY_LAYOUT_PREFERENCES: Partial<Record<TemplateId, PanelLayoutId[]>> = {
  "editorial-report": ["essay", "report", "contents", "cover"],
  "modern-technical": ["architecture", "hierarchy", "radial", "cover", "report"],
  "data-story": ["chart", "diverging", "priorities", "report"],
  "bold-social": ["radial", "cover", "priorities", "hierarchy"],
};

const IDENTITY_LABELS: Partial<Record<TemplateId, string>> = {
  "adaptive-editorial": "Adaptive Editorial",
  "editorial-report": "Editorial Report",
  "modern-technical": "Modern Technical",
  "data-story": "Data Story",
  "bold-social": "Bold Social",
};

export function panelLayoutIdentityLabel(template: TemplateId): string {
  return IDENTITY_LABELS[template] ?? "selected story";
}

/**
 * Resolve the exact composition a story identity renders. Automatic panels
 * use the identity's own compatible composition family; explicit per-panel
 * choices always win so a user's layout decision is never silently changed.
 */
export function chooseTemplatePanelLayout(
  panels: readonly RenderedPanel[],
  panelIndex: number,
  visiblePanel: RenderedPanel,
  template: TemplateId
): PanelLayoutId {
  const base = chooseCarouselPanelLayout(panels, panelIndex, visiblePanel);
  const explicit =
    visiblePanel.layoutVariant && visiblePanel.layoutVariant !== "auto";
  if (explicit || template === "adaptive-editorial") return base;

  // A visual identity controls typography, palette, framing, and rhythm; it
  // must not turn genuine data or system structure into a less truthful
  // composition merely to vary the sequence.
  if (
    SEMANTIC_PANEL_LAYOUTS.has(base) &&
    panelLayoutCompatibility(visiblePanel, base).compatible
  ) {
    return base;
  }

  const preferences = IDENTITY_LAYOUT_PREFERENCES[template] ?? [];
  if (!preferences.length) return base;
  const compatiblePreferences = preferences.filter(
    (layout) => panelLayoutCompatibility(visiblePanel, layout).compatible
  );
  if (
    panelLayoutCompatibility(visiblePanel, base).compatible &&
    !compatiblePreferences.includes(base)
  ) {
    compatiblePreferences.push(base);
  }
  if (!compatiblePreferences.length) return base;

  const offset = (panelIndex - 1) % compatiblePreferences.length;
  const rotated = [
    ...compatiblePreferences.slice(offset),
    ...compatiblePreferences.slice(0, offset),
  ];
  const previousPanel = panels[panelIndex - 2];
  const previousLayout = previousPanel
    ? chooseTemplatePanelLayout(
        panels,
        panelIndex - 1,
        previousPanel,
        template
      )
    : undefined;

  return rotated.find((layout) => layout !== previousLayout) ?? rotated[0] ?? base;
}

/**
 * Content-aware ordering. The automatic choice stays first, then every other
 * compatible design, followed by labelled incompatible designs. This keeps
 * the three visible recommendations genuinely usable for the current panel.
 */
export function suggestedPanelLayouts(
  panel: RenderedPanel,
  panelIndex: number
): PanelLayoutChoice[] {
  const automatic = chooseAdaptivePanelLayout(
    { ...panel, layoutVariant: "auto" },
    panelIndex
  );
  const preferred: PanelLayoutId[] =
    automatic === "diverging" ? ["diverging", "chart", "report"] :
    automatic === "chart" ? ["chart", "report", "essay"] :
    automatic === "architecture" ? ["architecture", "radial", "report"] :
    automatic === "radial" ? ["radial", "architecture", "report"] :
    automatic === "priorities" ? ["priorities", "hierarchy", "contents"] :
    automatic === "hierarchy" ? ["hierarchy", "priorities", "architecture"] :
    automatic === "cover" ? ["cover", "essay", "report"] :
    automatic === "essay" ? ["essay", "report", "cover"] :
    ["report", "essay", "cover"];
  const preferredSet = new Set(preferred);
  const rest = PANEL_LAYOUT_IDS.filter((id) => !preferredSet.has(id));
  const ordered = [...preferred, ...rest];
  const compatible = ordered.filter(
    (id) => panelLayoutCompatibility(panel, id).compatible
  );
  const incompatible = ordered.filter(
    (id) => !panelLayoutCompatibility(panel, id).compatible
  );
  return [...compatible, ...incompatible].map((id) => PANEL_LAYOUTS[id]);
}

/**
 * Rank the gallery through the same identity-aware resolver used by the
 * rendered panel and canvas seed. The actual automatic composition is always
 * first, then compatible members of the identity's visual family, then the
 * generic content-aware alternatives. Incompatible options remain available
 * under Explore more with a clear reason.
 */
export function suggestedTemplatePanelLayouts(
  panel: RenderedPanel,
  panelIndex: number,
  template: TemplateId,
  panels: readonly RenderedPanel[] = [panel]
): PanelLayoutChoice[] {
  const automaticPanel = { ...panel, layoutVariant: "auto" as const };
  const automaticPanels = panels.map((candidate) =>
    candidate.sectionId === panel.sectionId
      ? automaticPanel
      : candidate
  );
  const automatic = chooseTemplatePanelLayout(
    automaticPanels,
    panelIndex,
    automaticPanel,
    template
  );
  const generic = suggestedPanelLayouts(automaticPanel, panelIndex).map(
    (choice) => choice.id
  );
  const identityFamily = IDENTITY_LAYOUT_PREFERENCES[template] ?? [];
  const ordered = [...new Set<PanelLayoutId>([automatic, ...identityFamily, ...generic])];
  const compatible = ordered.filter(
    (id) => panelLayoutCompatibility(panel, id).compatible
  );
  const incompatible = ordered.filter(
    (id) => !panelLayoutCompatibility(panel, id).compatible
  );
  return [...compatible, ...incompatible].map((id) => PANEL_LAYOUTS[id]);
}
