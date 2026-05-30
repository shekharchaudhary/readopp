# Build Plan

Build in thin vertical slices. Get one URL → one panel working end-to-end before adding agents, streaming polish, or export. Each phase ends with something runnable.

> Golden rule (borrowed from the article this app was born to explain): make incremental progress, leave a clean working state at each step, and verify end-to-end before moving on.

---

## Phase 0 — Skeleton (runnable hello-world)
**Goal:** the app boots, types exist, DB connects.
- [ ] Init Next.js + TS + Tailwind in `apps/web`.
- [ ] Create `packages/shared` with Zod schemas + types from `DATA_CONTRACTS.md`.
- [ ] Set up Postgres + Drizzle schema in `db/` (`jobs`, `explainers`, `panels`, `events`, `exports`).
- [ ] `.env.example` + config loading.
- [ ] Input screen renders (no logic yet).
**Done when:** `npm run dev` shows the input screen; `POST /api/jobs` inserts a stub job row.

## Phase 1 — Single-pass vertical slice (NO multi-agent yet)
**Goal:** URL in → ONE diagram out, synchronously, no streaming.
- [ ] Ingest (code-only readability extraction) → `CleanArticle`.
- [ ] A SINGLE combined Claude call: article → one `PanelPlan` (pick the most important idea) → SVG.
  (Temporarily merge comprehension+structure+plan+render to prove the rendering quality fastest.)
- [ ] Render the SVG inline on `/j/[jobId]`.
- [ ] Test on 5 clean technical blog posts you pick.
**Done when:** pasting a known-good article URL shows one clean, valid SVG panel. This validates the hardest risk (render quality) earliest.

## Phase 2 — Split into the real 6-agent pipeline (still no fancy streaming)
**Goal:** the true pipeline runs server-side, persisting each stage.
- [ ] Implement agents 1–6 as separate modules per `docs/agents/*.md`, each with Zod-validated output + retry.
- [ ] Orchestrator runs them in sequence, persists partial state, produces a full multi-panel `Explainer`.
- [ ] Result view renders all panels + captions (fetch the finished explainer; polling is fine for now).
- [ ] Add the explainer cache (`hash(url+audienceLevel)`).
**Done when:** a URL produces a 3–6 panel explainer reliably across 10 test articles. Measure per-agent timing.

## Phase 3 — The working scene (streaming)
**Goal:** the signature live experience.
- [ ] Add the event system: `emit()` persists + pushes SSE (`STREAMING_PROTOCOL.md`).
- [ ] `GET /api/jobs/:id/stream` SSE route with replay-on-reconnect.
- [ ] `useJobStream` hook + `sceneReducer`.
- [ ] `<WorkingScene>` with agent nodes, active pulse, marching-ants arrows, live log line, reduced-motion fallback.
- [ ] Panels stream in via `panel.start`/`panel.done` (skeleton → filled).
**Done when:** watching a job run feels alive — agents light up in order, panels pop in one by one. Test on 5 people; it should be fun to watch.

## Phase 4 — Social export
**Goal:** download panels as Instagram/TikTok/LinkedIn images.
- [ ] `buildExportHtml` per format (light-locked theme, branding frame, bundled web font).
- [ ] Playwright screenshot → PNG → R2; `exports` cache.
- [ ] `POST /api/explainers/:id/export` + `<ExportSheet>` UI with preview + download.
- [ ] "Export all" (multi-image set for square/landscape; stacked for vertical).
**Done when:** a square export looks postable with zero editing across the 3 formats.

## Phase 5 — Hardening & polish
- [ ] Friendly typed error states (paywall, login, 404, empty) end-to-end.
- [ ] Render fallback panel path verified (force a bad plan, confirm explainer still completes).
- [ ] Model-tier routing (fast vs strong) wired + cost logging via PostHog.
- [ ] Example gallery on the home screen (precomputed explainers).
- [ ] Concurrency cap on panel render; global rate-limit handling/backoff.
- [ ] Split orchestrator into `apps/worker` on Fly.io if jobs exceed serverless limits (needed once Playwright is in prod).
**Done when:** 20 random real-world URLs across blogs/news/docs produce good or gracefully-degraded results.

---

## Test article set (use throughout)
Keep a fixed list of ~10 URLs spanning: a clean engineering blog post, a research paper abstract page, a long news feature, a product announcement, a how-to tutorial, and one deliberately messy/listicle page. Re-run after every phase to catch regressions. (The Anthropic long-running-agents engineering post is a good "clean technical" baseline — it decomposes naturally into problem / solution / loop panels.)

## Risk-first ordering rationale
- Phase 1 front-loads the **highest risk** (will the diagrams actually look good?) before investing in pipeline/streaming/export.
- Streaming (Phase 3) comes only after the pipeline reliably produces good explainers — a beautiful working scene around bad output is worthless.
- Export (Phase 4) last because it's additive and lower-risk once panels are clean SVG/HTML.

## Definition of v1 done
A non-technical friend pastes a real article, enjoys watching it build, understands the topic from the panels, and exports a square image they'd actually post — all in under 90 seconds, with graceful errors when an article can't be read.
