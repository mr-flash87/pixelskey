ALTER TABLE public.products ADD COLUMN IF NOT EXISTS primestore_id text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'local';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_usd numeric;
CREATE UNIQUE INDEX IF NOT EXISTS products_primestore_id_key ON public.products (primestore_id) WHERE primestore_id IS NOT NULL;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS primestore_id text;
CREATE UNIQUE INDEX IF NOT EXISTS categories_primestore_id_key ON public.categories (primestore_id) WHERE primestore_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.license_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  error text,
  primestore_order_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.license_deliveries TO service_role;
ALTER TABLE public.license_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON public.license_deliveries FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS license_deliveries_order_id_idx ON public.license_deliveries (order_id);
