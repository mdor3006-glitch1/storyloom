-- ── 005: STAGE v2 — scene typology, filler dialogue, pregen bundles, feature flags ────

-- ── scenes: Type A/B + filler_dialogue + can_text_input + schema_version ─
ALTER TABLE public.scenes
  ADD COLUMN IF NOT EXISTS scene_type      text    NOT NULL DEFAULT 'B'
    CHECK (scene_type IN ('A','B')),
  ADD COLUMN IF NOT EXISTS filler_dialogue jsonb   NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS can_text_input  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS schema_version  integer NOT NULL DEFAULT 2;

-- ── users: feature flags + choice bias (for predicted-branch priority) ───
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS flags       jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS choice_bias jsonb NOT NULL DEFAULT '{"safe_count":0,"risky_count":0}'::jsonb;

-- ── stories: freeform_cooldown_remaining (forces 2 Type B scenes after freeform) ─
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS freeform_cooldown_remaining integer NOT NULL DEFAULT 0;

-- ── pregen_bundles: Supabase-backed pregeneration cache ────────────────
CREATE TABLE IF NOT EXISTS public.pregen_bundles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id          uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  from_scene_number integer NOT NULL,
  choice_hash       text NOT NULL,
  choice_text       text NOT NULL,
  scene_data        jsonb,
  image_url         text,
  blurhash          text,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','ready','consumed','failed')),
  schema_version    integer NOT NULL DEFAULT 2,
  created_at        timestamptz NOT NULL DEFAULT now(),
  ready_at          timestamptz,
  CONSTRAINT pregen_bundles_unique UNIQUE (story_id, from_scene_number, choice_hash, schema_version)
);

CREATE INDEX IF NOT EXISTS pregen_bundles_lookup_idx
  ON public.pregen_bundles (story_id, from_scene_number, choice_hash, status);

CREATE INDEX IF NOT EXISTS pregen_bundles_cleanup_idx
  ON public.pregen_bundles (status, created_at);

-- ── system_flags: global kill-switches ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_flags (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);

INSERT INTO public.system_flags (key, value) VALUES
  ('pregen_enabled', 'true'::jsonb)
  ON CONFLICT (key) DO NOTHING;
