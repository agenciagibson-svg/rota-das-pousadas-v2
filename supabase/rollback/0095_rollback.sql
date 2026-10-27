-- Desfaz 0095 (mapa da pousada). Volta as duas funções para a versão da
-- 0078 (guarda) e da 0087 (busca) e remove as colunas. Os pontos marcados
-- pelos donos se perdem — exporte antes, se quiser guardar:
--   select id, slug, latitude, longitude from pousadas where latitude is not null;

-- Busca pública sem coordenadas (versão da 0087).
CREATE OR REPLACE FUNCTION public.search_public_pousadas(p_search text DEFAULT ''::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 24, p_checkin date DEFAULT NULL::date, p_checkout date DEFAULT NULL::date, p_guests integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_result jsonb;
begin
  if p_page is null or p_page < 1 or p_page > 1000000
    or p_page_size is null or p_page_size < 1 or p_page_size > 100
    or (p_guests is not null and (p_guests < 1 or p_guests > 100))
    or (p_checkin is null) <> (p_checkout is null) or p_checkout <= p_checkin
    or p_checkout - p_checkin > public_stay_max_nights()
    or length(coalesce(p_search, '')) > 200 then
    raise exception 'Filtros de busca inválidos.';
  end if;
  with matched as (
    select p.slug, p.name, p.city, p.state, p.image, p.rating, p.reviews,
      coalesce(offer.base_price, p.price_per_night) as price_per_night,
      p.tags, p.description, p.instagram
    from pousadas p
    left join lateral (
      select r.base_price from bookable_rooms_core(p.slug, p_checkin, p_checkout, coalesce(p_guests, 1)) r
      where p_checkin is not null or p_guests is not null limit 1
    ) offer on true
    where p.status = 'publicada' and p.tenant_status in ('onboarding', 'active')
      and strpos(catalog_search_text(concat_ws(' ', p.name, p.city, p.state, p.description, array_to_string(p.tags, ' '))),
        catalog_search_text(coalesce(p_search, ''))) > 0
      and (p_checkin is null and p_guests is null or offer.base_price is not null)
  ), paged as (
    select * from matched order by slug limit p_page_size offset (p_page - 1) * p_page_size
  )
  select jsonb_build_object('items', coalesce((select jsonb_agg(to_jsonb(paged) order by slug) from paged), '[]'::jsonb),
    'total', (select count(*) from matched), 'page', p_page, 'pageSize', p_page_size,
    'totalPages', greatest(1, ceil((select count(*) from matched)::numeric / p_page_size))) into v_result;
  return v_result;
end;
$function$;

-- Guarda de colunas sem latitude/longitude (versão da 0078).
create or replace function guard_pousada_owner_changes()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c_owner_editable constant text[] := array[
    'name', 'legal_name', 'tax_id', 'city', 'state', 'country', 'address', 'cep', 'image',
    'gallery',
    'description', 'tags', 'timezone', 'currency', 'language', 'checkin_time', 'checkout_time',
    'contact_phone', 'whatsapp', 'notification_email', 'house_rules', 'cancellation_policy',
    'updated_at'
  ];
begin
  if auth.uid() is null or auth_can_manage_pousadas_platform() then
    return new;
  end if;

  -- Recalculo da nota pelo gatilho de avaliações: só rating/reviews mudam.
  -- pg_trigger_depth() > 1: só vale dentro de outro gatilho, nunca num UPDATE direto.
  if tg_op = 'UPDATE' and current_setting('app.rating_refresh', true) = '1'
     and pg_trigger_depth() > 1
     and (to_jsonb(new) - array['rating', 'reviews']) = (to_jsonb(old) - array['rating', 'reviews']) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('rascunho', 'em_analise')
       or new.rating <> 0 or new.reviews <> 0 or new.destination_id is not null then
      raise exception 'Pousada nova começa em análise, sem avaliações; a publicação é feita pela equipe da Rota.';
    end if;
    return new;
  end if;

  if (to_jsonb(new) - c_owner_editable) is distinct from (to_jsonb(old) - c_owner_editable) then
    raise exception 'Só a equipe da Rota pode alterar publicação, situação da conta, dono ou avaliações da pousada.';
  end if;
  return new;
end;
$$;

alter table pousadas drop constraint if exists pousadas_coordenadas_brasil;
alter table pousadas drop constraint if exists pousadas_coordenadas_par;
-- O grant de coluna (0095) cai junto com a coluna.
alter table pousadas drop column if exists latitude;
alter table pousadas drop column if exists longitude;
