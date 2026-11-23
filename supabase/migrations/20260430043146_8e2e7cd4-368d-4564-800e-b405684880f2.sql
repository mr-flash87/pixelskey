-- Ensure pg_cron + pg_net are available
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any prior schedule with the same name
DO $$
BEGIN
  PERFORM cron.unschedule('retry-failed-deliveries');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Re-schedule: every 5 minutes, call retry-failed-deliveries
SELECT cron.schedule(
  'retry-failed-deliveries',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://uyqjgbbgcyxxdrkuxenn.supabase.co/functions/v1/retry-failed-deliveries',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
