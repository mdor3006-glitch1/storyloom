-- ============================================================
-- Seed data — development only
-- Run after migrations to create a test admin account.
-- The auth.users row is created via Supabase Auth API;
-- this just promotes an existing user to admin.
-- ============================================================

-- After signing up via the app/Auth UI, find your user UUID in
-- Supabase Dashboard → Authentication → Users, then run:
--
--   UPDATE public.users SET is_admin = true WHERE email = 'your@email.com';
--
-- Or use the helper below (replace the email):

DO $$
BEGIN
  UPDATE public.users
  SET is_admin = true
  WHERE email = 'admin@storyloom.dev';

  IF NOT FOUND THEN
    RAISE NOTICE 'Admin user not found — sign up first, then re-run this seed.';
  END IF;
END
$$;
