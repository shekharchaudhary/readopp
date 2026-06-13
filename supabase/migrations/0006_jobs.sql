-- Phase 9 — persist job records + SSE event log so multi-instance
-- serverless doesn't lose state. The in-memory Maps in lib/store.ts
-- worked fine in `next dev` (single Node process) but break on Vercel
-- Fluid Compute, where a /api/explain POST and the follow-up SSE
-- subscribe can land on different instances. Symptom: "That job ID
-- doesn't exist (or the dev server restarted)" 404 on the job page.

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Source + audience copied off the create request.
  url text not null,
  audience_level text not null,

  -- Pipeline state machine: queued → ingesting → comprehending → … → completed/failed.
  status text not null default 'queued',

  -- sha256 prefix of (url::audienceLevel), used for cache short-circuit.
  cache_key text not null,

  -- Progress log: append-only [{ts, note}]. Two-RTT read-modify-write
  -- is fine — there's only one writer (the orchestrator) per job.
  progress jsonb not null default '[]'::jsonb,
  usage jsonb not null default '{"inputTokens":0,"outputTokens":0,"calls":0}'::jsonb,
  error jsonb,

  -- Once the pipeline finishes, we point at the persisted explainer.
  -- The inline `explainer` snapshot keeps /api/jobs/:id self-contained
  -- so the page doesn't need a second roundtrip on completion.
  explainer_id text,
  explainer jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_user_created_idx
  on public.jobs (user_id, created_at desc);

-- Re-use the trigger function defined in 0001_init.sql.
drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
before update on public.jobs
for each row execute procedure public.set_updated_at();

-- RLS: owners read their own jobs. All writes flow through the admin
-- (service-role) client inside the orchestrator, so we don't need a
-- user-side INSERT/UPDATE/DELETE policy.
alter table public.jobs enable row level security;

drop policy if exists "jobs_owner_select" on public.jobs;
create policy "jobs_owner_select"
  on public.jobs for select
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------
-- Event log. Append-only SSE feed; the per-job `seq` field that the
-- client reducer dedupes by is just the global bigserial id of the row.
-- It's monotonically increasing per job (any per-job ordering query
-- sees a strictly increasing sequence), which is all the dedup needs.
-- Using bigserial sidesteps the seq-race problem when the orchestrator
-- fans out concurrent render workers.
-- ----------------------------------------------------------------------

create table if not exists public.job_events (
  seq bigserial primary key,
  job_id uuid not null references public.jobs(id) on delete cascade,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  ts timestamptz not null default now()
);

create index if not exists job_events_by_job_idx
  on public.job_events (job_id, seq);

alter table public.job_events enable row level security;

drop policy if exists "job_events_owner_select" on public.job_events;
create policy "job_events_owner_select"
  on public.job_events for select
  using (
    exists (
      select 1 from public.jobs
      where jobs.id = job_events.job_id
        and jobs.user_id = auth.uid()
    )
  );
