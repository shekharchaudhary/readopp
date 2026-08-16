import { cachedSystem, callMessages, MODEL_STRONG } from "../anthropic";
import { PanelPlanSchema, type PanelPlan, type PublishingGoal } from "../shared/schemas";
import { extractJson, parseWithFeedback, withRetry } from "./util";

const SYSTEM = `You revise ONE existing visual PanelPlan using user guidance.
Preserve sectionId and factual meaning. Never invent facts, statistics, quotes, names, or dates.
You may improve hierarchy, shorten copy, change visualType only when the existing plan already
contains enough factual material for that type, and rewrite the caption for the publishing goal.
Return the complete valid PanelPlan JSON only.`;

export async function regeneratePanelPlan(input: {
  plan: PanelPlan;
  heading: string;
  hint: string;
  publishingGoal: PublishingGoal;
}): Promise<PanelPlan> {
  return withRetry(`regeneratePanel[${input.plan.sectionId}]`, async (retryHint) => {
    const res = await callMessages({
      model: MODEL_STRONG,
      max_tokens: 2048,
      temperature: 0.45,
      system: cachedSystem(SYSTEM),
      messages: [{ role: "user", content: [retryHint || null, `Publishing goal: ${input.publishingGoal}`, `Current heading: ${input.heading}`, `User guidance: ${input.hint}`, "Existing PanelPlan:", JSON.stringify(input.plan, null, 2)].filter(Boolean).join("\n\n") }],
    }, { label: `regeneratePanel[${input.plan.sectionId}]` });
    const text = res.content.map((b) => b.type === "text" ? b.text : "").join("");
    const parsed = JSON.parse(extractJson(text)) as Record<string, unknown>;
    parsed.sectionId = input.plan.sectionId;
    return parseWithFeedback(PanelPlanSchema, parsed);
  });
}
