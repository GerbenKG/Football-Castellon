-- Let Player members see the confirmed players for a game without granting
-- direct roster/table access. Only players who are actually signed up are returned.

create or replace function public.player_list_game_squad(p_game_id uuid)
returns table (
  player_id uuid,
  name text
)
language sql
security definer
set search_path to ''
as $$
  select
    p.id as player_id,
    p.name
  from public.game_players gp
  join public.players p on p.id = gp.player_id
  where gp.game_id = p_game_id
    and gp.playing = true
    and p.archived_at is null
    and (
      exists (
        select 1
        from public.access_profiles a
        where a.active = true
          and a.role = 'player'
          and (a.user_id = auth.uid() or lower(a.email) = lower(auth.jwt()->>'email'))
      )
      or public.is_super_admin()
    )
  order by p.name;
$$;

grant execute on function public.player_list_game_squad(uuid) to authenticated;
