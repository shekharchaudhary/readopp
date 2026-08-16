alter table public.jobs
  add column if not exists editorial_brief jsonb,
  add column if not exists pipeline_state jsonb,
  add column if not exists brief_approved boolean not null default false;

create index if not exists jobs_awaiting_brief_idx
  on public.jobs (user_id, updated_at desc)
  where status = 'awaiting_approval';
