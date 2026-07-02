import { callMessages, MODEL_STRONG } from "../anthropic";
import {
  ComprehensionSchema,
  type AudienceLevel,
  type CleanArticle,
  type Comprehension,
} from "../shared/schemas";
import { extractJson, parseWithFeedback, withRetry } from "./util";

const SYSTEM_PROMPT = `
You are the comprehension stage of a pipeline that turns documents into visual
explanations. Deeply understand this document, classify what KIND of document
it is, and express that understanding as structured data. You are NOT designing
visuals. You are NOT writing the final captions.

Return ONLY a JSON object with EXACTLY this shape (all fields required unless marked optional):

{
  "oneLineSummary": "string <= 220 chars, plain language, no hype",
  "coreIdea": "the single most important takeaway, 1-2 sentences",
  "keyClaims": [
    "claim 1 — standalone and specific",
    "claim 2",
    "claim 3"
  ],
  "entities": [
    { "name": "thing name", "kind": "concept" | "tool" | "person" | "org" | "metric", "note": "optional one-liner" }
  ],
  "jargon": [
    { "term": "the term as it appears", "plainDefinition": "what it means in plain language" }
  ],
  "narrativeArc": "one sentence describing how the document is structured",
  "genre": "article" | "research_paper" | "resume" | "news" | "book_chapter" | "documentation" | "whitepaper" | "other",
  "genreConfidence": "low" | "medium" | "high",
  "contentFeatures": {
    "hasNumericData": boolean,
    "hasDates": boolean,
    "hasCharts": boolean,
    "hasCode": boolean,
    "hasRoles": boolean,
    "hasSkills": boolean,
    "hasFigures": boolean
  },
  "dataSeries": [
    {
      "name": "what the series measures, e.g. \"Quarterly revenue\"",
      "unit": "optional suffix like \"$M\", \"%\", \"votes\"",
      "points": [ { "label": "Q1 2023", "value": 2 }, { "label": "Q2 2023", "value": 4 } ]
    }
  ]
}

═══════════════════════════════════════════════════════════════════════════
GENRE CLASSIFICATION — how to pick "genre"
═══════════════════════════════════════════════════════════════════════════

• resume          — CV / curriculum vitae. Signs: contact info block, list of
                    job titles + companies + date ranges, a "Skills" or
                    "Experience" section. One person is the subject.
• research_paper  — academic paper. Signs: abstract, methods, results,
                    references, author affiliations, citations like [1].
• news            — current-events reporting. Signs: dateline, byline,
                    inverted-pyramid structure, named sources, quotes.
• book_chapter    — long-form narrative or analysis, often pedagogical.
                    Signs: explicit chapter heading, scaffolded narrative.
• documentation   — how-to / API reference / developer guide. Signs: code
                    blocks, step-by-step instructions, "Installation" /
                    "Usage" sections.
• whitepaper      — corporate / technical position piece. Signs: vendor
                    framing, problem-solution structure, executive summary.
• article         — blog post, essay, opinion, long-form journalism. The
                    catch-all narrative document. USE THIS WHEN UNSURE.
• other           — only when nothing above applies.

When confidence is low (the document is ambiguous or mixed), set
"genreConfidence":"low" and prefer "article" unless one of the specific
genres clearly fits.

═══════════════════════════════════════════════════════════════════════════
CONTENT FEATURES — set each flag true ONLY when the document warrants it
═══════════════════════════════════════════════════════════════════════════

• hasNumericData : the body contains data points or stats that could be
                   charted (percentages, growth numbers, comparative figures).
                   Set true if you can extract ≥3 labeled numeric values
                   (e.g. revenue by quarter, votes by candidate).
• hasDates       : the document anchors content to specific dates or date
                   ranges that would make a timeline panel worthwhile.
• hasCharts      : the SOURCE document already contains charts or graphs
                   (described in text, captioned figures, etc.) — even if
                   we can't reproduce them, this signals data density.
• hasCode        : code blocks, function signatures, CLI commands.
• hasRoles       : the document describes job roles (mostly true for
                   resumes; sometimes true for org announcements).
• hasSkills      : the document describes capabilities or technologies as
                   a list (resume Skills section, "tech stack" list, etc.).
• hasFigures     : visual artifacts the document leans on — screenshots,
                   diagrams, photographs, architecture sketches.

═══════════════════════════════════════════════════════════════════════════
DATA SERIES — extract chartable numbers into "dataSeries"
═══════════════════════════════════════════════════════════════════════════

When "hasNumericData" is true, extract every labeled numeric SERIES you can
read from the body into "dataSeries" — a sequence of {label, value} points
that share a dimension (revenue by quarter, votes by candidate, latency by
version). Each series gets a "name" and, if there is one, a "unit".

- Use ONLY real values that appear verbatim in the source (or are trivially
  derivable, e.g. a stated total minus a stated part). NEVER interpolate
  between two anchor numbers, and NEVER invent points to pad a series.
- A series needs ≥2 real points to be worth including. Prefer series with 4+
  points — those make the strongest charts downstream.
- If the body only has isolated one-off numbers with no shared sequence,
  leave "dataSeries" as [] and keep those figures in "keyClaims" as prose.
- "value" MUST be a plain JSON number (2000000, not "$2M"). Strip currency
  symbols, percent signs, and magnitude suffixes; put those in "unit".

═══════════════════════════════════════════════════════════════════════════
CRITICAL RULES for the shape
═══════════════════════════════════════════════════════════════════════════
- jargon items MUST have both "term" (string) AND "plainDefinition" (string).
  Never include a term without a definition. If you cannot define it, omit
  that jargon item entirely.
- entities items MUST have both "name" (string) AND "kind" (one of the five).
- keyClaims: 3 to 7 entries. Each is a single plain-text string, not an object.
- contentFeatures: ALL seven flags must be present (true or false).
- If a field doesn't apply (e.g. no jargon worth defining), use an empty
  array [], never null.
- Do NOT include any fields not listed above.

Calibrate to the audience level:
- general:      assume no domain knowledge; flag lots of jargon; keep claims concrete and concept-level.
- student:      assume curiosity and basic literacy in the field; define key terms.
- professional: assume working knowledge; flag only specialized jargon; keep claims sharp.
- technical:    assume expert; minimal jargon flagging; claims can be precise and detailed.

Respond with ONLY the JSON object. No markdown fences, no commentary, no preamble.
`.trim();

function userMessage(article: CleanArticle, audience: AudienceLevel): string {
  const MAX_CHARS = 24_000;
  const body =
    article.text.length > MAX_CHARS
      ? article.text.slice(0, MAX_CHARS) + "\n\n[…truncated…]"
      : article.text;
  return [
    `Audience level: ${audience}`,
    `Source URL: ${article.url}`,
    `Title: ${article.title}`,
    article.byline ? `Byline: ${article.byline}` : null,
    `Word count: ${article.wordCount}`,
    "",
    "Article body:",
    body,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Pre-validation cleanup. The model occasionally produces:
 *  - jargon entries with `definition` instead of `plainDefinition`
 *  - jargon entries with no definition at all (just a term)
 *  - entity entries missing `kind` or with non-enum values
 *  - keyClaims as objects ({claim: "..."}) instead of strings
 * Coerce or drop these so the schema parse succeeds whenever possible.
 */
function cleanComprehensionJson(
  obj: Record<string, unknown>,
  audience: AudienceLevel
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...obj, audienceLevel: audience };

  // keyClaims: coerce {claim: "..."} -> "..."
  if (Array.isArray(out.keyClaims)) {
    out.keyClaims = (out.keyClaims as unknown[])
      .map((c) => {
        if (typeof c === "string") return c.trim();
        if (c && typeof c === "object") {
          const r = c as Record<string, unknown>;
          for (const k of ["claim", "text", "value"] as const) {
            if (typeof r[k] === "string") return (r[k] as string).trim();
          }
        }
        return null;
      })
      .filter((c): c is string => Boolean(c && c.length > 0));
  }

  // jargon: rename definition -> plainDefinition; drop entries missing either field.
  if (Array.isArray(out.jargon)) {
    out.jargon = (out.jargon as unknown[])
      .map((j) => {
        if (!j || typeof j !== "object") return null;
        const r = j as Record<string, unknown>;
        const term = typeof r.term === "string" ? r.term.trim() : "";
        const pd =
          typeof r.plainDefinition === "string"
            ? r.plainDefinition
            : typeof r.definition === "string"
            ? r.definition
            : typeof r.meaning === "string"
            ? r.meaning
            : "";
        if (!term) return null;
        return { term, plainDefinition: pd.trim() };
      })
      .filter(Boolean);
  } else {
    out.jargon = [];
  }

  // entities: coerce unknown kinds to "concept"; drop entries with no name.
  const allowedKinds = new Set([
    "concept",
    "tool",
    "person",
    "org",
    "metric",
  ]);
  if (Array.isArray(out.entities)) {
    out.entities = (out.entities as unknown[])
      .map((e) => {
        if (!e || typeof e !== "object") return null;
        const r = e as Record<string, unknown>;
        const name = typeof r.name === "string" ? r.name.trim() : "";
        if (!name) return null;
        const kind =
          typeof r.kind === "string" && allowedKinds.has(r.kind)
            ? r.kind
            : "concept";
        const note =
          typeof r.note === "string" ? r.note.trim() : undefined;
        return note ? { name, kind, note } : { name, kind };
      })
      .filter(Boolean);
  } else {
    out.entities = [];
  }

  // narrativeArc: ensure it's a string
  if (typeof out.narrativeArc !== "string") out.narrativeArc = "";

  // genre: coerce unknown values back to "article" (low confidence fallback)
  const allowedGenres = new Set([
    "article",
    "research_paper",
    "resume",
    "news",
    "book_chapter",
    "documentation",
    "whitepaper",
    "other",
  ]);
  if (typeof out.genre !== "string" || !allowedGenres.has(out.genre as string)) {
    out.genre = "article";
    out.genreConfidence = "low";
  }
  if (
    typeof out.genreConfidence !== "string" ||
    !["low", "medium", "high"].includes(out.genreConfidence as string)
  ) {
    out.genreConfidence = "medium";
  }
  // contentFeatures: fill any missing flags with false
  const cf =
    out.contentFeatures && typeof out.contentFeatures === "object"
      ? (out.contentFeatures as Record<string, unknown>)
      : {};
  out.contentFeatures = {
    hasNumericData: cf.hasNumericData === true,
    hasDates: cf.hasDates === true,
    hasCharts: cf.hasCharts === true,
    hasCode: cf.hasCode === true,
    hasRoles: cf.hasRoles === true,
    hasSkills: cf.hasSkills === true,
    hasFigures: cf.hasFigures === true,
  };

  // dataSeries: coerce string values ("$2M", "45%") to numbers, drop points
  // with unparseable values or empty labels, drop series with <2 valid points.
  if (Array.isArray(out.dataSeries)) {
    out.dataSeries = (out.dataSeries as unknown[])
      .map((s) => {
        if (!s || typeof s !== "object") return null;
        const r = s as Record<string, unknown>;
        const name = typeof r.name === "string" ? r.name.trim() : "";
        if (!name) return null;
        const unit =
          typeof r.unit === "string" && r.unit.trim()
            ? r.unit.trim()
            : undefined;
        const points = Array.isArray(r.points)
          ? (r.points as unknown[])
              .map((p) => {
                if (!p || typeof p !== "object") return null;
                const pr = p as Record<string, unknown>;
                const label =
                  typeof pr.label === "string" ? pr.label.trim() : "";
                const value = coerceNumber(pr.value);
                if (!label || value === null) return null;
                return { label, value };
              })
              .filter(Boolean)
          : [];
        if (points.length < 2) return null;
        return unit ? { name, unit, points } : { name, points };
      })
      .filter(Boolean)
      .slice(0, 6);
  } else {
    out.dataSeries = [];
  }

  return out;
}

// Parse a JSON number, or the leading number out of a decorated string
// ("$2.5M" -> 2.5, "45%" -> 45, "1,200" -> 1200). We deliberately do NOT
// apply magnitude multipliers: the prompt asks the model to strip suffixes
// into "unit", so multiplying here would double-count when it complied and
// silently break the chart's y-scale. Returns null if no number is present.
function coerceNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const m = raw.replace(/,/g, "").match(/-?\d*\.?\d+/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

export async function runComprehension(
  article: CleanArticle,
  audience: AudienceLevel,
  jobId?: string
): Promise<Comprehension> {
  return withRetry("comprehension", async (retryHint) => {
    const messages = [
      {
        role: "user" as const,
        content:
          (retryHint
            ? `${retryHint}\n\nReturn the COMPLETE corrected Comprehension JSON (every jargon item MUST have both "term" and "plainDefinition"). No fences, no commentary.\n\n---\n\n`
            : "") + userMessage(article, audience),
      },
    ];
    const res = await callMessages(
      {
        model: MODEL_STRONG,
        max_tokens: 2560,
        temperature: 0.3,
        system: SYSTEM_PROMPT,
        messages,
      },
      { jobId, label: "comprehension" }
    );
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    const raw = JSON.parse(extractJson(text)) as Record<string, unknown>;
    const cleaned = cleanComprehensionJson(raw, audience);
    return parseWithFeedback(ComprehensionSchema, cleaned);
  });
}

/**
 * Tight one-liner used for the agent.done event summary.
 */
export function summarizeComprehension(c: Comprehension): string {
  const n = c.keyClaims.length;
  return `Identified ${n} key claim${n === 1 ? "" : "s"} — ${c.narrativeArc.toLowerCase()}`.slice(0, 140);
}
