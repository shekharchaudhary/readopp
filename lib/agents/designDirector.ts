import type { BrandStyle, Comprehension, Explainer, TemplateId } from "../shared/schemas";
import { getTemplate } from "../templates/registry";
import { recommendTemplates } from "../templates/recommend";

export interface DesignDirection { template: TemplateId; name: string; reason: string; }

/** Choose an entitlement-safe initial identity from upstream agent outputs. */
export function runDesignDirector(input: {
  explainer: Explainer;
  comprehension: Comprehension;
  requestedStyle: BrandStyle;
}): DesignDirection {
  // Keep one identity across the carousel, but let the identity adapt each
  // panel's composition to the information it needs to communicate.
  const [choice] = recommendTemplates(
    input.explainer,
    {
      genre: input.comprehension.genre,
      contentFeatures: input.comprehension.contentFeatures,
      requestedStyle: input.requestedStyle,
    },
    new Set<TemplateId>(["adaptive-editorial", "editorial-report", "modern-technical", "data-story", "bold-social"])
  );
  const template = choice?.id ?? "adaptive-editorial";
  return {
    template,
    name: getTemplate(template).name,
    reason: choice?.reason ?? "A cohesive editorial system with a layout chosen for each idea",
  };
}
