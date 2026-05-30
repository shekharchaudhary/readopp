# Data Contracts

These are the TypeScript types that flow through the pipeline. They are the source of truth. Implement them as Zod schemas in `packages/shared` and derive TS types from the schemas (`z.infer`) so runtime validation and compile-time types never drift.

```ts
// ---------- Job-level ----------

export type AudienceLevel = 'general' | 'student' | 'professional' | 'technical';

export type JobStatus =
  | 'queued' | 'ingesting' | 'comprehending' | 'structuring'
  | 'planning' | 'rendering' | 'assembling' | 'completed' | 'failed';

export interface Job {
  id: string;
  url: string;
  audienceLevel: AudienceLevel;
  status: JobStatus;
  cacheKey: string;            // hash(url + audienceLevel)
  explainerId?: string;        // set when completed
  error?: JobError;
  createdAt: string;
  updatedAt: string;
}

export interface JobError {
  reason:
    | 'invalid_url' | 'fetch_failed' | 'paywalled' | 'login_required'
    | 'empty_content' | 'comprehension_failed' | 'render_failed' | 'timeout' | 'unknown';
  message: string;             // human-friendly, shown to user
}

// ---------- Agent 1: Ingest ----------

export interface CleanArticle {
  url: string;
  title: string;
  byline?: string;
  publishedAt?: string;
  text: string;                // cleaned main body, markdown-ish
  codeBlocks: string[];        // extracted fenced code, if any
  imageUrls: string[];         // figure/diagram images found (URLs only)
  wordCount: number;
}

// ---------- Agent 2: Comprehension ----------

export interface Comprehension {
  oneLineSummary: string;          // <= 140 chars
  coreIdea: string;                // 1–2 sentences: the single thing to take away
  keyClaims: string[];             // 3–7 distinct claims/findings
  entities: { name: string; kind: 'concept' | 'tool' | 'person' | 'org' | 'metric'; note?: string }[];
  jargon: { term: string; plainDefinition: string }[];  // terms to define for this audience
  narrativeArc: string;            // how the article moves: problem→solution, etc.
  audienceLevel: AudienceLevel;
}

// ---------- Agent 3: Structure ----------

export type VisualType =
  | 'flowchart'        // sequential process / decision flow
  | 'illustrative'     // concept/mechanism, build intuition (spatial metaphor)
  | 'structural'       // things inside things / architecture
  | 'comparison'       // side-by-side / table
  | 'timeline'         // events over time
  | 'stat_callout';    // a single striking number/fact

export interface OutlineSection {
  id: string;
  heading: string;             // short section title
  intent: string;              // what this panel must make the reader understand
  visualType: VisualType;      // chosen by the structure agent
  sourceClaimIndexes: number[];// which keyClaims this draws from
}

export interface ExplainerOutline {
  title: string;               // explainer title (may differ from article title)
  sections: OutlineSection[];  // 3–6 sections => 3–6 panels
}

// ---------- Agent 4: Visual Planner ----------
// One PanelPlan per OutlineSection. This is a RENDER-AGNOSTIC spec
// describing nodes/edges/regions, NOT the SVG itself.

export interface PanelNode {
  id: string;
  label: string;               // <= ~24 chars
  subtitle?: string;           // <= ~5 words
  group?: string;              // category for coloring (same group = same color)
  role?: 'start' | 'end' | 'normal' | 'highlight';
}

export interface PanelEdge {
  from: string;                // node id
  to: string;                  // node id
  label?: string;              // keep rare/short
}

export interface PanelPlan {
  sectionId: string;
  visualType: VisualType;
  caption: string;             // prose shown beneath the panel, audience-appropriate
  // For node/edge diagrams (flowchart/structural):
  nodes?: PanelNode[];
  edges?: PanelEdge[];
  // For comparison:
  comparison?: { columns: string[]; rows: { label: string; cells: string[] }[] };
  // For timeline:
  timeline?: { when: string; what: string }[];
  // For illustrative: a short metaphor brief the render agent will draw
  illustrativeBrief?: string;
  // For stat_callout:
  stat?: { value: string; label: string };
  layoutHint?: 'horizontal' | 'vertical';
}

// ---------- Agent 5: Render ----------

export interface RenderedPanel {
  sectionId: string;
  caption: string;
  format: 'svg' | 'html';
  content: string;             // the actual <svg>…</svg> or self-contained HTML
  validated: boolean;          // passed the validation loop
  fallback: boolean;           // true if this is the simple fallback template
}

// ---------- Agent 6: Assembly => final artifact ----------

export interface Explainer {
  id: string;
  jobId: string;
  url: string;
  title: string;
  summary: string;             // = Comprehension.oneLineSummary
  audienceLevel: AudienceLevel;
  panels: RenderedPanel[];     // ordered
  createdAt: string;
}

// ---------- Export ----------

export type ExportFormat = 'square' | 'vertical' | 'landscape';

export const EXPORT_DIMENSIONS: Record<ExportFormat, { w: number; h: number; label: string }> = {
  square:    { w: 1080, h: 1080, label: 'Instagram feed' },
  vertical:  { w: 1080, h: 1920, label: 'TikTok / Reels / Stories' },
  landscape: { w: 1200, h: 627,  label: 'LinkedIn' },
};

export interface ExportRequest {
  explainerId: string;
  panelId?: string;            // omit to export the whole explainer as a stacked image
  format: ExportFormat;
}

export interface ExportResult {
  url: string;                 // object-storage URL of the rendered PNG
  format: ExportFormat;
  width: number;
  height: number;
}
```

## Validation rules

- Implement each type as a Zod schema. The orchestrator validates every agent's output against its schema before proceeding.
- `OutlineSection.sourceClaimIndexes` must reference valid indexes in `Comprehension.keyClaims`.
- `PanelEdge.from`/`.to` must reference existing `PanelNode.id`s.
- An `Explainer` must have between 3 and 6 panels (clamp in the structure agent).
