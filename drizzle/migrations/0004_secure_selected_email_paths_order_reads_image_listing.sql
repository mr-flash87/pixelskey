-- Email queue bodies already schema-qualify all pgmq references.
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = '';
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = '';
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = '';
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = '';

-- Customer order pages use get-order with service-role access, not direct table reads.
-- Preserve the existing authenticated admin policies and service-role access.
DROP POLICY IF EXISTS "Order items readable by anyone" ON public.order_items;
DROP POLICY IF EXISTS "Orders are readable by anyone with the order id" ON public.orders;

-- Public product image URLs still work without a client SELECT/listing policy.
-- Only authenticated staff may list stored product images for administration.
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Admins read product image metadata"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'product-images' AND public.is_admin((SELECT auth.uid())));
