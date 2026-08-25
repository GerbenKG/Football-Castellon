-- Remove the obsolete Present/attendance field from Game Squad.
-- Run once in the Supabase SQL Editor.
-- Game Squad membership itself is now the participation record.

alter table public.game_players
  drop column if exists attended;
