-- Player access: link access profiles to players, add avatars, and revoke access when archived.

alter table public.access_profiles
  add column if not exists player_id uuid references public.players(id) on delete set null,
  add column if not exists avatar_path text;

create unique index if not exists access_profiles_player_id_unique
  on public.access_profiles(player_id)
  where player_id is not null;

insert into public.role_permissions(role, permission, enabled)
values
  ('player','games.view',true)
 on conflict (role, permission) do update set enabled=excluded.enabled;

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
declare r public.access_profiles; n int;
begin
  if not public.is_super_admin() then raise exception 'Super Admin access required'; end if;
  if p_role not in('super_admin','admin','attendance','finance','viewer','player') then raise exception 'Invalid role'; end if;
  if lower(trim(p_email))='' then raise exception 'Email is required'; end if;

  if p_player_id is null then raise exception 'A Player must be linked to a Member'; end if;
  if not exists(select 1 from public.players where id=p_player_id and archived_at is null) then
    raise exception 'The selected Player is archived or does not exist';
  end if;
  if exists(select 1 from public.access_profiles where player_id=p_player_id and email<>lower(trim(p_email))) then
    raise exception 'This Player is already linked to another Member';
  end if;

  if p_role<>'super_admin' or p_active=false then
    select count(*) into n from public.access_profiles where role='super_admin' and active=true and email<>lower(trim(p_email));
    if n=0 and exists(select 1 from public.access_profiles where email=lower(trim(p_email)) and role='super_admin' and active=true) then
      raise exception 'At least one active Super Admin is required';
    end if;
  end if;

  insert into public.access_profiles(email,display_name,role,active,player_id)
  values(lower(trim(p_email)),nullif(trim(p_display_name),''),p_role,p_active,p_player_id)
  on conflict(email) do update set
    display_name=excluded.display_name,
    role=excluded.role,
    active=excluded.active,
    player_id=excluded.player_id,
    updated_at=now()
  returning * into r;
  return r;
end;
$$;

create or replace function public.player_profile()
returns jsonb
language sql
security definer
set search_path to ''
as $$
select coalesce(
  jsonb_build_object(
    'id',p.id,
    'name',p.name,
    'phone',p.phone,
    'email',p.email,
    'bibs_taken_count',coalesce(p.bibs_taken_count,0),
    'avatar_path',a.avatar_path
  ),
  jsonb_build_object('allowed',false)
)
from public.access_profiles a
join public.players p on p.id=a.player_id
where a.user_id=auth.uid() and a.active=true and a.role='player' and p.archived_at is null
limit 1;
$$;

create or replace function public.player_list_names()
returns table(id uuid, name text)
language sql
security definer
set search_path to ''
as $$
select p.id,p.name
from public.players p
where p.archived_at is null
  and exists(select 1 from public.access_profiles a where a.user_id=auth.uid() and a.active=true and a.role='player');
$$;

create or replace function public.player_list_games()
returns table(id uuid, game_date date, start_time time, end_time time, location text)
language sql
security definer
set search_path to ''
as $$
select g.id,g.game_date,g.start_time,g.end_time,g.location
from public.games g
where exists(select 1 from public.access_profiles a where a.user_id=auth.uid() and a.active=true and a.role='player')
order by g.game_date,g.start_time;
$$;

create or replace function public.player_update_avatar(p_avatar_path text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not exists(select 1 from public.access_profiles where user_id=auth.uid() and active=true and role='player') then
    raise exception 'Player access required';
  end if;
  update public.access_profiles
  set avatar_path=p_avatar_path,updated_at=now()
  where user_id=auth.uid() and active=true and role='player';
  return found;
end;
$$;

create or replace function public.revoke_player_access_on_archive()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.archived_at is not null and (old.archived_at is null or old.archived_at <> new.archived_at) then
    update public.access_profiles
    set active=false,updated_at=now()
    where player_id=new.id and role='player' and active=true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_revoke_player_access_on_archive on public.players;
create trigger trg_revoke_player_access_on_archive
after update of archived_at on public.players
for each row execute function public.revoke_player_access_on_archive();

insert into storage.buckets(id,name,public)
values('player-avatars','player-avatars',false)
on conflict(id) do nothing;

drop policy if exists "Player avatars can be viewed by owner" on storage.objects;
create policy "Player avatars can be viewed by owner"
on storage.objects for select to authenticated
using (bucket_id='player-avatars' and split_part(name,'/',1)=auth.uid()::text);

drop policy if exists "Player avatars can be uploaded by owner" on storage.objects;
create policy "Player avatars can be uploaded by owner"
on storage.objects for insert to authenticated
with check (bucket_id='player-avatars' and split_part(name,'/',1)=auth.uid()::text);

drop policy if exists "Player avatars can be updated by owner" on storage.objects;
create policy "Player avatars can be updated by owner"
on storage.objects for update to authenticated
using (bucket_id='player-avatars' and split_part(name,'/',1)=auth.uid()::text)
with check (bucket_id='player-avatars' and split_part(name,'/',1)=auth.uid()::text);
