-- =====================================================================
-- Alternative cleanup scheduler: Supabase pg_cron
--
-- Supabase blocks direct "DELETE FROM storage.objects" (you must use the Storage API),
-- so pure SQL cannot free the file space. The reliable pattern is: pg_cron calls the same
-- Vercel endpoint (/api/cron/cleanup) that Vercel Cron would call, via pg_net.
-- Use this INSTEAD of (not in addition to) the Vercel cron in vercel.json,
-- e.g. if you are on a plan/host where Vercel cron is unavailable.
-- Cleanup is idempotent, so running both is harmless, just wasteful.
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Replace YOURDOMAIN and the secret (must equal CRON_SECRET in Vercel env vars).
select cron.schedule(
  'car-preview-cleanup',
  '0 3 * * *',                                   -- every day 03:00 UTC
  $$
  select net.http_get(
    url := 'https://YOURDOMAIN.com/api/cron/cleanup',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
  );
  $$
);

-- Inspect / remove:
--   select * from cron.job;
--   select cron.unschedule('car-preview-cleanup');
