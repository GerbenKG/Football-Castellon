-- Football Castellón: in-app RBAC. Run once in Supabase SQL Editor.
create table if not exists public.access_profiles(
 email text primary key,
 user_id uuid references auth.users(id) on delete set null,
 display_name text,
 role text not null default 'viewer' check(role in('super_admin','admin','attendance','finance','viewer')),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.role_permissions(
 role text not null check(role in('super_admin','admin','attendance','finance','viewer')),
 permission text not null,
 enabled boolean not null default false,
 primary key(role,permission)
);
insert into public.role_permissions(role,permission,enabled) values
('super_admin','dashboard.view',true),('super_admin','players.view',true),('super_admin','players.manage',true),('super_admin','games.view',true),('super_admin','games.manage',true),('super_admin','attendance.view',true),('super_admin','attendance.manage',true),('super_admin','payments.view',true),('super_admin','payments.manage',true),('super_admin','access.manage',true),
('admin','dashboard.view',true),('admin','players.view',true),('admin','players.manage',true),('admin','games.view',true),('admin','games.manage',true),('admin','attendance.view',true),('admin','attendance.manage',true),('admin','payments.view',true),('admin','payments.manage',true),('admin','access.manage',false),
('attendance','dashboard.view',true),('attendance','players.view',true),('attendance','players.manage',false),('attendance','games.view',true),('attendance','games.manage',false),('attendance','attendance.view',true),('attendance','attendance.manage',true),('attendance','payments.view',false),('attendance','payments.manage',false),('attendance','access.manage',false),
('finance','dashboard.view',true),('finance','players.view',true),('finance','players.manage',false),('finance','games.view',true),('finance','games.manage',false),('finance','attendance.view',true),('finance','attendance.manage',false),('finance','payments.view',true),('finance','payments.manage',true),('finance','access.manage',false),
('viewer','dashboard.view',true),('viewer','players.view',true),('viewer','players.manage',false),('viewer','games.view',true),('viewer','games.manage',false),('viewer','attendance.view',true),('viewer','attendance.manage',false),('viewer','payments.view',false),('viewer','payments.manage',false),('viewer','access.manage',false)
on conflict(role,permission) do nothing;
create index if not exists access_profiles_user_id_idx on public.access_profiles(user_id);

create or replace function public.claim_access_profile() returns jsonb language plpgsql security definer set search_path='' as $$
declare e text:=lower(auth.jwt()->>'email'); u uuid:=auth.uid(); r public.access_profiles; n int;
begin
 if u is null or e is null or e='' then return jsonb_build_object('allowed',false); end if;
 select count(*) into n from public.access_profiles where active=true;
 if n=0 then
   insert into public.access_profiles(email,user_id,display_name,role,active) values(e,u,coalesce(auth.jwt()->>'name',e),'super_admin',true) returning * into r;
 else
   update public.access_profiles set user_id=u,display_name=coalesce(display_name,auth.jwt()->>'name',e),updated_at=now()
   where email=e and active=true and(user_id is null or user_id=u) returning * into r;
 end if;
 if r.email is null then return jsonb_build_object('allowed',false,'reason','This Google account has not been invited.'); end if;
 return jsonb_build_object('allowed',true,'profile',to_jsonb(r));
end; $$;

create or replace function public.get_my_access() returns jsonb language sql security definer set search_path='' as $$
select coalesce(jsonb_build_object('allowed',true,'profile',to_jsonb(p),'permissions',
 coalesce((select jsonb_object_agg(r.permission,r.enabled) from public.role_permissions r where r.role=p.role),'{}'::jsonb)),
 jsonb_build_object('allowed',false))
from public.access_profiles p
where p.active=true and(p.user_id=auth.uid() or lower(p.email)=lower(auth.jwt()->>'email')) limit 1;
$$;

create or replace function public.has_permission(x text) returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.access_profiles p join public.role_permissions r on r.role=p.role
 where p.active=true and r.permission=x and r.enabled=true and(p.user_id=auth.uid() or lower(p.email)=lower(auth.jwt()->>'email')));
$$;
create or replace function public.is_super_admin() returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.access_profiles p where p.active=true and p.role='super_admin'
 and(p.user_id=auth.uid() or lower(p.email)=lower(auth.jwt()->>'email')));
$$;
create or replace function public.admin_list_access() returns setof public.access_profiles language sql security definer set search_path='' as $$select * from public.access_profiles order by active desc,role,email;$$;
create or replace function public.admin_list_permissions() returns setof public.role_permissions language sql security definer set search_path='' as $$select * from public.role_permissions order by role,permission;$$;

create or replace function public.admin_upsert_access(p_email text,p_display_name text,p_role text,p_active boolean)
returns public.access_profiles language plpgsql security definer set search_path='' as $$
declare r public.access_profiles; n int;
begin
 if not public.is_super_admin() then raise exception 'Super Admin access required'; end if;
 if p_role not in('super_admin','admin','attendance','finance','viewer') then raise exception 'Invalid role'; end if;
 if lower(trim(p_email))='' then raise exception 'Email is required'; end if;
 if p_role<>'super_admin' or p_active=false then
   select count(*) into n from public.access_profiles where role='super_admin' and active=true and email<>lower(trim(p_email));
   if n=0 and exists(select 1 from public.access_profiles where email=lower(trim(p_email)) and role='super_admin' and active=true) then
     raise exception 'At least one active Super Admin is required';
   end if;
 end if;
 insert into public.access_profiles(email,display_name,role,active) values(lower(trim(p_email)),nullif(trim(p_display_name),''),p_role,p_active)
 on conflict(email) do update set display_name=excluded.display_name,role=excluded.role,active=excluded.active,updated_at=now()
 returning * into r;
 return r;
end; $$;

create or replace function public.admin_delete_access(p_email text) returns boolean language plpgsql security definer set search_path='' as $$
declare r text; n int;
begin
 if not public.is_super_admin() then raise exception 'Super Admin access required'; end if;
 select role into r from public.access_profiles where email=lower(trim(p_email));
 if r='super_admin' then
  select count(*) into n from public.access_profiles where role='super_admin' and active=true;
  if n<=1 then raise exception 'At least one active Super Admin is required'; end if;
 end if;
 delete from public.access_profiles where email=lower(trim(p_email)); return true;
end; $$;

create or replace function public.admin_update_permission(p_role text,p_permission text,p_enabled boolean) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not public.is_super_admin() then raise exception 'Super Admin access required'; end if;
 if p_role='super_admin' then raise exception 'Super Admin permissions are fixed'; end if;
 update public.role_permissions set enabled=p_enabled where role=p_role and permission=p_permission;
 if not found then insert into public.role_permissions(role,permission,enabled) values(p_role,p_permission,p_enabled); end if;
 return true;
end; $$;

alter table public.access_profiles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.players enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.payments enable row level security;

drop policy if exists "admins can read players" on public.players;
drop policy if exists "authenticated admins can read players" on public.players;
drop policy if exists "authenticated admins can insert players" on public.players;
drop policy if exists "authenticated admins can update players" on public.players;
drop policy if exists "authenticated admins can delete players" on public.players;
drop policy if exists "authenticated admins can read games" on public.games;
drop policy if exists "authenticated admins can insert games" on public.games;
drop policy if exists "authenticated admins can update games" on public.games;
drop policy if exists "authenticated admins can delete games" on public.games;
drop policy if exists "authenticated admins can read game players" on public.game_players;
drop policy if exists "authenticated admins can insert game players" on public.game_players;
drop policy if exists "authenticated admins can update game players" on public.game_players;
drop policy if exists "authenticated admins can delete game players" on public.game_players;
drop policy if exists "authenticated admins can read payments" on public.payments;
drop policy if exists "authenticated admins can insert payments" on public.payments;
drop policy if exists "authenticated admins can delete payments" on public.payments;

drop policy if exists "admins can insert players" on public.players;
drop policy if exists "admins can update players" on public.players;
drop policy if exists "admins can delete players" on public.players;
drop policy if exists "admins can read games" on public.games;
drop policy if exists "admins can insert games" on public.games;
drop policy if exists "admins can update games" on public.games;
drop policy if exists "admins can delete games" on public.games;
drop policy if exists "admins can read game players" on public.game_players;
drop policy if exists "admins can insert game players" on public.game_players;
drop policy if exists "admins can update game players" on public.game_players;
drop policy if exists "admins can delete game players" on public.game_players;
drop policy if exists "admins can read payments" on public.payments;
drop policy if exists "admins can insert payments" on public.payments;
drop policy if exists "admins can delete payments" on public.payments;

create policy "access own or super" on public.access_profiles for select to authenticated
using((select public.is_super_admin()) or user_id=(select auth.uid()) or lower(email)=lower((select auth.jwt()->>'email')));
create policy "access super insert" on public.access_profiles for insert to authenticated with check((select public.is_super_admin()));
create policy "access super update" on public.access_profiles for update to authenticated using((select public.is_super_admin())) with check((select public.is_super_admin()));
create policy "access super delete" on public.access_profiles for delete to authenticated using((select public.is_super_admin()));

create policy "players view by permission" on public.players for select to authenticated using((select public.has_permission('players.view')) or(select public.has_permission('dashboard.view')));
create policy "players insert by permission" on public.players for insert to authenticated with check((select public.has_permission('players.manage')));
create policy "players update by permission" on public.players for update to authenticated using((select public.has_permission('players.manage'))) with check((select public.has_permission('players.manage')));
create policy "players delete by permission" on public.players for delete to authenticated using((select public.has_permission('players.manage')));

create policy "games view by permission" on public.games for select to authenticated using((select public.has_permission('games.view')) or(select public.has_permission('dashboard.view')));
create policy "games insert by permission" on public.games for insert to authenticated with check((select public.has_permission('games.manage')));
create policy "games update by permission" on public.games for update to authenticated using((select public.has_permission('games.manage'))) with check((select public.has_permission('games.manage')));
create policy "games delete by permission" on public.games for delete to authenticated using((select public.has_permission('games.manage')));

create policy "attendance view by permission" on public.game_players for select to authenticated using((select public.has_permission('attendance.view')) or(select public.has_permission('dashboard.view')));
create policy "attendance insert by permission" on public.game_players for insert to authenticated with check((select public.has_permission('attendance.manage')));
create policy "attendance update by permission" on public.game_players for update to authenticated using((select public.has_permission('attendance.manage'))) with check((select public.has_permission('attendance.manage')));
create policy "attendance delete by permission" on public.game_players for delete to authenticated using((select public.has_permission('attendance.manage')));

create policy "payments view by permission" on public.payments for select to authenticated using((select public.has_permission('payments.view')) or(select public.has_permission('dashboard.view')));
create policy "payments insert by permission" on public.payments for insert to authenticated with check((select public.has_permission('payments.manage')));
create policy "payments delete by permission" on public.payments for delete to authenticated using((select public.has_permission('payments.manage')));

revoke all on table public.role_permissions from anon,authenticated;
revoke all on table public.access_profiles from anon;
grant select on table public.access_profiles to authenticated;
revoke execute on function public.claim_access_profile() from public,anon;
revoke execute on function public.get_my_access() from public,anon;
revoke execute on function public.has_permission(text) from public,anon;
revoke execute on function public.is_super_admin() from public,anon;
revoke execute on function public.admin_list_access() from public,anon;
revoke execute on function public.admin_list_permissions() from public,anon;
revoke execute on function public.admin_upsert_access(text,text,text,boolean) from public,anon;
revoke execute on function public.admin_delete_access(text) from public,anon;
revoke execute on function public.admin_update_permission(text,text,boolean) from public,anon;
grant execute on function public.claim_access_profile() to authenticated;
grant execute on function public.get_my_access() to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.admin_list_access() to authenticated;
grant execute on function public.admin_list_permissions() to authenticated;
grant execute on function public.admin_upsert_access(text,text,text,boolean) to authenticated;
grant execute on function public.admin_delete_access(text) to authenticated;
grant execute on function public.admin_update_permission(text,text,boolean) to authenticated;
create or replace function public.add_game_player(p_game_id uuid, p_player_id uuid)
returns public.game_players
language plpgsql
security definer
set search_path=''
as $$
declare
  r public.game_players;
begin
  if not public.has_permission('attendance.manage') then
    raise exception 'Attendance management permission required';
  end if;
  if not exists (select 1 from public.games where id=p_game_id) then
    raise exception 'Game game not found';
  end if;
  if not exists (select 1 from public.players where id=p_player_id) then
    raise exception 'Player not found';
  end if;
  select * into r from public.game_players
  where game_id=p_game_id and player_id=p_player_id limit 1;
  if r.id is null then
    insert into public.game_players(id,game_id,player_id,guest_name,playing,attended,paid)
    values(gen_random_uuid(),p_game_id,p_player_id,null,true,false,false)
    returning * into r;
  end if;
  return r;
end;
$$;

revoke execute on function public.add_game_player(uuid,uuid) from public,anon;
grant execute on function public.add_game_player(uuid,uuid) to authenticated;
