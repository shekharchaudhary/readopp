-- Phase 9 — full-canvas panel editor.
--
-- One row per panel-the-user-has-touched-in-the-editor. The Excalidraw scene
-- (elements, appState, files) lives wholesale in jsonb. We key on
-- (explainer_id, section_id) — every generated panel has a stable section_id
-- inside the explainer's panels jsonb. RLS scopes to the explainer's owner.

create table if not exists public.panel_scenes (
  explainer_id text not null references public.explainers(id) on delete cascade,
  section_id text not null,
  -- Owner cached from explainers.user_id so RLS can be checked without a
  -- join. Trigger below keeps it consistent on insert.
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Excalidraw scene shape: { elements: [...], appState: {...}, files: {...} }
  -- Size cap (200KB) enforced in the save API route, not at the column level.
  scene jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (explainer_id, section_id)
);

create index if not exists panel_scenes_user_idx
  on public.panel_scenes (user_id, updated_at desc);

-- Bump updated_at on any row write. Reuses the helper from 0001_init.sql.
drop trigger if exists panel_scenes_set_updated_at on public.panel_scenes;
create trigger panel_scenes_set_updated_at
  before update on public.panel_scenes
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------
-- RLS — owner-only read & write.
-- ----------------------------------------------------------------------
alter table public.panel_scenes enable row level security;

drop policy if exists panel_scenes_owner_select on public.panel_scenes;
create policy panel_scenes_owner_select
  on public.panel_scenes for select
  using (auth.uid() = user_id);

drop policy if exists panel_scenes_owner_insert on public.panel_scenes;
create policy panel_scenes_owner_insert
  on public.panel_scenes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.explainers e
      where e.id = explainer_id
        and e.user_id = auth.uid()
    )
  );

drop policy if exists panel_scenes_owner_update on public.panel_scenes;
create policy panel_scenes_owner_update
  on public.panel_scenes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists panel_scenes_owner_delete on public.panel_scenes;
create policy panel_scenes_owner_delete
  on public.panel_scenes for delete
  using (auth.uid() = user_id);
