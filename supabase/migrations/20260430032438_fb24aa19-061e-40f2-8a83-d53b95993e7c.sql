
CREATE TABLE IF NOT EXISTS public.product_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  duration TEXT NOT NULL,             -- '1_month', '3_months', '6_months', '1_year', 'lifetime'
  label TEXT NOT NULL,                -- '1 mois', '3 mois', 'À vie' (display)
  price INTEGER NOT NULL CHECK (price >= 0),
  old_price INTEGER,
  stock INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_tiers_product ON public.product_tiers(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_tiers_product_duration
  ON public.product_tiers(product_id, duration);

ALTER TABLE public.product_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active tiers publicly readable"
  ON public.product_tiers FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Admins manage tiers"
  ON public.product_tiers FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE TRIGGER update_product_tiers_updated_at
  BEFORE UPDATE ON public.product_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_tiers TO authenticated;
GRANT SELECT ON public.product_tiers TO anon;

-- Add tier reference on order_items for traceability
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS tier_id UUID REFERENCES public.product_tiers(id),
  ADD COLUMN IF NOT EXISTS duration_label TEXT;
