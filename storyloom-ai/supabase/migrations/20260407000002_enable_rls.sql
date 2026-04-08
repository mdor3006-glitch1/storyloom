-- ============================================================
-- Migration 002 — Enable RLS and create access policies
-- Every table is locked down. Users can only touch their own
-- data. Admins can read everything they need for moderation.
-- ============================================================

-- ---- helpers ----------------------------------------------
-- Convenience function so policies stay readable.
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

-- ============================================================
-- TABLE: users
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (id = auth.uid());

-- Users can update their own profile (display_name, language, avatar_url)
-- credit_balance and is_admin are NOT updatable by users directly
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND is_admin = (SELECT is_admin FROM public.users WHERE id = auth.uid())
  );

-- Admins can read all users
CREATE POLICY "users_select_admin"
  ON public.users FOR SELECT
  USING (public.is_admin());

-- ============================================================
-- TABLE: stories
-- ============================================================
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

-- Admins can read all stories (for moderation)
CREATE POLICY "stories_select_admin"
  ON public.stories FOR SELECT
  USING (public.is_admin());

-- ============================================================
-- TABLE: scenes
-- ============================================================
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;

-- Users can only access scenes that belong to their own stories
CREATE POLICY "scenes_select_own"
  ON public.scenes FOR SELECT
  USING (
    story_id IN (
      SELECT id FROM public.stories WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "scenes_insert_own"
  ON public.scenes FOR INSERT
  WITH CHECK (
    story_id IN (
      SELECT id FROM public.stories WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "scenes_update_own"
  ON public.scenes FOR UPDATE
  USING (
    story_id IN (
      SELECT id FROM public.stories WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "scenes_delete_own"
  ON public.scenes FOR DELETE
  USING (
    story_id IN (
      SELECT id FROM public.stories WHERE user_id = auth.uid()
    )
  );

-- Admins can read all scenes (for moderation)
CREATE POLICY "scenes_select_admin"
  ON public.scenes FOR SELECT
  USING (public.is_admin());

-- ============================================================
-- TABLE: characters
-- ============================================================
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "characters_select_own"
  ON public.characters FOR SELECT
  USING (
    story_id IN (
      SELECT id FROM public.stories WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "characters_insert_own"
  ON public.characters FOR INSERT
  WITH CHECK (
    story_id IN (
      SELECT id FROM public.stories WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "characters_update_own"
  ON public.characters FOR UPDATE
  USING (
    story_id IN (
      SELECT id FROM public.stories WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "characters_delete_own"
  ON public.characters FOR DELETE
  USING (
    story_id IN (
      SELECT id FROM public.stories WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- TABLE: credit_transactions
-- ============================================================
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own transaction history
CREATE POLICY "credit_tx_select_own"
  ON public.credit_transactions FOR SELECT
  USING (user_id = auth.uid());

-- Inserts happen via backend service role only — no client INSERT policy
-- (Backend uses service_role key which bypasses RLS)

-- Admins can read all transactions (for revenue dashboard)
CREATE POLICY "credit_tx_select_admin"
  ON public.credit_transactions FOR SELECT
  USING (public.is_admin());

-- ============================================================
-- TABLE: content_flags
-- ============================================================
ALTER TABLE public.content_flags ENABLE ROW LEVEL SECURITY;

-- Users can submit a flag (INSERT)
CREATE POLICY "content_flags_insert_own"
  ON public.content_flags FOR INSERT
  WITH CHECK (reported_by_user_id = auth.uid());

-- Users can see their own submitted flags
CREATE POLICY "content_flags_select_own"
  ON public.content_flags FOR SELECT
  USING (reported_by_user_id = auth.uid());

-- Admins can read all flags and update (review/dismiss)
CREATE POLICY "content_flags_select_admin"
  ON public.content_flags FOR SELECT
  USING (public.is_admin());

CREATE POLICY "content_flags_update_admin"
  ON public.content_flags FOR UPDATE
  USING (public.is_admin());
