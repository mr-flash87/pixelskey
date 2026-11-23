CREATE FUNCTION public.record_digitrust_delivery(_item_id uuid, _supplier_order_id text, _contents text[]) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE attempt public.digitrust_purchase_attempts%ROWTYPE; item public.order_items%ROWTYPE; content text;
BEGIN
 SELECT * INTO attempt FROM public.digitrust_purchase_attempts WHERE order_item_id=_item_id FOR UPDATE;
 IF NOT FOUND OR attempt.supplier_order_id IS DISTINCT FROM _supplier_order_id THEN RAISE EXCEPTION 'Supplier reference mismatch'; END IF;
 IF attempt.status='delivered' THEN RETURN true; END IF;
 SELECT * INTO item FROM public.order_items WHERE id=_item_id;
 IF cardinality(_contents) IS NULL OR cardinality(_contents)<1 OR cardinality(_contents)>item.quantity OR EXISTS(SELECT 1 FROM unnest(_contents) AS v WHERE v IS NULL OR length(trim(v))=0) THEN RAISE EXCEPTION 'Invalid delivery'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.orders WHERE id=item.order_id AND status='paid') THEN RAISE EXCEPTION 'Unpaid order'; END IF;
 IF EXISTS(SELECT 1 FROM public.license_deliveries WHERE order_item_id=_item_id AND status='delivered') THEN RAISE EXCEPTION 'Existing delivery requires review'; END IF;
 FOREACH content IN ARRAY _contents LOOP
 INSERT INTO public.license_deliveries(order_id,order_item_id,content,status,digitrust_order_id) VALUES(item.order_id,_item_id,content,'delivered',_supplier_order_id);
 END LOOP;
 UPDATE public.digitrust_purchase_attempts SET status='delivered',updated_at=now() WHERE order_item_id=_item_id;
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.record_digitrust_delivery(uuid,text,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_digitrust_delivery(uuid,text,text[]) TO service_role;
