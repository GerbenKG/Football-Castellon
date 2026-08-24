-- Football Castellón: enable authenticated admin access
create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('super_admin','admin')),
  created_at timestamptz not null default now()
);

alter table public.admin_profiles enable row level security;
alter table public.players enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.payments enable row level security;

create policy "admins can read own profile" on public.admin_profiles for select to authenticated using (user_id = auth.uid());
create policy "authenticated admins can read players" on public.players for select to authenticated using (exists (select 1 from public.admin_profiles p where p.user_id = auth.uid()));
create policy "authenticated admins can insert players" on public.players for insert to authenticated with check (exists (select 1 from public.admin_profiles p where p.user_id = auth.uid()));
create policy "authenticated admins can update players" on public.players for update to authenticated using (exists (select 1 from public.admin_profiles p where p.user_id = auth.uid())) with check (exists (select 1 from public.admin_profiles p where p.user_id = auth.uid()));
create policy "authenticated admins can delete players" on public.players for delete to authenticated using (exists (select 1 from public.admin_profiles p where p.user_id = auth.uid()));

create policy "authenticated admins can read games" on public.games for select to authenticated using (exists (select 1 from public.admin_profiles p where p.user_id = auth.uid()));
create policy "authenticated admins can insert games" on public.games for insert to authenticated with check (exists (select 1 from public.admin_profiles p where p.user_id = auth.uid()));
create policy "authenticated admins can update games" on public.games for update to authenticated using (exists (select 1 from public.admin_profiles p where p.user_id = auth.uid())) with check (exists (select 1 from public.admin_profiles p where p.user_id = auth.uid()));
create policy "authenticated admins can delete games" on public.games for delete to authenticated using (exists (select 1 from public.admin_profiles p where p.user_id = auth.uid()));

create policy "authenticated admins can read game players" on public.game_players for select to authenticated using (exists (select 1 from public.admin_profiles p where p.user_id = auth.uid()));
create policy "authenticated admins can insert game players" on public.game_players for insert to authenticated with check (exists (select 1 from public.admin_profiles p where p.user_id = auth.uid()));
create policy "authenticated admins can update game players" on public.game_players for update to authenticated using (exists (select 1 from public.admin_profiles p where p.user_id = auth.uid())) with check (exists (select 1 from public.admin_profiles p where p.user_id = auth.uid()));
create policy "authenticated admins can delete game players" on public.game_players for delete to authenticated using (exists (select 1 from public.admin_profiles p where p.user_id = auth.uid()));

create policy "authenticated admins can read payments" on public.payments for select to authenticated using (exists (select 1 from public.admin_profiles p where p.user_id = auth.uid()));
create policy "authenticated admins can insert payments" on public.payments for insert to authenticated with check (exists (select 1 from public.admin_profiles p where p.user_id = auth.uid()));
create policy "authenticated admins can delete payments" on public.payments for delete to authenticated using (exists (select 1 from public.admin_profiles p where p.user_id = auth.uid()));
