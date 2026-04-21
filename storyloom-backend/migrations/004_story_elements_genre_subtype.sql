-- ── 004: story_elements + genre_subtype on stories ──────────────────────────

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS story_elements jsonb     NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS genre_subtype  text;
