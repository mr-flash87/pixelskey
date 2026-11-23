ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS leekpay_payload jsonb,
  ADD COLUMN IF NOT EXISTS matching_details jsonb,
  ADD COLUMN IF NOT EXISTS last_reconciled_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON public.orders (status, created_at DESC);
