import { z } from "zod";
import { ICON_NAMES } from "@/lib/render/icons";

// ---------- Job-level ----------

/** Planner-pickable icon from the curated library (lib/render/icons.ts). */
export const IconNameSchema = z.enum(ICON_NAMES);

export const AudienceLevelSchema = z.enum([
  "general",
  "student",
  "professional",
  "technical",
]);
export type AudienceLevel = z.infer<typeof AudienceLevelSchema>;

export const JobStatusSchema = z.enum([
  "queued",
  "ingesting",
  "comprehending",
  "structuring",
  "planning",
  "rendering",
  "assembling",
  "completed",
  "failed",
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JobErrorReasonSchema = z.enum([
  "invalid_url",
  "fetch_failed",
  "paywalled",
  "login_required",
  "empty_content",
  "comprehension_failed",
  "render_failed",
  "timeout",
  "unknown",
]);
export type JobErrorReason = z.infer<typeof JobErrorReasonSchema>;

export const JobErrorSchema = z.object({
  reason: JobErrorReasonSchema,
  message: z.string(),
});
export type JobError = z.infer<typeof JobErrorSchema>;

// ---------- Agent 1: Ingest ----------

export const CleanArticleSchema = z.object({
  url: z.string(),
  title: z.string(),
  byline: z.string().optional(),
  publishedAt: z.string().optional(),
  text: z.string(),
  codeBlocks: z.array(z.string()).default([]),
  imageUrls: z.array(z.string()).default([]),
  wordCount: z.number().int().nonnegative(),
});
export type CleanArticle = z.infer<typeof CleanArticleSchema>;

// ---------- Agent 2: Comprehension ----------

// Both Entity and Jargon are tolerant of missing/extra fields — the model
// sometimes drops `plainDefinition` or `kind`. We'd rather coerce + downstream-ignore
// than hard-fail the whole comprehension stage on a cosmetic field.

export const EntitySchema = z.object({
  name: z.string().min(1),
  kind: z
    .enum(["concept", "tool", "person", "org", "metric"])
    .catch("concept"),
  note: z.string().optional(),
});

export const JargonSchema = z.object({
  term: z.string().min(1),
  // model occasionally outputs `definition` instead of `plainDefinition`
  // or drops the field entirely; default to empty string and we just don't
  // display it downstream.
  plainDefinition: z.string().default(""),
});

// What kind of document is this? Drives genre-specific structure + planner
// behavior. `other` is the catch-all when nothing clearly fits.
export const GenreSchema = z.enum([
  "article",
  "research_paper",
  "resume",
  "news",
  "book_chapter",
  "documentation",
  "whitepaper",
  "other",
]);
export type Genre = z.infer<typeof GenreSchema>;

// Lightweight feature flags the Comprehension agent sets so downstream stages
// can decide whether to reach for charts, timelines, etc. without re-reading
// the body. All default to false — Comprehension flips them on when present.
export const ContentFeaturesSchema = z.object({
  hasNumericData: z.boolean().default(false),
  hasDates: z.boolean().default(false),
  hasCharts: z.boolean().default(false),
  hasCode: z.boolean().default(false),
  hasRoles: z.boolean().default(false),
  hasSkills: z.boolean().default(false),
  hasFigures: z.boolean().default(false),
});
export type ContentFeatures = z.infer<typeof ContentFeaturesSchema>;

export const ComprehensionSchema = z.object({
  oneLineSummary: z.string().min(1).max(220),
  coreIdea: z.string().min(1),
  keyClaims: z.array(z.string()).min(1).max(10),
  entities: z.array(EntitySchema).default([]),
  jargon: z.array(JargonSchema).default([]),
  narrativeArc: z.string().default(""),
  audienceLevel: AudienceLevelSchema,
  // Genre classification — drives the downstream visual playbook. Defaults
  // to "article" when the model is unsure (low confidence fallback).
  genre: GenreSchema.default("article"),
  genreConfidence: z.enum(["low", "medium", "high"]).default("medium"),
  contentFeatures: ContentFeaturesSchema.default({
    hasNumericData: false,
    hasDates: false,
    hasCharts: false,
    hasCode: false,
    hasRoles: false,
    hasSkills: false,
    hasFigures: false,
  }),
});
export type Comprehension = z.infer<typeof ComprehensionSchema>;

// ---------- Agent 3: Structure ----------

export const VisualTypeSchema = z.enum([
  // Storytelling primary types
  "metaphor",
  "annotated_hero",
  // Tabular / time / hero number — kept
  "comparison",
  "timeline",
  "stat_callout",
  // Genre-specific types (Phase 7b)
  "career_timeline",  // resume: vertical roles list with date axis
  "profile_card",     // resume / about: name + headline + 2-3 stats
  "skills_matrix",    // resume: skills grouped by category
  "chart",            // any: real bar / donut / line chart from data
  // Genre-specific types (Phase 7c — articulation)
  "quote_card",       // book chapters / essays: pull quote + attribution
  "key_findings",     // research papers / whitepapers: numbered findings
  "definition_card",  // documentation: term + plain definition + analogy
  // Phase 2E.3 editorial primitives
  "insight",          // essays: single striking aha sentence
  "framework",        // OODA / 3 Rs / etc — numbered named principles
  "before_after",     // narrative transformation, lighter than `comparison`
  // Legacy types — still supported by the renderer; demoted in selection
  "flowchart",
  "illustrative",
  "structural",
]);
export type VisualType = z.infer<typeof VisualTypeSchema>;

// The 30 metaphor kinds the planner can choose from. Grouped by pattern:
//   duality / tension : iceberg, bridge, scale, tug_of_war, spectrum, paradox
//   sequence          : mountain, staircase, garden, domino, weaving
//   many-to-one       : confluence, funnel, tipping_point
//   one-to-many       : branching, ripple, crossroads
//   focus             : lighthouse, spotlight, orbits
//   cycle             : loop, tide, engine, gears
//   stack / hierarchy : layers, pyramid, onion
//   spatial           : compass, maze
//   classification    : quadrant
export const MetaphorKindSchema = z.enum([
  "iceberg",
  "bridge",
  "scale",
  "tug_of_war",
  "spectrum",
  "paradox",
  "mountain",
  "staircase",
  "garden",
  "domino",
  "weaving",
  "confluence",
  "funnel",
  "tipping_point",
  "branching",
  "ripple",
  "crossroads",
  "lighthouse",
  "spotlight",
  "orbits",
  "loop",
  "tide",
  "engine",
  "gears",
  "layers",
  "pyramid",
  "onion",
  "compass",
  "maze",
  "quadrant",
]);
export type MetaphorKind = z.infer<typeof MetaphorKindSchema>;

const SlotItemSchema = z.object({
  name: z.string().min(1).max(40),
  sub: z.string().max(80).nullish(),
  icon: IconNameSchema.nullish(),
});

const PoleItemSchema = z.object({
  label: z.string().min(1).max(40),
  sub: z.string().max(80).nullish(),
  icon: IconNameSchema.nullish(),
});

// Single permissive shape — each metaphor template reads the fields it cares
// about and ignores the rest. The planner prompt tells the model which fields
// to fill for each kind. We deliberately don't use a discriminated union here
// because (a) it'd make the planner JSON much more brittle and (b) the model
// is better at filling a single flat shape than a nested polymorphic one.
export const MetaphorPlanSchema = z.object({
  kind: MetaphorKindSchema,
  // Two-pole metaphors (iceberg, bridge, scale, tug_of_war, spectrum):
  // poles[0] = side a, poles[1] = side b.
  poles: z.array(PoleItemSchema).max(2).default([]),
  // Sequence / cycle / stack / spoke metaphors: 2–6 items.
  items: z.array(SlotItemSchema).max(6).default([]),
  // Hub for hub-and-spokes metaphors (confluence, funnel, branching, ripple,
  // crossroads, lighthouse, spotlight, orbits, engine).
  hub: SlotItemSchema.nullish(),
  // "in" = spokes flow into hub (confluence, funnel).
  // "out" = hub flows to spokes (branching, ripple, crossroads, spotlight,
  // orbits, lighthouse).
  flow: z.enum(["in", "out"]).nullish(),
  // Terminal label: mountain summit, weaving fabric, engine output, garden
  // outcome, bridge transition mid-label.
  outcome: SlotItemSchema.nullish(),
  // Freeform clarifier the renderer may surface (e.g. ratio "90%" for iceberg,
  // cycle period for tide).
  hint: z.string().max(200).nullish(),
});
export type MetaphorPlan = z.infer<typeof MetaphorPlanSchema>;

// ===== Phase 7b: genre-specific slot shapes =====

/** career_timeline — vertical list of roles with date range and 1-3 wins each. */
export const CareerTimelinePlanSchema = z.object({
  roles: z
    .array(
      z.object({
        title: z.string().min(1).max(60),
        company: z.string().min(1).max(60),
        period: z.string().max(40).nullish(), // "2021–2024", "2019–Now"
        achievements: z.array(z.string().max(140)).max(3).default([]),
      })
    )
    .min(1)
    .max(6),
});
export type CareerTimelinePlan = z.infer<typeof CareerTimelinePlanSchema>;

/** profile_card — hero block for resumes / about pages. */
export const ProfileCardPlanSchema = z.object({
  name: z.string().min(1).max(60),
  headline: z.string().max(120).nullish(), // "Staff engineer · open-source maintainer"
  location: z.string().max(60).nullish(),
  stats: z
    .array(
      z.object({
        label: z.string().min(1).max(30),
        value: z.string().min(1).max(20),
      })
    )
    .max(3)
    .default([]),
});
export type ProfileCardPlan = z.infer<typeof ProfileCardPlanSchema>;

/** skills_matrix — skills bucketed into categories, optionally with a level. */
export const SkillsMatrixPlanSchema = z.object({
  groups: z
    .array(
      z.object({
        name: z.string().min(1).max(40),
        skills: z
          .array(
            z.object({
              name: z.string().min(1).max(40),
              level: z.enum(["expert", "strong", "familiar"]).nullish(),
            })
          )
          .min(1)
          .max(8),
      })
    )
    .min(1)
    .max(4),
});
export type SkillsMatrixPlan = z.infer<typeof SkillsMatrixPlanSchema>;

/** chart — real bar / donut / line chart from structured data. */
export const ChartPlanSchema = z.object({
  kind: z.enum(["bar", "donut", "line"]),
  title: z.string().max(80).nullish(),
  xLabel: z.string().max(30).nullish(),
  yLabel: z.string().max(30).nullish(),
  /** Each series is a sequence of labeled values. Bar/donut take series[0];
   *  line can render up to 3 series for comparison. */
  series: z
    .array(
      z.object({
        name: z.string().max(40).nullish(),
        color: z
          .enum(["blue", "teal", "amber", "purple", "gray"])
          .nullish(),
        points: z
          .array(
            z.object({
              label: z.string().min(1).max(30),
              value: z.number(),
            })
          )
          .min(2)
          .max(12),
      })
    )
    .min(1)
    .max(3),
  /** Optional unit suffix shown on tick labels: "%", "k", "M", "$", etc. */
  unit: z.string().max(8).nullish(),
});
export type ChartPlan = z.infer<typeof ChartPlanSchema>;

// ===== Phase 7c: articulation slot shapes =====

/** quote_card — a pull quote lifted from the source, with attribution. */
export const QuoteCardPlanSchema = z.object({
  /** The quote itself, verbatim or lightly trimmed from the source. */
  text: z.string().min(1).max(280),
  /** Who said/wrote it: author name, character, or speaker. */
  attribution: z.string().max(80).nullish(),
  /** Where it sits: book title, chapter, page, section ("Chapter 3", "p. 142"). */
  context: z.string().max(80).nullish(),
});
export type QuoteCardPlan = z.infer<typeof QuoteCardPlanSchema>;

/** key_findings — numbered findings list for papers / whitepapers / reports. */
export const KeyFindingsPlanSchema = z.object({
  /** Optional kicker above the list ("KEY FINDINGS", "WHAT THE DATA SHOWS"). */
  label: z.string().max(40).nullish(),
  findings: z
    .array(
      z.object({
        title: z.string().min(1).max(70),
        detail: z.string().max(140).nullish(),
        /** Optional hero figure attached to the finding ("3.2×", "41%"). */
        figure: z.string().max(16).nullish(),
      })
    )
    .min(2)
    .max(4),
});
export type KeyFindingsPlan = z.infer<typeof KeyFindingsPlanSchema>;

/** definition_card — a term unpacked in plain language, with an analogy. */
export const DefinitionCardPlanSchema = z.object({
  term: z.string().min(1).max(60),
  /** Optional pronunciation / part-of-speech style sub ("noun · /kæʃ/"). */
  kicker: z.string().max(60).nullish(),
  definition: z.string().min(1).max(220),
  /** "Think of it like..." analogy line. */
  analogy: z.string().max(160).nullish(),
});
export type DefinitionCardPlan = z.infer<typeof DefinitionCardPlanSchema>;

// ===== Phase 2E.3: editorial primitives =====
//
// `insight` — single striking sentence with optional attribution. The
// "aha moment" panel; counter-intuitive reveal in display serif.
//
// `framework` — numbered named principles (OODA, 3 Rs, etc.). Each step
// has a short label + optional one-sentence description.
//
// `before_after` — two-column transformation. Lighter than the
// `comparison` template (vsScene) — meant for "old way → new way"
// narrative beats, not table-style head-to-head comparisons.

export const InsightPlanSchema = z.object({
  /** The insight itself — one striking sentence. */
  text: z.string().min(1).max(240),
  /** Small all-caps eyebrow above the sentence ("THE INSIGHT", "AHA"). */
  kicker: z.string().max(40).nullish(),
  /** Where the insight comes from (author, paper, chapter). */
  attribution: z.string().max(80).nullish(),
});
export type InsightPlan = z.infer<typeof InsightPlanSchema>;

export const FrameworkPlanSchema = z.object({
  /** Optional framework name shown as a kicker ("THE 3 R'S", "OODA LOOP"). */
  label: z.string().max(40).nullish(),
  steps: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        description: z.string().max(220).nullish(),
      })
    )
    .min(2)
    .max(6),
});
export type FrameworkPlan = z.infer<typeof FrameworkPlanSchema>;

export const BeforeAfterPlanSchema = z.object({
  before: z.object({
    label: z.string().min(1).max(40),
    description: z.string().max(280).nullish(),
  }),
  after: z.object({
    label: z.string().min(1).max(40),
    description: z.string().max(280).nullish(),
  }),
  /** Connector word painted between the two columns ("→", "BECOMES", "TO"). */
  transition: z.string().max(40).nullish(),
});
export type BeforeAfterPlan = z.infer<typeof BeforeAfterPlanSchema>;

export const AnnotatedHeroPlanSchema = z.object({
  // A concrete depictable subject: "smartphone with chat app", "open book",
  // "growth chart", "coffee brewer cross-section". Not abstract concepts.
  subject: z.string().min(1).max(80),
  subjectHint: z.string().max(200).nullish(),
  annotations: z
    .array(
      z.object({
        targetHint: z.string().min(1).max(80),
        label: z.string().min(1).max(60),
        sub: z.string().max(140).nullish(),
      })
    )
    .min(2)
    .max(5),
});
export type AnnotatedHeroPlan = z.infer<typeof AnnotatedHeroPlanSchema>;

export const OutlineSectionSchema = z.object({
  id: z.string(),
  heading: z.string(),
  intent: z.string(),
  visualType: VisualTypeSchema,
  sourceClaimIndexes: z.array(z.number().int().nonnegative()).default([]),
});
export type OutlineSection = z.infer<typeof OutlineSectionSchema>;

export const ExplainerOutlineSchema = z.object({
  title: z.string(),
  sections: z.array(OutlineSectionSchema).min(1).max(6),
});
export type ExplainerOutline = z.infer<typeof ExplainerOutlineSchema>;

// ---------- Agent 4: Visual Planner ----------

// Optional fields use .nullish() (accepts null + undefined) instead of
// .optional() (undefined only) because the model frequently emits explicit
// null for fields that don't apply to a given panel type.

export const PanelNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  subtitle: z.string().nullish(),
  group: z.string().nullish(),
  role: z.enum(["start", "end", "normal", "highlight"]).nullish(),
});

export const PanelEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().nullish(),
});

export const PanelPlanSchema = z.object({
  sectionId: z.string(),
  visualType: VisualTypeSchema,
  caption: z.string().max(600),
  nodes: z.array(PanelNodeSchema).nullish(),
  edges: z.array(PanelEdgeSchema).nullish(),
  comparison: z
    .object({
      columns: z.array(z.string()).default([]),
      // Aligned with `columns` — icon for each side's medallion in the VS
      // scene. Optional; renderers fall back to initials when absent.
      columnIcons: z.array(IconNameSchema.nullable()).nullish(),
      // Defaults on label + cells so the model's occasional `[{}, {}]` payload
      // still parses; the planner filters empty rows before returning.
      rows: z
        .array(
          z.object({
            label: z.string().default(""),
            cells: z.array(z.string()).default([]),
          })
        )
        .default([]),
    })
    .nullish(),
  timeline: z
    .array(z.object({ when: z.string(), what: z.string() }))
    .nullish(),
  illustrativeBrief: z.string().nullish(),
  stat: z.object({ value: z.string(), label: z.string() }).nullish(),
  layoutHint: z.enum(["horizontal", "vertical"]).nullish(),
  // Storytelling slots — populated when visualType is "metaphor" or "annotated_hero".
  metaphor: MetaphorPlanSchema.nullish(),
  annotatedHero: AnnotatedHeroPlanSchema.nullish(),
  // Genre-specific slots (Phase 7b)
  careerTimeline: CareerTimelinePlanSchema.nullish(),
  profileCard: ProfileCardPlanSchema.nullish(),
  skillsMatrix: SkillsMatrixPlanSchema.nullish(),
  chart: ChartPlanSchema.nullish(),
  // Articulation slots (Phase 7c)
  quoteCard: QuoteCardPlanSchema.nullish(),
  keyFindings: KeyFindingsPlanSchema.nullish(),
  definitionCard: DefinitionCardPlanSchema.nullish(),
  // Phase 2E.3 editorial primitives
  insight: InsightPlanSchema.nullish(),
  framework: FrameworkPlanSchema.nullish(),
  beforeAfter: BeforeAfterPlanSchema.nullish(),
  // One sentence explaining why the planner chose this visual for this section.
  // Dev-only surface (exposed via ?debug=1); kept on every plan so we can sample
  // and tune selection without re-running the pipeline.
  narrativeReason: z.string().max(220).default(""),
});
export type PanelPlan = z.infer<typeof PanelPlanSchema>;

// ---------- Agent 5: Render ----------

export const RenderedPanelSchema = z.object({
  sectionId: z.string(),
  // Section heading from the Outline agent; falls back to "" for explainers
  // persisted before this field existed.
  heading: z.string().default(""),
  caption: z.string(),
  format: z.enum(["svg", "html"]),
  content: z.string(),
  validated: z.boolean().default(false),
  fallback: z.boolean().default(false),
  // The PanelPlan that produced this content. Optional because older
  // persisted explainers were saved before this field existed. New panels
  // attach it so structured editors (recolor, delete, drag) can mutate the
  // plan and re-render rather than parsing the SVG.
  plan: PanelPlanSchema.optional(),
  // Set true once a human has edited the panel content. Locks the panel against
  // any re-render from plan (template re-runs, plan-based regeneration) so
  // hand-edits aren't blown away. Older persisted explainers default to false.
  edited: z.boolean().default(false),
  // Vision-critic feedback for panels rendered via the Opus draw path
  // (template-rendered panels never carry one). Optional because:
  //   1. critique is gated behind READOPP_VISION_CRITIQUE — disabled
  //      runs produce no critique at all.
  //   2. older persisted explainers predate the field entirely.
  // The shape mirrors CritiqueResult in lib/render/criticize.ts.
  critique: z
    .object({
      pass: z.boolean(),
      overall: z.number(),
      scores: z.object({
        hierarchy: z.number(),
        alignment: z.number(),
        density: z.number(),
        readability: z.number(),
        narrativeFit: z.number(),
      }),
      issues: z.array(z.string()).default([]),
      suggestion: z.string().default(""),
    })
    .optional(),
});
export type RenderedPanel = z.infer<typeof RenderedPanelSchema>;

// ---------- Agent 7: Social pack (Phase 8 week 1) ----------

/**
 * Everything the user needs to actually POST the explainer:
 *  - a caption written in their voice,
 *  - hashtag suggestions inferred from genre + entities,
 *  - alt-text per panel for accessibility,
 *  - a pre-formatted source attribution line.
 */
export const SocialPackSchema = z.object({
  caption: z.string().min(1).max(600),
  hashtags: z.array(z.string().min(1).max(40)).max(5).default([]),
  altTexts: z
    .array(
      z.object({
        sectionId: z.string(),
        text: z.string().min(1).max(200),
      })
    )
    .default([]),
  sourceAttribution: z.string().max(200).default(""),
});
export type SocialPack = z.infer<typeof SocialPackSchema>;

// ---------- Templates ----------

/**
 * Visual identity systems the export pipeline can render the explainer
 * with. Each template owns its own HTML + CSS and may ignore the panel
 * SVG entirely in favour of rendering from the text content (Receipt
 * needs line items, Terminal needs monospace, etc.).
 *
 * "tachyon" is the original Readopp look — the default for everything
 * created before the template picker shipped.
 */
export const TemplateIdSchema = z.enum([
  // Default
  "tachyon",
  // Editorial
  "editorial-broadsheet",
  "magazine-cover",
  "new-yorker-frame",
  // Technical
  "terminal-brutalist",
  "engineering-spec",
  "notebook-cell",
  // Document
  "receipt",
  "index-card",
  "boarding-pass",
  // Reader
  "highlighter-reader",
  "sticky-notes",
  "kindle-highlight",
  // Bold / display
  "editorial-brutalist",
  "tabloid-splash",
  "risograph-zine",
  "galaxy-brain",
  // Modern
  "aurora-glass",
  "bento-grid",
  "swiss-poster",
]);
export type TemplateId = z.infer<typeof TemplateIdSchema>;

// ---------- Agent 6: Assembly ----------

export const ExplainerSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  url: z.string(),
  title: z.string(),
  summary: z.string(),
  audienceLevel: AudienceLevelSchema,
  panels: z.array(RenderedPanelSchema).min(1),
  createdAt: z.string(),
  // Bumped on every edit; used as a cache-buster for PNG/MP4 exports.
  updatedAt: z.string().optional(),
  // Caption + hashtags + alt-texts the user can paste straight into a post.
  // Produced by the socialPack agent and refreshable from the API.
  socialPack: SocialPackSchema.optional(),
  // Visual identity for export. Older explainers default to "tachyon".
  template: TemplateIdSchema.optional(),
});
export type Explainer = z.infer<typeof ExplainerSchema>;

// ---------- Brand kit (Phase 8 week 4) ----------

/**
 * Per-user brand identity, applied to export chrome and the source-attribution
 * slide. Lets the carousel feel like the user's brand, not Readopp's.
 *
 * MVP scope: brand only applies at EXPORT time. Editing view + public view
 * stay default-styled. Logo is stored as a URL (Supabase Storage upload
 * lands later).
 */
export const BrandFontSchema = z.enum(["sans", "serif", "mono", "display"]);
export type BrandFont = z.infer<typeof BrandFontSchema>;

export const BrandKitSchema = z.object({
  /** Hex color (e.g. "#FF6B35"). Replaces accent in export chrome. */
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullish(),
  font: BrandFontSchema.nullish(),
  /** Logo image URL. Replaces "Readopp" wordmark in exports. */
  logoUrl: z.string().url().nullish(),
  /** Display name added to attribution. */
  authorName: z.string().max(60).nullish(),
  /** One-line role / focus area. */
  authorHeadline: z.string().max(120).nullish(),
  updatedAt: z.string().nullish(),
});
export type BrandKit = z.infer<typeof BrandKitSchema>;

// ---------- Token usage ----------

export const TokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative().default(0),
  outputTokens: z.number().int().nonnegative().default(0),
  calls: z.number().int().nonnegative().default(0),
  // Prompt-cache breakdown. Cache reads cost 10% of normal input; cache
  // creates cost 125%. Tracking both lets us measure cache effectiveness
  // without re-querying the model logs. Default 0 keeps older persisted
  // jobs valid after the schema bump.
  cacheReadTokens: z.number().int().nonnegative().default(0),
  cacheCreationTokens: z.number().int().nonnegative().default(0),
});
export type TokenUsage = z.infer<typeof TokenUsageSchema>;

// ---------- Job ----------

export const JobSchema = z.object({
  id: z.string(),
  url: z.string(),
  audienceLevel: AudienceLevelSchema,
  status: JobStatusSchema,
  cacheKey: z.string(),
  explainerId: z.string().optional(),
  explainer: ExplainerSchema.optional(),
  error: JobErrorSchema.optional(),
  progress: z
    .array(z.object({ ts: z.string(), note: z.string() }))
    .default([]),
  usage: TokenUsageSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Job = z.infer<typeof JobSchema>;

// ---------- Request schemas ----------

export const CreateJobRequestSchema = z.object({
  url: z.string().url(),
  audienceLevel: AudienceLevelSchema.default("general"),
});
export type CreateJobRequest = z.infer<typeof CreateJobRequestSchema>;
