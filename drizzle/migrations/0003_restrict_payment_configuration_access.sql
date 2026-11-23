REVOKE ALL ON TABLE public.payment_provider_settings FROM anon, authenticated, PUBLIC;
GRANT ALL ON TABLE public.payment_provider_settings TO service_role;
