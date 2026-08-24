-- Game Football: prevent the same roster player being assigned twice to one Game.
-- Safe to run once in Supabase SQL Editor.
--
-- Remove any accidental duplicates first, keeping the oldest record.
delete from public.game_players a
using public.game_players b
where a.game_id = b.game_id
  and a.player_id is not null
  and a.player_id = b.player_id
  and a.id > b.id;

create unique index if not exists game_players_game_player_unique
on public.game_players(game_id, player_id)
where player_id is not null;
