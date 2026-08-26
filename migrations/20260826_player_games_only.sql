-- Player members may access Games and Profile, but not the Players roster.

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
