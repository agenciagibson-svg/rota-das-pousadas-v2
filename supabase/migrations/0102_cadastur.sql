-- =============================================================================
-- 0102 — Cadastur da pousada (número e validade) e selo na página pública.
--
-- O Cadastur (Ministério do Turismo, Lei 11.771/2008) é obrigatório para meios
-- de hospedagem e vale por dois anos. A pousada informa o número e, se quiser,
-- a validade do certificado em Configurações; a página mostra o selo
-- "Cadastrada no Ministério do Turismo" enquanto não vence.
--
-- 1. Colunas `cadastur` (texto, '' = não informado) e `cadastur_valid_until`.
--    O formato muda entre PF, MEI e empresa: o banco só confere os caracteres
--    e a quantidade de dígitos (8 a 20), igual a lib/cadastur.ts.
-- 2. Leitura pública das duas colunas (vitrine, 0084).
-- 3. Guarda de colunas (0065/0095): dono/gestor podem editar as duas.
-- 4. get_demo_pousada (0101): devolve as duas colunas.
--
-- Rollback: supabase/rollback/0102_rollback.sql
-- =============================================================================

alter table pousadas
  add column cadastur text not null default '',
  add column cadastur_valid_until date;

alter table pousadas
  add constraint pousadas_cadastur_formato check (
    cadastur = ''
    or (
      cadastur ~ '^[0-9./ -]+$'
      and char_length(regexp_replace(cadastur, '[^0-9]', '', 'g')) between 8 and 20
    )
  ),
  add constraint pousadas_cadastur_validade_sem_numero check (
    cadastur_valid_until is null or cadastur <> ''
  );

comment on column pousadas.cadastur is
  'Número do Cadastur como no certificado. Vazio = não informado. Ver 0102.';
comment on column pousadas.cadastur_valid_until is
  'Fim da validade do certificado Cadastur (opcional). Vencido some o selo. Ver 0102.';

-- ---------------------------------------------------------------------------
-- 2. Leitura pública (colunas de vitrine, 0084)
-- ---------------------------------------------------------------------------
grant select (cadastur, cadastur_valid_until) on public.pousadas to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Guarda de colunas: dono/gestor podem informar o Cadastur
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
    -- 0102: Cadastur, informado em Configurações.
    'cadastur', 'cadastur_valid_until',
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
-- 4. Página de demonstração (0101) com o Cadastur
-- ---------------------------------------------------------------------------
create or replace function get_demo_pousada(p_token text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_pousada_id uuid;
  v_status pousada_status;
  v_slug text;
  v_pousada jsonb;
  v_rooms jsonb;
begin
  -- Formato inválido nem chega a consultar (e responde igual a "não existe").
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{40,64}$' then return null; end if;

  select l.pousada_id, p.status, p.slug into v_pousada_id, v_status, v_slug
  from pousada_demo_links l join pousadas p on p.id = l.pousada_id
  where l.token = p_token and l.revoked_at is null;
  if v_pousada_id is null or v_status = 'arquivada' then return null; end if;

  -- Já virou cliente: a página manda para o endereço de verdade.
  if v_status = 'publicada' then
    return jsonb_build_object('published', true, 'slug', v_slug);
  end if;

  -- No máximo uma abertura por minuto: a prévia do WhatsApp e o clique logo
  -- depois contam uma vez só, e recarregar a página não infla o número.
  update pousada_demo_links
     set views = views + 1,
         first_viewed_at = coalesce(first_viewed_at, now()),
         last_viewed_at = now()
   where pousada_id = v_pousada_id
     and (last_viewed_at is null or last_viewed_at < now() - interval '1 minute');

  -- As colunas da vitrine, uma a uma (as mesmas de PUBLIC_POUSADA_COLUMNS):
  -- nunca `to_jsonb(p)`, que levaria junto qualquer coluna sensível futura.
  select to_jsonb(x) into v_pousada from (
    select p.id, p.slug, p.name, p.city, p.state, p.destination_id, p.image, p.gallery,
           p.rating, p.reviews, p.price_per_night, p.tags, p.description, p.status,
           p.created_at, p.updated_at, p.checkin_time, p.checkout_time, p.contact_phone,
           p.house_rules, p.cancellation_policy, p.tenant_status, p.whatsapp, p.address,
           p.country, p.timezone, p.currency, p.language, p.instagram, p.cep,
           p.latitude, p.longitude, p.cadastur, p.cadastur_valid_until
    from pousadas p where p.id = v_pousada_id
  ) x;

  -- Acomodações como a página pública mostra (mesmos filtros de
  -- bookable_rooms_core, 0087), sem disponibilidade nem cotação.
  select coalesce(jsonb_agg(to_jsonb(r) order by r.base_price, r.id), '[]'::jsonb) into v_rooms
  from (
    select r.id, r.name, r.description,
           coalesce(nullif(r.base_price, 0), p.price_per_night) as base_price,
           coalesce(r.capacity_max, r.capacity) as capacity,
           r.gallery
    from rooms r join pousadas p on p.id = r.pousada_id
    left join accommodation_categories c on c.id = r.category_id
    where r.pousada_id = v_pousada_id
      and r.status = 'active' and r.public_visible
      and (r.category_id is null or c.status = 'active')
  ) r;

  return jsonb_build_object('published', false, 'pousada', v_pousada, 'rooms', v_rooms);
end;
$$;
revoke all on function get_demo_pousada(text) from public;
grant execute on function get_demo_pousada(text) to anon, authenticated;
