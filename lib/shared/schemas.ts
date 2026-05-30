import { z } from "zod";

// ---------- Job-level ----------

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

export const ComprehensionSchema = z.object({
  oneLineSummary: z.string().min(1).max(220),
  coreIdea: z.string().min(1),
  keyClaims: z.array(z.string()).min(1).max(10),
  entities: z.array(EntitySchema).default([]),
  jargon: z.array(JargonSchema).default([]),
  narrativeArc: z.string().default(""),
  audienceLevel: AudienceLevelSchema,
});
export type Comprehension = z.infer<typeof ComprehensionSchema>;

// ---------- Agent 3: Structure ----------

export const VisualTypeSchema = z.enum([
  "flowchart",
  "illustrative",
  "structural",
  "comparison",
  "timeline",
  "stat_callout",
]);
export type VisualType = z.infer<typeof VisualTypeSchema>;

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

export const PanelNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  subtitle: z.string().optional(),
  group: z.string().optional(),
  role: z.enum(["start", "end", "normal", "highlight"]).optional(),
});

export const PanelEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
});

export const PanelPlanSchema = z.object({
  sectionId: z.string(),
  visualType: VisualTypeSchema,
  caption: z.string().max(600),
  nodes: z.array(PanelNodeSchema).optional(),
  edges: z.array(PanelEdgeSchema).optional(),
  comparison: z
    .object({
      columns: z.array(z.string()),
      rows: z.array(z.object({ label: z.string(), cells: z.array(z.string()) })),
    })
    .optional(),
  timeline: z
    .array(z.object({ when: z.string(), what: z.string() }))
    .optional(),
  illustrativeBrief: z.string().optional(),
  stat: z.object({ value: z.string(), label: z.string() }).optional(),
  layoutHint: z.enum(["horizontal", "vertical"]).optional(),
});
export type PanelPlan = z.infer<typeof PanelPlanSchema>;

// ---------- Agent 5: Render ----------

export const RenderedPanelSchema = z.object({
  sectionId: z.string(),
  caption: z.string(),
  format: z.enum(["svg", "html"]),
  content: z.string(),
  validated: z.boolean().default(false),
  fallback: z.boolean().default(false),
});
export type RenderedPanel = z.infer<typeof RenderedPanelSchema>;

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
});
export type Explainer = z.infer<typeof ExplainerSchema>;

// ---------- Token usage ----------

export const TokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative().default(0),
  outputTokens: z.number().int().nonnegative().default(0),
  calls: z.number().int().nonnegative().default(0),
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
