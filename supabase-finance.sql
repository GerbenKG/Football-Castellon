-- Football Castellón: finance module
-- Run once in Supabase SQL Editor after supabase-rbac.sql.
create table if not exists public.finance_seasons(
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  starts_on date not null,
  ends_on date not null,
  season_ticket_amount numeric(10,2) not null default 0,
  pay_per_game_amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  check(ends_on > starts_on)
);

create table if not exists public.finance_season_tickets(
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.finance_seasons(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  amount numeric(10,2) not null default 0,
  paid boolean not null default false,
  paid_on date,
  created_at timestamptz not null default now(),
  unique(season_id,player_id)
);

create table if not exists public.finance_expenses(
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.finance_seasons(id) on delete cascade,
  due_date date not null,
  description text not null,
  category text not null default 'Pitch rental',
  amount numeric(10,2) not null,
  paid boolean not null default false,
  paid_on date,
  created_at timestamptz not null default now()
);

alter table public.finance_seasons enable row level security;
alter table public.finance_season_tickets enable row level security;
alter table public.finance_expenses enable row level security;

drop policy if exists "finance seasons view" on public.finance_seasons;
drop policy if exists "finance seasons manage" on public.finance_seasons;
drop policy if exists "finance tickets view" on public.finance_season_tickets;
drop policy if exists "finance tickets manage" on public.finance_season_tickets;
drop policy if exists "finance expenses view" on public.finance_expenses;
drop policy if exists "finance expenses manage" on public.finance_expenses;

create policy "finance seasons view" on public.finance_seasons for select to authenticated
using((select public.has_permission('payments.view')));
create policy "finance seasons manage" on public.finance_seasons for all to authenticated
using((select public.has_permission('payments.manage')))
with check((select public.has_permission('payments.manage')));

create policy "finance tickets view" on public.finance_season_tickets for select to authenticated
using((select public.has_permission('payments.view')));
create policy "finance tickets manage" on public.finance_season_tickets for all to authenticated
using((select public.has_permission('payments.manage')))
with check((select public.has_permission('payments.manage')));

create policy "finance expenses view" on public.finance_expenses for select to authenticated
using((select public.has_permission('payments.view')));
create policy "finance expenses manage" on public.finance_expenses for all to authenticated
using((select public.has_permission('payments.manage')))
with check((select public.has_permission('payments.manage')));

grant select,insert,update,delete on public.finance_seasons to authenticated;
grant select,insert,update,delete on public.finance_season_tickets to authenticated;
grant select,insert,update,delete on public.finance_expenses to authenticated;

-- Create the 2026/27 season. Amounts are intentionally 0 until you set the real prices in the Finance page.
insert into public.finance_seasons(name,starts_on,ends_on)
values('2026/27','2026-09-01','2027-08-31')
on conflict(name) do nothing;

-- Pitch-rental schedule supplied for 2026/27.
-- The two amounts are kept as separate scheduled payments so nothing is lost.
with s as (select id from public.finance_seasons where name='2026/27')
insert into public.finance_expenses(season_id,due_date,description,category,amount)
select s.id,v.due_date,v.description,'Pitch rental',v.amount
from s cross join (values
 ('2026-09-01'::date,'Pitch rental 1',40.90::numeric),
 ('2026-09-01'::date,'Pitch rental 2',45.40::numeric),
 ('2026-10-01'::date,'Pitch rental 1',45.40::numeric),
 ('2026-10-01'::date,'Pitch rental 2',45.40::numeric),
 ('2026-11-01'::date,'Pitch rental 1',45.40::numeric),
 ('2026-11-01'::date,'Pitch rental 2',45.40::numeric),
 ('2026-12-01'::date,'Pitch rental 1',34.05::numeric),
 ('2026-12-01'::date,'Pitch rental 2',34.05::numeric),
 ('2027-01-01'::date,'Pitch rental 1',45.40::numeric),
 ('2027-01-01'::date,'Pitch rental 2',45.40::numeric),
 ('2027-02-01'::date,'Pitch rental 1',45.40::numeric),
 ('2027-02-01'::date,'Pitch rental 2',45.40::numeric),
 ('2027-03-01'::date,'Pitch rental 1',22.70::numeric),
 ('2027-03-01'::date,'Pitch rental 2',22.70::numeric),
 ('2027-04-01'::date,'Pitch rental 1',49.25::numeric),
 ('2027-04-01'::date,'Pitch rental 2',53.75::numeric),
 ('2027-05-01'::date,'Pitch rental 1',39.40::numeric),
 ('2027-05-01'::date,'Pitch rental 2',40.15::numeric),
 ('2027-06-01'::date,'Pitch rental 1',39.40::numeric),
 ('2027-06-01'::date,'Pitch rental 2',39.40::numeric),
 ('2027-07-01'::date,'Pitch rental 1',49.25::numeric),
 ('2027-07-01'::date,'Pitch rental 2',53.00::numeric),
 ('2027-08-01'::date,'Pitch rental 1',39.40::numeric),
 ('2027-08-01'::date,'Pitch rental 2',39.40::numeric)
) v(due_date,description,amount)
where not exists(
 select 1 from public.finance_expenses e
 where e.season_id=s.id and e.due_date=v.due_date and e.description=v.description
);
