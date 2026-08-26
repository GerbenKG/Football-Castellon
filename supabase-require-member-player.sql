-- Every access member must be linked to exactly one player.
-- Existing members were backfilled by matching display_name to active player name before
-- the NOT NULL constraint was applied.

alter table public.access_profiles
  alter column player_id set not null;

create unique index if not exists access_profiles_player_id_unique
  on public.access_profiles(player_id);
