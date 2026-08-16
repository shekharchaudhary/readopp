alter table public.jobs
  add column if not exists voice_profile_id text not null default 'clear_expert';

alter table public.explainers
  add column if not exists voice_profile_id text not null default 'clear_expert',
  add column if not exists evidence_map jsonb;
