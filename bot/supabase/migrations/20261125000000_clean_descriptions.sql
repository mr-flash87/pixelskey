-- Les fournisseurs envoient parfois des descriptions avec du HTML Telegram (<b>, <tg-emoji …>, <blockquote>…),
-- qui s'afficherait tel quel dans le bot. Nettoyage automatique à chaque import ou modification.
create or replace function public.clean_product_description()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.description is not null then
    new.description := regexp_replace(new.description, '<br\s*/?>', E'\n', 'gi');
    new.description := regexp_replace(new.description, '<[^>]*>', '', 'g');
    new.description := replace(replace(replace(replace(replace(new.description,
      '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#39;', ''''), '&amp;', '&');
    new.description := regexp_replace(new.description, '[─━]{3,}', '', 'g');   -- lignes de séparation décoratives
    new.description := regexp_replace(new.description, E'[ \t]+\n', E'\n', 'g');
    new.description := regexp_replace(new.description, E'\n{3,}', E'\n\n', 'g');
    new.description := btrim(new.description, E' \n\t');
  end if;
  return new;
end $$;

drop trigger if exists products_clean_description on public.products;
create trigger products_clean_description
  before insert or update of description on public.products
  for each row execute function public.clean_product_description();

-- Nettoyage des descriptions déjà importées.
update public.products set description = description where description ~ '<[a-zA-Z/]|&[a-z#0-9]+;|[─━]{3,}';
