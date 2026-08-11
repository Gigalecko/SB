-- ------------------------------------------------------------------
-- Simple Buildings – databasuppsättning
-- Klistra in allt i Supabase → SQL Editor → New query → Run.
-- Kan köras om utan att förstöra befintlig data.
-- ------------------------------------------------------------------

-- Hela arbetsytan ligger som ett JSON-dokument på en enda rad.
create table if not exists public.twin_bases (
  id          text primary key,
  data        jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

-- Radsäkerhet: utan inloggning kommer man ingenstans.
alter table public.twin_bases enable row level security;

drop policy if exists "inloggade kan lasa"      on public.twin_bases;
drop policy if exists "inloggade kan skapa"     on public.twin_bases;
drop policy if exists "inloggade kan uppdatera" on public.twin_bases;
drop policy if exists "inloggade kan radera"    on public.twin_bases;

create policy "inloggade kan lasa"      on public.twin_bases for select to authenticated using (true);
create policy "inloggade kan skapa"     on public.twin_bases for insert to authenticated with check (true);
create policy "inloggade kan uppdatera" on public.twin_bases for update to authenticated using (true) with check (true);
create policy "inloggade kan radera"    on public.twin_bases for delete to authenticated using (true);

-- Realtid: så att alla inloggade ser varandras ändringar direkt.
alter publication supabase_realtime add table public.twin_bases;
