ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS skill_level integer
  CHECK (skill_level IS NULL OR skill_level BETWEEN 1 AND 5);
