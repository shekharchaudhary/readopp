import { createHash, randomUUID } from "node:crypto";
import {
  ExplainerSchema,
  type AudienceLevel,
  type BrandKit,
  type Explainer,
  type Job,
  type JobError,
  type JobStatus,
  type TokenUsage,
} from "./shared/schemas";
import type { StreamEvent, StreamEventInput } from "./events";
import { getAdminSupabase, getServerSupabase } from "./supabase/server";

/**
 * Hybrid store: jobs + event streams stay in process memory (transient,
 * 60-90 sec lifecycle); explainers (the durable artifact) live in Supabase
 * Postgres tagged with the owning auth.users id.
 */

declare global {
  // eslint-disable-next-line no-var
  var __readopp_store__: ReadoppStore | undefined;
}

type Subscriber = (event: StreamEvent) => void;

class ReadoppStore {
  jobs = new Map<string, Job>();
  events = new Map<string, StreamEvent[]>(); // jobId -> ordered events
  subscribers = new Map<string, Set<Subscriber>>();
}

function getStore(): ReadoppStore {
  if (!globalThis.__readopp_store__) {
    globalThis.__readopp_store__ = new ReadoppStore();
  }
  return globalThis.__readopp_store__;
}

export function cacheKeyFor(url: string, audienceLevel: AudienceLevel): string {
  return createHash("sha256")
    .update(`${url}::${audienceLevel}`)
    .digest("hex")
    .slice(0, 16);
}

// ---------- Jobs (in-memory) ----------

export function createJob(input: {
  url: string;
  audienceLevel: AudienceLevel;
  userId: string;
  /** Optional explicit cache key (e.g. file-hash for PDF uploads). Defaults to url+audience hash. */
  cacheKey?: string;
}): Job & { userId: string } {
  const now = new Date().toISOString();
  const job: Job & { userId: string } = {
    id: randomUUID(),
    url: input.url,
    audienceLevel: input.audienceLevel,
    status: "queued",
    cacheKey: input.cacheKey ?? cacheKeyFor(input.url, input.audienceLevel),
    progress: [],
    usage: { inputTokens: 0, outputTokens: 0, calls: 0 },
    createdAt: now,
    updatedAt: now,
    userId: input.userId,
  };
  getStore().jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): (Job & { userId?: string }) | undefined {
  return getStore().jobs.get(id) as (Job & { userId?: string }) | undefined;
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

/**
 * Persist the finished explainer (Supabase) and mark the in-memory job
 * complete with an inline copy for the immediate /j/:id render.
 */
export async function completeJob(
  id: string,
  explainer: Explainer
): Promise<Job | undefined> {
  const job = getJob(id);
  if (!job) return undefined;
  const userId = job.userId;
  if (!userId) {
    throw new Error(`Job ${id} has no userId — cannot persist explainer.`);
  }
  await insertExplainer(explainer, {
    userId,
    cacheKey: job.cacheKey,
    jobId: id,
  });
  return updateJob(id, {
    status: "completed",
    explainerId: explainer.id,
    explainer,
  });
}

// ---------- Explainers (Supabase) ----------

// ---------- Brand kit (Phase 8 week 4) ----------

interface BrandKitRow {
  user_id: string;
  color: string | null;
  font: string | null;
  logo_url: string | null;
  author_name: string | null;
  author_headline: string | null;
  updated_at: string;
}

/** Returns the user's brand kit, or null when they haven't set one. */
export async function getBrandKit(userId: string): Promise<BrandKit | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("brand_kits")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return rowToBrandKit(data as BrandKitRow);
}

/** Insert-or-update the user's brand kit. */
export async function upsertBrandKit(
  userId: string,
  patch: Partial<BrandKit>
): Promise<
  | { ok: true; brandKit: BrandKit }
  | { ok: false; reason: "missing_table" | "rls_or_other"; message: string }
> {
  const supabase = getServerSupabase();
  const row = {
    user_id: userId,
    color: patch.color ?? null,
    font: patch.font ?? null,
    logo_url: patch.logoUrl ?? null,
    author_name: patch.authorName ?? null,
    author_headline: patch.authorHeadline ?? null,
    updated_at: new Date().toISOString(),
  } as unknown as never;
  const { data, error } = await supabase
    .from("brand_kits")
    .upsert(row, { onConflict: "user_id" })
    .select("*")
    .maybeSingle();
  if (error || !data) {
    // eslint-disable-next-line no-console
    console.warn("[readopp] upsertBrandKit failed", error);
    const message = error?.message ?? "Unknown Supabase error.";
    // "Could not find the table 'public.brand_kits'" → the migration hasn't
    // been applied. Surface this distinctly so the UI can guide the user
    // (or the developer setting up a fresh environment).
    const missingTable = /schema cache|brand_kits/i.test(message);
    return {
      ok: false,
      reason: missingTable ? "missing_table" : "rls_or_other",
      message,
    };
  }
  return { ok: true, brandKit: rowToBrandKit(data as BrandKitRow) };
}

function rowToBrandKit(row: BrandKitRow): BrandKit {
  return {
    color: row.color ?? undefined,
    font: (row.font as BrandKit["font"]) ?? undefined,
    logoUrl: row.logo_url ?? undefined,
    authorName: row.author_name ?? undefined,
    authorHeadline: row.author_headline ?? undefined,
    updatedAt: row.updated_at,
  };
}

interface ExplainerRow {
  id: string;
  user_id: string;
  job_id: string;
  url: string;
  audience_level: string;
  cache_key: string;
  title: string;
  summary: string;
  panels: unknown;
  usage: unknown;
  social_pack: unknown;
  created_at: string;
  updated_at: string;
}

function rowToExplainer(row: ExplainerRow): Explainer {
  const parsed = ExplainerSchema.safeParse({
    id: row.id,
    jobId: row.job_id,
    url: row.url,
    title: row.title,
    summary: row.summary,
    audienceLevel: row.audience_level,
    panels: row.panels,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    socialPack: row.social_pack ?? undefined,
  });
  if (!parsed.success) {
    throw new Error(
      `Stored explainer ${row.id} failed schema parse: ${parsed.error.issues[0]?.message}`
    );
  }
  return parsed.data;
}

async function insertExplainer(
  explainer: Explainer,
  meta: { userId: string; cacheKey: string; jobId: string }
): Promise<void> {
  const admin = getAdminSupabase();
  // We don't run supabase-gen-types in CI, so the client infers row shape
  // as `never`. Cast the payload through `unknown` to keep type-safety
  // localised to the Explainer + meta inputs.
  const row = {
    id: explainer.id,
    user_id: meta.userId,
    job_id: meta.jobId,
    url: explainer.url,
    audience_level: explainer.audienceLevel,
    cache_key: meta.cacheKey,
    title: explainer.title,
    summary: explainer.summary,
    panels: explainer.panels,
    social_pack: explainer.socialPack ?? null,
  } as unknown as never;
  const { error } = await admin.from("explainers").insert(row);
  if (error) {
    throw new Error(`Failed to persist explainer ${explainer.id}: ${error.message}`);
  }
}

/**
 * Find a previously-generated explainer for the same (user, url, audience).
 * Per-user so an edit one user made doesn't leak to another.
 */
export async function findCachedExplainer(
  userId: string,
  cacheKey: string
): Promise<Explainer | undefined> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("explainers")
    .select("*")
    .eq("user_id", userId)
    .eq("cache_key", cacheKey)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return undefined;
  try {
    return rowToExplainer(data as ExplainerRow);
  } catch {
    return undefined;
  }
}

/**
 * Public read — anyone with the id can fetch (the /e/:id share link).
 * RLS policy allows SELECT for everyone.
 */
export async function getExplainer(id: string): Promise<Explainer | undefined> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("explainers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return undefined;
  try {
    return rowToExplainer(data as ExplainerRow);
  } catch {
    return undefined;
  }
}

/**
 * Patch a single panel's editable fields. RLS enforces ownership — a request
 * from a non-owner will simply update 0 rows.
 */
export async function updatePanel(
  explainerId: string,
  sectionId: string,
  patch: { heading?: string; caption?: string; content?: string }
): Promise<Explainer | undefined> {
  const supabase = getServerSupabase();
  // Read-modify-write on the panels jsonb. Two round-trips; acceptable for
  // a once-per-edit operation.
  const { data: existingRow } = await supabase
    .from("explainers")
    .select("*")
    .eq("id", explainerId)
    .maybeSingle();
  if (!existingRow) return undefined;
  const existing = rowToExplainer(existingRow as ExplainerRow);
  const i = existing.panels.findIndex((p) => p.sectionId === sectionId);
  if (i === -1) return undefined;

  const panel = existing.panels[i];
  const nextPanel = {
    ...panel,
    heading: patch.heading !== undefined ? patch.heading : panel.heading,
    caption: patch.caption !== undefined ? patch.caption : panel.caption,
    content: patch.content !== undefined ? patch.content : panel.content,
    // Lock the panel as edited once content is patched, so future
    // template re-renders don't blow away hand-edits.
    edited:
      patch.content !== undefined ? true : panel.edited ?? false,
  };
  const nextPanels = existing.panels.slice();
  nextPanels[i] = nextPanel;

  const { data: updatedRow, error } = await supabase
    .from("explainers")
    .update({ panels: nextPanels })
    .eq("id", explainerId)
    .select("*")
    .maybeSingle();
  if (error || !updatedRow) return undefined;
  const next = rowToExplainer(updatedRow as ExplainerRow);

  // Mirror back into the in-memory job copy so /j/:id stays consistent
  // within the dev session.
  const store = getStore();
  for (const [jobId, job] of store.jobs.entries()) {
    if (job.explainerId === explainerId && job.explainer) {
      store.jobs.set(jobId, {
        ...job,
        explainer: next,
        updatedAt: new Date().toISOString(),
      });
    }
  }
  return next;
}

/**
 * Delete an explainer. RLS enforces ownership.
 */
export async function deleteExplainer(id: string): Promise<boolean> {
  const supabase = getServerSupabase();
  const { error, count } = await supabase
    .from("explainers")
    .delete({ count: "exact" })
    .eq("id", id);
  return !error && (count ?? 0) > 0;
}

/**
 * Number of explainers a user has generated. Used by the Phase 3b free-tier
 * gate. Cache-hit reuses don't insert rows, so this naturally measures
 * unique generations (not page reloads or re-shares).
 */
export async function countExplainersByUser(userId: string): Promise<number> {
  const admin = getAdminSupabase();
  const { count, error } = await admin
    .from("explainers")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) return 0;
  return count ?? 0;
}

/**
 * The current user's recent explainers — newest first. With RLS we don't
 * have to thread userId here; the session-bound client filters for us via
 * the SELECT policy (which is public-read) — so we ALSO add an explicit
 * user filter for the gallery view.
 */
export async function listRecentExplainers(
  userId: string,
  limit = 6
): Promise<Explainer[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("explainers")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  const out: Explainer[] = [];
  for (const row of data) {
    try {
      out.push(rowToExplainer(row as ExplainerRow));
    } catch {
      // Skip any row that fails schema parse rather than 500 the gallery.
    }
  }
  return out;
}

// ---------- Event log + pub/sub (in-memory) ----------

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
