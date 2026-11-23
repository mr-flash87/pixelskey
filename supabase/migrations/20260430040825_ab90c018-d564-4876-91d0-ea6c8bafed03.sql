UPDATE public.orders
SET payment_id = substring(payment_url FROM '/(pay_[A-Za-z0-9]+)')
WHERE payment_id IS NULL
  AND payment_url LIKE '%/pay_%'
  AND status = 'pending';
