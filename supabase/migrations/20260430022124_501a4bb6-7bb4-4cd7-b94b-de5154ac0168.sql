REVOKE EXECUTE ON FUNCTION public.validate_promo_code(TEXT, INTEGER) FROM anon, authenticated, public;
-- Only service_role (used by edge functions) keeps execute access by default.
