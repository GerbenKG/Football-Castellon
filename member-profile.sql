-- Member profile fields and self-service profile functions.
alter table public.access_profiles
  add column if not exists phone text,
  add column if not exists contact_email text,
  add column if not exists avatar_path text;

create or replace function public.member_profile()
returns jsonb
language sql
security definer
set search_path to ''
as $$
select jsonb_build_object(
  'id', a.email,
  'name', coalesce(nullif(a.display_name,''), p.name, a.email),
  'phone', coalesce(a.phone, p.phone, ''),
  'email', coalesce(a.contact_email, p.email, a.email),
  'avatar_path', a.avatar_path,
  'role', a.role,
  'bibs_taken_count', case when a.role='player' then coalesce(p.bibs_taken_count,0) else 0 end
)
from public.access_profiles a
left join public.players p on p.id=a.player_id
where a.user_id=auth.uid()
  and a.active=true
limit 1;
$$;

create or replace function public.member_update_profile(
  p_phone text,
  p_email text,
  p_avatar_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare a public.access_profiles; result jsonb;
begin
  select * into a from public.access_profiles where user_id=auth.uid() and active=true limit 1;
  if not found then raise exception 'Member access required'; end if;

  update public.access_profiles
  set phone=nullif(trim(coalesce(p_phone,'')),''),
      contact_email=nullif(trim(coalesce(p_email,'')),''),
      avatar_path=coalesce(p_avatar_path,avatar_path),
      updated_at=now()
  where email=a.email;

  if a.player_id is not null then
    update public.players
    set phone=nullif(trim(coalesce(p_phone,'')),''),
        email=nullif(trim(coalesce(p_email,'')),''),
        updated_at=now()
    where id=a.player_id;
  end if;

  select public.member_profile() into result;
  return result;
end;
$$;

grant execute on function public.member_profile() to authenticated;
grant execute on function public.member_update_profile(text,text,text) to authenticated;

insert into storage.buckets(id,name,public)
values('player-avatars','player-avatars',false)
on conflict(id) do nothing;

drop policy if exists "Member avatars can be viewed by owner" on storage.objects;
create policy "Member avatars can be viewed by owner"
on storage.objects for select to authenticated
using (bucket_id='player-avatars' and split_part(name,'/',1)=auth.uid()::text);

drop policy if exists "Member avatars can be uploaded by owner" on storage.objects;
create policy "Member avatars can be uploaded by owner"
on storage.objects for insert to authenticated
with check (bucket_id='player-avatars' and split_part(name,'/',1)=auth.uid()::text);

drop policy if exists "Member avatars can be updated by owner" on storage.objects;
create policy "Member avatars can be updated by owner"
on storage.objects for update to authenticated
using (bucket_id='player-avatars' and split_part(name,'/',1)=auth.uid()::text)
with check (bucket_id='player-avatars' and split_part(name,'/',1)=auth.uid()::text);
