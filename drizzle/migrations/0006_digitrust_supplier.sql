ALTER TABLE public.products ADD COLUMN digitrust_id text;
CREATE UNIQUE INDEX products_digitrust_id_idx ON public.products (digitrust_id) WHERE digitrust_id IS NOT NULL;
ALTER TABLE public.license_deliveries ADD COLUMN digitrust_order_id text;
ALTER TABLE public.catalog_sync_runs ADD COLUMN supplier text NOT NULL DEFAULT 'primestore';
CREATE TABLE public.digitrust_purchase_attempts (
 order_item_id uuid PRIMARY KEY REFERENCES public.order_items(id),
 status text NOT NULL DEFAULT 'processing',
 supplier_order_id text,
 error text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.digitrust_purchase_attempts TO service_role;
ALTER TABLE public.digitrust_purchase_attempts ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.claim_digitrust_purchase(_item_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE claimed uuid;
BEGIN
 INSERT INTO public.digitrust_purchase_attempts(order_item_id,status) VALUES (_item_id,'processing')
 ON CONFLICT (order_item_id) DO UPDATE SET status='processing', error=NULL, updated_at=now()
 WHERE digitrust_purchase_attempts.status='failed'
 RETURNING order_item_id INTO claimed;
 RETURN claimed IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_digitrust_purchase(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_digitrust_purchase(uuid) TO service_role;
