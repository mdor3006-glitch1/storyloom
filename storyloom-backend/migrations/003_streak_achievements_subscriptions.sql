-- ── 003: Streak columns, achievements table, subscriptions table ──────────────

-- 1. Streak columns on users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS current_streak  int  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak  int  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_active_date date;

-- 2. Achievements table
CREATE TABLE IF NOT EXISTS public.achievements (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_id text        NOT NULL,
  unlocked_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_id)
);
CREATE INDEX IF NOT EXISTS achievements_user_id_idx ON public.achievements(user_id);

-- RLS
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users can read own achievements"
  ON public.achievements FOR SELECT
  USING (auth.uid() = user_id);

-- 3. Subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status                 text        NOT NULL DEFAULT 'inactive',  -- active | inactive | cancelled | past_due
  stripe_subscription_id text,
  started_at             timestamptz,
  expires_at             timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_id_unique ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON public.subscriptions(status);

-- RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users can read own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);
