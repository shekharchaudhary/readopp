import { callMessages, MODEL_VISION } from "../anthropic";
import { extractJson } from "../agents/util";

export interface CritiqueScores {
  hierarchy: number;
  alignment: number;
  density: number;
  readability: number;
  narrativeFit: number;
}

export interface CritiqueResult {
  pass: boolean;
  scores: CritiqueScores;
  issues: string[];
  /** Actionable single-paragraph instruction the renderer feeds back to
   *  the draw model on the next attempt. Plain English, imperative voice. */
  suggestion: string;
  /** Average score 1–5. Used by the A/B reporter for ranking. */
  overall: number;
}

const RUBRIC_PROMPT = `
You are the visual critic for a LinkedIn-style explainer panel. You receive
ONE rendered panel image plus the heading + caption text it was supposed
to convey. Grade it 1–5 on each of five axes, then decide pass / fail.

  hierarchy     — does the heading dominate? Do body lines step down in
                  weight & size? Is the eye drawn to ONE focal point first?
  alignment     — is everything on a coherent grid? Are columns/rows even?
                  No floating, off-axis, or visually tilted elements.
  density       — is whitespace generous enough? Nothing crammed. No
                  oversized blank zones either — balanced.
  readability   — body text comfortably legible at thumbnail size. Sufficient
                  contrast. Line lengths not too long, not too short.
  narrativeFit  — does the visual MATCH the claim in the caption? A flowchart
                  for a process, a comparison for a contrast, etc. Penalise
                  generic shapes that don't reinforce the specific point.

Scoring scale — be discerning. Most LinkedIn-quality panels should fall
in the 3–4 range. Reserve 5s for axes that are genuinely flawless.

  5 = flawless — a senior designer would change NOTHING on this axis
  4 = good — at least one specific tweak a competent designer would make
  3 = mediocre — a clear issue is visibly hurting the post
  2 = poor — broken in a noticeable way
  1 = unusable

DEFAULT TO 4. If you can name even one specific element you'd nudge,
resize, realign, or recolor on an axis, that axis is a 4, not a 5.
Awarding 5s indiscriminately makes this critic useless.

PASS RULE (strict): average across the 5 axes ≥ 4.5 AND every axis ≥ 4.
A panel that scores straight 4s is competent but not yet polished — fail
it so the renderer takes another pass. To pass, the panel must be
excellent on a majority of axes, not merely acceptable across all of them.

Return ONLY JSON of this exact shape (no fences, no commentary):

{
  "scores": {
    "hierarchy": 4,
    "alignment": 5,
    "density": 3,
    "readability": 4,
    "narrativeFit": 4
  },
  "issues": [
    "The two stat figures collide near the centre — the larger one needs to drop down ~30px or shrink one font size",
    "Body subheading is the same weight as the body sentences — increase its weight or size for contrast"
  ],
  "suggestion": "Single-paragraph imperative instruction telling the renderer what to change next, e.g. 'Increase heading weight and size so it dominates. Separate the two stat figures vertically by ~30px. Drop the body subheading to a single line so it doesn't compete with the stats.'"
}

issues: 0–4 short bullet diagnoses. suggestion: ONE actionable paragraph
the renderer will receive verbatim as feedback. Be specific (cite which
element, which direction). Don't say "improve the design" — say "drop the
subheading to medium weight."

If everything passes (≥4 on all five), still return issues: [] and
suggestion: "" — the renderer ignores empty strings.
`.trim();

function clampScore(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 1;
  return Math.max(1, Math.min(5, Math.round(x)));
}

/**
 * Score a rendered panel PNG against the design rubric and return
 * structured feedback. Used inline in renderPanel() to drive an
 * iterative redraw loop.
 *
 * On any parse/model failure we return a synthetic PASS so the render
 * pipeline never blocks on the critique layer — critique is advisory,
 * not gating. The job log captures the swallowed error.
 */
export async function critiquePanel(input: {
  pngBase64: string;
  heading: string;
  caption: string;
  visualType: string;
  jobId?: string;
  label: string;
}): Promise<CritiqueResult> {
  try {
    const res = await callMessages(
      {
        model: MODEL_VISION,
        max_tokens: 600,
        temperature: 0.2,
        system: RUBRIC_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: input.pngBase64,
                },
              },
              {
                type: "text",
                text: [
                  `Heading: ${input.heading}`,
                  `Caption: ${input.caption}`,
                  `Visual type: ${input.visualType}`,
                  "",
                  "Grade the panel. Return JSON only.",
                ].join("\n"),
              },
            ],
          },
        ],
      },
      { jobId: input.jobId, label: input.label }
    );

    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    const parsed = JSON.parse(extractJson(text)) as {
      scores?: Record<string, unknown>;
      issues?: unknown[];
      suggestion?: unknown;
    };
    const rawScores = parsed.scores ?? {};
    const scores: CritiqueScores = {
      hierarchy: clampScore(rawScores.hierarchy),
      alignment: clampScore(rawScores.alignment),
      density: clampScore(rawScores.density),
      readability: clampScore(rawScores.readability),
      narrativeFit: clampScore(rawScores.narrativeFit),
    };
    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.filter((i): i is string => typeof i === "string").slice(0, 4)
      : [];
    const suggestion =
      typeof parsed.suggestion === "string" ? parsed.suggestion.trim() : "";
    const values = Object.values(scores);
    const overall = values.reduce((a, b) => a + b, 0) / values.length;
    // Tightened bar: straight-4s ("competent but not polished") no longer
    // passes. To stop the loop, the panel needs average ≥ 4.5 (i.e. a
    // majority of axes at 5) AND no axis below 4. Mirrors the prompt's
    // PASS RULE so the model is grading against the same threshold the
    // code enforces.
    const pass = overall >= 4.5 && values.every((s) => s >= 4);
    return { pass, scores, issues, suggestion, overall };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      `[readopp] critique ${input.label} failed; advisory-pass so render continues: ${(e as Error).message}`
    );
    return {
      pass: true,
      scores: {
        hierarchy: 0,
        alignment: 0,
        density: 0,
        readability: 0,
        narrativeFit: 0,
      },
      issues: [],
      suggestion: "",
      overall: 0,
    };
  }
}
