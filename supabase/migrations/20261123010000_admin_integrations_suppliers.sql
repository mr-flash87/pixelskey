-- Clés d'intégration (Brevo, IA, Prime Labs, Digitrust…) saisies depuis l'admin.
-- Valeurs chiffrées (AES-GCM) par les fonctions serveur ; aucune lecture possible côté navigateur.
create table if not exists public.app_secrets (
  name text primary key,
  ciphertext text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;

-- Fournisseurs : autant que voulu. Les fournisseurs « manual » n'ont pas d'API
-- (commande à la main, puis ajout des clés en stock) ; « primestore » et « digitrust »
-- sont reliés à leur API (un compte par type).
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  kind text not null default 'manual' check (kind in ('manual', 'primestore', 'digitrust')),
  website text,
  contact_email text,
  contact_phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists suppliers_one_api_account on public.suppliers (kind) where kind <> 'manual';
alter table public.suppliers enable row level security;

drop policy if exists "Admins read suppliers" on public.suppliers;
create policy "Admins read suppliers" on public.suppliers
  for select to authenticated using (public.is_admin(auth.uid()));
drop policy if exists "Managers manage suppliers" on public.suppliers;
create policy "Managers manage suppliers" on public.suppliers
  for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'manager'))
  with check (public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'manager'));

drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at before update on public.suppliers
  for each row execute function public.update_updated_at_column();

alter table public.products add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
create index if not exists idx_products_supplier on public.products(supplier_id);

insert into public.suppliers (name, kind, website) values
  ('Prime Labs', 'primestore', 'https://pirmestore.mylabsstore.com'),
  ('Digitrust', 'digitrust', null)
on conflict do nothing;
