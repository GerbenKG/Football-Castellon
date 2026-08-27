-- Player members may access Games and Profile, but not the admin dashboard.
insert into public.role_permissions(role, permission, enabled)
values ('player', 'dashboard.view', false)
on conflict (role, permission) do update set enabled = excluded.enabled;
