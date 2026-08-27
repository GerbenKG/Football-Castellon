create or replace function public.admin_list_players_for_linking()
returns table(id uuid, name text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.name
  from public.players p
  where p.archived_at is null
    and public.has_permission('access.manage')
  order by p.name;
$$;

grant execute on function public.admin_list_players_for_linking() to authenticated;
