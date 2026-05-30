# Agent Pipeline

The pipeline is 6 agents run in sequence. Each consumes the accumulated job state and produces its slice of output. All types are defined in `DATA_CONTRACTS.md`.

```
  ┌──────────────┐   ┌──────────────────┐   ┌────────────────┐
  │ 1. Ingest    │──▶│ 2. Comprehension │──▶│ 3. Structure   │
  │  fetch+clean │   │  understand it   │   │  sectionize +  │
  │              │   │                  │   │  pick visual   │
  └──────────────┘   └──────────────────┘   └────────────────┘
                                                     │
  ┌──────────────┐   ┌──────────────────┐   ┌────────▼───────┐
  │ 6. Assembly  │◀──│ 5. Render        │◀──│ 4. Visual      │
  │  final       │   │  spec → SVG/HTML  │   │  Planner       │
  │  explainer   │   │  validate+fix     │   │  layout spec   │
  └──────────────┘   └──────────────────┘   └────────────────┘
```

Each agent specced in detail in `docs/agents/`. Summary:

| # | Agent | Model tier | Input | Output | Emits event |
|---|-------|-----------|-------|--------|-------------|
| 1 | Ingest | fast | `url` | `CleanArticle` | `agent.ingest.*` |
| 2 | Comprehension | strong | `CleanArticle`, `audienceLevel` | `Comprehension` | `agent.comprehension.*` |
| 3 | Structure | fast | `Comprehension` | `ExplainerOutline` (sections + chosen visual type each) | `agent.structure.*` |
| 4 | Visual Planner | strong | each `OutlineSection` | `PanelPlan` per section | `agent.planner.*` |
| 5 | Render | strong | each `PanelPlan` | `RenderedPanel` (SVG/HTML) | `agent.render.panel.*` |
| 6 | Assembly | fast | all `RenderedPanel` + `Comprehension` | `Explainer` | `agent.assembly.*`, `job.completed` |

## Why this decomposition

- **Comprehension ≠ visual design.** Understanding the article and deciding how to draw it are different skills with different failure modes. Splitting them lets each be tuned and tested alone.
- **Structure picks the visual TYPE before anything is drawn.** A process → flowchart; a concept/mechanism → illustrative diagram; a comparison → table/side-by-side; a sequence over time → timeline. Getting the *type* right is most of the battle, so it gets its own agent (mirrors the "plan-first" approach competitors are converging on).
- **Render is isolated so the validate-and-self-correct loop lives in one place.** This is where SVG correctness is enforced.
- **Panels render in parallel.** Once the planner has produced N panel plans, the render stage fans out — N concurrent render calls — then assembly waits for all.

## The state machine

A job moves through these statuses (persisted, so a refresh can resume):

```
queued → ingesting → comprehending → structuring → planning → rendering → assembling → completed
                                                                                    ↘ failed
```

Each transition persists the partial result and emits an SSE event. If the browser disconnects and reconnects, the server replays the current state then continues live.

## Audience level threading

`audienceLevel` is passed to agents 2, 4, and 5 and changes their behavior:

- **Comprehension** — how much to simplify, which jargon to flag for definition.
- **Visual Planner** — metaphor choice and density (a `general` audience gets a kitchen analogy; a `technical` audience gets the real component names).
- **Render** — caption reading level and label verbosity.

## Per-agent contracts (the iron rule)

Every agent MUST return valid JSON matching its output type in `DATA_CONTRACTS.md`. Agents are called with structured-output instructions ("respond ONLY with JSON matching this schema, no prose, no markdown fences"). The orchestrator parses, validates against a Zod schema, and retries with the validation error fed back if parsing fails (max 2 retries) before failing the stage.

## Parallelism & ordering rules

- Agents 1→4 are strictly sequential.
- Agent 5 (Render) fans out: one concurrent task per panel plan. Cap concurrency (e.g. 4) to control cost/rate limits.
- Agent 6 (Assembly) is a barrier — waits for all panels, orders them by the outline order, attaches title/summary.
- Panels are emitted to the client **as each finishes**, but the final ordered `Explainer` is authoritative.

## Fallbacks

- Render agent invalid after retries → emit a template-based fallback panel (a simple titled card with the caption) so the explainer is never broken by one bad panel.
- Comprehension/structure failure → fail the job with reason `comprehension_failed` (rare; usually means the article was empty/garbage after ingest).
