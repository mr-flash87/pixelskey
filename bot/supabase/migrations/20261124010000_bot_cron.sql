-- Tâches planifiées du bot : rattrapage toutes les 5 minutes, synchronisation des catalogues toutes les heures.
-- Le jeton est généré ici et lu à la fois par pg_cron et par la fonction bot-cron (settings.cron_token) :
-- personne n'a besoin de le recopier. L'URL des fonctions est lue dans settings.functions_url.
create extension if not exists pg_cron;
create extension if not exists pg_net;

insert into public.settings (key, value)
values ('cron_token', to_jsonb(encode(extensions.gen_random_bytes(32), 'hex')))
on conflict (key) do nothing;

-- À adapter si le projet change : https://<ref>.supabase.co/functions/v1
insert into public.settings (key, value)
values ('functions_url', to_jsonb('https://eneyqjnjpxvxagjaopfe.supabase.co/functions/v1'::text))
on conflict (key) do nothing;

-- Appelle bot-cron avec une action ; utilisable aussi à la main : select public.bot_cron_call('setup');
create or replace function public.bot_cron_call(_action text)
returns bigint language sql security definer set search_path = '' as $$
  select net.http_post(
    url := (select value #>> '{}' from public.settings where key = 'functions_url') || '/bot-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select value #>> '{}' from public.settings where key = 'cron_token')),
    body := jsonb_build_object('action', _action),
    timeout_milliseconds := 120000);
$$;
revoke all on function public.bot_cron_call(text) from public, anon, authenticated;

select cron.schedule('bot-tick', '*/5 * * * *', $$ select public.bot_cron_call('tick') $$);
select cron.schedule('bot-sync', '7 * * * *', $$ select public.bot_cron_call('sync') $$);
