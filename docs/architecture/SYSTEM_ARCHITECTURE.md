# System Architecture

## High-level shape

```
Browser (Next.js)
   │  POST /api/jobs  { url, audienceLevel }
   ▼
API route ── creates Job, returns jobId
   │
   │  GET /api/jobs/:id/stream  (SSE)
   ▼
Orchestrator (server) ── runs the 6-agent pipeline
   │   each agent: Claude API call w/ scoped prompt + structured output
   │   emits SSE events after each stage (see STREAMING_PROTOCOL.md)
   ▼
Persistence
   ├─ Postgres: jobs, explainers, panels, events
   └─ Object storage (R2/S3): exported PNGs
   │
   ▼
Browser renders: working scene (from events) → panels (from explainer) → export
```

## Why server-orchestrated, not client-orchestrated

The agent prompts and the Anthropic API key must never touch the browser. The orchestrator runs server-side. The browser's only job is: kick off a job, subscribe to its event stream, and render what comes back. This also means a job survives a page refresh (re-subscribe to the same job's stream / fetch its current state).

## Request lifecycle

1. **Create job.** `POST /api/jobs` validates the URL, computes `cacheKey = hash(url + audienceLevel)`. If a finished explainer exists for that key, return it immediately (cache hit). Otherwise create a `Job` row with status `queued`, return `{ jobId }`.
2. **Subscribe.** Browser opens `GET /api/jobs/:id/stream` (SSE). Server begins (or resumes) running the pipeline and emits events.
3. **Run pipeline.** Orchestrator runs agents 1→6 (see `AGENT_PIPELINE.md`). After each agent, it persists progress and emits an SSE event.
4. **Stream panels.** As the render agent finishes each panel, that panel is emitted immediately so the UI shows it without waiting for the whole explainer.
5. **Finish.** Orchestrator emits `job.completed` with the full explainer. Browser switches to the result view.
6. **Export (on demand).** When the user exports, `POST /api/explainers/:id/export { panelId?, format }` renders the panel(s) to PNG at the requested dimensions server-side and returns a URL.

## Rendering strategy (critical)

Diagrams are produced as **SVG or self-contained HTML strings** by the render agent. They are:
- Shown directly in the browser (inline SVG / sandboxed iframe for HTML).
- Exported to PNG **server-side** using a headless browser (Playwright) that loads the SVG/HTML at the target dimensions and screenshots it.

This is the core anti-garbling decision: text is real vector text, never pixels from a diffusion model. See `RENDERING_AND_EXPORT.md`.

## Cost & latency model

- 6 agents = up to 6 Claude calls per job. Use a **fast/cheap model** for the mechanical stages (ingest cleanup, structure) and the **strong model** for comprehension, visual planning, and rendering.
- Cache aggressively by `cacheKey`.
- Run independent panel renders **in parallel** (the render agent can fan out across panels once the plan exists).
- Target: < 90s wall-clock per uncached job.

## Failure handling

- Each agent call is wrapped with a retry (max 2) and a timeout.
- If ingest fails (paywall/404), the job ends early with `job.failed` + a typed reason; the UI shows a friendly message.
- If the render agent produces invalid SVG after its self-correction retries, it falls back to a simpler template-based diagram for that panel rather than failing the whole job.

## Environments

- `dev`: local Next.js, local Postgres (Docker), local object storage (MinIO) or just the filesystem.
- `prod`: Next.js on Vercel; orchestrator either as Vercel functions (if within timeout) or a small long-running worker on Fly.io for jobs that exceed serverless limits. Postgres on Neon/Supabase. Storage on Cloudflare R2.

> Note: serverless function timeouts may be too short for a 90s job. Prefer running the orchestrator on a Fly.io worker process and have the Next.js API talk to it, OR use a streaming function platform that allows long-lived SSE. Decide in Phase 1; see BUILD_PLAN.md.
