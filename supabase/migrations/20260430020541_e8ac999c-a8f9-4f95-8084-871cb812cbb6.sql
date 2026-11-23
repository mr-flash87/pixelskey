-- =========================================================
-- ADMIN: ROLES
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin', 'manager', 'support');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin','manager','support')
  )
$$;

-- RLS user_roles
DROP POLICY IF EXISTS "Users see own roles" ON public.user_roles;
CREATE POLICY "Users see own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin manage roles" ON public.user_roles;
CREATE POLICY "Super admin manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- =========================================================
-- PRODUCTS: extra columns + admin policies
-- =========================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS instant_delivery boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

DROP POLICY IF EXISTS "Admins manage products" ON public.products;
CREATE POLICY "Admins manage products" ON public.products
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins read all products" ON public.products;
CREATE POLICY "Admins read all products" ON public.products
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- =========================================================
-- ORDERS: extra columns + admin policies
-- =========================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz;

DROP POLICY IF EXISTS "Admins manage orders" ON public.orders;
CREATE POLICY "Admins manage orders" ON public.orders
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage order items" ON public.order_items;
CREATE POLICY "Admins manage order items" ON public.order_items
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- LICENSE KEYS: admin access
-- =========================================================
DROP POLICY IF EXISTS "Admins manage license keys" ON public.license_keys;
CREATE POLICY "Admins manage license keys" ON public.license_keys
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- PROMO CODES
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.promo_kind AS ENUM ('percent', 'amount');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  kind public.promo_kind NOT NULL DEFAULT 'percent',
  value integer NOT NULL CHECK (value > 0),
  max_uses integer,
  uses_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage promos" ON public.promo_codes;
CREATE POLICY "Admins manage promos" ON public.promo_codes
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER promo_codes_set_updated_at
BEFORE UPDATE ON public.promo_codes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- SHOP SETTINGS (key/value)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.shop_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage settings" ON public.shop_settings;
CREATE POLICY "Admins manage settings" ON public.shop_settings
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Public reads public settings" ON public.shop_settings;
CREATE POLICY "Public reads public settings" ON public.shop_settings
  FOR SELECT TO anon, authenticated
  USING (key LIKE 'public.%');

-- Default settings
INSERT INTO public.shop_settings (key, value) VALUES
  ('public.shop', '{"name":"Pixels Key","support_email":"support@pixelskey.com","whatsapp":"+221770000000","currency":"XOF"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.shop_settings (key, value) VALUES
  ('payments.methods', '{"orange_money":true,"wave":true,"mtn":true,"moov":false,"card":true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- =========================================================
-- ADMIN AUDIT LOG
-- =========================================================
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource text,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read audit" ON public.admin_audit_log;
CREATE POLICY "Admins read audit" ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins insert audit" ON public.admin_audit_log;
CREATE POLICY "Admins insert audit" ON public.admin_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_license_keys_status ON public.license_keys(status);
CREATE INDEX IF NOT EXISTS idx_license_keys_product ON public.license_keys(product_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.admin_audit_log(created_at DESC);
