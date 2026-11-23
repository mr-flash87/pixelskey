-- 1. Bloquer explicitement tout accès direct anon/authenticated à license_keys
--    (en plus de l'absence de policy, on retire les droits SQL au cas où)
REVOKE ALL ON public.license_keys FROM anon, authenticated;

-- 2. Restreindre la fonction get_order_with_keys au service_role uniquement
REVOKE EXECUTE ON FUNCTION public.get_order_with_keys(UUID) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_with_keys(UUID) TO service_role;
