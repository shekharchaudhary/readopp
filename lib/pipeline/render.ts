import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cachedSystem, callMessages, MODEL_DRAW } from "../anthropic";
import { findRelevant, type RetrievalHit } from "../references/store";
import { critiquePanel, type CritiqueResult } from "../render/criticize";
import { DESIGN_SYSTEM_PROMPT } from "../render/designSystem";
import { buildFallbackPanel } from "../render/fallbackPanel";
import { fixSvg } from "../render/fixer";
import { renderGenrePanel } from "../render/genrePanels";
import { HERO_SYSTEM_PROMPT } from "../render/heroPrompt";
import { renderMetaphor } from "../render/metaphors";
import { svgToPng } from "../render/rasterize";
import { renderVsScene } from "../render/vsScene";
import { renderAnthropicStat } from "../render/templates/anthropicStat";
import { renderBeforeAfter } from "../render/templates/beforeAfter";
import { renderFlowchart } from "../render/templates/flowchart";
import { renderFramework } from "../render/templates/framework";
import { renderInsight } from "../render/templates/insight";
import { renderStructural } from "../render/templates/structural";
import { renderTimeline } from "../render/templates/timeline";
import { renderBoldPanel } from "../render/templates/bold";
import { renderCleanPanel } from "../render/templates/clean";
import {
  stripFences,
  validateHtmlPanel,
  validateSvg,
} from "../render/validate";
import type {
  AudienceLevel,
  BrandStyle,
  PanelPlan,
  RenderedPanel,
} from "../shared/schemas";
import { sourceLabel } from "../shared/source";

/**
 * Per-panel chrome (heading, source, slide position) threaded into the
 * Tier C deterministic templates so the panel SVG carries its own
 * heading + footer instead of being a headless box. Tier A templates
 * (quote_card, key_findings, definition_card, chart) already inline
 * their own envelopes, so they ignore this; AI-rendered panels can't
 * receive it either.
 *
 * Source defaults to derive-from-job-URL when this object is omitted.
 */
export interface PanelChrome {
  source?: string;
  slide?: { index: number; total: number };
}

/**
 * Knobs for the LLM-render path. Defaults come from env so the regular
 * pipeline picks them up without ceremony; the A/B test script overrides
 * `critique` explicitly to compare with/without back-to-back.
 *
 * `critique` only affects panels that hit the model (templated panels
 * never see it — they're already deterministic).
 */
export interface RenderOptions {
  critique?: boolean;
  /** Inject top-k reference panels from the curated corpus as image
   *  blocks ahead of the user message. Defaults to env. */
  references?: boolean;
  /** Comprehension.genre — threaded through so retrieval can score on
   *  it. Optional because the deterministic-template branches don't
   *  need it; only the LLM-draw path queries the corpus. */
  genre?: string;
  /** Deck-level visual style. "bold" re-skins every panel through the
   *  Bold family; "editorial" (default) keeps the per-visualType
   *  templates + Opus draw path. */
  style?: BrandStyle;
}

function critiqueEnabled(opts: RenderOptions): boolean {
  if (typeof opts.critique === "boolean") return opts.critique;
  return process.env.READOPP_VISION_CRITIQUE === "1";
}

function referencesEnabled(opts: RenderOptions): boolean {
  if (typeof opts.references === "boolean") return opts.references;
  return process.env.READOPP_REFERENCE_RAG === "1";
}

/** Worst-case Opus draw attempts per panel when critique is on (baseline
 *  + 2 retry rounds). When critique is off we fall back to the legacy
 *  2-attempt structural-only loop. */
const MAX_DRAW_ATTEMPTS_WITH_CRITIQUE = 3;
const MAX_DRAW_ATTEMPTS_LEGACY = 2;

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
  jobId?: string,
  chrome: PanelChrome = {},
  opts: RenderOptions = {}
): Promise<RenderedPanel> {
  // Bold style re-skins the WHOLE deck: every plan routes through the
  // Bold family so the carousel stays in one loud voice, never mixed
  // with editorial templates. Deterministic + free — no model call.
  if (opts.style === "bold") {
    return {
      ...renderBoldPanel(plan, {
        heading,
        caption: plan.caption,
        slide: chrome.slide ? chrome.slide.index - 1 : 0,
        total: chrome.slide?.total,
      }),
      plan,
    };
  }
  if (opts.style === "clean") {
    return {
      ...renderCleanPanel(plan, {
        heading,
        caption: plan.caption,
        slide: chrome.slide ? chrome.slide.index - 1 : 0,
        total: chrome.slide?.total,
      }),
      plan,
    };
  }

  // Metaphor panels with a deterministic template skip the model entirely.
  // Instant, free, consistent. Untemplated kinds fall through to AI render.
  if (plan.visualType === "metaphor") {
    const svg = renderMetaphor(plan, {
      heading,
      source: chrome.source,
      slide: chrome.slide,
    });
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
    const svg = renderGenrePanel(plan, {
      heading,
      source: chrome.source,
      slide: chrome.slide,
    });
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
    const out = renderAnthropicStat({
      sectionId: plan.sectionId,
      heading,
      caption: plan.caption,
      stat: plan.stat,
      source: chrome.source,
      slide: chrome.slide,
    });
    return { ...out, plan };
  }

  // Phase 2E.3 editorial primitives — single-shape panels for content
  // that didn't map well to any prior template.
  if (plan.visualType === "insight" && plan.insight) {
    const out = renderInsight({
      sectionId: plan.sectionId,
      heading,
      caption: plan.caption,
      plan: plan.insight,
      source: chrome.source,
      slide: chrome.slide,
    });
    return { ...out, plan };
  }
  if (plan.visualType === "framework" && plan.framework) {
    const out = renderFramework({
      sectionId: plan.sectionId,
      heading,
      caption: plan.caption,
      plan: plan.framework,
      source: chrome.source,
      slide: chrome.slide,
    });
    return { ...out, plan };
  }
  if (plan.visualType === "before_after" && plan.beforeAfter) {
    const out = renderBeforeAfter({
      sectionId: plan.sectionId,
      heading,
      caption: plan.caption,
      plan: plan.beforeAfter,
      source: chrome.source,
      slide: chrome.slide,
    });
    return { ...out, plan };
  }
  // Tier C templates accept a chrome arg so the SVG carries its own
  // heading + source + slide-position footer instead of being a headless
  // box. heading is always threaded through; source/slide may be unset.
  const tierCChrome = { heading, ...chrome };
  if (plan.visualType === "flowchart") {
    const svg = renderFlowchart(plan, tierCChrome);
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
    const svg = renderTimeline(plan, tierCChrome);
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
    const svg = renderStructural(plan, tierCChrome);
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
  const useCritique = critiqueEnabled(opts) && format === "svg";
  const maxAttempts = useCritique
    ? MAX_DRAW_ATTEMPTS_WITH_CRITIQUE
    : MAX_DRAW_ATTEMPTS_LEGACY;

  // Reference-RAG: fetch once outside the retry loop — the same panels
  // apply on every attempt, no point re-querying the corpus per retry.
  // Returns [] when the env flag is off, when the corpus is empty, or
  // when the embedding API errors — render never blocks on it.
  const referenceBlocks = await fetchReferenceBlocks(plan, opts);

  let lastError: string | null = null;
  // Last structurally-valid draft we got back from the model. If we
  // exhaust the critique budget without a pass, this is what ships —
  // critique is advisory, not gating, so a flagged-but-valid panel is
  // always better than the placeholder fallback.
  let lastValid:
    | { content: string; critique?: CritiqueResult }
    | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const textBody =
      (lastError
        ? `Your previous output had problems: ${lastError}\nReturn ONLY a corrected ${format.toUpperCase()} block.\n\n`
        : "") + userMessage(plan, audience);
    // Anthropic API accepts either a string OR a content-block array.
    // Use the array form only when we have references to inject —
    // otherwise leave the cheap string form so the existing retry-only
    // path is byte-for-byte identical to pre-RAG behavior.
    const messages = [
      {
        role: "user" as const,
        content:
          referenceBlocks.length > 0
            ? [
                ...referenceBlocks,
                { type: "text" as const, text: textBody },
              ]
            : textBody,
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

    if (!v.ok) {
      lastError = v.reason;
      continue;
    }

    // Structural validation passed. If critique is off, ship it.
    if (!useCritique) {
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

    // Critique pass. Rasterize → vision-score → either accept or feed the
    // suggestion back into the next attempt as `lastError`.
    let critique: CritiqueResult | undefined;
    try {
      const raster = svgToPng(content);
      critique = await critiquePanel({
        pngBase64: raster.base64,
        heading,
        caption: plan.caption,
        visualType: plan.visualType,
        jobId,
        label: `critique[${plan.sectionId}]#${attempt + 1}`,
      });
    } catch (e) {
      // Rasterize failed → can't critique → accept the structurally-valid
      // draft. Logged so a bad SVG family becomes visible in job traces.
      console.warn(
        `render[${plan.sectionId}] rasterize failed, skipping critique: ${(e as Error).message}`
      );
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

    lastValid = { content, critique };

    if (critique.pass) {
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
        critique,
      };
    }

    // Failed critique. If budget left, retry with the suggestion as
    // explicit feedback to the draw model. If not, fall through to the
    // post-loop accept-best path.
    if (attempt < maxAttempts - 1) {
      lastError = [
        "A visual critic scored your previous render below the bar. Issues:",
        ...critique.issues.map((i) => `  - ${i}`),
        "",
        critique.suggestion
          ? `What to change: ${critique.suggestion}`
          : "Improve hierarchy, alignment, density, readability, and narrative-fit.",
      ].join("\n");
      continue;
    }
  }

  // Critique-loop exhaustion: we have a structurally-valid draft that
  // never quite cleared the rubric. Ship the last one — better than the
  // placeholder fallback.
  if (lastValid) {
    console.warn(
      `render[${plan.sectionId}] critique never passed (overall=${lastValid.critique?.overall?.toFixed(
        2
      )}); shipping last draft.`
    );
    return {
      sectionId: plan.sectionId,
      heading,
      caption: plan.caption,
      format,
      content: lastValid.content,
      validated: true,
      fallback: false,
      edited: false,
      plan,
      critique: lastValid.critique,
    };
  }

  // Structural validation never passed across every attempt. This is the
  // real broken path — placeholder so the explainer ships at all.
  console.warn(`render[${plan.sectionId}] fell back to placeholder: ${lastError}`);
  return buildFallbackPanel(plan.sectionId, heading, plan.caption);
}

export async function renderAllPanels(
  plans: PanelPlan[],
  audience: AudienceLevel,
  headings: Record<string, string>,
  jobId?: string,
  sourceUrl?: string,
  extra: { genre?: string; style?: BrandStyle } = {}
): Promise<RenderedPanel[]> {
  const CONCURRENCY = 4;
  const out: RenderedPanel[] = new Array(plans.length);
  let cursor = 0;
  const source = sourceUrl ? sourceLabel(sourceUrl) : undefined;
  const total = plans.length;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= plans.length) return;
      const plan = plans[i];
      const heading = headings[plan.sectionId] || "Panel";
      out[i] = await renderPanel(
        plan,
        audience,
        heading,
        jobId,
        {
          source,
          slide: { index: i + 1, total },
        },
        { genre: extra.genre, style: extra.style }
      );
    }
  }

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, plans.length) },
    worker
  );
  await Promise.all(workers);
  return out;
}

// ---------------------------------------------------------------------------
// Reference-RAG helpers
// ---------------------------------------------------------------------------

type ImageBlock = {
  type: "image";
  source: { type: "base64"; media_type: "image/png"; data: string };
};
type TextBlock = { type: "text"; text: string };
type AnthropicContentBlock = ImageBlock | TextBlock;

/**
 * Build the leading content blocks for the draw call when reference-
 * RAG is enabled. Returns an empty array — meaning "no injection" — on
 * any failure path (RAG disabled, empty corpus, OpenAI key missing,
 * embedding error, missing PNG file). The renderer treats `[]` as a
 * no-op and falls back to the cheap string-content path, so RAG never
 * breaks a render.
 *
 * Block layout per reference:
 *   - one short text label ("Reference 1 — why it works: ...")
 *   - the PNG itself as a base64 image block
 *
 * Followed by a single trailing instruction block telling the model
 * how to use them.
 */
async function fetchReferenceBlocks(
  plan: PanelPlan,
  opts: RenderOptions
): Promise<AnthropicContentBlock[]> {
  if (!referencesEnabled(opts)) return [];
  let hits: RetrievalHit[];
  try {
    hits = await findRelevant({
      visualType: plan.visualType,
      genre: opts.genre,
      caption: plan.caption,
    });
  } catch (e) {
    console.warn(
      `[readopp] reference retrieval failed; rendering without RAG: ${(e as Error).message}`
    );
    return [];
  }
  if (hits.length === 0) return [];

  const blocks: AnthropicContentBlock[] = [];
  let used = 0;
  for (const hit of hits) {
    const path = join(process.cwd(), "references", hit.reference.pngFile);
    let buf: Buffer;
    try {
      buf = await readFile(path);
    } catch (e) {
      console.warn(
        `[readopp] reference PNG missing: ${path} — skipping (${(e as Error).message})`
      );
      continue;
    }
    blocks.push({
      type: "text",
      text: `Reference ${used + 1} — caption: "${hit.reference.caption}" · why it works: ${hit.reference.whyItWorks}`,
    });
    blocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: buf.toString("base64"),
      },
    });
    used++;
  }
  if (used === 0) return [];

  blocks.push({
    type: "text",
    text:
      `The ${used} reference panel${used === 1 ? "" : "s"} above are real-world examples curated for ` +
      "visual quality. Imitate their LAYOUT principles (hierarchy, grid, " +
      "whitespace, accent colour usage) — NOT their literal content. The " +
      "content you must render comes from the PanelPlan below.",
  });
  return blocks;
}
