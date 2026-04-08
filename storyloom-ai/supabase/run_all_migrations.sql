-- ============================================================
-- StoryLoom AI — Full Database Setup
-- Paste this entire file into Supabase SQL Editor and click Run.
-- ============================================================


-- ============================================================
-- PART 1 — Create all tables
-- ============================================================

-- ---- users ------------------------------------------------
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
  expires_at            timestamptz,
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
  photo_url       text,
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
  amount             integer NOT NULL,
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


-- ============================================================
-- PART 2 — Enable RLS and create access policies
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.users WHERE id = auth.uid()),
    false
  );
$$;

-- users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND is_admin = (SELECT is_admin FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "users_select_admin"
  ON public.users FOR SELECT
  USING (public.is_admin());

-- stories
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stories_select_own"
  ON public.stories FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "stories_insert_own"
  ON public.stories FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "stories_update_own"
  ON public.stories FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "stories_delete_own"
  ON public.stories FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "stories_select_admin"
  ON public.stories FOR SELECT
  USING (public.is_admin());

-- scenes
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scenes_select_own"
  ON public.scenes FOR SELECT
  USING (
    story_id IN (SELECT id FROM public.stories WHERE user_id = auth.uid())
  );

CREATE POLICY "scenes_insert_own"
  ON public.scenes FOR INSERT
  WITH CHECK (
    story_id IN (SELECT id FROM public.stories WHERE user_id = auth.uid())
  );

CREATE POLICY "scenes_update_own"
  ON public.scenes FOR UPDATE
  USING (
    story_id IN (SELECT id FROM public.stories WHERE user_id = auth.uid())
  );

CREATE POLICY "scenes_delete_own"
  ON public.scenes FOR DELETE
  USING (
    story_id IN (SELECT id FROM public.stories WHERE user_id = auth.uid())
  );

CREATE POLICY "scenes_select_admin"
  ON public.scenes FOR SELECT
  USING (public.is_admin());

-- characters
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "characters_select_own"
  ON public.characters FOR SELECT
  USING (
    story_id IN (SELECT id FROM public.stories WHERE user_id = auth.uid())
  );

CREATE POLICY "characters_insert_own"
  ON public.characters FOR INSERT
  WITH CHECK (
    story_id IN (SELECT id FROM public.stories WHERE user_id = auth.uid())
  );

CREATE POLICY "characters_update_own"
  ON public.characters FOR UPDATE
  USING (
    story_id IN (SELECT id FROM public.stories WHERE user_id = auth.uid())
  );

CREATE POLICY "characters_delete_own"
  ON public.characters FOR DELETE
  USING (
    story_id IN (SELECT id FROM public.stories WHERE user_id = auth.uid())
  );

-- credit_transactions
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_tx_select_own"
  ON public.credit_transactions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "credit_tx_select_admin"
  ON public.credit_transactions FOR SELECT
  USING (public.is_admin());

-- content_flags
ALTER TABLE public.content_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_flags_insert_own"
  ON public.content_flags FOR INSERT
  WITH CHECK (reported_by_user_id = auth.uid());

CREATE POLICY "content_flags_select_own"
  ON public.content_flags FOR SELECT
  USING (reported_by_user_id = auth.uid());

CREATE POLICY "content_flags_select_admin"
  ON public.content_flags FOR SELECT
  USING (public.is_admin());

CREATE POLICY "content_flags_update_admin"
  ON public.content_flags FOR UPDATE
  USING (public.is_admin());


-- ============================================================
-- PART 3 — Auth triggers
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, avatar_url, credit_balance)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    100
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.credit_transactions (user_id, type, amount, description)
  VALUES (NEW.id, 'bonus', 100, 'Signup bonus');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_user_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.stories
  WHERE id = NEW.story_id;

  IF v_user_id IS NOT NULL THEN
    UPDATE public.users
    SET last_active_at = now()
    WHERE id = v_user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_scene_created ON public.scenes;

CREATE TRIGGER on_scene_created
  AFTER INSERT ON public.scenes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_activity();


-- ============================================================
-- PART 4 — Storage buckets
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'character-photos',
  'character-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'scene-images',
  'scene-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "char_photos_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'character-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "char_photos_select_own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'character-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "char_photos_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'character-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "char_photos_select_admin"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'character-photos'
    AND public.is_admin()
  );

CREATE POLICY "scene_images_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'scene-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================
-- VERIFICATION — Run this after the above to confirm success
-- ============================================================

SELECT
  t.tablename,
  t.rowsecurity AS rls_enabled
FROM pg_tables t
WHERE t.schemaname = 'public'
ORDER BY t.tablename;
