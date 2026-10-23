-- 0087 — Tarifas por temporada, estadia mínima e fotos por acomodação
--
-- 1. rooms.gallery: fotos da própria acomodação (até 12). Escrita pela mesma
--    policy `rooms_write` (0081: dono/gestor da pousada, comercial e master);
--    as fotos sobem no bucket `pousadas` na pasta da pousada, então a policy
--    de Storage da 0076 já restringe quem envia.
--
-- 2. rate_rules: regra de preço por período (Carnaval, Réveillon, alta
--    temporada, fim de semana) com estadia mínima opcional.
--      - período por NOITES, com as duas pontas inclusivas: first_night é a
--        primeira noite em que vale e last_night a última (uma regra de
--        "20/12 a 05/01" vale para a noite de 05/01). É o jeito como a pousada
--        pensa o período; não confundir com `bookings.checkout`, que é exclusivo.
--      - weekdays: dias da semana da NOITE (0 = domingo … 6 = sábado, como
--        `extract(dow)`); nulo = todos. Fim de semana = {5,6} (sexta e sábado).
--      - kind 'fixed': a diária passa a ser `value` (reais inteiros, mesma
--        convenção de rooms.base_price e bookings.total);
--        kind 'percent': base × (1 + value/100), arredondado para reais.
--      - room_id nulo = vale para todas as acomodações da pousada.
--    Quando mais de uma regra cobre a mesma noite, vence a mais específica:
--    a da acomodação antes da geral, depois a de período mais curto, depois a
--    que limita dia da semana, depois a mais recente. Uma regra só.
--    Estadia mínima: a maior entre as regras que cobrem QUALQUER noite da
--    estadia (chegar um dia antes do Carnaval não fura o mínimo do Carnaval).
--
-- 3. room_stay_quote(): preço autoritativo da estadia (soma noite a noite).
--    list_bookable_rooms passa a devolver stay_total, min_nights e gallery;
--    create_booking (fluxo público) cobra stay_total e recusa estadia abaixo
--    do mínimo. O fluxo da equipe (balcão) continua com o valor digitado.
--
-- Rollback: supabase/rollback/0087_rollback.sql

-- ---------------------------------------------------------------------------
-- 1. Fotos por acomodação
-- ---------------------------------------------------------------------------
alter table rooms add column if not exists gallery text[] not null default '{}';
alter table rooms drop constraint if exists rooms_gallery_max;
alter table rooms add constraint rooms_gallery_max
  check (coalesce(array_length(gallery, 1), 0) <= 12);

-- ---------------------------------------------------------------------------
-- 2. Regras de tarifa
-- ---------------------------------------------------------------------------
create table if not exists rate_rules (
  id          uuid primary key default gen_random_uuid(),
  pousada_id  uuid not null references pousadas(id) on delete cascade,
  room_id     uuid references rooms(id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 2 and 80),
  first_night date not null,
  last_night  date not null,
  weekdays    smallint[] check (
    weekdays is null
    or (coalesce(array_length(weekdays, 1), 0) between 1 and 7
        and weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])
  ),
  kind        text not null check (kind in ('fixed', 'percent')),
  value       numeric(10, 2) not null,
  min_nights  smallint check (min_nights is null or min_nights between 1 and 30),
  active      boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint rate_rules_period check (last_night >= first_night and last_night - first_night <= 400),
  constraint rate_rules_value check (
    (kind = 'fixed' and value >= 0 and value <= 100000 and value = round(value))
    or (kind = 'percent' and value >= -90 and value <= 300)
  )
);
create index if not exists idx_rate_rules_pousada on rate_rules(pousada_id, first_night, last_night);
create index if not exists idx_rate_rules_room on rate_rules(room_id) where room_id is not null;

-- A acomodação da regra precisa ser da mesma pousada (FK sozinha não garante).
create or replace function guard_rate_rule_room()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.room_id is not null and not exists (
    select 1 from rooms r where r.id = new.room_id and r.pousada_id = new.pousada_id
  ) then
    raise exception 'A acomodação escolhida não é desta pousada.';
  end if;
  if tg_op = 'UPDATE' and new.pousada_id is distinct from old.pousada_id then
    raise exception 'A regra não pode mudar de pousada.';
  end if;
  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_by := auth.uid(); end if;
  return new;
end;
$$;
revoke execute on function guard_rate_rule_room() from public, anon, authenticated;

drop trigger if exists trg_guard_rate_rule_room on rate_rules;
create trigger trg_guard_rate_rule_room
  before insert or update on rate_rules
  for each row execute function guard_rate_rule_room();

create or replace function audit_rate_rule()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'rate_rule.delete', 'rate_rules', old.id,
            jsonb_build_object('pousadaId', old.pousada_id));
    return old;
  end if;
  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'rate_rule.' || lower(tg_op), 'rate_rules', new.id,
          jsonb_build_object('pousadaId', new.pousada_id));
  return new;
end;
$$;
revoke execute on function audit_rate_rule() from public, anon, authenticated;

drop trigger if exists trg_audit_rate_rule on rate_rules;
create trigger trg_audit_rate_rule
  after insert or update or delete on rate_rules
  for each row execute function audit_rate_rule();

alter table rate_rules enable row level security;

-- Leitura: quem gerencia a pousada e a recepção (que lança reserva no balcão
-- e precisa saber o preço da data). Público nunca lê a tabela; o preço chega
-- pronto por list_bookable_rooms.
drop policy if exists "rate_rules_read" on rate_rules;
create policy "rate_rules_read" on rate_rules for select
  using (auth_can_manage_pousada(pousada_id) or auth_has_guest_access(pousada_id)
         or auth_can_manage_pousadas_platform());

-- Escrita: mesmo grupo que edita acomodações e preços (rooms_write, 0081).
drop policy if exists "rate_rules_write" on rate_rules;
create policy "rate_rules_write" on rate_rules for all
  using (auth_can_manage_pousada(pousada_id) or auth_can_manage_pousadas_platform())
  with check (auth_can_manage_pousada(pousada_id) or auth_can_manage_pousadas_platform());

revoke all on rate_rules from anon;
grant select, insert, update, delete on rate_rules to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Preço noite a noite e cotação da estadia
-- ---------------------------------------------------------------------------
create or replace function room_night_price(p_room_id uuid, p_night date)
returns integer
language sql stable security definer set search_path = public as $$
  with base as (
    select r.id, r.pousada_id, coalesce(nullif(r.base_price, 0), p.price_per_night) as price
    from rooms r join pousadas p on p.id = r.pousada_id
    where r.id = p_room_id
  ), winner as (
    select rr.kind, rr.value
    from rate_rules rr, base b
    where rr.pousada_id = b.pousada_id
      and rr.active
      and (rr.room_id is null or rr.room_id = b.id)
      and p_night between rr.first_night and rr.last_night
      and (rr.weekdays is null or extract(dow from p_night)::smallint = any(rr.weekdays))
    order by (rr.room_id is not null) desc,
             (rr.last_night - rr.first_night) asc,
             (rr.weekdays is not null) desc,
             rr.created_at desc, rr.id
    limit 1
  )
  select case
    when w.kind = 'fixed' then w.value::integer
    when w.kind = 'percent' then greatest(0, round(b.price * (1 + w.value / 100.0))::integer)
    else b.price
  end
  from base b left join winner w on true;
$$;
revoke all on function room_night_price(uuid, date) from public, anon, authenticated;

create or replace function room_stay_quote(p_room_id uuid, p_checkin date, p_checkout date)
returns table(total integer, nights integer, min_nights integer)
language sql stable security definer set search_path = public as $$
  -- Uma consulta só: as regras que tocam a estadia são lidas uma vez e cada
  -- noite escolhe a vencedora entre elas (mesma ordem de room_night_price).
  with r as (
    select r.id, r.pousada_id, coalesce(nullif(r.base_price, 0), p.price_per_night) as price
    from rooms r join pousadas p on p.id = r.pousada_id
    where r.id = p_room_id
  ), n as (
    select d::date as night
    from generate_series(p_checkin::timestamp, (p_checkout - 1)::timestamp, interval '1 day') d
    where p_checkout > p_checkin
  ), rules as (
    select rr.* from rate_rules rr, r
    where rr.pousada_id = r.pousada_id and rr.active
      and (rr.room_id is null or rr.room_id = r.id)
      and rr.first_night <= p_checkout - 1 and rr.last_night >= p_checkin
  ), per_night as (
    select n.night, r.price as base, (
      select case when w.kind = 'fixed' then w.value::integer
                  else greatest(0, round(r.price * (1 + w.value / 100.0))::integer) end
      from rules w
      where n.night between w.first_night and w.last_night
        and (w.weekdays is null or extract(dow from n.night)::smallint = any(w.weekdays))
      order by (w.room_id is not null) desc, (w.last_night - w.first_night) asc,
               (w.weekdays is not null) desc, w.created_at desc, w.id
      limit 1
    ) as rule_price
    from n, r
  )
  select
    coalesce(sum(coalesce(rule_price, base)), 0)::integer,
    greatest(p_checkout - p_checkin, 0)::integer,
    coalesce((
      select max(w.min_nights)::integer from rules w join n
        on n.night between w.first_night and w.last_night
       and (w.weekdays is null or extract(dow from n.night)::smallint = any(w.weekdays))
    ), 1)
  from per_night;
$$;
revoke all on function room_stay_quote(uuid, date, date) from public, anon, authenticated;

-- Cotação para a equipe (nova reserva no balcão): sugere o valor das regras.
create or replace function quote_room_stay(p_room_id uuid, p_checkin date, p_checkout date)
returns table(total integer, nights integer, min_nights integer)
language plpgsql stable security definer set search_path = public as $$
declare
  v_pousada uuid;
begin
  select pousada_id into v_pousada from rooms where id = p_room_id;
  if v_pousada is null
     or not (auth_has_guest_access(v_pousada) or auth_can_manage_pousada(v_pousada)
             or auth_has_active_grant(v_pousada)) then
    raise exception 'Acomodação não encontrada.';
  end if;
  if p_checkin is null or p_checkout is null or p_checkout <= p_checkin
     or p_checkout - p_checkin > 366 then
    raise exception 'Período inválido.';
  end if;
  return query select q.total, q.nights, q.min_nights from room_stay_quote(p_room_id, p_checkin, p_checkout) q;
end;
$$;
revoke all on function quote_room_stay(uuid, date, date) from public, anon;
grant execute on function quote_room_stay(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Vitrine: núcleo sem cotação (busca) e list_bookable_rooms com cotação
-- ---------------------------------------------------------------------------
-- Estadia pública: no máximo 90 noites (vitrine, busca e reserva pelo site).
-- Limita o custo da cotação que `anon` consegue pedir pela API.
create or replace function public_stay_max_nights() returns integer
language sql immutable as $$ select 90 $$;

-- Acomodações ofertáveis, sem cotação: a busca do catálogo só precisa saber se
-- há vaga e a diária-base (0087: não cota noite a noite para cada pousada).
create or replace function bookable_rooms_core(
  p_slug text, p_checkin date, p_checkout date, p_guests integer
) returns table(id uuid, name text, description text, base_price integer, capacity integer, gallery text[])
language plpgsql stable security definer set search_path = public as $$
begin
  if p_guests is null or p_guests < 1 or p_guests > 100
    or (p_checkin is null) <> (p_checkout is null)
    or p_checkout <= p_checkin
    or p_checkout - p_checkin > public_stay_max_nights() then
    raise exception 'Filtros de disponibilidade inválidos.';
  end if;
  return query
  select r.id, r.name, r.description,
    coalesce(nullif(r.base_price, 0), p.price_per_night),
    coalesce(r.capacity_max, r.capacity),
    r.gallery
  from rooms r join pousadas p on p.id = r.pousada_id
  left join accommodation_categories c on c.id = r.category_id
  where p.slug = p_slug and p.status = 'publicada'
    and p.tenant_status in ('onboarding', 'active')
    and r.status = 'active' and r.public_visible
    and (r.category_id is null or c.status = 'active')
    and r.operational_status not in ('maintenance', 'blocked')
    and coalesce(r.capacity_max, r.capacity) >= p_guests
    and (p_checkin is null or (
      not exists (select 1 from bookings b where b.room_id = r.id
        and b.status in ('pending', 'confirmed', 'checked_in')
        -- 0070: pendência com prazo vencido não segura mais o quarto.
        and (b.status <> 'pending' or b.payment_due_at is null or b.payment_due_at > now())
        and b.checkin < p_checkout and b.checkout > p_checkin)
      and not exists (select 1 from room_blocks rb where rb.room_id = r.id
        and rb.status = 'active'
        and rb.starts_at < (p_checkout::timestamp at time zone 'UTC')
        and rb.ends_at > (p_checkin::timestamp at time zone 'UTC'))
      and not exists (select 1 from channel_events ce where ce.room_id = r.id
        and ce.starts_on < p_checkout and ce.ends_on > p_checkin)
    ))
  order by 4, r.id;
end;
$$;
revoke all on function bookable_rooms_core(text, date, date, integer) from public, anon, authenticated;

drop function if exists list_bookable_rooms(text, date, date, integer);
create function list_bookable_rooms(
  p_slug text, p_checkin date default null, p_checkout date default null,
  p_guests integer default 1
) returns table(
  id uuid, name text, description text, base_price integer, capacity integer,
  stay_total integer, min_nights integer, gallery text[]
)
language sql stable security definer set search_path = public as $$
  -- Com datas, a mais barata é a de menor total da estadia (a temporada pode
  -- inverter a ordem das diárias-base); sem datas, pela diária-base.
  select c.id, c.name, c.description, c.base_price, c.capacity,
         q.total, coalesce(q.min_nights, 1), c.gallery
  from bookable_rooms_core(p_slug, p_checkin, p_checkout, p_guests) c
  left join lateral (
    select sq.total, sq.min_nights from room_stay_quote(c.id, p_checkin, p_checkout) sq
    where p_checkin is not null
  ) q on true
  order by coalesce(q.total, c.base_price), c.id;
$$;
revoke all on function list_bookable_rooms(text, date, date, integer) from public;
grant execute on function list_bookable_rooms(text, date, date, integer) to anon, authenticated;

-- A busca do catálogo usa o núcleo sem cotação (cópia da 0041 com essa troca).
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

-- ---------------------------------------------------------------------------
-- 5. create_booking: no fluxo público, preço = room_stay_quote e mínimo de noites
--    (cópia da 0084; só o bloco "Preço autoritativo" mudou)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_booking(p_pousada_id uuid, p_room_id uuid, p_responsible_guest_id uuid, p_code text, p_checkin date, p_checkout date, p_adults integer, p_children integer, p_infants integer, p_pets boolean, p_subtotal integer, p_fee integer, p_discount integer, p_surcharge integer, p_services_amount integer, p_total integer, p_status booking_status, p_origin booking_origin DEFAULT 'rota_das_pousadas'::booking_origin, p_traveler_user_id uuid DEFAULT NULL::uuid, p_external_channel_name text DEFAULT NULL::text, p_external_code text DEFAULT NULL::text, p_expected_commission numeric DEFAULT NULL::numeric, p_expected_arrival_time text DEFAULT NULL::text, p_special_requests text DEFAULT ''::text, p_internal_notes text DEFAULT ''::text, p_payment_due_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_is_staff boolean;
  v_guest record;
  v_id uuid;
  v_stale record;
  v_quote record;
  v_subtotal integer;
  v_open_pending integer;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if p_checkout <= p_checkin then raise exception 'A data de saída deve ser posterior à de entrada.'; end if;

  v_is_staff := auth_has_guest_access(p_pousada_id) or auth_has_active_grant(p_pousada_id);

  -- 0084: no fluxo da equipe (balcão/painel) a reserva nunca é vinculada à
  -- conta de outra pessoa.
  if v_is_staff and p_traveler_user_id is not null and p_traveler_user_id <> auth.uid() then
    raise exception 'A reserva da equipe não pode ser vinculada à conta de outro usuário.';
  end if;

  if not v_is_staff then
    -- Fluxo público: só o próprio viajante autenticado, só como pending,
    -- só para uma pousada realmente publicada.
    if p_traveler_user_id is distinct from auth.uid() then
      raise exception 'Você não tem permissão para criar esta reserva.';
    end if;
    if p_status <> 'pending' then
      raise exception 'Reservas públicas só podem ser criadas como pendentes de pagamento.';
    end if;
    if p_checkin < pousada_local_date(p_pousada_id) then
      raise exception 'A data de entrada não pode ser no passado.';
    end if;
    if p_checkout - p_checkin > public_stay_max_nights() then
      raise exception 'Pelo site, a reserva pode ter até % noites. Fale com a pousada para estadias maiores.',
        public_stay_max_nights();
    end if;
    if not exists (
      select 1 from pousadas p where p.id = p_pousada_id
        and p.status = 'publicada' and p.tenant_status in ('onboarding', 'active')
    ) then
      raise exception 'Esta pousada não está disponível para reserva.';
    end if;
    -- Mesmas condições da vitrine: acomodação oculta ou inativa não se reserva
    -- pelo site, nem chamando a RPC direto.
    if not exists (
      select 1 from rooms r left join accommodation_categories c on c.id = r.category_id
      where r.id = p_room_id and r.pousada_id = p_pousada_id
        and r.status = 'active' and r.public_visible
        and (r.category_id is null or c.status = 'active')
        and r.operational_status not in ('maintenance', 'blocked')
    ) then
      raise exception 'Acomodação inválida para esta pousada.';
    end if;

    -- 0087: preço autoritativo = soma das diárias com as regras de temporada,
    -- a mesma conta que list_bookable_rooms mostrou ao hóspede.
    select q.total, q.nights, q.min_nights into v_quote
    from room_stay_quote(p_room_id, p_checkin, p_checkout) q;
    if v_quote.nights < v_quote.min_nights then
      raise exception 'Para estas datas a estadia mínima é de % noites.', v_quote.min_nights;
    end if;
    v_subtotal := v_quote.total;

    -- Divergência é erro explícito, não correção silenciosa.
    if coalesce(p_subtotal, -1) <> v_subtotal or coalesce(p_total, -1) <> v_subtotal
       or coalesce(p_fee, 0) <> 0 or coalesce(p_discount, 0) <> 0
       or coalesce(p_surcharge, 0) <> 0 or coalesce(p_services_amount, 0) <> 0 then
      raise exception 'O valor da reserva mudou. Volte à busca para revisar antes de reservar.';
    end if;

    if p_origin is null or p_origin not in ('rota_das_pousadas', 'link_bio')
       or p_external_channel_name is not null or p_external_code is not null
       or p_expected_commission is not null then
      raise exception 'Origem inválida para reserva pública.';
    end if;

    -- Teto de pendências abertas.
    select count(*) into v_open_pending from bookings
    where guest_id = auth.uid() and status = 'pending'
      and (payment_due_at is null or payment_due_at > now());
    if v_open_pending >= 3 then
      raise exception 'Você já tem reservas aguardando pagamento. Conclua ou cancele antes de criar outra.';
    end if;

    -- Campos que só o servidor decide.
    p_subtotal       := v_subtotal;
    p_total          := v_subtotal;
    p_fee            := 0;
    p_discount       := 0;
    p_surcharge      := 0;
    p_services_amount := 0;
    p_internal_notes := '';
    p_special_requests := left(trim(coalesce(p_special_requests, '')), 500);
    -- 0070: 2h quando a pousada recebe on-line (Mercado Pago conectado);
    -- 24h quando o pagamento é combinado direto com a pousada.
    p_payment_due_at := now() + case
      when exists (select 1 from pousada_payment_accounts a
                   where a.pousada_id = p_pousada_id and a.access_token is not null)
        then interval '2 hours'
      else interval '24 hours'
    end;

    loop
      p_code := 'RP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      exit when not exists (select 1 from bookings where code = p_code);
    end loop;
  end if;

  select id, pousada_id, full_name, email, phone into v_guest from guests where id = p_responsible_guest_id;
  if v_guest.id is null or v_guest.pousada_id <> p_pousada_id then
    raise exception 'Hóspede responsável inválido para esta pousada.';
  end if;
  if not v_is_staff and not exists (
    select 1 from guests g where g.id = p_responsible_guest_id and g.user_id = auth.uid()
  ) then
    raise exception 'Hóspede responsável inválido para esta reserva.';
  end if;

  for v_stale in
    select id from bookings
    where room_id = p_room_id and status = 'pending'
      and payment_due_at is not null and payment_due_at < now()
      and checkin < p_checkout and checkout > p_checkin
  loop
    update bookings set status = 'cancelled', cancellation_reason = 'Prazo de pagamento expirado',
      cancelled_at = now(), version = version + 1
    where id = v_stale.id;
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (null, 'booking.expired', 'bookings', v_stale.id, jsonb_build_object('reason', 'payment_due_at_passed'));
  end loop;

  perform assert_room_available_for_booking(p_pousada_id, p_room_id, p_checkin, p_checkout, p_adults, p_children, p_pets);

  begin
    insert into bookings (
      code, pousada_id, room_id, guest_id, responsible_guest_id, guest_name, guest_email, guest_phone,
      checkin, checkout, adults, children, infants, pets,
      subtotal, fee, discount, surcharge, services_amount, total,
      status, origin, external_channel_name, external_code, expected_commission,
      expected_arrival_time, special_requests, internal_notes, payment_due_at, created_by
    ) values (
      p_code, p_pousada_id, p_room_id, p_traveler_user_id, p_responsible_guest_id, v_guest.full_name, v_guest.email, v_guest.phone,
      p_checkin, p_checkout, p_adults, p_children, p_infants, p_pets,
      p_subtotal, p_fee, p_discount, p_surcharge, p_services_amount, p_total,
      p_status, p_origin, p_external_channel_name, p_external_code, p_expected_commission,
      p_expected_arrival_time, coalesce(p_special_requests, ''), coalesce(p_internal_notes, ''), p_payment_due_at, auth.uid()
    ) returning id into v_id;
  exception when exclusion_violation then
    raise exception 'Já existe uma reserva conflitando com este período para esta acomodação.';
  end;

  insert into booking_guests (booking_id, guest_id, full_name, guest_type)
  values (v_id, p_responsible_guest_id, v_guest.full_name, 'responsible');

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'booking.created', 'bookings', v_id,
          jsonb_build_object('pousadaId', p_pousada_id, 'roomId', p_room_id, 'status', p_status,
                             'origin', p_origin, 'staff', v_is_staff));

  return jsonb_build_object('id', v_id, 'code', p_code);
end;
$function$;
