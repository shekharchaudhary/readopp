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
  // One mature visual system adapts its internal composition to the agents'
  // panel plans. Template roulette weakens brand recognition and makes design
  // decorative; Swiss Social is therefore the deliberate default direction.
  const [choice] = recommendTemplates(
    input.explainer,
    {
      genre: input.comprehension.genre,
      contentFeatures: input.comprehension.contentFeatures,
      requestedStyle: input.requestedStyle,
    },
    new Set<TemplateId>(["swiss-poster"])
  );
  const template = choice?.id ?? "swiss-poster";
  return {
    template,
    name: getTemplate(template).name,
    reason: choice?.reason ?? "A clear default for this visual story",
  };
}
