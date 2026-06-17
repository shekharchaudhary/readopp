/**
 * In-memory cache for inputs that arrive BEFORE the orchestrator starts:
 *
 *  - Articles already extracted (CleanArticle)
 *  - Raw PDF buffers waiting to be extracted by the orchestrator's ingest
 *    stage. Running PDF extraction inside the orchestrator (instead of
 *    inline in the upload route) lets the upload return immediately so
 *    the client sees the job stream + progress UI rather than a long
 *    "Uploading…" spinner.
 *
 * Lives in-process only — each job is single-process and the orchestrator
 * is fired immediately after stashing.
 */
import type { CleanArticle } from "../shared/schemas";

const ARTICLE_STORE = new Map<string, CleanArticle>();

export function stashPreIngested(jobId: string, article: CleanArticle): void {
  ARTICLE_STORE.set(jobId, article);
}

/** Returns the stashed article and removes it from the map (one-shot). */
export function drainPreIngested(jobId: string): CleanArticle | null {
  const a = ARTICLE_STORE.get(jobId);
  if (!a) return null;
  ARTICLE_STORE.delete(jobId);
  return a;
}

export interface PendingPdf {
  buffer: Buffer;
  filename: string;
}

const PDF_STORE = new Map<string, PendingPdf>();

export function stashPendingPdf(jobId: string, pdf: PendingPdf): void {
  PDF_STORE.set(jobId, pdf);
}

/** Returns the pending PDF and removes it from the map (one-shot). */
export function drainPendingPdf(jobId: string): PendingPdf | null {
  const p = PDF_STORE.get(jobId);
  if (!p) return null;
  PDF_STORE.delete(jobId);
  return p;
}
