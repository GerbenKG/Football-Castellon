-- Restore the database API used by the Player member portal.
-- These functions are SECURITY DEFINER so Player members do not need direct
-- table access to roster/game data.

create or replace function public.player_profile()
returns jsonb
language sql
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'phone', coalesce(a.phone, p.phone, ''),
    'email', coalesce(a.contact_email, p.email, a.email, ''),
    'avatar_path', a.avatar_path,
    'role', a.role,
    'bibs_taken_count', coalesce(p.bibs_taken_count, 0)
  )
  from public.access_profiles a
  join public.players p on p.id = a.player_id
  where a.active = true
    and a.role = 'player'
    and (a.user_id = auth.uid() or lower(a.email) = lower(auth.jwt()->>'email'))
    and p.archived_at is null
  limit 1;
$$;

create or replace function public.player_list_games()
returns table (
  id uuid,
  game_date date,
  start_time time,
  end_time time,
  location text,
  playing boolean
)
language sql
security definer
set search_path to ''
as $$
  with current_player as (
    select a.player_id
    from public.access_profiles a
    where a.active = true
      and a.role = 'player'
      and (a.user_id = auth.uid() or lower(a.email) = lower(auth.jwt()->>'email'))
    limit 1
  )
  select
    g.id,
    g.game_date,
    g.start_time,
    g.end_time,
    g.location,
    coalesce(gp.playing, false) as playing
  from public.games g
  cross join current_player cp
  left join public.game_players gp
    on gp.game_id = g.id
   and gp.player_id = cp.player_id
  order by g.game_date, g.start_time;
$$;

create or replace function public.player_list_names()
returns table (id uuid, name text)
language sql
security definer
set search_path to ''
as $$
  select p.id, p.name
  from public.players p
  join public.access_profiles a on a.player_id = p.id
  where a.active = true
    and a.role = 'player'
    and (a.user_id = auth.uid() or lower(a.email) = lower(auth.jwt()->>'email'))
    and p.archived_at is null
  order by p.name;
$$;

grant execute on function public.player_profile() to authenticated;
grant execute on function public.player_list_games() to authenticated;
grant execute on function public.player_list_names() to authenticated;
