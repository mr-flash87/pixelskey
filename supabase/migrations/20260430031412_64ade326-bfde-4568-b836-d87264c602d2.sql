
-- Track when customer viewed their license keys (via /order/:id page)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS keys_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- Allow public marking of keys_viewed_at (anyone with order id can view)
CREATE POLICY "Public can mark keys as viewed"
ON public.orders
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);
