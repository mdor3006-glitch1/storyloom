-- ============================================================
-- Migration 003 — Auth triggers & automation
--
-- 1. on_auth_user_created   — auto-creates public.users row + bonus credit tx
-- 2. on_user_last_active    — updates last_active_at on any story/scene write
-- 3. auto_expire_stories    — pg_cron job: delete expired non-favourite stories
-- ============================================================

-- ---- 1. New user signup trigger ---------------------------
-- Fires after a row is inserted into auth.users (Google, Apple, or Email signup).
-- Creates the public.users profile and logs the 100-credit signup bonus.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create the user profile
  INSERT INTO public.users (id, email, display_name, avatar_url, credit_balance)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    100  -- signup bonus
  )
  ON CONFLICT (id) DO NOTHING;

  -- Log the bonus credit transaction
  INSERT INTO public.credit_transactions (user_id, type, amount, description)
  VALUES (NEW.id, 'bonus', 100, 'Signup bonus');

  RETURN NEW;
END;
$$;

-- Drop trigger if it already exists (idempotent re-runs)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ---- 2. Update last_active_at on story activity -----------
-- Keeps last_active_at current whenever the user writes a scene.

CREATE OR REPLACE FUNCTION public.handle_user_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Resolve the user from the story
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


-- ---- 3. Auto-expire stories (requires pg_cron extension) --
-- pg_cron is available on Supabase Pro plans.
-- Enable it in the Supabase Dashboard → Database → Extensions.
-- Once enabled, uncomment the block below.

/*
SELECT cron.schedule(
  'expire-old-stories',          -- job name
  '0 3 * * *',                   -- 03:00 UTC daily
  $$
    DELETE FROM public.stories
    WHERE
      expires_at IS NOT NULL
      AND expires_at < now()
      AND is_favourite = false;
  $$
);
*/

-- Alternatively, the backend can call this on a cron schedule via Railway.
-- See StoryService.js → cleanupExpiredStories().
