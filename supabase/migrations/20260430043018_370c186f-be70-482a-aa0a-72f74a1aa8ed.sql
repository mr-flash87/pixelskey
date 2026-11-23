ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_delivery_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_error TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_retry
  ON public.orders (status, delivery_status, last_delivery_attempt_at)
  WHERE status = 'paid' AND delivery_status IN ('pending', 'failed');
