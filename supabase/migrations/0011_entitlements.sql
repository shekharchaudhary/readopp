create table if not exists public.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  provider_customer_id text,
  provider_subscription_id text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.user_entitlements enable row level security;
drop policy if exists "entitlements_owner_select" on public.user_entitlements;
create policy "entitlements_owner_select" on public.user_entitlements for select using (auth.uid() = user_id);
drop trigger if exists entitlements_set_updated_at on public.user_entitlements;
create trigger entitlements_set_updated_at before update on public.user_entitlements for each row execute procedure public.set_updated_at();
