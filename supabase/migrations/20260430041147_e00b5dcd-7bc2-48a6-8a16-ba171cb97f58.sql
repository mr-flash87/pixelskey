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
    url := 'https://ixxfdkoqaudrszzvdemb.supabase.co/functions/v1/reconcile-pending-orders',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4eGZka29xYXVkcnN6enZkZW1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0OTY2MTAsImV4cCI6MjA5MzA3MjYxMH0.cxLYXTrMboiz_a3t-k_aGpFDtmc3-bfvAdeAV6MGXNE"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  );
  $$
);
