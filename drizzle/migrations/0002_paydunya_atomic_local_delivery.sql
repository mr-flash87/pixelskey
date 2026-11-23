CREATE OR REPLACE FUNCTION public.assign_paid_order_keys(_order_id uuid, _product_id uuid, _quantity integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing_count integer; required_count integer; key_ids uuid[];
BEGIN
  PERFORM 1 FROM public.orders WHERE id = _order_id AND status = 'paid' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not paid'; END IF;
  IF _quantity < 1 OR _quantity > 20 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  SELECT count(*) INTO existing_count FROM public.license_keys WHERE order_id = _order_id AND product_id = _product_id;
  required_count := greatest(0, _quantity - existing_count);
  IF required_count = 0 THEN RETURN true; END IF;
  SELECT array_agg(id) INTO key_ids FROM (SELECT id FROM public.license_keys WHERE product_id = _product_id AND status = 'available' LIMIT required_count FOR UPDATE SKIP LOCKED) AS available_keys;
  IF coalesce(array_length(key_ids, 1), 0) < required_count THEN RETURN false; END IF;
  UPDATE public.license_keys SET status = 'sold', order_id = _order_id, assigned_at = now() WHERE id = ANY(key_ids);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_paid_order_keys(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_paid_order_keys(uuid, uuid, integer) TO service_role;
