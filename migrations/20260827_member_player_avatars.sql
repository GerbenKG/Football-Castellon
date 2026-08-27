-- Use a linked Member's uploaded profile picture as the Player avatar everywhere.
-- access_profiles is the source of truth because every Member is linked to a Player.

create or replace function public.list_player_avatars()
returns table(player_id uuid, player_name text, avatar_path text)
language sql
security definer
set search_path to ''
as $$
  select a.player_id, p.name, a.avatar_path
  from public.access_profiles a
  join public.players p on p.id = a.player_id
  where a.active = true
    and a.player_id is not null
    and p.archived_at is null
    and a.avatar_path is not null
    and a.avatar_path <> '';
$$;

grant execute on function public.list_player_avatars() to authenticated;

-- Player avatars are intentionally visible to authenticated team members so
-- the same picture can be rendered in rosters, games and other team views.
drop policy if exists "Member avatars can be viewed by owner" on storage.objects;
drop policy if exists "Super admins can view member avatars" on storage.objects;
drop policy if exists "Player avatars can be viewed by owner" on storage.objects;
drop policy if exists "Authenticated users can view player avatars" on storage.objects;

create policy "Authenticated users can view player avatars"
on storage.objects for select to authenticated
using (bucket_id = 'player-avatars');
