import { randomUUID } from "node:crypto";
import type {
  AudienceLevel,
  Comprehension,
  Explainer,
  ExplainerOutline,
  RenderedPanel,
} from "../shared/schemas";

/**
 * Pure-code assembly: order panels by the outline, attach title + summary.
 * No LLM call — assembly is deterministic in v0.1 (see docs/agents/06_assembly.md).
 */
export function runAssembly(input: {
  jobId: string;
  url: string;
  audienceLevel: AudienceLevel;
  outline: ExplainerOutline;
  comprehension: Comprehension;
  panels: RenderedPanel[];
}): Explainer {
  const orderById = new Map<string, number>();
  input.outline.sections.forEach((s, i) => orderById.set(s.id, i));

  const ordered = [...input.panels].sort((a, b) => {
    const ai = orderById.get(a.sectionId) ?? 999;
    const bi = orderById.get(b.sectionId) ?? 999;
    return ai - bi;
  });

  return {
    id: randomUUID(),
    jobId: input.jobId,
    url: input.url,
    title: input.outline.title,
    summary: input.comprehension.oneLineSummary,
    audienceLevel: input.audienceLevel,
    panels: ordered,
    createdAt: new Date().toISOString(),
  };
}
