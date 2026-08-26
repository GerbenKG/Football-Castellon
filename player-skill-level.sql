alter table public.players
  add column if not exists skill_level integer;

alter table public.players
  drop constraint if exists players_skill_level_check;

alter table public.players
  add constraint players_skill_level_check
  check (skill_level is null or skill_level between 1 and 5);
