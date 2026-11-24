-- Tests des fonctions atomiques. À lancer sur une base vierge après la migration :
--   psql -v ON_ERROR_STOP=1 -f supabase/migrations/*.sql -f tests/sql_test.sql
do $$
declare
  _order uuid; _order2 uuid; _bal integer; _n integer; _ok boolean; _txt text[];
begin
  insert into public.bot_users (telegram_id) values (1), (2);
  update public.bot_users set referrer_id = 1 where telegram_id = 2;
  insert into public.products (supplier_id, name, price, is_active) values ('manual', 'Netflix', 3000, true);

  -- Recharge confirmée deux fois → créditée une seule fois.
  insert into public.payments (id, kind, telegram_id, amount) values ('PAY-T1', 'topup', 2, 5000);
  select count(*) into _n from public.confirm_payment('PAY-T1', 5000);
  assert _n = 1, 'première confirmation attendue';
  select count(*) into _n from public.confirm_payment('PAY-T1', 5000);
  assert _n = 0, 'seconde confirmation ignorée';
  select balance into _bal from public.bot_users where telegram_id = 2;
  assert _bal = 5000, 'solde crédité une fois : ' || _bal;

  -- Montant différent → refusé.
  insert into public.payments (id, kind, telegram_id, amount) values ('PAY-T2', 'topup', 2, 1000);
  begin
    perform public.confirm_payment('PAY-T2', 999);
    assert false, 'montant différent accepté';
  exception when others then assert sqlerrm like '%montant%', sqlerrm; end;

  -- Achat avec le solde : débit atomique, pas de double paiement.
  insert into public.orders (telegram_id, product_id, product_name, unit_price, amount, pay_method)
    values (2, 1, 'Netflix', 3000, 3000, 'balance') returning id into _order;
  assert public.pay_order_with_balance(_order), 'paiement par solde';
  assert not public.pay_order_with_balance(_order), 'double paiement refusé';
  select balance into _bal from public.bot_users where telegram_id = 2;
  assert _bal = 2000, 'solde après achat : ' || _bal;

  -- Solde insuffisant → exception, commande toujours en attente.
  insert into public.orders (telegram_id, product_id, product_name, unit_price, amount, pay_method)
    values (2, 1, 'Netflix', 3000, 3000, 'balance') returning id into _order2;
  begin
    perform public.pay_order_with_balance(_order2);
    assert false, 'solde négatif accepté';
  exception when others then assert sqlerrm like '%insuffisant%', sqlerrm; end;
  assert (select status from public.orders where id = _order2) = 'pending', 'commande restée en attente';

  -- Bonus parrainage une seule fois par filleul.
  assert public.wallet_apply(1, 150, 'referral_bonus', '2') = 150, 'bonus versé';
  assert public.wallet_apply(1, 150, 'referral_bonus', '2') is null, 'bonus non dupliqué';

  -- Livraison réservée une seule fois.
  assert public.claim_delivery(_order, array['none']), 'réservation';
  assert not public.claim_delivery(_order, array['none']), 'seconde réservation refusée';
  assert not public.claim_delivery(_order2, array['none']), 'commande non payée non livrable';

  -- Stock manuel tout-ou-rien, jamais attribué deux fois.
  insert into public.stock_items (product_id, content) values (1, 'cle-A');
  select array_agg(x) into _txt from public.take_manual_stock(_order, 1, 2) x;
  assert _txt is null, 'stock insuffisant : rien pris';
  assert (select count(*) from public.stock_items where status = 'available') = 1, 'stock intact';
  select array_agg(x) into _txt from public.take_manual_stock(_order, 1, 1) x;
  assert _txt = array['cle-A'], 'clé attribuée';
  select array_agg(x) into _txt from public.take_manual_stock(_order, 1, 1) x;
  assert _txt is null, 'clé jamais réattribuée';

  -- Enregistrement de livraison idempotent.
  assert public.record_delivery(_order, array['cle-A'], null), 'livraison enregistrée';
  assert not public.record_delivery(_order, array['cle-A'], null), 'pas de doublon';
  assert (select count(*) from public.deliveries where order_id = _order) = 1, 'un seul contenu';

  -- Remboursement : impossible si livrée, une seule fois sinon.
  assert public.refund_order_to_balance(_order) is null, 'commande livrée non remboursable';
  update public.orders set status = 'paid', paid_at = now() where id = _order2;
  assert public.refund_order_to_balance(_order2) = 5000, 'remboursée';
  assert public.refund_order_to_balance(_order2) is null, 'remboursement unique';

  -- Paiement de commande validé en retard (expiré côté FlashPay puis validé par l'admin).
  update public.orders set status = 'expired' where id = _order2;
  insert into public.orders (telegram_id, product_id, product_name, unit_price, amount, pay_method, status)
    values (1, 1, 'Netflix', 3000, 3000, 'flashpay', 'expired') returning id into _order;
  insert into public.payments (id, kind, order_id, telegram_id, amount, status) values ('PAY-O1', 'order', _order, 1, 3000, 'expired');
  select count(*) into _n from public.confirm_payment('PAY-O1', 3000);
  assert _n = 1 and (select status from public.orders where id = _order) = 'paid', 'paiement tardif accepté';

  -- Les rôles publics n'ont aucun accès.
  assert not has_function_privilege('anon', 'public.wallet_apply(bigint, integer, text, text)', 'execute'), 'anon ne peut pas créditer';
  assert not has_function_privilege('authenticated', 'public.confirm_payment(text, integer)', 'execute'), 'authenticated ne peut pas confirmer';

  raise notice 'SQL_TESTS_OK';
end $$;
