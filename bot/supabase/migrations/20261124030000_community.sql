-- Groupe officiel : adhésion obligatoire (cache de vérification) et annonces des nouveaux services.
alter table public.bot_users add column if not exists member_until timestamptz;
alter table public.products add column if not exists announced_at timestamptz;

-- Les services déjà publiés ne sont pas des nouveautés.
update public.products set announced_at = now() where is_active and announced_at is null;

-- Nouveaux services à annoncer : publiés, en stock, jamais annoncés,
-- et dont aucune offre équivalente (même dup_group) n'a déjà été annoncée.
create or replace function public.pending_announcements(_limit integer)
returns table (id bigint, name text, price integer, category text, instant boolean)
language sql security definer set search_path = '' as $$
  select p.id, p.name, p.price, p.category, p.instant
  from public.products p
  where p.is_active and p.announced_at is null
    and ((p.supplier_available and p.supplier_stock > 0)
      or exists (select 1 from public.stock_items s where s.product_id = p.id and s.status = 'available'))
    and (p.dup_group is null or not exists (
      select 1 from public.products q where q.dup_group = p.dup_group and q.announced_at is not null))
  order by p.created_at, p.id
  limit _limit;
$$;

-- Marque le service (et ses équivalents) comme annoncé.
create or replace function public.mark_announced(_product_id bigint)
returns void language sql security definer set search_path = '' as $$
  update public.products set announced_at = now()
  where announced_at is null and (id = _product_id or dup_group = (select dup_group from public.products where id = _product_id));
$$;

revoke all on function public.pending_announcements(integer) from public, anon, authenticated;
revoke all on function public.mark_announced(bigint) from public, anon, authenticated;

-- Nouvelles offres automatiques publiées d'office.
update public.suppliers set auto_publish = true where id in ('digitrust', 'primelabs');
