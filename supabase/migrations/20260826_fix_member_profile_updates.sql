-- Fix member self-service profile updates.
-- players does not have an updated_at column, so only access_profiles should
-- maintain its updated_at timestamp. Keep phone/email synchronized for linked players.

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
  where user_id=auth.uid()
    and active=true
  limit 1;

  if not found then
    raise exception 'Member access required';
  end if;

  update public.access_profiles
  set phone=nullif(trim(coalesce(p_phone,'')),''),
      contact_email=nullif(lower(trim(coalesce(p_email,''))),''),
      avatar_path=coalesce(p_avatar_path,avatar_path),
      updated_at=now()
  where user_id=auth.uid()
    and active=true;

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

grant execute on function public.member_update_profile(text,text,text) to authenticated;
