# Tech Stack

Chosen to match a TypeScript-first builder and to minimize moving parts at MVP.

## Language & framework
- **TypeScript** everywhere (strict mode).
- **Next.js (App Router)** — frontend + API routes. React 18+.
- **Tailwind CSS** for styling. Optionally shadcn/ui for primitives (buttons, sheets).

## Orchestration & agents
- **Anthropic TypeScript SDK** (`@anthropic-ai/sdk`) for all agent calls.
  - Strong tier: the current strongest available model for comprehension / planning / render.
  - Fast tier: a smaller/faster model for ingest-cleanup / structure / assembly.
  - (Resolve exact model identifiers at build time from current Anthropic docs — do not hardcode stale names.)
- **Zod** for every agent's structured-output schema + runtime validation.
- Orchestrator is plain TypeScript (a small state machine). Optionally **XState** if you want the job state machine to be explicit and inspectable; not required.

## Article ingestion
- **@mozilla/readability** + **jsdom** for primary extraction.
- A hosted reader API (**Jina AI Reader** or **Firecrawl**) as the fallback for hard/messy pages. Configurable; can be disabled in dev.

## Rendering to images (export)
- **Playwright** (headless Chromium) renders SVG/HTML panels to PNG at exact dimensions.
  - In prod, run Playwright in the Fly.io worker (it needs a real browser binary; not Vercel-friendly).

## Streaming
- Native **SSE** via a Next.js route handler returning a `ReadableStream`, OR the **Vercel AI SDK**'s streaming helpers. SSE is simplest and matches the protocol in `STREAMING_PROTOCOL.md`.

## Data & storage
- **Postgres** — Neon or Supabase. Tables: `jobs`, `explainers`, `panels`, `events`, `exports`.
- **Prisma** or **Drizzle** ORM (Drizzle pairs nicely with Zod + TS).
- **Object storage** — Cloudflare R2 (no egress fees) for exported PNGs. MinIO or local FS in dev.

## Hosting
- **Vercel** — Next.js app + light API routes.
- **Fly.io** — long-running orchestrator worker (handles 90s jobs + Playwright). The Vercel API creates the job row and the worker picks it up / streams it. (If a single platform can do long SSE + Playwright within limits, you may collapse this — but plan for the split.)

## Caching
- Explainer cache keyed by `hash(url + audienceLevel)` in Postgres.
- Export cache keyed by `(explainerId, panelId, format)` in `exports` table + R2.

## Observability
- **Sentry** (errors), **PostHog** (product analytics: job started/completed, export by format, audience-level mix), structured logs (pino) including the persisted event stream per job for debugging "why this output".

## Env vars (`.env.example`)
```
ANTHROPIC_API_KEY=
DATABASE_URL=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
READER_API_KEY=         # Jina/Firecrawl fallback (optional)
APP_BASE_URL=
SENTRY_DSN=             # optional
POSTHOG_KEY=            # optional
```

## Package list (initial)
```
next react react-dom typescript tailwindcss
@anthropic-ai/sdk zod
@mozilla/readability jsdom
playwright
drizzle-orm postgres            # or prisma @prisma/client
@aws-sdk/client-s3              # R2 is S3-compatible
pino
# dev: tsx, eslint, prettier, vitest
```
