ALTER TABLE public.game_players
  ADD COLUMN IF NOT EXISTS attended boolean NOT NULL DEFAULT false;
