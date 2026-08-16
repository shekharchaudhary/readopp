import { createHash } from "node:crypto";
import {
  ExplainerSchema,
  type AudienceLevel,
  type BrandStyle,
  type PublishingGoal,
  type BrandKit,
  type Explainer,
  type Job,
  type JobError,
  type JobStatus,
  type EditorialBrief,
  type CleanArticle,
  type Comprehension,
  type VoiceProfileId,
  type TokenUsage,
} from "./shared/schemas";
import type { StreamEvent, StreamEventInput } from "./events";
import { getAdminSupabase, getServerSupabase } from "./supabase/server";

/**
 * Jobs + SSE event log live in Postgres so they survive serverless
 * instance boundaries (Vercel Fluid Compute can route a job's POST and
 * its follow-up SSE subscribe to different processes). Explainers also
 * persist in Postgres. Nothing critical is in process memory anymore.
 */

export function cacheKeyFor(
  url: string,
  audienceLevel: AudienceLevel,
  style: BrandStyle = "editorial",
  publishingGoal: PublishingGoal = "teach",
  voiceProfileId: VoiceProfileId = "clear_expert"
): string {
  return createHash("sha256")
    .update(`${url}::${audienceLevel}::${style}::${publishingGoal}::${voiceProfileId}`)
    .digest("hex")
    .slice(0, 16);
}

// ---------- Jobs (Supabase) ----------

interface JobRow {
  id: string;
  user_id: string;
  url: string;
  audience_level: string;
  publishing_goal?: string | null;
  voice_profile_id?: string | null;
  status: string;
  style?: string | null;
  cache_key: string;
  progress: unknown;
  usage: unknown;
  error: unknown;
  explainer_id: string | null;
  explainer: unknown;
  editorial_brief?: unknown;
  pipeline_state?: unknown;
  brief_approved?: boolean | null;
  created_at: string;
  updated_at: string;
}

function rowToJob(row: JobRow): Job & { userId: string } {
  return {
    id: row.id,
    url: row.url,
    audienceLevel: row.audience_level as AudienceLevel,
    style: (row.style as BrandStyle | null) ?? "editorial",
    publishingGoal: (row.publishing_goal as PublishingGoal | null) ?? "teach",
    voiceProfileId: (row.voice_profile_id as VoiceProfileId | null) ?? "clear_expert",
    status: row.status as JobStatus,
    cacheKey: row.cache_key,
    progress:
      (row.progress as { ts: string; note: string }[] | null) ?? [],
    usage: (row.usage as TokenUsage | null) ?? undefined,
    error: (row.error as JobError | null) ?? undefined,
    explainerId: row.explainer_id ?? undefined,
    explainer: (row.explainer as Explainer | null) ?? undefined,
    editorialBrief: (row.editorial_brief as EditorialBrief | null) ?? undefined,
    pipelineState: (row.pipeline_state as { article: CleanArticle; comprehension: Comprehension } | null) ?? undefined,
    briefApproved: row.brief_approved ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}

export async function createJob(input: {
  url: string;
  audienceLevel: AudienceLevel;
  userId: string;
  /** Deck-level visual style; defaults to editorial. */
  style?: BrandStyle;
  publishingGoal?: PublishingGoal;
  voiceProfileId?: VoiceProfileId;
  /** Optional explicit cache key (e.g. file-hash for PDF uploads). Defaults to url+audience+style hash. */
  cacheKey?: string;
}): Promise<Job & { userId: string }> {
  const admin = getAdminSupabase();
  const style = input.style ?? "editorial";
  const publishingGoal = input.publishingGoal ?? "teach";
  const voiceProfileId = input.voiceProfileId ?? "clear_expert";
  const row = {
    user_id: input.userId,
    url: input.url,
    audience_level: input.audienceLevel,
    style,
    publishing_goal: publishingGoal,
    voice_profile_id: voiceProfileId,
    status: "queued",
    cache_key:
      input.cacheKey ?? cacheKeyFor(input.url, input.audienceLevel, style, publishingGoal, voiceProfileId),
    progress: [],
    usage: { inputTokens: 0, outputTokens: 0, calls: 0 },
  } as unknown as never;
  const { data, error } = await admin
    .from("jobs")
    .insert(row)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    throw new Error(`Failed to create job: ${error?.message ?? "no row"}`);
  }
  return rowToJob(data as JobRow);
}

export async function getJob(
  id: string
): Promise<(Job & { userId?: string }) | undefined> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return undefined;
  return rowToJob(data as JobRow);
}

export async function updateJob(
  id: string,
  patch: Partial<Job>
): Promise<Job | undefined> {
  const admin = getAdminSupabase();
  const row: Record<string, unknown> = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.progress !== undefined) row.progress = patch.progress;
  if (patch.usage !== undefined) row.usage = patch.usage;
  if (patch.error !== undefined) row.error = patch.error;
  if (patch.explainerId !== undefined) row.explainer_id = patch.explainerId;
  if (patch.explainer !== undefined) row.explainer = patch.explainer;
  if (patch.editorialBrief !== undefined) row.editorial_brief = patch.editorialBrief;
  if (patch.pipelineState !== undefined) row.pipeline_state = patch.pipelineState;
  if (patch.briefApproved !== undefined) row.brief_approved = patch.briefApproved;
  // updated_at is bumped by the row-level trigger.
  const { data, error } = await admin
    .from("jobs")
    .update(row as unknown as never)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error || !data) return undefined;
  return rowToJob(data as JobRow);
}

export async function setJobStatus(
  id: string,
  status: JobStatus
): Promise<Job | undefined> {
  return updateJob(id, { status });
}

export async function appendProgress(
  id: string,
  note: string
): Promise<Job | undefined> {
  // Two-RTT read-modify-write. Only one writer per job (the orchestrator),
  // so there's no append race.
  const existing = await getJob(id);
  if (!existing) return undefined;
  const next = [...existing.progress, { ts: new Date().toISOString(), note }];
  return updateJob(id, { progress: next });
}

export async function addUsage(
  id: string,
  delta: TokenUsage
): Promise<Job | undefined> {
  const existing = await getJob(id);
  if (!existing) return undefined;
  const base = existing.usage ?? {
    inputTokens: 0,
    outputTokens: 0,
    calls: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
  };
  const next: TokenUsage = {
    inputTokens: base.inputTokens + (delta.inputTokens ?? 0),
    outputTokens: base.outputTokens + (delta.outputTokens ?? 0),
    calls: base.calls + (delta.calls ?? 0),
    cacheReadTokens:
      (base.cacheReadTokens ?? 0) + (delta.cacheReadTokens ?? 0),
    cacheCreationTokens:
      (base.cacheCreationTokens ?? 0) + (delta.cacheCreationTokens ?? 0),
  };
  return updateJob(id, { usage: next });
}

export async function failJob(
  id: string,
  error: JobError
): Promise<Job | undefined> {
  return updateJob(id, { status: "failed", error });
}

/**
 * Persist the finished explainer and mark the job complete with an inline
 * copy so /api/jobs/:id can be a single-RTT read.
 */
export async function completeJob(
  id: string,
  explainer: Explainer
): Promise<Job | undefined> {
  const job = await getJob(id);
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
  publishing_goal?: string | null;
  voice_profile_id?: string | null;
  cache_key: string;
  title: string;
  summary: string;
  panels: unknown;
  usage: unknown;
  social_pack: unknown;
  template: string | null;
  resume_doc: unknown;
  evidence_map?: unknown;
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
    publishingGoal: row.publishing_goal ?? "teach",
    voiceProfileId: (row.voice_profile_id as VoiceProfileId | null) ?? "clear_expert",
    panels: row.panels,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    socialPack: row.social_pack ?? undefined,
    template: row.template ?? undefined,
    resumeDoc: row.resume_doc ?? undefined,
    evidenceMap: row.evidence_map ?? undefined,
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
    publishing_goal: explainer.publishingGoal,
    voice_profile_id: explainer.voiceProfileId,
    cache_key: meta.cacheKey,
    title: explainer.title,
    summary: explainer.summary,
    panels: explainer.panels,
    social_pack: explainer.socialPack ?? null,
    template: explainer.template ?? null,
    resume_doc: explainer.resumeDoc ?? null,
    evidence_map: explainer.evidenceMap ?? null,
  } as unknown as never;
  // Upsert (not insert) so the cache-hit path works: when a user
  // re-submits a URL they already have an explainer for, completeJob
  // calls us with the cached explainer's existing id. A plain insert
  // hits explainers_pkey; upsert preserves the original row and bumps
  // the joining job_id so the new job has a valid foreign-key target.
  const { error } = await admin
    .from("explainers")
    .upsert(row, { onConflict: "id" });
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
  return rowToExplainer(updatedRow as ExplainerRow);
}

/**
 * Reorder the panels of an explainer. `order` is the full list of
 * sectionIds in the desired order; it must be a permutation of the
 * existing panel ids (no adds, no drops). Returns the updated explainer
 * or undefined when the explainer doesn't exist / the user isn't the
 * owner / the order doesn't match the current panel set.
 */
export async function reorderPanels(
  explainerId: string,
  order: string[]
): Promise<Explainer | undefined> {
  const supabase = getServerSupabase();
  const { data: existingRow } = await supabase
    .from("explainers")
    .select("*")
    .eq("id", explainerId)
    .maybeSingle();
  if (!existingRow) return undefined;
  const existing = rowToExplainer(existingRow as ExplainerRow);

  const byId = new Map(existing.panels.map((p) => [p.sectionId, p]));
  if (order.length !== existing.panels.length) return undefined;
  if (!order.every((id) => byId.has(id))) return undefined;
  // Permutation check — order has same count + ids exist in byId, so any
  // duplicate id in `order` means a missing id is implicit. Reject.
  if (new Set(order).size !== order.length) return undefined;

  const nextPanels = order.map((id) => byId.get(id)!);

  const { data: updatedRow, error } = await supabase
    .from("explainers")
    .update({ panels: nextPanels })
    .eq("id", explainerId)
    .select("*")
    .maybeSingle();
  if (error || !updatedRow) return undefined;
  return rowToExplainer(updatedRow as ExplainerRow);
}

/**
 * Remove a single panel. Refuses to remove the last panel (an explainer
 * must have at least one). Returns the updated explainer.
 */
export async function deletePanel(
  explainerId: string,
  sectionId: string
): Promise<Explainer | undefined> {
  const supabase = getServerSupabase();
  const { data: existingRow } = await supabase
    .from("explainers")
    .select("*")
    .eq("id", explainerId)
    .maybeSingle();
  if (!existingRow) return undefined;
  const existing = rowToExplainer(existingRow as ExplainerRow);
  const nextPanels = existing.panels.filter((p) => p.sectionId !== sectionId);
  if (nextPanels.length === existing.panels.length) return undefined;
  if (nextPanels.length < 1) return undefined;

  const { data: updatedRow, error } = await supabase
    .from("explainers")
    .update({ panels: nextPanels })
    .eq("id", explainerId)
    .select("*")
    .maybeSingle();
  if (error || !updatedRow) return undefined;
  return rowToExplainer(updatedRow as ExplainerRow);
}

/**
 * Insert a blank panel after `afterSectionId` (or at the end when that
 * id is missing / not found). The blank ships with a minimal placeholder
 * SVG and is marked `edited: true` so future template re-runs don't
 * overwrite it.
 */
export async function insertBlankPanel(
  explainerId: string,
  afterSectionId?: string
): Promise<{ explainer: Explainer; sectionId: string } | undefined> {
  const supabase = getServerSupabase();
  const { data: existingRow } = await supabase
    .from("explainers")
    .select("*")
    .eq("id", explainerId)
    .maybeSingle();
  if (!existingRow) return undefined;
  const existing = rowToExplainer(existingRow as ExplainerRow);

  const newPanel = buildBlankPanel();
  const nextPanels = existing.panels.slice();
  const insertAt = afterSectionId
    ? nextPanels.findIndex((p) => p.sectionId === afterSectionId)
    : -1;
  if (insertAt >= 0) nextPanels.splice(insertAt + 1, 0, newPanel);
  else nextPanels.push(newPanel);

  const { data: updatedRow, error } = await supabase
    .from("explainers")
    .update({ panels: nextPanels })
    .eq("id", explainerId)
    .select("*")
    .maybeSingle();
  if (error || !updatedRow) return undefined;
  return {
    explainer: rowToExplainer(updatedRow as ExplainerRow),
    sectionId: newPanel.sectionId,
  };
}

function buildBlankPanel() {
  const sectionId = `blank-${Math.random().toString(36).slice(2, 10)}`;
  // 680×480 matches the SVG canvas used by all four templates so the new
  // panel sits at the same aspect ratio as its neighbours.
  const content = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 480"><rect x="0" y="0" width="680" height="480" fill="#FAF9F5"/><text x="340" y="240" font-size="16" fill="#7A6F62" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif">Click “Edit on canvas” to draw, or edit the heading and caption below.</text></svg>`;
  return {
    sectionId,
    heading: "Untitled panel",
    caption: "",
    format: "svg" as const,
    content,
    validated: false,
    fallback: false,
    edited: true,
  };
}

/**
 * Persist a template choice on an explainer. RLS enforces ownership.
 * Returns the updated row, or undefined if not found / not owned.
 */
export async function setExplainerTemplate(
  explainerId: string,
  template: Explainer["template"]
): Promise<Explainer | undefined> {
  const supabase = getServerSupabase();
  const { data: updatedRow, error } = await supabase
    .from("explainers")
    .update({ template: template ?? null })
    .eq("id", explainerId)
    .select("*")
    .maybeSingle();
  if (error || !updatedRow) return undefined;
  return rowToExplainer(updatedRow as ExplainerRow);
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

// ---------- Panel scenes (Phase 9 — canvas editor) ----------

/**
 * Read the owner user_id for an explainer. Used by API routes that need to
 * verify ownership without pulling the entire row.
 */
export async function getExplainerOwner(id: string): Promise<string | null> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("explainers")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { user_id: string }).user_id;
}

/**
 * Read the Excalidraw scene for a given (explainer, section). Returns null
 * when the user has never edited this panel. RLS scopes to the owner.
 */
export async function getPanelScene(
  explainerId: string,
  sectionId: string
): Promise<{ scene: unknown; updatedAt: string } | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("panel_scenes")
    .select("scene, updated_at")
    .eq("explainer_id", explainerId)
    .eq("section_id", sectionId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    scene: (data as { scene: unknown }).scene,
    updatedAt: (data as { updated_at: string }).updated_at,
  };
}

/**
 * Upsert the Excalidraw scene for a given (explainer, section). Caller is
 * responsible for verifying ownership before calling — we pass user_id
 * through so the row's RLS-cached column stays consistent.
 */
export async function savePanelScene(input: {
  explainerId: string;
  sectionId: string;
  userId: string;
  scene: unknown;
}): Promise<void> {
  const admin = getAdminSupabase();
  const row = {
    explainer_id: input.explainerId,
    section_id: input.sectionId,
    user_id: input.userId,
    scene: input.scene as never,
  };
  const { error } = await admin
    .from("panel_scenes")
    .upsert(row as unknown as never, {
      onConflict: "explainer_id,section_id",
    });
  if (error) {
    throw new Error(`Failed to save panel scene: ${error.message}`);
  }
}

/**
 * Remove the saved Excalidraw scene for a panel. Used by the canvas's
 * "Restore from panel" button when the user wants to discard their
 * canvas state and re-seed from the underlying panel SVG. No-op when
 * no row exists yet — the user gets the seed regardless.
 */
export async function deletePanelScene(input: {
  explainerId: string;
  sectionId: string;
}): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("panel_scenes")
    .delete()
    .eq("explainer_id", input.explainerId)
    .eq("section_id", input.sectionId);
  if (error) {
    throw new Error(`Failed to delete panel scene: ${error.message}`);
  }
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

// ---------- Event log (Supabase) ----------

interface JobEventRow {
  seq: number;
  job_id: string;
  type: string;
  data: unknown;
  ts: string;
}

function rowToEvent(row: JobEventRow): StreamEvent {
  return {
    type: row.type,
    data: row.data,
    jobId: row.job_id,
    seq: row.seq,
    ts: row.ts,
  } as unknown as StreamEvent;
}

export async function emitEvent(
  jobId: string,
  input: StreamEventInput
): Promise<StreamEvent> {
  const admin = getAdminSupabase();
  const insertRow = {
    job_id: jobId,
    type: input.type,
    data: input.data ?? {},
  } as unknown as never;
  const { data, error } = await admin
    .from("job_events")
    .insert(insertRow)
    .select("seq, job_id, type, data, ts")
    .maybeSingle();
  if (error || !data) {
    throw new Error(
      `Failed to emit event for ${jobId}: ${error?.message ?? "no row"}`
    );
  }
  return rowToEvent(data as JobEventRow);
}

/** Replay every event for a job — used on (re)connect to rebuild scene state. */
export async function listEvents(jobId: string): Promise<StreamEvent[]> {
  return listEventsSince(jobId, 0);
}

/**
 * Events newer than `afterSeq`, ordered by seq. The SSE route polls this
 * to forward new events to a connected client; pass the last-seen seq so
 * subsequent polls only return the delta.
 */
export async function listEventsSince(
  jobId: string,
  afterSeq: number
): Promise<StreamEvent[]> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("job_events")
    .select("seq, job_id, type, data, ts")
    .eq("job_id", jobId)
    .gt("seq", afterSeq)
    .order("seq", { ascending: true });
  if (error || !data) return [];
  return (data as JobEventRow[]).map(rowToEvent);
}
