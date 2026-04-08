-- ─────────────────────────────────────────────────────────────
-- Task 4.8: Auto-delete stories older than 10 days that are
--           not marked as favourites.
--
-- Uses pg_cron (enabled in Supabase Dashboard → Extensions).
-- The cron job runs once daily at 03:00 UTC.
-- ─────────────────────────────────────────────────────────────

-- 1. Function that deletes expired stories
CREATE OR REPLACE FUNCTION public.delete_expired_stories()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.stories
  WHERE
    is_favourite = false
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$$;

-- 2. Schedule the function to run daily at 03:00 UTC
-- Requires pg_cron extension (enable in Supabase Dashboard → Extensions → pg_cron)
SELECT cron.schedule(
  'delete-expired-stories',   -- job name (unique)
  '0 3 * * *',                -- cron expression: daily at 03:00 UTC
  $$SELECT public.delete_expired_stories();$$
);

-- To verify the job was registered:
-- SELECT * FROM cron.job WHERE jobname = 'delete-expired-stories';

-- To manually run / test:
-- SELECT public.delete_expired_stories();
