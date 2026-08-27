-- Allow an active Player member to add their linked Player to a game.
create or replace function public.member_join_game(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_player_id uuid;
  v_game_date date;
  v_row public.game_players%rowtype;
begin
  select ap.player_id into v_player_id
  from public.access_profiles ap
  where ap.active = true
    and (ap.user_id = auth.uid() or lower(ap.email) = lower(auth.jwt()->>'email'))
    and ap.role = 'player'
  limit 1;

  if v_player_id is null then
    raise exception 'Only active Player members can add themselves to a game';
  end if;

  select g.game_date into v_game_date
  from public.games g
  where g.id = p_game_id;

  if v_game_date is null then
    raise exception 'Game not found';
  end if;

  if v_game_date < current_date then
    raise exception 'You cannot join a game that has already passed';
  end if;

  select * into v_row
  from public.game_players gp
  where gp.game_id = p_game_id and gp.player_id = v_player_id
  limit 1;

  if v_row.id is not null then
    update public.game_players
      set playing = true
    where id = v_row.id
    returning * into v_row;
  else
    insert into public.game_players(game_id, player_id, playing, attended, paid)
    values (p_game_id, v_player_id, true, false, false)
    returning * into v_row;
  end if;

  return jsonb_build_object('success', true, 'id', v_row.id, 'game_id', v_row.game_id, 'player_id', v_row.player_id, 'playing', v_row.playing);
end;
$$;

grant execute on function public.member_join_game(uuid) to authenticated;

-- Super Admin preview support: lets an admin test the same action for the Player being previewed.
create or replace function public.admin_preview_join_game(p_game_id uuid, p_member_name text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_player_id uuid;
  v_row public.game_players%rowtype;
  v_game_date date;
begin
  if not exists (
    select 1 from public.access_profiles ap
    where ap.active = true
      and (ap.user_id = auth.uid() or lower(ap.email) = lower(auth.jwt()->>'email'))
      and ap.role = 'super_admin'
  ) then
    raise exception 'Only Super Admins can use preview signup';
  end if;

  select ap.player_id into v_player_id
  from public.access_profiles ap
  where ap.active = true
    and lower(ap.display_name) = lower(trim(p_member_name))
    and ap.role = 'player'
  limit 1;

  if v_player_id is null then
    raise exception 'Preview Player not found';
  end if;

  select game_date into v_game_date from public.games where id = p_game_id;
  if v_game_date is null then raise exception 'Game not found'; end if;
  if v_game_date < current_date then raise exception 'You cannot join a game that has already passed'; end if;

  select * into v_row from public.game_players where game_id = p_game_id and player_id = v_player_id limit 1;
  if v_row.id is not null then
    update public.game_players set playing = true where id = v_row.id returning * into v_row;
  else
    insert into public.game_players(game_id, player_id, playing, attended, paid)
    values (p_game_id, v_player_id, true, false, false)
    returning * into v_row;
  end if;

  return jsonb_build_object('success', true, 'id', v_row.id, 'game_id', v_row.game_id, 'player_id', v_row.player_id, 'playing', v_row.playing);
end;
$$;

grant execute on function public.admin_preview_join_game(uuid, text) to authenticated;
