-- Fix registered-player Game assignment.
-- Run this once in the Supabase SQL Editor after the application update.

create or replace function public.add_game_player(p_game_id uuid, p_player_id uuid)
returns public.game_players
language plpgsql
security definer
set search_path=''
as $$
declare
  r public.game_players;
begin
  -- Keep the application permission check, but allow the privileged Supabase SQL
  -- editor role to execute the RPC for administration/maintenance.
  if current_user <> 'postgres'
     and not public.has_permission('attendance.manage') then
    raise exception 'Attendance management permission required';
  end if;

  if not exists (select 1 from public.games where id=p_game_id) then
    raise exception 'Game game not found';
  end if;

  if not exists (select 1 from public.players where id=p_player_id) then
    raise exception 'Player not found';
  end if;

  select * into r
  from public.game_players
  where game_id=p_game_id and player_id=p_player_id
  limit 1;

  if r.id is null then
    insert into public.game_players(
      id, game_id, player_id, guest_name, playing, attended, paid
    )
    values(
      gen_random_uuid(), p_game_id, p_player_id, null, true, false, false
    )
    returning * into r;
  end if;

  return r;
end;
$$;

revoke execute on function public.add_game_player(uuid,uuid) from public,anon;
grant execute on function public.add_game_player(uuid,uuid) to authenticated;
