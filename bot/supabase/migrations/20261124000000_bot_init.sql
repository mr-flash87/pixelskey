-- Bot Telegram de vente d'abonnements — schéma initial.
-- Toutes les tables sont réservées au service (RLS activé, aucune policy) :
-- seules les fonctions serveur (clé service) y accèdent, jamais un navigateur.

create extension if not exists pgcrypto;

-- ── Utilisateurs Telegram ──────────────────────────────────────────────
create table public.bot_users (
  telegram_id bigint primary key,
  username text,
  first_name text,
  balance integer not null default 0 check (balance >= 0),
  referral_code text not null unique default lower(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  referrer_id bigint references public.bot_users(telegram_id),
  is_blocked boolean not null default false,
  state text,
  state_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (referrer_id is null or referrer_id <> telegram_id)
);

-- ── Fournisseurs (un adaptateur de code par "kind") ────────────────────
create table public.suppliers (
  id text primary key,                       -- ex. digitrust, primelabs, manual
  name text not null,
  enabled boolean not null default true,
  auto_publish boolean not null default false, -- publier automatiquement les nouvelles offres importées
  usd_rate numeric not null default 600 check (usd_rate > 0),
  margin_percent numeric not null default 30 check (margin_percent >= 0),
  margin_fixed integer not null default 0 check (margin_fixed >= 0),
  last_sync_at timestamptz,
  last_sync_error text
);
insert into public.suppliers (id, name) values
  ('manual', 'Stock manuel'),
  ('digitrust', 'Digitrust'),
  ('primelabs', 'Prime Labs');

-- ── Produits ───────────────────────────────────────────────────────────
create table public.products (
  id bigint generated always as identity primary key,  -- court : tient dans les callback_data Telegram
  supplier_id text not null references public.suppliers(id),
  supplier_product_id text,                  -- identifiant chez le fournisseur (null pour le stock manuel)
  category text not null default 'Autres',
  name text not null,
  description text not null default '',
  price integer not null check (price >= 0), -- prix de vente en XOF
  price_locked boolean not null default false, -- true : la synchro ne touche plus au prix
  cost numeric,                              -- coût fournisseur (devise du fournisseur)
  supplier_stock integer not null default 0,
  supplier_available boolean not null default true,
  instant boolean not null default true,
  is_active boolean not null default false,
  position integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, supplier_product_id)
);
create index products_active_idx on public.products (is_active, category, position);

-- Stock que vous ajoutez vous-même (clés, comptes, liens) — prioritaire sur le fournisseur.
create table public.stock_items (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  content text not null,
  status text not null default 'available' check (status in ('available', 'delivered')),
  order_id uuid,
  created_at timestamptz not null default now()
);
create index stock_items_available_idx on public.stock_items (product_id) where status = 'available';

-- ── Commandes ──────────────────────────────────────────────────────────
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('CMD-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8))),
  telegram_id bigint not null references public.bot_users(telegram_id),
  product_id bigint not null references public.products(id),
  product_name text not null,
  quantity integer not null default 1 check (quantity between 1 and 10),
  unit_price integer not null check (unit_price >= 0),
  amount integer not null check (amount >= 0),
  pay_method text not null check (pay_method in ('flashpay', 'balance')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'expired', 'refunded')),
  -- none → processing → delivered | supplier_pending | failed | uncertain
  delivery_status text not null default 'none' check (delivery_status in ('none', 'processing', 'delivered', 'supplier_pending', 'failed', 'uncertain')),
  supplier_order_id text,
  supplier_attempted_at timestamptz,
  delivery_claimed_at timestamptz,
  delivery_error text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  delivered_at timestamptz
);
create index orders_user_idx on public.orders (telegram_id, created_at desc);
create index orders_delivery_idx on public.orders (delivery_status) where status = 'paid';

-- Contenus livrés (identifiants). Jamais lisibles hors service.
create table public.deliveries (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
create index deliveries_order_idx on public.deliveries (order_id);

-- ── Paiements FlashPay (commande ou recharge de solde) ─────────────────
create table public.payments (
  id text primary key,                       -- identifiant FlashPay (PAY-...)
  kind text not null check (kind in ('order', 'topup')),
  order_id uuid references public.orders(id),
  telegram_id bigint not null references public.bot_users(telegram_id),
  amount integer not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'cancelled')),
  checkout_url text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  check ((kind = 'order') = (order_id is not null))
);
create index payments_pending_idx on public.payments (created_at) where status = 'pending';

-- Événements webhook déjà traités (un même événement peut arriver plusieurs fois).
create table public.webhook_events (
  id text primary key,
  received_at timestamptz not null default now()
);

-- ── Portefeuille ───────────────────────────────────────────────────────
create table public.wallet_transactions (
  id bigint generated always as identity primary key,
  telegram_id bigint not null references public.bot_users(telegram_id),
  amount integer not null check (amount <> 0),   -- positif : crédit, négatif : débit
  kind text not null check (kind in ('topup', 'purchase', 'referral_bonus', 'refund', 'admin')),
  ref text not null,                              -- identifiant unique de l'opération (anti-doublon)
  balance_after integer not null,
  created_at timestamptz not null default now(),
  unique (kind, ref)
);
create index wallet_user_idx on public.wallet_transactions (telegram_id, created_at desc);

-- ── Réglages ───────────────────────────────────────────────────────────
create table public.settings (
  key text primary key,
  value jsonb not null
);
insert into public.settings (key, value) values
  ('referral_percent', '5'),      -- % du premier achat du filleul crédité au parrain
  ('topup_min', '500'),
  ('topup_max', '200000');

alter table public.bot_users enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.stock_items enable row level security;
alter table public.orders enable row level security;
alter table public.deliveries enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.settings enable row level security;

-- ═══════════════════════════════════════════════════════════════════════
-- Fonctions atomiques (service uniquement, search_path vide)
-- ═══════════════════════════════════════════════════════════════════════

-- Mouvement de solde idempotent : un même (kind, ref) n'est appliqué qu'une fois.
-- Retourne le nouveau solde, ou null si l'opération existait déjà.
-- Lève une exception si le solde deviendrait négatif.
create or replace function public.wallet_apply(_telegram_id bigint, _amount integer, _kind text, _ref text)
returns integer language plpgsql security definer set search_path = '' as $$
declare _balance integer;
begin
  select balance into _balance from public.bot_users where telegram_id = _telegram_id for update;
  if not found then raise exception 'utilisateur inconnu'; end if;
  if exists (select 1 from public.wallet_transactions where kind = _kind and ref = _ref) then
    return null;
  end if;
  if _balance + _amount < 0 then raise exception 'solde insuffisant'; end if;
  update public.bot_users set balance = balance + _amount where telegram_id = _telegram_id;
  insert into public.wallet_transactions (telegram_id, amount, kind, ref, balance_after)
    values (_telegram_id, _amount, _kind, _ref, _balance + _amount);
  return _balance + _amount;
end $$;

-- Paiement d'une commande avec le solde : débit + passage en "paid" dans la même transaction.
create or replace function public.pay_order_with_balance(_order_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare _o public.orders%rowtype;
begin
  select * into _o from public.orders where id = _order_id for update;
  if not found or _o.status <> 'pending' or _o.pay_method <> 'balance' then return false; end if;
  if _o.amount > 0 then
    perform public.wallet_apply(_o.telegram_id, -_o.amount, 'purchase', _o.id::text);
  end if;
  update public.orders set status = 'paid', paid_at = now() where id = _order_id;
  return true;
end $$;

-- Confirme un paiement FlashPay déjà vérifié côté serveur (montant contrôlé).
-- Idempotent. Accepte aussi un paiement "expired"/"cancelled" validé en retard par l'administrateur FlashPay.
-- Retourne kind/order_id/telegram_id si le paiement vient de passer en "paid", sinon aucune ligne.
create or replace function public.confirm_payment(_payment_id text, _amount integer)
returns table (kind text, order_id uuid, telegram_id bigint, amount integer)
language plpgsql security definer set search_path = '' as $$
declare _p public.payments%rowtype;
begin
  select * into _p from public.payments where id = _payment_id for update;
  if not found or _p.status = 'paid' then return; end if;
  if _p.amount <> _amount then raise exception 'montant différent'; end if;
  update public.payments set status = 'paid', paid_at = now() where id = _payment_id;
  if _p.kind = 'topup' then
    perform public.wallet_apply(_p.telegram_id, _p.amount, 'topup', _p.id);
  else
    update public.orders set status = 'paid', paid_at = now(), pay_method = 'flashpay'
      where id = _p.order_id and status in ('pending', 'expired', 'cancelled');
  end if;
  return query select _p.kind, _p.order_id, _p.telegram_id, _p.amount;
end $$;

-- Réserve la livraison d'une commande payée : un seul exécutant à la fois.
-- _from : états de départ autorisés (none pour une première livraison, failed pour une relance admin).
create or replace function public.claim_delivery(_order_id uuid, _from text[])
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.orders set delivery_status = 'processing', delivery_error = null, delivery_claimed_at = now()
    where id = _order_id and status = 'paid' and delivery_status = any(_from);
  return found;
end $$;

-- Prend des éléments du stock manuel (verrou par ligne, sans double attribution).
-- Tout ou rien : retourne les contenus seulement si la quantité complète est disponible.
create or replace function public.take_manual_stock(_order_id uuid, _product_id bigint, _quantity integer)
returns setof text language plpgsql security definer set search_path = '' as $$
declare _ids bigint[];
begin
  select array_agg(id) into _ids from (
    select id from public.stock_items
      where product_id = _product_id and status = 'available'
      order by id limit _quantity for update skip locked
  ) s;
  if coalesce(array_length(_ids, 1), 0) < _quantity then return; end if;
  return query
    update public.stock_items set status = 'delivered', order_id = _order_id
      where id = any(_ids) returning content;
end $$;

-- Enregistre la livraison (contenus + statut) en une transaction ; ignore une commande déjà livrée.
create or replace function public.record_delivery(_order_id uuid, _contents text[], _supplier_order_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.orders where id = _order_id and delivery_status <> 'delivered' for update;
  if not found then return false; end if;
  insert into public.deliveries (order_id, content) select _order_id, c from unnest(_contents) c;
  update public.orders set delivery_status = 'delivered', delivered_at = now(), delivery_error = null,
    supplier_order_id = coalesce(_supplier_order_id, supplier_order_id)
    where id = _order_id;
  return true;
end $$;

-- Rembourse une commande payée sur le solde du client (admin). Idempotent.
create or replace function public.refund_order_to_balance(_order_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare _o public.orders%rowtype; _balance integer;
begin
  select * into _o from public.orders where id = _order_id for update;
  if not found or _o.status <> 'paid' or _o.delivery_status = 'delivered' then return null; end if;
  _balance := public.wallet_apply(_o.telegram_id, _o.amount, 'refund', _o.id::text);
  update public.orders set status = 'refunded' where id = _order_id;
  return _balance;
end $$;

-- Stock disponible par produit (stock manuel + fournisseur) pour l'affichage.
create or replace view public.product_availability with (security_invoker = true) as
select p.id,
  (select count(*) from public.stock_items s where s.product_id = p.id and s.status = 'available')::integer as manual_stock,
  p.supplier_stock
from public.products p;

revoke all on function public.wallet_apply(bigint, integer, text, text) from public, anon, authenticated;
revoke all on function public.pay_order_with_balance(uuid) from public, anon, authenticated;
revoke all on function public.confirm_payment(text, integer) from public, anon, authenticated;
revoke all on function public.claim_delivery(uuid, text[]) from public, anon, authenticated;
revoke all on function public.take_manual_stock(uuid, bigint, integer) from public, anon, authenticated;
revoke all on function public.record_delivery(uuid, text[], text) from public, anon, authenticated;
revoke all on function public.refund_order_to_balance(uuid) from public, anon, authenticated;
revoke all on public.product_availability from anon, authenticated;
