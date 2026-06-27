-- Bold style: persist the deck-level visual style on each job so the
-- orchestrator re-skins the whole carousel. Existing rows are editorial.
alter table public.jobs
  add column if not exists style text not null default 'editorial';
