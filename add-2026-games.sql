-- Add the historical 2026 games supplied by the team.
-- Run this once in the Supabase SQL Editor.
-- Existing games on the same date are left untouched.

insert into public.games (id, game_date, start_time, end_time, location)
select gen_random_uuid(), v.game_date, v.start_time, v.end_time, v.location
from (
  values
    ('2026-01-09'::date, '19:30'::time, '21:30'::time, 'Castellón'),
    ('2026-01-16'::date, '19:30'::time, '21:30'::time, 'Castellón'),
    ('2026-01-23'::date, '19:30'::time, '21:30'::time, 'Castellón'),
    ('2026-01-30'::date, '19:30'::time, '21:30'::time, 'Castellón'),
    ('2026-02-06'::date, '19:30'::time, '21:30'::time, 'Castellón'),
    ('2026-02-13'::date, '19:30'::time, '21:30'::time, 'Castellón'),
    ('2026-02-20'::date, '19:30'::time, '21:30'::time, 'Castellón'),
    ('2026-02-27'::date, '19:30'::time, '21:30'::time, 'Castellón'),
    ('2026-03-06'::date, '19:30'::time, '21:30'::time, 'Castellón'),
    ('2026-03-13'::date, '19:30'::time, '21:30'::time, 'Castellón'),
    ('2026-03-20'::date, '19:30'::time, '21:30'::time, 'Castellón'),
    ('2026-03-27'::date, '19:30'::time, '21:30'::time, 'Castellón'),
    ('2026-04-02'::date, '19:30'::time, '21:30'::time, 'Castellón'),
    ('2026-04-10'::date, '19:30'::time, '21:30'::time, 'Castellón'),
    ('2026-04-17'::date, '19:30'::time, '21:30'::time, 'Castellón'),
    ('2026-04-24'::date, '19:30'::time, '21:30'::time, 'Castellón'),
    ('2026-04-28'::date, '19:30'::time, '21:30'::time, 'Castellón'),
    ('2026-05-08'::date, '19:30'::time, '21:30'::time, 'Castellón'),
    ('2026-05-15'::date, '19:30'::time, '21:30'::time, 'Castellón'),
    ('2026-05-29'::date, '19:30'::time, '21:30'::time, 'Castellón'),
    ('2026-06-05'::date, '19:30'::time, '21:30'::time, 'Castellón'),
    ('2026-06-12'::date, '19:30'::time, '21:30'::time, 'Castellón'),
    ('2026-06-19'::date, '19:30'::time, '21:30'::time, 'Castellón'),
    ('2026-06-26'::date, '19:30'::time, '21:30'::time, 'Castellón'),
    ('2026-07-10'::date, '20:00'::time, '22:00'::time, 'Castellón'),
    ('2026-07-17'::date, '20:00'::time, '22:00'::time, 'Castellón'),
    ('2026-07-24'::date, '20:00'::time, '22:00'::time, 'Castellón'),
    ('2026-07-31'::date, '20:00'::time, '22:00'::time, 'Castellón'),
    ('2026-08-07'::date, '20:00'::time, '22:00'::time, 'Castellón'),
    ('2026-08-14'::date, '20:00'::time, '22:00'::time, 'Castellón'),
    ('2026-08-21'::date, '20:00'::time, '22:00'::time, 'Castellón'),
    ('2026-08-28'::date, '20:00'::time, '22:00'::time, 'Castellón')
) as v(game_date, start_time, end_time, location)
where not exists (
  select 1
  from public.games g
  where g.game_date = v.game_date
);

-- Verify the inserted dates.
select game_date, start_time, end_time, location
from public.games
where game_date between '2026-01-01' and '2026-08-31'
order by game_date;
