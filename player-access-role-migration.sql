-- Allow the Player profile in access_profiles and keep the rule in version control.
alter table public.access_profiles
drop constraint if exists access_profiles_role_check;

alter table public.access_profiles
add constraint access_profiles_role_check
check (role = any (array['super_admin','admin','attendance','finance','viewer','player']));
