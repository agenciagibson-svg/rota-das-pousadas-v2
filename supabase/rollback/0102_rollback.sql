-- Rollback da 0102 (Cadastur). Volta a guarda de colunas da 0095 e a página
-- de demonstração da 0101, e apaga as duas colunas (os números informados
-- pelas pousadas se perdem).
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
           p.latitude, p.longitude
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

revoke select (cadastur, cadastur_valid_until) on public.pousadas from anon, authenticated;
alter table pousadas drop constraint if exists pousadas_cadastur_validade_sem_numero;
alter table pousadas drop constraint if exists pousadas_cadastur_formato;
alter table pousadas drop column if exists cadastur_valid_until;
alter table pousadas drop column if exists cadastur;
