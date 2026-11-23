CREATE TABLE public.catalog_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  trigger text NOT NULL DEFAULT 'cron',
  products_total integer NOT NULL DEFAULT 0,
  products_instant integer NOT NULL DEFAULT 0,
  products_created integer NOT NULL DEFAULT 0,
  products_updated integer NOT NULL DEFAULT 0,
  error text
);
GRANT SELECT ON public.catalog_sync_runs TO authenticated;
GRANT ALL ON public.catalog_sync_runs TO service_role;
ALTER TABLE public.catalog_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read sync runs" ON public.catalog_sync_runs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE INDEX catalog_sync_runs_started_idx ON public.catalog_sync_runs (started_at DESC);
