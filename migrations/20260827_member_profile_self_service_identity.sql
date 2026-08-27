-- Allow every active Member to manage their own profile, including Player-profile members
-- whose access row has not yet been linked to auth.users.user_id.
-- The authenticated account email is used as a secure fallback for invited/pending members.

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
where a.active=true
  and (a.user_id=auth.uid() or lower(a.email)=lower(coalesce(auth.jwt()->>'email','')))
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
declare
  a public.access_profiles;
  result jsonb;
begin
  select * into a
  from public.access_profiles
  where active=true
    and (user_id=auth.uid() or lower(email)=lower(coalesce(auth.jwt()->>'email','')))
  order by case when user_id=auth.uid() then 0 else 1 end
  limit 1;

  if not found then
    raise exception 'Member access required';
  end if;

  -- Link an invited Member to the authenticated account on first self-service save.
  update public.access_profiles
  set user_id=coalesce(user_id, auth.uid()),
      phone=nullif(trim(coalesce(p_phone,'')),''),
      contact_email=nullif(lower(trim(coalesce(p_email,''))),''),
      avatar_path=coalesce(p_avatar_path,avatar_path),
      updated_at=now()
  where email=a.email;

  if a.player_id is not null then
    update public.players
    set phone=nullif(trim(coalesce(p_phone,'')),''),
        email=nullif(lower(trim(coalesce(p_email,''))), '')
    where id=a.player_id;
  end if;

  select public.member_profile() into result;
  return result;
end;
$$;

grant execute on function public.member_profile() to authenticated;
grant execute on function public.member_update_profile(text,text,text) to authenticated;
