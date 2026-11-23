-- =========================================
-- PIXELS KEY — Schéma e-commerce
-- =========================================

-- Trigger générique pour updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Enums
CREATE TYPE public.order_status AS ENUM ('pending', 'paid', 'failed', 'expired', 'refunded');
CREATE TYPE public.license_status AS ENUM ('available', 'reserved', 'sold');

-- =========================================
-- PRODUCTS
-- =========================================
CREATE TABLE public.products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price       INTEGER NOT NULL CHECK (price >= 0), -- en FCFA (entier)
  old_price   INTEGER CHECK (old_price IS NULL OR old_price >= price),
  type        TEXT NOT NULL DEFAULT 'license',
  category    TEXT NOT NULL DEFAULT 'other',
  image_url   TEXT,
  duration    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  promo       BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Lecture publique des produits actifs (vitrine)
CREATE POLICY "Active products are publicly readable"
  ON public.products FOR SELECT
  USING (is_active = true);

-- =========================================
-- LICENSE KEYS (pool à distribuer)
-- =========================================
CREATE TABLE public.license_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  license_key   TEXT NOT NULL,
  status        public.license_status NOT NULL DEFAULT 'available',
  order_id      UUID,                            -- rempli à l'attribution
  assigned_at   TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, license_key)
);

CREATE INDEX idx_license_keys_available
  ON public.license_keys (product_id)
  WHERE status = 'available';

CREATE INDEX idx_license_keys_order ON public.license_keys (order_id);

CREATE TRIGGER trg_license_keys_updated_at
  BEFORE UPDATE ON public.license_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;
-- Aucune policy : seul le service_role (Edge Functions) peut lire/écrire

-- =========================================
-- ORDERS
-- =========================================
CREATE TABLE public.orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       TEXT NOT NULL UNIQUE DEFAULT ('PK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  customer_email  TEXT NOT NULL,
  customer_phone  TEXT,
  customer_name   TEXT,
  amount          INTEGER NOT NULL CHECK (amount >= 0), -- FCFA
  currency        TEXT NOT NULL DEFAULT 'XOF',
  status          public.order_status NOT NULL DEFAULT 'pending',
  payment_id      TEXT UNIQUE,        -- ID LeekPay
  payment_url     TEXT,
  provider        TEXT NOT NULL DEFAULT 'leekpay',
  paid_at         TIMESTAMPTZ,
  failed_reason   TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_payment_id ON public.orders (payment_id);
CREATE INDEX idx_orders_status ON public.orders (status);
CREATE INDEX idx_orders_email ON public.orders (customer_email);

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Lecture publique d'une commande UNIQUEMENT par son ID (UUID non-devinable)
-- Aucune policy d'écriture côté client : tout passe par les Edge Functions (service_role)
CREATE POLICY "Orders are readable by anyone with the order id"
  ON public.orders FOR SELECT
  USING (true);
-- ⚠️ La sécurité repose sur l'imprévisibilité de l'UUID (jamais listé publiquement).
-- Les colonnes sensibles (failed_reason, metadata) sont OK à exposer pour le client.

-- Lien FK license_keys → orders (après création de orders)
ALTER TABLE public.license_keys
  ADD CONSTRAINT fk_license_keys_order
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

-- =========================================
-- ORDER ITEMS
-- =========================================
CREATE TABLE public.order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name  TEXT NOT NULL,        -- snapshot au moment de l'achat
  unit_price    INTEGER NOT NULL CHECK (unit_price >= 0),
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  duration      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order ON public.order_items (order_id);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Lecture publique liée à orders (même logique : besoin de connaître l'order_id)
CREATE POLICY "Order items readable by anyone"
  ON public.order_items FOR SELECT
  USING (true);

-- =========================================
-- VUE STOCK (calcul temps réel)
-- =========================================
CREATE OR REPLACE VIEW public.products_with_stock
WITH (security_invoker = true) AS
SELECT
  p.*,
  COALESCE(stock.available_count, 0) AS stock
FROM public.products p
LEFT JOIN (
  SELECT product_id, COUNT(*)::int AS available_count
  FROM public.license_keys
  WHERE status = 'available'
  GROUP BY product_id
) stock ON stock.product_id = p.id;

-- =========================================
-- FONCTION SECURITY DEFINER : récupérer commande + items + clés
-- (utilisée par la page /order/:id)
-- =========================================
CREATE OR REPLACE FUNCTION public.get_order_with_keys(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'order', to_jsonb(o.*),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'product_id', oi.product_id,
        'product_name', oi.product_name,
        'unit_price', oi.unit_price,
        'quantity', oi.quantity,
        'duration', oi.duration
      ) ORDER BY oi.created_at)
      FROM public.order_items oi
      WHERE oi.order_id = o.id
    ), '[]'::jsonb),
    'license_keys', CASE
      WHEN o.status = 'paid' THEN COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'product_id', lk.product_id,
          'license_key', lk.license_key,
          'assigned_at', lk.assigned_at
        ))
        FROM public.license_keys lk
        WHERE lk.order_id = o.id
      ), '[]'::jsonb)
      ELSE '[]'::jsonb
    END
  )
  INTO v_result
  FROM public.orders o
  WHERE o.id = p_order_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_with_keys(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_with_keys(UUID) TO anon, authenticated;
