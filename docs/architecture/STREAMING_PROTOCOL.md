# Streaming Protocol (SSE)

The working scene is driven entirely by a Server-Sent Events stream. The browser opens `GET /api/jobs/:id/stream` and receives a sequence of typed JSON events. This file defines every event.

## Transport

- Content-Type: `text/event-stream`.
- Each event is a line: `data: <json>\n\n`.
- On (re)connect, the server first **replays** events needed to reconstruct current state (it persists emitted events), then continues live. The client must be idempotent — applying the same event twice is harmless because events carry absolute state, not deltas where it matters.

## Event envelope

```ts
interface StreamEvent {
  type: StreamEventType;
  jobId: string;
  ts: string;               // ISO timestamp
  seq: number;              // monotonic per job, for ordering/dedup
  data: unknown;            // shape depends on type (below)
}
```

## Event types

```ts
type StreamEventType =
  // lifecycle
  | 'job.status'              // { status: JobStatus }
  | 'job.completed'           // { explainer: Explainer }
  | 'job.failed'              // { error: JobError }

  // each agent emits start + done (and optionally progress)
  | 'agent.start'             // { agent: AgentName, index: number }       // index 1..6
  | 'agent.progress'          // { agent: AgentName, note: string }        // a human log line
  | 'agent.done'              // { agent: AgentName, index: number, summary: string }

  // render fans out per-panel; these drive panels appearing one-by-one
  | 'panel.start'             // { sectionId, index, total }
  | 'panel.done';             // { panel: RenderedPanel, index, total }

type AgentName =
  | 'ingest' | 'comprehension' | 'structure' | 'planner' | 'render' | 'assembly';
```

## The canonical event sequence (happy path)

```
job.status            { status: 'ingesting' }
agent.start           { agent: 'ingest', index: 1 }
agent.progress        { agent: 'ingest', note: 'Fetching article…' }
agent.progress        { agent: 'ingest', note: 'Stripped nav & ads, 1,240 words' }
agent.done            { agent: 'ingest', index: 1, summary: 'Read "Effective harnesses…", 1,240 words' }

job.status            { status: 'comprehending' }
agent.start           { agent: 'comprehension', index: 2 }
agent.progress        { agent: 'comprehension', note: 'Found the core idea' }
agent.done            { agent: 'comprehension', index: 2, summary: 'Identified 2 failure modes + a 2-part fix' }

job.status            { status: 'structuring' }
agent.start           { agent: 'structure', index: 3 }
agent.done            { agent: 'structure', index: 3, summary: 'Planned 3 panels: problem, solution, loop' }

job.status            { status: 'planning' }
agent.start           { agent: 'planner', index: 4 }
agent.done            { agent: 'planner', index: 4, summary: 'Designed layouts for 3 panels' }

job.status            { status: 'rendering' }
agent.start           { agent: 'render', index: 5 }
panel.start           { sectionId: 's1', index: 1, total: 3 }
panel.done            { panel: {…}, index: 1, total: 3 }      // ← panel appears in UI now
panel.start           { sectionId: 's2', index: 2, total: 3 }
panel.done            { panel: {…}, index: 2, total: 3 }
panel.start           { sectionId: 's3', index: 3, total: 3 }
panel.done            { panel: {…}, index: 3, total: 3 }
agent.done            { agent: 'render', index: 5, summary: 'Rendered 3 panels' }

job.status            { status: 'assembling' }
agent.start           { agent: 'assembly', index: 6 }
agent.done            { agent: 'assembly', index: 6, summary: 'Assembled explainer' }

job.completed         { explainer: {…} }
```

## How the frontend maps events → working scene

- `agent.start` → that node lights up / pulses; previous node gets a check.
- `agent.progress` → updates the live log line under the pipeline.
- `agent.done` → node shows a check + its `summary` as a tooltip/subtitle.
- `panel.start` / `panel.done` → a placeholder card appears then fills with the rendered panel; this is what makes panels "stream in one by one."
- `job.completed` → transition from working scene to result view (keep the scene visible, collapsed, above the result).
- `job.failed` → show error state with `error.message`.

## Failure events

If any stage fails irrecoverably:
```
agent.progress  { agent: 'ingest', note: 'Article appears to be behind a paywall' }
job.failed      { error: { reason: 'paywalled', message: 'This article seems to require a subscription…' } }
```

## Implementation note

The orchestrator should expose an `emit(event)` function that (1) assigns `seq`, (2) persists the event to the `events` table, (3) pushes to any open SSE connection for that job. Persisting enables replay-on-reconnect and post-hoc debugging of "why did this job produce that?".
