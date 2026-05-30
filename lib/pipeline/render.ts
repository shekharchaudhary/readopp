import { callMessages, MODEL_STRONG } from "../anthropic";
import { DESIGN_SYSTEM_PROMPT } from "../render/designSystem";
import { buildFallbackPanel } from "../render/fallbackPanel";
import {
  stripFences,
  validateHtmlPanel,
  validateSvg,
} from "../render/validate";
import type {
  AudienceLevel,
  PanelPlan,
  RenderedPanel,
} from "../shared/schemas";

function targetFormat(plan: PanelPlan): "svg" | "html" {
  if (plan.visualType === "comparison" || plan.visualType === "timeline")
    return "html";
  return "svg";
}

const CAPTION_RULE =
  "IMPORTANT: The `caption` field is rendered by the host page UNDER the visual. " +
  "Do NOT embed the caption text inside the SVG/HTML. Use the plan's structured " +
  "fields (nodes, edges, comparison, timeline, stat, illustrativeBrief) for content " +
  "inside the visual; never paste the caption sentence(s) into it.";

function buildSystemPrompt(format: "svg" | "html"): string {
  if (format === "html") {
    return [
      "You are the render stage. Convert ONE PanelPlan into a clean self-contained HTML block",
      "(a table for comparison, a vertical timeline for timeline). Output ONLY the HTML block.",
      "No <html>/<head>/<body> wrapper. No <script>. No <style> tags — use inline styles only.",
      "",
      CAPTION_RULE,
      "",
      DESIGN_SYSTEM_PROMPT,
      "",
      "Respond with ONLY the HTML element. No fences. No commentary.",
    ].join("\n");
  }
  return [
    "You are the render stage. Convert ONE PanelPlan into clean SVG.",
    "Output MUST be a single <svg>...</svg> with viewBox=\"0 0 680 H\".",
    "Real vector text (no <foreignObject>). No <script>. No external refs.",
    "",
    CAPTION_RULE,
    "",
    DESIGN_SYSTEM_PROMPT,
    "",
    "Respond with ONLY the SVG. No fences. No commentary.",
  ].join("\n");
}

function userMessage(plan: PanelPlan, audience: AudienceLevel): string {
  return [
    `Audience level: ${audience}`,
    `Target format: ${targetFormat(plan)}`,
    "",
    "PanelPlan (render this exactly — do not invent new content):",
    JSON.stringify(plan, null, 2),
  ].join("\n");
}

export async function renderPanel(
  plan: PanelPlan,
  audience: AudienceLevel,
  heading: string,
  jobId?: string
): Promise<RenderedPanel> {
  const format = targetFormat(plan);
  const system = buildSystemPrompt(format);

  let lastError: string | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const messages = [
      {
        role: "user" as const,
        content:
          (lastError
            ? `Your previous output failed validation: ${lastError}\nReturn ONLY a corrected ${format.toUpperCase()} block.\n\n`
            : "") + userMessage(plan, audience),
      },
    ];

    let text = "";
    try {
      const res = await callMessages(
        {
          model: MODEL_STRONG,
          max_tokens: 4096,
          temperature: 0.3,
          system,
          messages,
        },
        { jobId, label: `render[${plan.sectionId}]` }
      );
      text = res.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim();
    } catch (e) {
      lastError = `API error: ${(e as Error).message.slice(0, 300)}`;
      continue;
    }

    const content = stripFences(text);
    const v =
      format === "svg" ? validateSvg(content) : validateHtmlPanel(content);

    if (v.ok) {
      return {
        sectionId: plan.sectionId,
        caption: plan.caption,
        format,
        content,
        validated: true,
        fallback: false,
      };
    }
    lastError = v.reason;
  }

  // Fallback: titled card with the caption so the explainer isn't broken.
  return buildFallbackPanel(plan.sectionId, heading, plan.caption);
}

export async function renderAllPanels(
  plans: PanelPlan[],
  audience: AudienceLevel,
  headings: Record<string, string>,
  jobId?: string
): Promise<RenderedPanel[]> {
  const CONCURRENCY = 4;
  const out: RenderedPanel[] = new Array(plans.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= plans.length) return;
      const plan = plans[i];
      const heading = headings[plan.sectionId] || "Panel";
      out[i] = await renderPanel(plan, audience, heading, jobId);
    }
  }

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, plans.length) },
    worker
  );
  await Promise.all(workers);
  return out;
}
