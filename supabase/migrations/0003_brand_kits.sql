-- Phase 8 week 4 — brand kit MVP.
-- Per-user brand identity that the export pipeline applies to slide
-- chrome (header dot, footer accent, attribution slide). Panel content
-- SVGs stay in the metaphor palette — branding lives on the chrome only.

create table if not exists public.brand_kits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  color text,
  font text,
  logo_url text,
  author_name text,
  author_headline text,
  updated_at timestamptz not null default now()
);

-- Owner-only read / write.
alter table public.brand_kits enable row level security;

drop policy if exists "brand_kits_select_own" on public.brand_kits;
create policy "brand_kits_select_own"
  on public.brand_kits
  for select
  using (auth.uid() = user_id);

drop policy if exists "brand_kits_insert_own" on public.brand_kits;
create policy "brand_kits_insert_own"
  on public.brand_kits
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "brand_kits_update_own" on public.brand_kits;
create policy "brand_kits_update_own"
  on public.brand_kits
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "brand_kits_delete_own" on public.brand_kits;
create policy "brand_kits_delete_own"
  on public.brand_kits
  for delete
  using (auth.uid() = user_id);

-- Touch updated_at on row update so exports invalidate their cache when
-- the user changes their brand.
drop trigger if exists brand_kits_set_updated_at on public.brand_kits;
create trigger brand_kits_set_updated_at
  before update on public.brand_kits
  for each row execute function public.set_updated_at();
