-- Football Castellón: season-ticket migration
-- Run once in Supabase SQL Editor after supabase-finance.sql.
-- A player may have one ticket per season and may therefore have tickets
-- across many seasons. Ticket status and amount live on the season-ticket row.

create unique index if not exists finance_season_tickets_season_player_uidx
  on public.finance_season_tickets(season_id, player_id);

-- Preserve any legacy paid season-ticket information for the 2026/27 season.
-- This is intentionally a one-time backfill only. Going forward, the Finance
-- module is the source of truth; players.season_paid is not used for finance.
insert into public.finance_season_tickets(season_id, player_id, amount, paid, paid_on)
select
  s.id,
  p.id,
  s.season_ticket_amount,
  true,
  current_date
from public.finance_seasons s
join public.players p on coalesce(p.season_paid, false) = true
where s.name = '2026/27'
  and not exists (
    select 1
    from public.finance_season_tickets t
    where t.season_id = s.id
      and t.player_id = p.id
  );
