# Frontend Spec

Next.js (App Router) + TypeScript + Tailwind. Three core surfaces: input, working scene, result. The working scene is the signature experience — spec it carefully.

## Routes

- `/` — input screen.
- `/j/[jobId]` — working scene + result (same page; result reveals as panels stream in). Shareable; on load it subscribes to the job stream (or shows the finished explainer if already complete).
- `/e/[explainerId]` — canonical permalink to a finished explainer (for "copy link" and example gallery).

## State & data flow

- Submitting the form → `POST /api/jobs` → returns `{ jobId }` → router pushes `/j/[jobId]`.
- `/j/[jobId]` opens an `EventSource` to `/api/jobs/:id/stream`.
- A single reducer consumes `StreamEvent`s and maintains:
  ```ts
  interface SceneState {
    status: JobStatus;
    agents: Record<AgentName, { state: 'pending'|'active'|'done'; summary?: string; lastNote?: string }>;
    activeAgentIndex: number;
    panels: { index: number; total: number; panel?: RenderedPanel; pending: boolean }[];
    explainer?: Explainer;
    error?: JobError;
  }
  ```
- Events mutate this state; the UI is a pure function of it. (Idempotent: dedupe by `seq`.)

## The working scene (component: `<WorkingScene>`)

### Layout
A row (desktop) / column (mobile) of 6 **agent nodes**, connected by arrows, in pipeline order:

```
[Ingest] → [Comprehend] → [Structure] → [Plan] → [Render] → [Assemble]
```

Each node shows: an icon, the agent name, and a state.

### Node states & animation
- **pending** — dimmed (low opacity), no animation.
- **active** — full color, a soft pulsing ring/glow, and the connector arrow flowing INTO it animates (a dash-offset "marching ants" or a moving dot along the arrow).
- **done** — a check mark; shows its `summary` as a subtitle/tooltip; connector arrow OUT becomes solid.

Transitions are eased (200–400ms). Respect `prefers-reduced-motion`: replace pulses/marching-ants with a simple opacity/color change.

### Live log line
Under the pipeline, a single line shows the latest `agent.progress.note` for the active agent, e.g. "Comprehension agent: identified 2 core failure modes…". It updates in place (fade swap), not a growing log, to stay clean. Optionally a small expandable "show all steps" reveals the full history for power users.

### Panels streaming in
Below the scene, a panels area. On `panel.start`, insert a skeleton card (shimmer). On `panel.done`, the skeleton fills with the rendered panel (SVG inline; HTML in a sandboxed iframe sized to content) + caption, with a gentle fade/slide-in. This is the "watch it build" payoff.

### Why this matters
This scene is both the product's trust-builder and its marketing: it's inherently screen-recordable. Consider a subtle "record this scene" affordance in v2. Keep it genuinely informative (real summaries from real agent output), not fake theater.

## Result view (component: `<ExplainerView>`)

- Sticky header: explainer title, source domain (linked), audience-level badge, "Copy link", "Export all".
- Body: ordered panels. Each panel card:
  - The visual (SVG inline, or HTML in a height-synced sandboxed iframe).
  - Caption prose beneath.
  - A per-panel "Export" button → opens `<ExportSheet>`.
- The collapsed working scene remains visible above (so the build story is part of the artifact).

## `<ExportSheet>`
- Three format buttons with their labels (Instagram feed / TikTok-Reels-Stories / LinkedIn) and dimensions.
- On select → `POST /api/explainers/:id/export` → show a preview of the returned PNG with a Download button.
- "Export all" exports the whole explainer in the chosen format (may return multiple images; show them as a downloadable set).

## Input screen (component: `<UrlInput>`)
- URL field (with paste detection + basic validation).
- Audience level: 4 pills (`general`, `student`, `professional`, `technical`) with one-line descriptions on hover; default `general`.
- "Explain" button (disabled until URL looks valid).
- Below: 2–3 precomputed example explainers (cards linking to `/e/[id]`) for instant social proof and so the page isn't empty.

## Rendering untrusted HTML panels safely
HTML panels come from the LLM. Render them inside a **sandboxed iframe** (`sandbox="allow-same-origin"` only as needed; no `allow-scripts` unless an interactive panel requires it, and if so, sanitize). Inline SVG is safer — prefer SVG for most panels; reserve HTML for tables/timelines and sanitize before injecting.

## Accessibility
- Working scene nodes have ARIA live-region updates for the active step.
- SVG panels include `<title>`/`<desc>`.
- Respect reduced motion throughout.
