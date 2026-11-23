
DROP POLICY IF EXISTS "Public can mark keys as viewed" ON public.orders;

CREATE OR REPLACE FUNCTION public.mark_keys_viewed(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
     SET keys_viewed_at = COALESCE(keys_viewed_at, now())
   WHERE id = p_order_id
     AND status = 'paid';
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_keys_viewed(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_keys_viewed(UUID) TO anon, authenticated;
