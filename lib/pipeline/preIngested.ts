/**
 * In-memory cache for articles that were extracted BEFORE the orchestrator
 * started (e.g. PDF uploads). The upload route stashes the CleanArticle here
 * by jobId; the orchestrator's Ingest stage drains it instead of fetching.
 *
 * Lives in-process only — fine because each job is single-process and the
 * orchestrator is fired immediately after stashing.
 */
import type { CleanArticle } from "../shared/schemas";

const STORE = new Map<string, CleanArticle>();

export function stashPreIngested(jobId: string, article: CleanArticle): void {
  STORE.set(jobId, article);
}

/** Returns the stashed article and removes it from the map (one-shot). */
export function drainPreIngested(jobId: string): CleanArticle | null {
  const a = STORE.get(jobId);
  if (!a) return null;
  STORE.delete(jobId);
  return a;
}
