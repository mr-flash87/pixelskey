-- Ensure scheduling extensions exist
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any previous schedule so re-runs are idempotent
DO $$
DECLARE jid bigint;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'reconcile-pending-orders'
  LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'reconcile-pending-orders',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://uyqjgbbgcyxxdrkuxenn.supabase.co/functions/v1/reconcile-pending-orders',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5cWpnYmJnY3l4eGRya3V4ZW5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU0NTc4MDYsImV4cCI6MjExMTAzMzgwNn0.Os1yhUGVjY_4TTY3DQG3HSICLq42mrmby85Zx0hXW6I"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  );
  $$
);
