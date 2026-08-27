-- A Member is linked to a Player; the Player name is the canonical name.
-- Do not use access_profiles.display_name as a separate Member name.

create or replace function public.member_profile()
returns jsonb
language sql
security definer
set search_path to ''
as $$
select jsonb_build_object(
  'id', a.email,
  'name', coalesce(p.name, a.display_name, a.email),
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
