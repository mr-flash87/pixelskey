CREATE TABLE public.payment_provider_settings (
  provider text PRIMARY KEY CHECK (provider = 'paydunya'),
  mode text NOT NULL DEFAULT 'test' CHECK (mode IN ('test', 'live')),
  enabled boolean NOT NULL DEFAULT false,
  credentials_ciphertext text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.payment_provider_settings TO service_role;
ALTER TABLE public.payment_provider_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service only payment configuration" ON public.payment_provider_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_mode text;
CREATE OR REPLACE FUNCTION public.claim_paydunya_order(_order_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claimed uuid;
BEGIN
  UPDATE public.orders SET status = 'paid', paid_at = now(), delivery_status = 'pending'
  WHERE id = _order_id AND provider = 'paydunya' AND status = 'pending'
  RETURNING id INTO claimed;
  RETURN claimed IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_paydunya_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_paydunya_order(uuid) TO service_role;
