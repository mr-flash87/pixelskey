-- Corrections appliquées lors de la migration vers le projet Supabase autonome.
-- 1. Les commandes gratuites (code promo 100 %) utilisent provider = 'promo' :
--    elles doivent aussi pouvoir être validées par claim_paydunya_order.
CREATE OR REPLACE FUNCTION public.claim_paydunya_order(_order_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claimed uuid;
BEGIN
  UPDATE public.orders SET status = 'paid', paid_at = now(), delivery_status = 'pending'
  WHERE id = _order_id AND provider IN ('paydunya', 'promo') AND status = 'pending'
  RETURNING id INTO claimed;
  RETURN claimed IS NOT NULL;
END;
$$;
-- 2. La file d'e-mails enregistre aussi le statut 'rate_limited'.
ALTER TABLE public.email_send_log DROP CONSTRAINT IF EXISTS email_send_log_status_check;
ALTER TABLE public.email_send_log ADD CONSTRAINT email_send_log_status_check
  CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq', 'rate_limited'));
