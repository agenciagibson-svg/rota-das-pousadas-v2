-- =============================================================================
-- 0095 — Mapa na busca e na página da pousada (item h8).
--
-- Até aqui a localização da pousada era só texto (endereço, cidade, CEP) e o
-- botão "Ver no mapa" buscava esse texto no Google. Para desenhar o alfinete
-- no mapa (página pública e busca `/pousadas`) a pousada passa a guardar o
-- ponto marcado pelo dono no painel.
--
-- 1. Colunas `latitude`/`longitude` (graus decimais, WGS 84), nulas até o
--    dono marcar. Checagens no banco, não só na Server Action — o painel usa
--    a chave pública do Supabase, então quem chamar a API REST direto também
--    passa por elas:
--      - as duas juntas ou nenhuma;
--      - dentro da caixa do Brasil com folga (mesma caixa de
--        `lib/geo/coordinates.ts::BRAZIL_BOUNDS`; o teste
--        `coordinates.test.ts` confere que as duas não se separam).
--        `numeric` aceita 'NaN', mas NaN é maior que qualquer número no
--        Postgres, então o `between` já o recusa.
-- 2. Leitura: entram na lista de colunas públicas de `pousadas` (0084). A
--    RLS `pousadas_public_read` (0002) segue valendo: fora da equipe da
--    pousada e da plataforma, só aparecem linhas de pousadas PUBLICADAS.
-- 3. Escrita: o mesmo caminho das Configurações. A RLS `pousadas_update`
--    (0051) deixa proprietário/gestor da própria pousada e a equipe
--    comercial/master atualizarem a linha; a guarda de colunas
--    `guard_pousada_owner_changes` (0065/0077/0078) só deixa o dono mexer nas
--    colunas da lista — as duas novas entram nela (cópia da 0078, só a lista
--    mudou). Recepção, governança, financeiro e viajantes continuam sem
--    UPDATE na linha (RLS).
-- 4. Busca: `search_public_pousadas` devolve as coordenadas de cada item para
--    o mapa da busca. O retorno continua `jsonb` (mesma assinatura), então
--    `create or replace` basta — não há assinatura antiga para remover.
--    Cópia da 0087 com as duas colunas a mais no `select`.
--
-- Nada aqui apaga dado. Reversão: `supabase/rollback/0095_rollback.sql`.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Colunas e checagens
-- ---------------------------------------------------------------------------
alter table pousadas add column if not exists latitude numeric(9,6);
alter table pousadas add column if not exists longitude numeric(9,6);

alter table pousadas drop constraint if exists pousadas_coordenadas_par;
alter table pousadas add constraint pousadas_coordenadas_par
  check ((latitude is null) = (longitude is null));

alter table pousadas drop constraint if exists pousadas_coordenadas_brasil;
alter table pousadas add constraint pousadas_coordenadas_brasil
  check (
    latitude is null
    or (latitude between -35.5 and 7 and longitude between -75.5 and -27.5)
  );

comment on column pousadas.latitude is
  'Latitude do ponto marcado pelo dono no painel (graus decimais, WGS 84). Nula = sem mapa. Ver 0095.';
comment on column pousadas.longitude is
  'Longitude do ponto marcado pelo dono no painel (graus decimais, WGS 84). Nula = sem mapa. Ver 0095.';

-- ---------------------------------------------------------------------------
-- 2. Leitura pública (colunas de vitrine, 0084)
-- ---------------------------------------------------------------------------
grant select (latitude, longitude) on public.pousadas to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Guarda de colunas: dono/gestor podem marcar o ponto
-- ---------------------------------------------------------------------------
create or replace function guard_pousada_owner_changes()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c_owner_editable constant text[] := array[
    'name', 'legal_name', 'tax_id', 'city', 'state', 'country', 'address', 'cep', 'image',
    'gallery',
    'description', 'tags', 'timezone', 'currency', 'language', 'checkin_time', 'checkout_time',
    'contact_phone', 'whatsapp', 'notification_email', 'house_rules', 'cancellation_policy',
    -- 0095: ponto no mapa, marcado em Configurações.
    'latitude', 'longitude',
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

-- ---------------------------------------------------------------------------
-- 4. Busca pública com coordenadas (cópia da 0087 + latitude/longitude)
-- ---------------------------------------------------------------------------
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
      p.tags, p.description, p.instagram,
      p.latitude, p.longitude
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
