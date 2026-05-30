import { createHash, randomUUID } from "node:crypto";
import type {
  AudienceLevel,
  Explainer,
  Job,
  JobError,
  JobStatus,
} from "./shared/schemas";
import type { StreamEvent, StreamEventInput } from "./events";

// In-memory job store. Survives only within a single Next.js dev/server process.

declare global {
  // eslint-disable-next-line no-var
  var __lucidread_store__: LucidreadStore | undefined;
}

type Subscriber = (event: StreamEvent) => void;

class LucidreadStore {
  jobs = new Map<string, Job>();
  cacheKeyToExplainerId = new Map<string, string>();
  explainers = new Map<string, Explainer>();
  events = new Map<string, StreamEvent[]>(); // jobId -> ordered events
  subscribers = new Map<string, Set<Subscriber>>(); // jobId -> live SSE listeners
}

function getStore(): LucidreadStore {
  if (!globalThis.__lucidread_store__) {
    globalThis.__lucidread_store__ = new LucidreadStore();
  }
  return globalThis.__lucidread_store__;
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
    createdAt: now,
    updatedAt: now,
  };
  getStore().jobs.set(job.id, job);
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

export function failJob(id: string, error: JobError): Job | undefined {
  return updateJob(id, { status: "failed", error });
}

export function completeJob(
  id: string,
  explainer: Explainer
): Job | undefined {
  const store = getStore();
  store.explainers.set(explainer.id, explainer);
  store.cacheKeyToExplainerId.set(
    getJob(id)?.cacheKey ?? "",
    explainer.id
  );
  return updateJob(id, {
    status: "completed",
    explainerId: explainer.id,
    explainer,
  });
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

// ---------- Event log + pub/sub (Phase 3) ----------

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
