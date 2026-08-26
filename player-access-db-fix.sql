-- Fix the Player profile database support on the shared Supabase project.
-- This adds the Player <-> Member link column and the 5-argument upsert function
-- used by the Player profile assignment UI.

alter table public.access_profiles
  add column if not exists player_id uuid references public.players(id) on delete set null;

create unique index if not exists access_profiles_player_id_unique
  on public.access_profiles(player_id)
  where player_id is not null;

create or replace function public.admin_upsert_access(
  p_email text,
  p_display_name text,
  p_role text,
  p_active boolean,
  p_player_id uuid default null
)
returns public.access_profiles
language plpgsql
security definer
set search_path to ''
as $$
declare
  r public.access_profiles;
  n int;
begin
  if not public.is_super_admin() then
    raise exception 'Super Admin access required';
  end if;

  if p_role not in ('super_admin','admin','attendance','finance','viewer','player') then
    raise exception 'Invalid role';
  end if;

  if lower(trim(p_email)) = '' then
    raise exception 'Email is required';
  end if;

  if p_role = 'player' then
    if p_player_id is null then
      raise exception 'A Player must be linked to a Player record';
    end if;

    if not exists (
      select 1
      from public.players
      where id = p_player_id
        and archived_at is null
    ) then
      raise exception 'The selected Player is archived or does not exist';
    end if;

    if exists (
      select 1
      from public.access_profiles
      where player_id = p_player_id
        and email <> lower(trim(p_email))
    ) then
      raise exception 'This Player is already linked to another Member';
    end if;
  else
    p_player_id := null;
  end if;

  if p_role <> 'super_admin' or p_active = false then
    select count(*) into n
    from public.access_profiles
    where role = 'super_admin'
      and active = true
      and email <> lower(trim(p_email));

    if n = 0
       and exists (
         select 1
         from public.access_profiles
         where email = lower(trim(p_email))
           and role = 'super_admin'
           and active = true
       ) then
      raise exception 'At least one active Super Admin is required';
    end if;
  end if;

  insert into public.access_profiles(
    email,
    display_name,
    role,
    active,
    player_id
  )
  values (
    lower(trim(p_email)),
    nullif(trim(p_display_name), ''),
    p_role,
    p_active,
    p_player_id
  )
  on conflict(email) do update set
    display_name = excluded.display_name,
    role = excluded.role,
    active = excluded.active,
    player_id = excluded.player_id,
    updated_at = now()
  returning * into r;

  return r;
end;
$$;
