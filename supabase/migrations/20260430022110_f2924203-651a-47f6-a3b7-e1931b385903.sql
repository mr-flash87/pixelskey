-- Promotions par dates sur produits
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS promo_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promo_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0;

-- Règles supplémentaires sur les codes promo
ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS min_order_amount INTEGER NOT NULL DEFAULT 0;

-- Lien optionnel d'un code promo sur une commande + montant remisé
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS promo_code TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal_amount INTEGER;

-- Validation server-side d'un code promo
CREATE OR REPLACE FUNCTION public.validate_promo_code(_code TEXT, _subtotal INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo RECORD;
  v_discount INTEGER := 0;
BEGIN
  SELECT * INTO v_promo FROM public.promo_codes
  WHERE upper(code) = upper(_code) LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Code introuvable');
  END IF;
  IF NOT v_promo.is_active THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Code désactivé');
  END IF;
  IF v_promo.starts_at IS NOT NULL AND v_promo.starts_at > now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Code pas encore actif');
  END IF;
  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Code expiré');
  END IF;
  IF v_promo.max_uses IS NOT NULL AND v_promo.uses_count >= v_promo.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Code épuisé');
  END IF;
  IF _subtotal < v_promo.min_order_amount THEN
    RETURN jsonb_build_object('valid', false, 'reason',
      'Montant minimum ' || v_promo.min_order_amount || ' FCFA requis');
  END IF;

  IF v_promo.kind = 'percent' THEN
    v_discount := (_subtotal * v_promo.value) / 100;
  ELSE
    v_discount := v_promo.value;
  END IF;
  IF v_discount > _subtotal THEN
    v_discount := _subtotal;
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'code', v_promo.code,
    'kind', v_promo.kind,
    'value', v_promo.value,
    'discount', v_discount
  );
END;
$$;

-- Permet aux clients (anon) d'appeler la validation sans modification de données
GRANT EXECUTE ON FUNCTION public.validate_promo_code(TEXT, INTEGER) TO anon, authenticated;
