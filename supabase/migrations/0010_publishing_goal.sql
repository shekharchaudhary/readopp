-- Publishing intent controls narrative structure, captions, and cache identity.
alter table public.jobs
  add column if not exists publishing_goal text not null default 'teach';

alter table public.explainers
  add column if not exists publishing_goal text not null default 'teach';
