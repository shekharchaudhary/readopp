# Agent harness

Run every deterministic offline contract:

```bash
npm run harness:all
```

Run one agent with `npm run harness:<agent>`. Offline mode validates versioned fixtures against both Zod schemas and semantic invariants. It never calls a model or fetches a URL. The JSON result is written to `tmp/agent-harness/latest.json` for CI artifacts and baseline comparison.

Live model evaluation remains deliberately separate because it can fetch external content and spend model tokens:

```bash
npx tsx scripts/smoke-test-pipeline.ts
```

Fixtures and executable contracts live in `scripts/agent-harness.mjs`; typed reference fixtures and reusable evaluators live in `lib/harness/`. When an agent contract changes, update its fixture and invariants together, bump the harness version, and review the generated report. Never weaken an invariant merely to accept a model regression.
