import { createHash, randomUUID } from "node:crypto";
import type {
  AudienceLevel,
  Explainer,
  Job,
  JobError,
  JobStatus,
  TokenUsage,
} from "./shared/schemas";
import type { StreamEvent, StreamEventInput } from "./events";
import { loadSnapshot, schedulePersist, type PersistedSnapshot } from "./persistence";

/**
 * In-process store backed by a JSON file. Reads are O(1) from memory; every
 * mutation schedules a debounced flush to .readopp-data/store.json so jobs +
 * explainers survive `npm run dev` restarts.
 */

declare global {
  // eslint-disable-next-line no-var
  var __readopp_store__: ReadoppStore | undefined;
}

type Subscriber = (event: StreamEvent) => void;

class ReadoppStore {
  jobs = new Map<string, Job>();
  cacheKeyToExplainerId = new Map<string, string>();
  explainers = new Map<string, Explainer>();
  events = new Map<string, StreamEvent[]>(); // jobId -> ordered events
  subscribers = new Map<string, Set<Subscriber>>(); // not persisted

  constructor() {
    const snap = loadSnapshot();
    this.jobs = new Map(snap.jobs);
    this.cacheKeyToExplainerId = new Map(snap.cacheKeyToExplainerId);
    this.explainers = new Map(snap.explainers);
    this.events = new Map(snap.events);
  }

  snapshot(): PersistedSnapshot {
    return {
      version: 1,
      jobs: Array.from(this.jobs.entries()),
      cacheKeyToExplainerId: Array.from(this.cacheKeyToExplainerId.entries()),
      explainers: Array.from(this.explainers.entries()),
      events: Array.from(this.events.entries()),
    };
  }
}

function getStore(): ReadoppStore {
  if (!globalThis.__readopp_store__) {
    globalThis.__readopp_store__ = new ReadoppStore();
  }
  return globalThis.__readopp_store__;
}

function persist(): void {
  const store = getStore();
  schedulePersist(() => store.snapshot());
}

export function cacheKeyFor(url: string, audienceLevel: AudienceLevel): string {
  return createHash("sha256")
    .update(`${url}::${audienceLevel}`)
    .digest("hex")
    .slice(0, 16);
}

export function createJob(input: {
  url: string;
  audienceLevel: AudienceLevel;
}): Job {
  const now = new Date().toISOString();
  const job: Job = {
    id: randomUUID(),
    url: input.url,
    audienceLevel: input.audienceLevel,
    status: "queued",
    cacheKey: cacheKeyFor(input.url, input.audienceLevel),
    progress: [],
    usage: { inputTokens: 0, outputTokens: 0, calls: 0 },
    createdAt: now,
    updatedAt: now,
  };
  getStore().jobs.set(job.id, job);
  persist();
  return job;
}

export function getJob(id: string): Job | undefined {
  return getStore().jobs.get(id);
}

export function updateJob(id: string, patch: Partial<Job>): Job | undefined {
  const store = getStore();
  const existing = store.jobs.get(id);
  if (!existing) return undefined;
  const merged: Job = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  store.jobs.set(id, merged);
  persist();
  return merged;
}

export function setJobStatus(id: string, status: JobStatus): Job | undefined {
  return updateJob(id, { status });
}

export function appendProgress(id: string, note: string): Job | undefined {
  const existing = getJob(id);
  if (!existing) return undefined;
  const next = [...existing.progress, { ts: new Date().toISOString(), note }];
  return updateJob(id, { progress: next });
}

export function addUsage(id: string, delta: TokenUsage): Job | undefined {
  const existing = getJob(id);
  if (!existing) return undefined;
  const base = existing.usage ?? { inputTokens: 0, outputTokens: 0, calls: 0 };
  const next: TokenUsage = {
    inputTokens: base.inputTokens + (delta.inputTokens ?? 0),
    outputTokens: base.outputTokens + (delta.outputTokens ?? 0),
    calls: base.calls + (delta.calls ?? 0),
  };
  return updateJob(id, { usage: next });
}

export function failJob(id: string, error: JobError): Job | undefined {
  return updateJob(id, { status: "failed", error });
}

export function completeJob(
  id: string,
  explainer: Explainer
): Job | undefined {
  const store = getStore();
  store.explainers.set(explainer.id, explainer);
  const key = getJob(id)?.cacheKey ?? "";
  if (key) store.cacheKeyToExplainerId.set(key, explainer.id);
  const updated = updateJob(id, {
    status: "completed",
    explainerId: explainer.id,
    explainer,
  });
  persist();
  return updated;
}

export function findCachedExplainer(cacheKey: string): Explainer | undefined {
  const store = getStore();
  const explainerId = store.cacheKeyToExplainerId.get(cacheKey);
  if (!explainerId) return undefined;
  return store.explainers.get(explainerId);
}

export function getExplainer(id: string): Explainer | undefined {
  return getStore().explainers.get(id);
}

/**
 * Patch a single panel's editable fields (heading + caption). Returns the
 * updated explainer or undefined if the explainer or section is missing.
 * Bumps explainer.updatedAt so export caches invalidate.
 */
export function updatePanel(
  explainerId: string,
  sectionId: string,
  patch: { heading?: string; caption?: string; content?: string }
): Explainer | undefined {
  const store = getStore();
  const existing = store.explainers.get(explainerId);
  if (!existing) return undefined;
  const i = existing.panels.findIndex((p) => p.sectionId === sectionId);
  if (i === -1) return undefined;

  const panel = existing.panels[i];
  const nextPanel = {
    ...panel,
    heading: patch.heading !== undefined ? patch.heading : panel.heading,
    caption: patch.caption !== undefined ? patch.caption : panel.caption,
    content: patch.content !== undefined ? patch.content : panel.content,
  };
  const nextPanels = existing.panels.slice();
  nextPanels[i] = nextPanel;

  const nextExplainer: Explainer = {
    ...existing,
    panels: nextPanels,
    updatedAt: new Date().toISOString(),
  };
  store.explainers.set(explainerId, nextExplainer);

  // Also reflect into the linked job, if any, so the /j/:id view stays consistent.
  for (const [jobId, job] of store.jobs.entries()) {
    if (job.explainerId === explainerId && job.explainer) {
      store.jobs.set(jobId, {
        ...job,
        explainer: nextExplainer,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  persist();
  return nextExplainer;
}

/**
 * Remove an explainer and the cache-key pointer that targets it. Jobs that
 * inlined this explainer keep their copy — the /e/:id permalink 404s cleanly
 * via the page's notFound() path.
 */
export function deleteExplainer(id: string): boolean {
  const store = getStore();
  if (!store.explainers.has(id)) return false;
  store.explainers.delete(id);
  for (const [key, eid] of store.cacheKeyToExplainerId.entries()) {
    if (eid === id) store.cacheKeyToExplainerId.delete(key);
  }
  persist();
  return true;
}

/**
 * Recent completed explainers, newest first, for the home-screen gallery.
 */
export function listRecentExplainers(limit = 6): Explainer[] {
  const store = getStore();
  return Array.from(store.explainers.values())
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
}

// ---------- Event log + pub/sub ----------

export function emitEvent(jobId: string, input: StreamEventInput): StreamEvent {
  const store = getStore();
  const list = store.events.get(jobId) ?? [];
  const seq = list.length + 1;
  const event: StreamEvent = {
    ...input,
    jobId,
    seq,
    ts: new Date().toISOString(),
  } as StreamEvent;
  list.push(event);
  store.events.set(jobId, list);
  persist();
  const subs = store.subscribers.get(jobId);
  if (subs) {
    for (const fn of subs) {
      try {
        fn(event);
      } catch {
        // ignore subscriber errors so a broken listener can't poison the loop
      }
    }
  }
  return event;
}

export function listEvents(jobId: string): StreamEvent[] {
  return getStore().events.get(jobId) ?? [];
}

export function subscribe(jobId: string, fn: Subscriber): () => void {
  const store = getStore();
  let set = store.subscribers.get(jobId);
  if (!set) {
    set = new Set();
    store.subscribers.set(jobId, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) store.subscribers.delete(jobId);
  };
}
