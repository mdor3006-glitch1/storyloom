-- ============================================================
-- Migration 001 — Create all tables
-- StoryLoom AI
-- ============================================================

-- ---- users ------------------------------------------------
-- Mirrors auth.users. Populated via trigger on signup.
CREATE TABLE IF NOT EXISTS public.users (
  id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            text UNIQUE NOT NULL,
  display_name     text NOT NULL DEFAULT '',
  avatar_url       text,
  credit_balance   integer NOT NULL DEFAULT 100,
  language         text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'he')),
  is_admin         boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_active_at   timestamptz
);

-- ---- stories ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.stories (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title                 text,
  genre                 text NOT NULL,
  setting               text NOT NULL,
  tone                  text NOT NULL,
  art_style             text NOT NULL,
  total_scenes          integer NOT NULL CHECK (total_scenes IN (8, 15, 25, 30, 35, 40)),
  current_scene_number  integer NOT NULL DEFAULT 0,
  status                text NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'completed', 'abandoned')),
  credits_spent         integer NOT NULL DEFAULT 0,
  is_favourite          boolean NOT NULL DEFAULT false,
  expires_at            timestamptz,        -- null means permanent (favourites)
  created_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,
  story_tension_score   integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS stories_user_id_idx ON public.stories(user_id);
CREATE INDEX IF NOT EXISTS stories_expires_at_idx ON public.stories(expires_at)
  WHERE expires_at IS NOT NULL;

-- ---- scenes -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.scenes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id          uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  scene_number      integer NOT NULL,
  scene_text        text NOT NULL DEFAULT '',
  dialogue          jsonb NOT NULL DEFAULT '[]',
  choices           jsonb NOT NULL DEFAULT '[]',
  player_choice     text,
  player_text_input text,
  image_url         text NOT NULL DEFAULT '',
  image_prompt      text NOT NULL DEFAULT '',
  twist_occurred    boolean NOT NULL DEFAULT false,
  twist_type        text,
  is_undo_snapshot  boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, scene_number, is_undo_snapshot)
);

CREATE INDEX IF NOT EXISTS scenes_story_id_idx ON public.scenes(story_id);

-- ---- characters -------------------------------------------
CREATE TABLE IF NOT EXISTS public.characters (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id        uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  name            text NOT NULL,
  role            text NOT NULL CHECK (role IN ('main', 'secondary', 'ai_side')),
  photo_url       text,  -- null for AI side characters
  traits          jsonb NOT NULL DEFAULT '[]',
  emotions        jsonb NOT NULL DEFAULT
                    '{"love":50,"trust":50,"anger":0,"fear":0,"jealousy":0}',
  relationships   jsonb NOT NULL DEFAULT '[]',
  key_events      jsonb NOT NULL DEFAULT '[]',
  secrets         jsonb NOT NULL DEFAULT '[]',
  is_ai_generated boolean NOT NULL DEFAULT false,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS characters_story_id_idx ON public.characters(story_id);

-- ---- credit_transactions ----------------------------------
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type               text NOT NULL
                       CHECK (type IN ('purchase', 'spend', 'bonus', 'refund')),
  amount             integer NOT NULL,  -- positive = added, negative = spent
  description        text NOT NULL DEFAULT '',
  story_id           uuid REFERENCES public.stories(id) ON DELETE SET NULL,
  stripe_payment_id  text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_tx_user_id_idx
  ON public.credit_transactions(user_id);

-- ---- content_flags ----------------------------------------
CREATE TABLE IF NOT EXISTS public.content_flags (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id              uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  scene_id              uuid REFERENCES public.scenes(id) ON DELETE SET NULL,
  reported_by_user_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ai_flag_reason        text,
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  reviewed_by_admin_id  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_flags_status_idx
  ON public.content_flags(status);
