-- Allow Super Admins to preview another member's profile without changing
-- the authenticated session. Preview is intentionally read-only in the UI.

create or replace function public.admin_preview_member_profile(p_email text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare result jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Super Admin access required';
  end if;

  select jsonb_build_object(
    'id', a.email,
    'name', coalesce(nullif(a.display_name,''), p.name, a.email),
    'phone', coalesce(a.phone, p.phone, ''),
    'email', coalesce(a.contact_email, p.email, a.email),
    'avatar_path', a.avatar_path,
    'role', a.role,
    'bibs_taken_count', case when a.role='player' then coalesce(p.bibs_taken_count,0) else 0 end
  )
  into result
  from public.access_profiles a
  left join public.players p on p.id=a.player_id
  where lower(a.email)=lower(trim(p_email))
    and a.active=true
  limit 1;

  if result is null then
    raise exception 'Preview member profile is not available';
  end if;

  return result;
end;
$$;

grant execute on function public.admin_preview_member_profile(text) to authenticated;

drop policy if exists "Super admins can view member avatars" on storage.objects;
create policy "Super admins can view member avatars"
on storage.objects for select to authenticated
using (
  bucket_id='player-avatars'
  and public.is_super_admin()
);
