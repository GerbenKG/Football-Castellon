-- Player members may access Games and Profile, but not the Players roster.
-- Ensure the role_permissions table itself accepts the Player role before
-- inserting the Player-specific permissions.

alter table public.role_permissions
drop constraint if exists role_permissions_role_check;

alter table public.role_permissions
add constraint role_permissions_role_check
check (role = any (array['super_admin','admin','attendance','finance','viewer','player']));

insert into public.role_permissions(role, permission, enabled)
values
  ('player', 'games.view', true),
  ('player', 'players.view', false)
on conflict (role, permission) do update
set enabled = excluded.enabled;

create or replace function public.player_list_names()
returns table(id uuid, name text)
language plpgsql
security definer
set search_path to ''
as $$
begin
  raise exception 'Player access does not include roster access';
end;
$$;
