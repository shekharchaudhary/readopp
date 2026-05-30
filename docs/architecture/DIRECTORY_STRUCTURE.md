# Directory Structure

Target monorepo-ish layout (single Next.js app + a worker + shared package). Keep shared types in one place so frontend, API, and worker agree.

```
lucidread/
├─ README.md
├─ docs/                          # <- this spec folder (keep it in the repo)
├─ .env.example
├─ package.json
├─ apps/
│  ├─ web/                        # Next.js app (frontend + thin API)
│  │  ├─ app/
│  │  │  ├─ page.tsx              # input screen
│  │  │  ├─ j/[jobId]/page.tsx    # working scene + result
│  │  │  ├─ e/[explainerId]/page.tsx  # explainer permalink
│  │  │  └─ api/
│  │  │     ├─ jobs/route.ts                 # POST create job
│  │  │     ├─ jobs/[id]/stream/route.ts     # GET SSE stream
│  │  │     └─ explainers/[id]/export/route.ts # POST export
│  │  ├─ components/
│  │  │  ├─ UrlInput.tsx
│  │  │  ├─ WorkingScene.tsx      # the animated pipeline
│  │  │  ├─ AgentNode.tsx
│  │  │  ├─ PanelCard.tsx         # renders SVG inline / HTML in iframe
│  │  │  ├─ ExplainerView.tsx
│  │  │  └─ ExportSheet.tsx
│  │  ├─ lib/
│  │  │  ├─ useJobStream.ts       # EventSource hook -> SceneState reducer
│  │  │  └─ sceneReducer.ts
│  │  └─ styles/
│  └─ worker/                     # Fly.io orchestrator (long-running jobs + Playwright)
│     ├─ src/
│     │  ├─ orchestrator.ts       # the 6-agent state machine
│     │  ├─ emit.ts               # persist + push SSE events
│     │  ├─ agents/
│     │  │  ├─ ingest.ts
│     │  │  ├─ comprehension.ts
│     │  │  ├─ structure.ts
│     │  │  ├─ planner.ts
│     │  │  ├─ render.ts          # includes self-validation loop
│     │  │  └─ assembly.ts
│     │  ├─ render/
│     │  │  ├─ designSystem.ts    # tokens injected into render prompt
│     │  │  ├─ validateSvg.ts     # programmatic overlap/bounds checks
│     │  │  └─ fallbackPanel.ts
│     │  └─ export/
│     │     ├─ buildExportHtml.ts # per-format export document
│     │     └─ screenshot.ts      # Playwright -> PNG -> R2
│     └─ package.json
├─ packages/
│  └─ shared/
│     ├─ schemas.ts               # Zod schemas (source of truth)
│     ├─ types.ts                 # z.infer types re-exported
│     └─ events.ts                # StreamEvent types + helpers
└─ db/
   ├─ schema.ts                   # drizzle schema: jobs, explainers, panels, events, exports
   └─ migrations/
```

## Boundaries
- `packages/shared` is imported by web, worker, and db. It owns the contracts. No business logic.
- The render design system (`designSystem.ts`) is the single source for the tokens embedded into the render prompt AND used by the export HTML builder — they must agree so the exported PNG looks like the on-screen panel.
- The worker owns ALL Anthropic calls and the API key. The web app never calls Anthropic directly.

## If you want to start simpler
For Phase 0–1 you may collapse `apps/worker` into the Next.js app (run the orchestrator inside a route handler) to avoid managing two deploys, accepting that long jobs may hit serverless timeouts. Split out the worker when jobs reliably exceed the limit or when you add Playwright export. The directory layout above is the destination, not a Phase-0 requirement.
```
