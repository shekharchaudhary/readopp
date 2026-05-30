# Lucidread

> Paste a URL. Watch a team of AI agents read it, understand it, and turn it into a visual explanation anyone can follow — then export it as a social post for Instagram, TikTok, or LinkedIn.

This folder is the **complete build specification** for the Lucidread web app. It is written to be handed directly to Claude Code. Read the files in the order listed below.

---

## What we are building (one paragraph)

A web app where a user pastes an article URL and selects an audience level (e.g. "explain like I'm not technical"). A pipeline of specialized AI agents then runs **visibly, one after another** — the user watches each agent light up, do its job, and hand off to the next — and the result is a **multi-panel visual explanation** of the article (clean SVG/HTML diagrams + short prose, not garbled AI images). The user can then **export** any panel or the whole explainer as a social-ready graphic in three aspect ratios: square (Instagram), vertical (TikTok / Reels / Stories), and landscape (LinkedIn).

## The two things that make this different from Napkin / ConceptViz / Mapify

1. **The working scene.** Competitors hide the AI behind a spinner. We make the multi-agent process the *experience* — a live, animated "control room" where you watch agents collaborate. This is also inherently shareable content.
2. **Structured vector rendering, not image generation.** We render diagrams as SVG/HTML with a validate-and-self-correct loop. This avoids the #1 complaint about every competitor: garbled text and misaligned labels inside AI-generated images.

## Reading order for Claude Code

| # | File | What it covers |
|---|------|----------------|
| 1 | `README.md` (this file) | Overview, principles, glossary |
| 2 | `docs/PRODUCT_SPEC.md` | Full product requirements, user stories, screens |
| 3 | `docs/architecture/SYSTEM_ARCHITECTURE.md` | High-level system, data flow, hosting |
| 4 | `docs/architecture/AGENT_PIPELINE.md` | The 6-agent pipeline, contracts, state machine |
| 5 | `docs/architecture/DATA_CONTRACTS.md` | TypeScript types passed between every stage |
| 6 | `docs/architecture/STREAMING_PROTOCOL.md` | SSE event protocol that drives the working scene |
| 7 | `docs/agents/*.md` | One spec file per agent (prompts + I/O) |
| 8 | `docs/architecture/RENDERING_AND_EXPORT.md` | SVG design system + social export pipeline |
| 9 | `docs/architecture/FRONTEND_SPEC.md` | Screens, the working-scene animation, components |
| 10 | `docs/architecture/TECH_STACK.md` | Exact dependencies and why |
| 11 | `docs/BUILD_PLAN.md` | Phased, milestone-by-milestone build order |
| 12 | `docs/architecture/DIRECTORY_STRUCTURE.md` | Target repo layout |

## Core principles (do not violate)

- **Stream everything.** A job takes 30–90s. The user never stares at a blank spinner. Every agent emits progress events that animate the working scene.
- **Vector, not raster.** Diagrams are SVG/HTML. Never use a diffusion image model to draw a diagram with text in it.
- **Validate then self-correct.** The render agent must validate its own SVG (no overlaps, fits viewBox, valid XML) and retry on failure before emitting.
- **Audience level is a first-class input.** It flows through every agent and changes comprehension depth, metaphor choice, and prose reading level.
- **Each agent has ONE job.** Scoped prompts, structured output, independently testable. When output is bad, you must know which agent to fix.
- **Cache by (url + audience_level).** Reprocessing the same article is wasteful and slow. Hash and cache finished explainers.

## Glossary

- **Job** — one URL → explainer run. Has an id, status, and a stream of events.
- **Panel** — one visual unit of the explainer (one diagram + its caption). An explainer is an ordered list of panels.
- **Working scene** — the animated UI showing agents executing in sequence.
- **Explainer** — the finished artifact: ordered panels + title + summary, exportable to social formats.
- **Audience level** — `general` | `student` | `professional` | `technical`. Controls depth and tone.

## Status

Phases 0–4 complete. URL in → live agent pipeline → multi-panel SVG/HTML explainer → social PNG export. No DB yet (in-memory store).

## Run it

1. Set your Anthropic API key:
   ```
   echo 'ANTHROPIC_API_KEY=sk-ant-...' > .env.local
   ```
2. Install everything (first run downloads Chromium for export, ~150MB):
   ```
   npm install
   npx playwright install chromium
   ```
3. Start the dev server:
   ```
   npm run dev
   ```
4. Open http://localhost:3000, paste an article URL, pick an audience level, hit Explain.

### Model overrides (optional)

```
ANTHROPIC_MODEL_STRONG=claude-sonnet-4-5        # default
ANTHROPIC_MODEL_FAST=claude-haiku-4-5-20251001  # default
```

### What works today

- Live working scene: 6 agent nodes light up in order, with a real progress line from the active agent. Panels stream in one by one as the render agent finishes each.
- Real 6-agent pipeline: ingest, comprehension, structure, planner (per-section), render (per-panel, parallel, capped at 4), assembly. Each step is Zod-validated with 1-retry self-correction; per-panel hard failure renders a clean titled-card fallback.
- Per-panel and whole-explainer PNG export via headless Chromium at exact dimensions: square 1080×1080 (Instagram), vertical 1080×1920 (TikTok/Reels), landscape 1200×627 (LinkedIn). Light-locked theme, text-only branding frame. Exports are cached on disk under `.lucidread-exports/`.
- SSE streaming with replay-on-reconnect — refresh `/j/[jobId]` mid-job and the scene rebuilds losslessly.
- Audience level threads into comprehension + planner + caption tone.
- Typed error states surface friendly messages for paywall / login / 404 / invalid URL / empty content / timeout.

### What's intentionally not here

- No DB persistence — jobs and explainers live in process memory and vanish on restart.
- No object storage — exports are served from the local filesystem via `/api/exports/[filename]`. Fine for dev; for prod you'd swap in R2.
- No example gallery on the home screen (Phase 5 polish).
- No worker split — orchestrator and Playwright run inside the Next.js process. For prod with serverless timeouts you'd want a Fly.io worker.
