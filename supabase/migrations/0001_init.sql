-- Phase 3a — Supabase foundation for Readopp.
--
-- One table for now: explainers (the durable artifact). Jobs and event
-- streams stay in process memory; they're transient (60-90 sec lifecycle)
-- and can be hoisted to Postgres later when we go serverless.

create table if not exists public.explainers (
  -- Keep the existing string id format so old URLs (and migration scripts
  -- later) stay valid.
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Trace back to the job that produced the explainer. The job itself lives
  -- in-process and is ephemeral; this column is for debugging only.
  job_id text not null default '',

  -- Source + audience were already on the explainer record.
  url text not null,
  audience_level text not null,
  -- sha256 prefix of (url::audienceLevel). Lets us short-circuit identical
  -- jobs to a cached explainer without a full scan.
  cache_key text not null,

  title text not null default '',
  summary text not null default '',
  -- The panels array (RenderedPanel[]) lives wholesale in jsonb. Editing
  -- happens by rewriting this column. 50KB cap is enforced in the API
  -- route, not at the column level.
  panels jsonb not null default '[]'::jsonb,
  -- TokenUsage object, optional.
  usage jsonb,

  created_at timestamptz not null default now(),
  -- Bumped on every panel edit; used as a cache-buster for PNG/MP4 exports.
  updated_at timestamptz not null default now()
);

-- Cache lookup: one user shouldn't generate the same (url, audience) twice.
-- We DON'T enforce uniqueness across users — each user gets their own copy
-- so an edit doesn't leak across accounts.
create index if not exists explainers_user_cache_idx
  on public.explainers (user_id, cache_key);

-- For "my recent runs" gallery.
create index if not exists explainers_user_created_idx
  on public.explainers (user_id, created_at desc);

-- Touch updated_at on row update so the export caches invalidate without
-- the application having to remember.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists explainers_set_updated_at on public.explainers;
create trigger explainers_set_updated_at
before update on public.explainers
for each row execute procedure public.set_updated_at();

-- ----------------------------------------------------------------------
-- Row-level security.
--
-- Reads: anyone can SELECT any explainer. We rely on the unguessable id
-- (8-char random) for share-link privacy. This keeps /e/:id public for
-- anonymous browsers, including link recipients.
--
-- Writes: only the owner can insert/update/delete their own rows. The
-- service role bypasses RLS for any admin tasks.
-- ----------------------------------------------------------------------

alter table public.explainers enable row level security;

drop policy if exists "explainers_public_select" on public.explainers;
create policy "explainers_public_select"
  on public.explainers for select
  using (true);

drop policy if exists "explainers_owner_insert" on public.explainers;
create policy "explainers_owner_insert"
  on public.explainers for insert
  with check (auth.uid() = user_id);

drop policy if exists "explainers_owner_update" on public.explainers;
create policy "explainers_owner_update"
  on public.explainers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "explainers_owner_delete" on public.explainers;
create policy "explainers_owner_delete"
  on public.explainers for delete
  using (auth.uid() = user_id);
