import { cachedSystem, callMessages, MODEL_DRAW } from "../anthropic";
import { DESIGN_SYSTEM_PROMPT } from "../render/designSystem";
import { buildFallbackPanel } from "../render/fallbackPanel";
import { fixSvg } from "../render/fixer";
import { renderGenrePanel } from "../render/genrePanels";
import { HERO_SYSTEM_PROMPT } from "../render/heroPrompt";
import { renderMetaphor } from "../render/metaphors";
import { renderVsScene } from "../render/vsScene";
import { renderAnthropicStat } from "../render/templates/anthropicStat";
import { renderFlowchart } from "../render/templates/flowchart";
import { renderStructural } from "../render/templates/structural";
import { renderTimeline } from "../render/templates/timeline";
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

function buildSystemPrompt(
  format: "svg" | "html",
  plan: PanelPlan
): string {
  if (plan.visualType === "annotated_hero" && format === "svg") {
    return [
      HERO_SYSTEM_PROMPT,
      "",
      CAPTION_RULE,
      "",
      "Respond with ONLY the SVG. No fences. No commentary.",
    ].join("\n");
  }
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
  // Metaphor panels with a deterministic template skip the model entirely.
  // Instant, free, consistent. Untemplated kinds fall through to AI render.
  if (plan.visualType === "metaphor") {
    const svg = renderMetaphor(plan);
    if (svg) {
      return {
        sectionId: plan.sectionId,
        heading,
        caption: plan.caption,
        format: "svg",
        content: svg,
        validated: true,
        fallback: false,
        edited: false,
        plan,
      };
    }
  }

  // Two-column comparisons become a deterministic Napkin-style VS scene;
  // anything wider or wordier falls through to the model-rendered HTML table.
  if (plan.visualType === "comparison") {
    const svg = renderVsScene(plan);
    if (svg) {
      return {
        sectionId: plan.sectionId,
        heading,
        caption: plan.caption,
        format: "svg",
        content: svg,
        validated: true,
        fallback: false,
        edited: false,
        plan,
      };
    }
  }

  // Phase 7b genre-specific templates — also deterministic.
  if (
    plan.visualType === "profile_card" ||
    plan.visualType === "career_timeline" ||
    plan.visualType === "skills_matrix" ||
    plan.visualType === "chart" ||
    plan.visualType === "quote_card" ||
    plan.visualType === "key_findings" ||
    plan.visualType === "definition_card"
  ) {
    const svg = renderGenrePanel(plan);
    if (svg) {
      return {
        sectionId: plan.sectionId,
        heading,
        caption: plan.caption,
        format: "svg",
        content: svg,
        validated: true,
        fallback: false,
        edited: false,
        plan,
      };
    }
  }

  // Track 1 slot-fill templates: stat callout, flowchart (linear chains),
  // narrative timeline, and structural container diagrams. Each returns null
  // when its plan doesn't fit the template's range, falling through to Opus.
  if (plan.visualType === "stat_callout" && plan.stat) {
    return renderAnthropicStat({
      sectionId: plan.sectionId,
      heading,
      caption: plan.caption,
      stat: plan.stat,
    });
  }
  if (plan.visualType === "flowchart") {
    const svg = renderFlowchart(plan);
    if (svg) {
      return {
        sectionId: plan.sectionId,
        heading,
        caption: plan.caption,
        format: "svg",
        content: svg,
        validated: true,
        fallback: false,
        edited: false,
        plan,
      };
    }
  }
  if (plan.visualType === "timeline") {
    const svg = renderTimeline(plan);
    if (svg) {
      return {
        sectionId: plan.sectionId,
        heading,
        caption: plan.caption,
        format: "svg",
        content: svg,
        validated: true,
        fallback: false,
        edited: false,
        plan,
      };
    }
  }
  if (plan.visualType === "structural") {
    const svg = renderStructural(plan);
    if (svg) {
      return {
        sectionId: plan.sectionId,
        heading,
        caption: plan.caption,
        format: "svg",
        content: svg,
        validated: true,
        fallback: false,
        edited: false,
        plan,
      };
    }
  }

  const format = targetFormat(plan);
  const system = buildSystemPrompt(format, plan);

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
        // No temperature: Opus 4.7 rejects the param outright.
        // System prompt is wrapped in a cacheable block — the DESIGN_SYSTEM_PROMPT
        // is ~3000 tokens and reused across every panel of the same format in a
        // job, so cache reads after the first hit cost 10% of normal input.
        {
          model: MODEL_DRAW,
          max_tokens: 4096,
          system: cachedSystem(system),
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

    let content = stripFences(text);
    // Cheap deterministic touch-ups (chev marker, bold→medium, missing
    // rx, etc.) before validation so we don't waste a re-prompt round on
    // mistakes we can auto-correct.
    if (format === "svg") content = fixSvg(content);
    const v =
      format === "svg" ? validateSvg(content) : validateHtmlPanel(content);

    if (v.ok) {
      return {
        sectionId: plan.sectionId,
        heading,
        caption: plan.caption,
        format,
        content,
        validated: true,
        fallback: false,
        edited: false,
        plan,
      };
    }
    lastError = v.reason;
  }

  // Fallback: titled card with the caption so the explainer isn't broken.
  console.warn(`render[${plan.sectionId}] fell back to placeholder: ${lastError}`);
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
