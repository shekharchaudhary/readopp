import { randomUUID } from "node:crypto";
import type {
  AudienceLevel,
  PublishingGoal,
  Comprehension,
  Explainer,
  ExplainerOutline,
  RenderedPanel,
  ResumeDoc,
  VoiceProfileId,
} from "../shared/schemas";

/**
 * Pure-code assembly: order panels by the outline, attach title + summary.
 * No LLM call — assembly is deterministic in v0.1 (see docs/agents/06_assembly.md).
 */
export function runAssembly(input: {
  jobId: string;
  url: string;
  audienceLevel: AudienceLevel;
  publishingGoal: PublishingGoal;
  voiceProfileId: VoiceProfileId;
  outline: ExplainerOutline;
  comprehension: Comprehension;
  panels: RenderedPanel[];
  /** Structured résumé source, present only for resume explainers. */
  resumeDoc?: ResumeDoc;
}): Explainer {
  const orderById = new Map<string, number>();
  input.outline.sections.forEach((s, i) => orderById.set(s.id, i));

  const ordered = [...input.panels].sort((a, b) => {
    const ai = orderById.get(a.sectionId) ?? 999;
    const bi = orderById.get(b.sectionId) ?? 999;
    return ai - bi;
  });
  const usedClaimIndexes = new Set<number>();
  const evidencePanels = input.outline.sections.map((section) => {
    const claims = section.sourceClaimIndexes
      .map((index) => {
        const claim = input.comprehension.keyClaims[index];
        if (claim) usedClaimIndexes.add(index);
        return claim;
      })
      .filter((claim): claim is string => Boolean(claim));
    return {
      sectionId: section.id,
      heading: section.heading,
      claims,
      grounded: claims.length > 0,
    };
  });
  const claimCount = input.comprehension.keyClaims.length;
  const evidenceMap = {
    claimCount,
    coveredClaimCount: usedClaimIndexes.size,
    coveragePercent: claimCount > 0 ? Math.round((usedClaimIndexes.size / claimCount) * 100) : 100,
    panels: evidencePanels,
  };

  return {
    id: randomUUID(),
    jobId: input.jobId,
    url: input.url,
    title: input.outline.title,
    summary: input.comprehension.oneLineSummary,
    audienceLevel: input.audienceLevel,
    publishingGoal: input.publishingGoal,
    voiceProfileId: input.voiceProfileId,
    panels: ordered,
    ...(!input.resumeDoc ? { evidenceMap } : {}),
    createdAt: new Date().toISOString(),
    ...(input.resumeDoc ? { resumeDoc: input.resumeDoc } : {}),
  };
}
