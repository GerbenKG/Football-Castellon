-- Track how often each player has been selected as team captain.
create table if not exists public.team_captain_history (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  team_name text not null,
  player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (game_id, team_name)
);

create index if not exists idx_team_captain_history_player
  on public.team_captain_history(player_id);

alter table public.team_captain_history enable row level security;

drop policy if exists "authenticated can read captain history"
  on public.team_captain_history;
create policy "authenticated can read captain history"
  on public.team_captain_history
  for select to authenticated
  using (true);

drop policy if exists "authenticated can insert captain history"
  on public.team_captain_history;
create policy "authenticated can insert captain history"
  on public.team_captain_history
  for insert to authenticated
  with check (true);
