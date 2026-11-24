-- Offres identiques chez plusieurs fournisseurs : une seule visible par groupe.
-- Règle : la moins chère parmi celles en stock ; si aucune n'est en stock, la moins chère.
-- Recalculé chaque heure après la synchronisation (le stock fournisseur change).
-- Pour sortir un produit d'un groupe : update products set dup_group = null where id = …;
alter table public.products add column if not exists dup_group text;

create or replace function public.apply_duplicate_groups()
returns integer language plpgsql security definer set search_path = '' as $$
declare _changed integer;
begin
  with ranked as (
    select p.id,
      row_number() over (
        partition by p.dup_group
        order by
          ((p.supplier_available and p.supplier_stock > 0)
            or exists (select 1 from public.stock_items s where s.product_id = p.id and s.status = 'available')) desc,
          p.price asc,
          (p.supplier_id = 'primelabs') desc,  -- à prix égal : fournisseur avec clé d'idempotence
          p.id
      ) as rk
    from public.products p
    where p.dup_group is not null
  )
  update public.products p set is_active = (r.rk = 1)
  from ranked r
  where p.id = r.id and p.is_active is distinct from (r.rk = 1);
  get diagnostics _changed = row_count;
  return _changed;
end $$;
revoke all on function public.apply_duplicate_groups() from public, anon, authenticated;

select cron.schedule('bot-duplicates', '12 * * * *', $$ select public.apply_duplicate_groups() $$);
