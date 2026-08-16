create table if not exists public.product_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists product_events_name_created_idx on public.product_events(event_name, created_at desc);
alter table public.product_events enable row level security;
-- No browser policies: events are written/read through trusted server routes only.
