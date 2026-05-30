import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StreamEvent } from "./events";
import type { Explainer, Job } from "./shared/schemas";

/**
 * Tiny JSON-file persistence. Single document on disk; writes are atomic
 * (write temp + rename) and debounced via setImmediate so a burst of mutations
 * coalesces into one flush. Synchronous reads/writes — fine for this scale.
 *
 * The full schema swap to Postgres lives in TECH_STACK.md; this file is the
 * interim store for local dev that survives `npm run dev` restarts.
 */

export const DATA_DIR = join(process.cwd(), ".lucidread-data");
const STORE_FILE = join(DATA_DIR, "store.json");
const STORE_TMP = join(DATA_DIR, "store.json.tmp");

const STORE_VERSION = 1;

export interface PersistedSnapshot {
  version: number;
  jobs: [string, Job][];
  cacheKeyToExplainerId: [string, string][];
  explainers: [string, Explainer][];
  events: [string, StreamEvent[]][];
}

export function emptySnapshot(): PersistedSnapshot {
  return {
    version: STORE_VERSION,
    jobs: [],
    cacheKeyToExplainerId: [],
    explainers: [],
    events: [],
  };
}

export function loadSnapshot(): PersistedSnapshot {
  try {
    if (!existsSync(STORE_FILE)) return emptySnapshot();
    const raw = readFileSync(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<PersistedSnapshot>;
    if (parsed.version !== STORE_VERSION) return emptySnapshot();
    return {
      version: STORE_VERSION,
      jobs: parsed.jobs ?? [],
      cacheKeyToExplainerId: parsed.cacheKeyToExplainerId ?? [],
      explainers: parsed.explainers ?? [],
      events: parsed.events ?? [],
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      "[lucidread] could not load persisted store, starting empty:",
      (e as Error).message
    );
    return emptySnapshot();
  }
}

let writeScheduled = false;
let getSnapshot: (() => PersistedSnapshot) | null = null;

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function flushNow(): void {
  if (!getSnapshot) return;
  try {
    ensureDir();
    const snap = getSnapshot();
    writeFileSync(STORE_TMP, JSON.stringify(snap), "utf8");
    renameSync(STORE_TMP, STORE_FILE);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      "[lucidread] failed to persist store:",
      (e as Error).message
    );
  }
}

/**
 * Register the snapshot producer + schedule a flush (debounced to next tick).
 * Multiple mutations within a tick coalesce into one disk write.
 */
export function schedulePersist(producer: () => PersistedSnapshot): void {
  getSnapshot = producer;
  if (writeScheduled) return;
  writeScheduled = true;
  setImmediate(() => {
    writeScheduled = false;
    flushNow();
  });
}
