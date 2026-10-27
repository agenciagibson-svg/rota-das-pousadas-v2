-- 0100 — Cupom e vantagem para quem reserva direto (item g2).
--
-- Objetivo: dar ao hóspede um motivo para reservar pelo link da pousada (site
-- ou bio do Instagram) em vez do Booking/Airbnb.
--
-- 1. pousada_coupons: cupons da pousada. Quem cria, pausa e escolhe o cupom
--    divulgado é o dono/gestor (`auth_can_manage_pousada`, o mesmo grupo das
--    tarifas). Valores em REAIS INTEIROS, como bookings.total e rooms.base_price.
--      - kind 'percent' (1–90%) ou 'fixed' (R$ 1–100.000);
--      - valid_from/valid_until: período em que o cupom pode ser USADO (data de
--        hoje no fuso da pousada), as duas pontas inclusivas; nulo = sem limite;
--      - stay_from/stay_until: opcional, "só para estadias entre X e Y" — a
--        entrada não pode ser antes de X e a saída não pode ser depois de Y;
--      - min_nights e max_uses opcionais;
--      - SEMPRE uma vez por hóspede (por conta de viajante);
--      - featured: no máximo UM por pousada, o cupom divulgado na bio e na
--        página pública.
--    Sem escrita direta pela API: tudo passa pelas RPCs abaixo (auditadas).
--
-- 2. booking_coupon_redemptions: o uso. Um por reserva. Conta como uso só
--    enquanto a reserva não for cancelada: ao cancelar/expirar (status
--    'cancelled'), o gatilho marca released_at e o hóspede pode usar de novo.
--    "Uma vez por hóspede" é garantido por índice único parcial; o limite total
--    pelo lock da linha do cupom (FOR UPDATE) — dois usos simultâneos fazem
--    fila e o segundo já enxerga o primeiro.
--
-- 3. Reserva pública com cupom: RPC NOVA `create_booking_with_coupon`, que na
--    MESMA transação valida o cupom (com lock), chama `create_booking` (que
--    segue intacta e continua recusando desconto vindo do cliente no fluxo
--    público) e grava desconto, total e uso. Escolhida em vez de mudar a
--    assinatura de create_booking (drop + recriar 150 linhas) e em vez de uma
--    RPC separada depois da criação (janela com reserva sem desconto e
--    tentativa falha que não cria nada). O desconto vai em bookings.discount;
--    o total cai junto e balance_due (coluna gerada) acompanha — Pix e Mercado
--    Pago já cobram balance_due.
--
-- 4. Prévia (`preview_booking_coupon`): exige login; código inexistente,
--    pausado, fora do período ou esgotado dão a MESMA resposta ('invalid').
--    10 códigos inválidos por conta na última hora bloqueiam a próxima hora
--    (coupon_attempts, só o banco lê). Os outros motivos (estadia mínima,
--    período, já usado) não contam: só aparecem para quem sabe um código real.
--
-- 5. `get_featured_coupon(slug)`: público, devolve o cupom divulgado só se ele
--    estiver valendo hoje (ativo, no período, com usos sobrando).
--
-- Rollback: supabase/rollback/0100_rollback.sql

-- ---------------------------------------------------------------------------
-- 1. Cupons
-- ---------------------------------------------------------------------------
create table if not exists pousada_coupons (
  id          uuid primary key default gen_random_uuid(),
  pousada_id  uuid not null references pousadas(id) on delete cascade,
  code        text not null check (code ~ '^[A-Z0-9]{3,20}$'),
  kind        text not null check (kind in ('percent', 'fixed')),
  value       integer not null,
  valid_from  date,
  valid_until date,
  stay_from   date,
  stay_until  date,
  min_nights  smallint check (min_nights is null or min_nights between 1 and 60),
  max_uses    integer check (max_uses is null or max_uses between 1 and 100000),
  active      boolean not null default true,
  featured    boolean not null default false,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint pousada_coupons_value check (
    (kind = 'percent' and value between 1 and 90)
    or (kind = 'fixed' and value between 1 and 100000)
  ),
  constraint pousada_coupons_valid_period check (
    valid_from is null or valid_until is null or valid_until >= valid_from
  ),
  constraint pousada_coupons_stay_period check (
    stay_from is null or stay_until is null or stay_until > stay_from
  ),
  -- Divulgado precisa estar ativo (pausar tira da divulgação).
  constraint pousada_coupons_featured_active check (not featured or active)
);
-- Código único por pousada; maiúsculas garantidas pelo check acima.
create unique index if not exists uq_pousada_coupons_code on pousada_coupons(pousada_id, code);
create unique index if not exists uq_pousada_coupons_featured on pousada_coupons(pousada_id) where featured;

alter table pousada_coupons enable row level security;
-- Leitura e escrita só por RPC (SECURITY DEFINER). Nenhuma policy = nada pela API.
revoke all on pousada_coupons from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Usos
-- ---------------------------------------------------------------------------
create table if not exists booking_coupon_redemptions (
  id          uuid primary key default gen_random_uuid(),
  coupon_id   uuid not null references pousada_coupons(id) on delete cascade,
  pousada_id  uuid not null references pousadas(id) on delete cascade,
  booking_id  uuid not null unique references bookings(id) on delete cascade,
  -- Nulo depois que o hóspede exclui a conta (0090 zera bookings.guest_id; o
  -- gatilho da seção 10 faz o mesmo aqui). O uso continua contando.
  user_id     uuid references auth.users(id) on delete set null,
  code        text not null,
  discount    integer not null check (discount >= 0),
  created_at  timestamptz not null default now(),
  released_at timestamptz
);
create unique index if not exists uq_coupon_redemption_once_per_guest
  on booking_coupon_redemptions(coupon_id, user_id) where released_at is null;
create index if not exists idx_coupon_redemptions_coupon
  on booking_coupon_redemptions(coupon_id) where released_at is null;

alter table booking_coupon_redemptions enable row level security;
revoke all on booking_coupon_redemptions from anon, authenticated;
-- A equipe vê qual cupom a reserva usou (mesma regra de leitura de bookings,
-- 0085). O hóspede não lê a tabela: o desconto chega pela própria reserva.
drop policy if exists "coupon_redemptions_read" on booking_coupon_redemptions;
create policy "coupon_redemptions_read" on booking_coupon_redemptions for select
  using (auth_has_operational_access(pousada_id) or auth_has_active_grant(pousada_id));
grant select on booking_coupon_redemptions to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Tentativas erradas (freio contra adivinhar código)
-- ---------------------------------------------------------------------------
create table if not exists coupon_attempts (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  pousada_id uuid references pousadas(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_coupon_attempts_user on coupon_attempts(user_id, created_at);
alter table coupon_attempts enable row level security;
revoke all on coupon_attempts from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Funções internas (sem EXECUTE para a API)
-- ---------------------------------------------------------------------------

-- Desconto em reais inteiros. Percentual arredonda para o real mais próximo
-- (meio real sobe), como as tarifas percentuais da 0087, e deixa pelo menos
-- R$ 1 de total (total zero trava o Pix e o Mercado Pago). Fixo nunca passa do
-- subtotal (e coupon_evaluate só aceita fixo menor que o subtotal). Nunca
-- negativo. Espelho em features/cupons/discount.ts.
create or replace function coupon_discount(p_kind text, p_value integer, p_subtotal integer)
returns integer
language sql immutable set search_path = public as $$
  select case
    when coalesce(p_subtotal, 0) <= 0 or coalesce(p_value, 0) <= 0 then 0
    else greatest(0, least(p_subtotal,
      case when p_kind = 'percent' then least(p_subtotal - 1, ((p_subtotal::bigint * p_value + 50) / 100)::integer)
           else p_value end))
  end;
$$;
revoke all on function coupon_discount(text, integer, integer) from public, anon, authenticated;

-- Pousada da acomodação, se ela pode ser reservada pelo site (mesmas condições
-- de create_booking). Null = não pode — nem a prévia vira consulta de preço
-- de acomodação oculta.
create or replace function coupon_public_room_pousada(p_room_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select r.pousada_id
  from rooms r
  join pousadas p on p.id = r.pousada_id
  left join accommodation_categories c on c.id = r.category_id
  where r.id = p_room_id
    and p.status = 'publicada' and p.tenant_status in ('onboarding', 'active')
    and r.status = 'active' and r.public_visible
    and (r.category_id is null or c.status = 'active')
    and r.operational_status not in ('maintenance', 'blocked');
$$;
revoke all on function coupon_public_room_pousada(uuid) from public, anon, authenticated;

-- Freio contra adivinhar código (revisão de 26/10). Toda tentativa é GRAVADA
-- antes de avaliar o código, com lock por usuário: requisições paralelas fazem
-- fila e enxergam umas às outras, e uma chamada em transação só de leitura
-- (o PostgREST roda RPC por GET assim) falha antes de responder qualquer
-- coisa. Código que vale tem a tentativa apagada depois (coupon_drop_attempt):
-- só os inválidos ficam contando. Devolve o id da tentativa ou null se o
-- usuário passou de 10 inválidos na última hora.
create or replace function coupon_take_attempt(p_user uuid, p_pousada_id uuid)
returns bigint
language plpgsql volatile security definer set search_path = public as $$
declare
  v_id bigint;
begin
  if current_setting('transaction_read_only', true) = 'on' then
    raise exception 'Use o formulário de reserva para aplicar o cupom.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('coupon_attempts:' || p_user::text, 0));
  delete from coupon_attempts where user_id = p_user and created_at < now() - interval '1 day';
  if (select count(*) from coupon_attempts
      where user_id = p_user and created_at > now() - interval '1 hour') >= 10 then
    return null;
  end if;
  insert into coupon_attempts(user_id, pousada_id) values (p_user, p_pousada_id)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function coupon_take_attempt(uuid, uuid) from public, anon, authenticated;

create or replace function coupon_drop_attempt(p_attempt bigint)
returns void
language sql security definer set search_path = public as $$
  delete from coupon_attempts where id = p_attempt;
$$;
revoke all on function coupon_drop_attempt(bigint) from public, anon, authenticated;

-- Uso "vivo" de um cupom: não devolvido E a reserva não é uma pendência com o
-- prazo de pagamento vencido (revisão de 26/10: sem isto, reservas não pagas
-- seguravam o cupom até o cron diário, e dava para "esgotar" uma promoção com
-- contas descartáveis). Se a pendência vencida for paga depois, volta a contar.
create or replace function coupon_redemption_live(p_booking_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from bookings b
    where b.id = p_booking_id and b.status = 'pending'
      and b.payment_due_at is not null and b.payment_due_at < now()
  );
$$;
revoke all on function coupon_redemption_live(uuid) from public, anon, authenticated;

-- Avalia o cupom para uma estadia. VOLATILE de propósito: com p_lock, a linha
-- do cupom é travada no primeiro comando e a contagem de usos roda num comando
-- seguinte, com foto nova do banco — enxerga o uso de quem tinha o lock antes.
-- Motivos: ok · invalid (não existe, pausado, fora do período de uso, esgotado
-- — mesma resposta para não ajudar a adivinhar código) · already_used ·
-- min_nights · stay_period · min_value (cupom de valor fixo só vale quando a
-- estadia custa mais do que ele, para o total nunca zerar).
create or replace function coupon_evaluate(
  p_pousada_id uuid, p_code text, p_checkin date, p_checkout date,
  p_subtotal integer, p_user uuid, p_lock boolean
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_c pousada_coupons%rowtype;
  v_today date;
  v_used integer;
begin
  if v_code !~ '^[A-Z0-9]{3,20}$' then
    return jsonb_build_object('reason', 'invalid');
  end if;
  if p_lock then
    select * into v_c from pousada_coupons
    where pousada_id = p_pousada_id and code = v_code for update;
  else
    select * into v_c from pousada_coupons
    where pousada_id = p_pousada_id and code = v_code;
  end if;
  if v_c.id is null or not v_c.active then
    return jsonb_build_object('reason', 'invalid');
  end if;
  -- Com o cupom travado (criação da reserva): pendências vencidas que seguram
  -- este cupom expiram agora — mesmo UPDATE protegido da 0099 (se o pagamento
  -- chegou no meio-tempo, a reserva fica de fora) — e o gatilho devolve o uso.
  if p_lock then
    with expired as (
      update bookings b set status = 'cancelled', cancellation_reason = 'Prazo de pagamento expirado',
        cancelled_at = now(), version = b.version + 1
      where b.id in (select r.booking_id from booking_coupon_redemptions r
                     where r.coupon_id = v_c.id and r.released_at is null)
        and b.status = 'pending' and b.payment_due_at is not null and b.payment_due_at < now()
      returning b.id
    )
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    select null, 'booking.expired', 'bookings', e.id, jsonb_build_object('reason', 'payment_due_at_passed')
    from expired e;
  end if;
  v_today := pousada_local_date(p_pousada_id);
  if (v_c.valid_from is not null and v_today < v_c.valid_from)
     or (v_c.valid_until is not null and v_today > v_c.valid_until) then
    return jsonb_build_object('reason', 'invalid');
  end if;
  if v_c.max_uses is not null then
    select count(*) into v_used from booking_coupon_redemptions
    where coupon_id = v_c.id and released_at is null and coupon_redemption_live(booking_id);
    if v_used >= v_c.max_uses then
      return jsonb_build_object('reason', 'invalid');
    end if;
  end if;
  if exists (
    select 1 from booking_coupon_redemptions
    where coupon_id = v_c.id and user_id = p_user and released_at is null
      and coupon_redemption_live(booking_id)
  ) then
    return jsonb_build_object('reason', 'already_used');
  end if;
  if v_c.min_nights is not null and p_checkout - p_checkin < v_c.min_nights then
    return jsonb_build_object('reason', 'min_nights', 'minNights', v_c.min_nights);
  end if;
  if (v_c.stay_from is not null and p_checkin < v_c.stay_from)
     or (v_c.stay_until is not null and p_checkout > v_c.stay_until) then
    return jsonb_build_object('reason', 'stay_period',
      'stayFrom', v_c.stay_from, 'stayUntil', v_c.stay_until);
  end if;
  if v_c.kind = 'fixed' and coalesce(p_subtotal, 0) <= v_c.value then
    return jsonb_build_object('reason', 'min_value', 'value', v_c.value);
  end if;
  return jsonb_build_object(
    'reason', 'ok',
    'couponId', v_c.id,
    'code', v_c.code,
    'kind', v_c.kind,
    'value', v_c.value,
    'discount', coupon_discount(v_c.kind, v_c.value, p_subtotal)
  );
end;
$$;
revoke all on function coupon_evaluate(uuid, text, date, date, integer, uuid, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Gestão pelo painel (dono/gestor)
-- ---------------------------------------------------------------------------
create or replace function list_pousada_coupons(p_pousada_id uuid)
returns table (
  id uuid, code text, kind text, value integer,
  valid_from date, valid_until date, stay_from date, stay_until date,
  min_nights integer, max_uses integer, active boolean, featured boolean,
  uses integer, created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not (auth_can_manage_pousada(p_pousada_id) or auth_has_active_grant(p_pousada_id)) then
    raise exception 'Você não tem permissão para ver os cupons desta pousada.';
  end if;
  return query
  select c.id, c.code, c.kind, c.value, c.valid_from, c.valid_until, c.stay_from, c.stay_until,
         c.min_nights::integer, c.max_uses, c.active, c.featured,
         (select count(*)::integer from booking_coupon_redemptions r
          where r.coupon_id = c.id and r.released_at is null and coupon_redemption_live(r.booking_id)),
         c.created_at
  from pousada_coupons c
  where c.pousada_id = p_pousada_id
  order by c.active desc, c.created_at desc;
end;
$$;
revoke all on function list_pousada_coupons(uuid) from public, anon;
grant execute on function list_pousada_coupons(uuid) to authenticated;

create or replace function create_pousada_coupon(
  p_pousada_id uuid, p_code text, p_kind text, p_value integer,
  p_valid_from date default null, p_valid_until date default null,
  p_stay_from date default null, p_stay_until date default null,
  p_min_nights integer default null, p_max_uses integer default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_id uuid;
begin
  if auth.uid() is null or not (auth_can_manage_pousada(p_pousada_id) or auth_has_active_grant(p_pousada_id)) then
    raise exception 'Você não tem permissão para gerenciar os cupons desta pousada.';
  end if;
  if v_code !~ '^[A-Z0-9]{3,20}$' then
    raise exception 'Use de 3 a 20 letras ou números no código, sem espaço nem acento.';
  end if;
  if p_kind is null or p_kind not in ('percent', 'fixed') then raise exception 'Tipo de desconto inválido.'; end if;
  if p_kind = 'percent' and (p_value is null or p_value < 1 or p_value > 90) then
    raise exception 'O desconto percentual vai de 1%% a 90%%.';
  end if;
  if p_kind = 'fixed' and (p_value is null or p_value < 1 or p_value > 100000) then
    raise exception 'Informe um desconto em reais entre R$ 1 e R$ 100.000.';
  end if;
  if p_valid_from is not null and p_valid_until is not null and p_valid_until < p_valid_from then
    raise exception 'O fim da validade precisa ser depois do início.';
  end if;
  if p_valid_until is not null and p_valid_until < pousada_local_date(p_pousada_id) then
    raise exception 'O fim da validade já passou.';
  end if;
  if p_stay_from is not null and p_stay_until is not null and p_stay_until <= p_stay_from then
    raise exception 'O período de estadia precisa terminar depois de começar.';
  end if;
  if p_min_nights is not null and (p_min_nights < 1 or p_min_nights > 60) then
    raise exception 'A estadia mínima vai de 1 a 60 noites.';
  end if;
  if p_max_uses is not null and (p_max_uses < 1 or p_max_uses > 100000) then
    raise exception 'O limite de usos precisa ser de pelo menos 1.';
  end if;
  if (select count(*) from pousada_coupons where pousada_id = p_pousada_id) >= 200 then
    raise exception 'Esta pousada já tem 200 cupons. Pause os antigos antes de criar outro.';
  end if;

  begin
    insert into pousada_coupons (pousada_id, code, kind, value, valid_from, valid_until,
      stay_from, stay_until, min_nights, max_uses, created_by)
    values (p_pousada_id, v_code, p_kind, p_value, p_valid_from, p_valid_until,
      p_stay_from, p_stay_until, p_min_nights, p_max_uses, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Já existe um cupom com este código nesta pousada.';
  end;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'coupon.created', 'pousada_coupons', v_id,
          jsonb_build_object('pousadaId', p_pousada_id, 'code', v_code, 'kind', p_kind, 'value', p_value));
  return v_id;
end;
$$;
revoke all on function create_pousada_coupon(uuid, text, text, integer, date, date, date, date, integer, integer) from public, anon;
grant execute on function create_pousada_coupon(uuid, text, text, integer, date, date, date, date, integer, integer) to authenticated;

-- Pausar tira da divulgação; reativar não volta a divulgar sozinho.
create or replace function set_pousada_coupon_active(p_coupon_id uuid, p_active boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_pousada uuid;
begin
  select pousada_id into v_pousada from pousada_coupons where id = p_coupon_id;
  if auth.uid() is null or v_pousada is null
     or not (auth_can_manage_pousada(v_pousada) or auth_has_active_grant(v_pousada)) then
    raise exception 'Cupom não encontrado.';
  end if;
  update pousada_coupons
     set active = coalesce(p_active, false),
         featured = case when coalesce(p_active, false) then featured else false end,
         updated_at = now()
   where id = p_coupon_id;
  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), case when p_active then 'coupon.resumed' else 'coupon.paused' end,
          'pousada_coupons', p_coupon_id, jsonb_build_object('pousadaId', v_pousada));
end;
$$;
revoke all on function set_pousada_coupon_active(uuid, boolean) from public, anon;
grant execute on function set_pousada_coupon_active(uuid, boolean) to authenticated;

-- Um cupom divulgado por pousada: marcar um desmarca o anterior.
create or replace function set_pousada_coupon_featured(p_coupon_id uuid, p_featured boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_c pousada_coupons%rowtype;
begin
  select * into v_c from pousada_coupons where id = p_coupon_id;
  if auth.uid() is null or v_c.id is null
     or not (auth_can_manage_pousada(v_c.pousada_id) or auth_has_active_grant(v_c.pousada_id)) then
    raise exception 'Cupom não encontrado.';
  end if;
  if coalesce(p_featured, false) then
    -- Trava os cupons da pousada: dois "divulgar" ao mesmo tempo fazem fila
    -- (antes, o segundo batia no índice único com erro cru).
    perform 1 from pousada_coupons where pousada_id = v_c.pousada_id order by id for update;
    select * into v_c from pousada_coupons where id = p_coupon_id;
    if not v_c.active then raise exception 'Reative o cupom antes de divulgar.'; end if;
    update pousada_coupons set featured = false, updated_at = now()
     where pousada_id = v_c.pousada_id and featured and id <> p_coupon_id;
    update pousada_coupons set featured = true, updated_at = now() where id = p_coupon_id;
  else
    update pousada_coupons set featured = false, updated_at = now() where id = p_coupon_id;
  end if;
  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), case when p_featured then 'coupon.featured' else 'coupon.unfeatured' end,
          'pousada_coupons', p_coupon_id, jsonb_build_object('pousadaId', v_c.pousada_id));
end;
$$;
revoke all on function set_pousada_coupon_featured(uuid, boolean) from public, anon;
grant execute on function set_pousada_coupon_featured(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Cupom divulgado (bio e página pública)
-- ---------------------------------------------------------------------------
create or replace function get_featured_coupon(p_slug text)
returns table (
  code text, kind text, value integer, min_nights integer,
  valid_until date, stay_from date, stay_until date
)
language sql stable security definer set search_path = public as $$
  select c.code, c.kind, c.value, c.min_nights::integer, c.valid_until, c.stay_from, c.stay_until
  from pousadas p
  join pousada_coupons c on c.pousada_id = p.id and c.featured and c.active
  where p.slug = p_slug
    and p.status = 'publicada' and p.tenant_status in ('onboarding', 'active')
    and (c.valid_from is null or c.valid_from <= pousada_local_date(p.id))
    and (c.valid_until is null or c.valid_until >= pousada_local_date(p.id))
    and (c.max_uses is null or c.max_uses > (
      select count(*) from booking_coupon_redemptions r
      where r.coupon_id = c.id and r.released_at is null and coupon_redemption_live(r.booking_id)))
  limit 1;
$$;
revoke all on function get_featured_coupon(text) from public;
grant execute on function get_featured_coupon(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Prévia do desconto na reserva
-- ---------------------------------------------------------------------------
create or replace function preview_booking_coupon(
  p_room_id uuid, p_checkin date, p_checkout date, p_code text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_pousada uuid;
  v_subtotal integer;
  v_eval jsonb;
  v_attempt bigint;
begin
  if auth.uid() is null then raise exception 'Faça login para usar um cupom.'; end if;
  if p_checkin is null or p_checkout is null or p_checkout <= p_checkin
     or p_checkout - p_checkin > public_stay_max_nights() then
    raise exception 'Escolha um período válido antes de aplicar o cupom.';
  end if;
  v_pousada := coupon_public_room_pousada(p_room_id);
  if v_pousada is null then raise exception 'Acomodação inválida.'; end if;
  if auth_has_guest_access(v_pousada) or auth_has_active_grant(v_pousada) then
    return jsonb_build_object('ok', false, 'reason', 'staff');
  end if;
  v_attempt := coupon_take_attempt(auth.uid(), v_pousada);
  if v_attempt is null then
    return jsonb_build_object('ok', false, 'reason', 'too_many_attempts');
  end if;

  select q.total into v_subtotal from room_stay_quote(p_room_id, p_checkin, p_checkout) q;
  v_eval := coupon_evaluate(v_pousada, p_code, p_checkin, p_checkout, v_subtotal, auth.uid(), false);
  -- Só o código que não vale fica contando como tentativa errada: os outros
  -- motivos só aparecem para quem já sabe um código de verdade.
  if v_eval->>'reason' <> 'invalid' then perform coupon_drop_attempt(v_attempt); end if;
  if v_eval->>'reason' <> 'ok' then
    return (v_eval - 'couponId') || jsonb_build_object('ok', false);
  end if;
  return jsonb_build_object(
    'ok', true,
    'code', v_eval->>'code',
    'kind', v_eval->>'kind',
    'value', (v_eval->>'value')::integer,
    'subtotal', v_subtotal,
    'discount', (v_eval->>'discount')::integer,
    'total', v_subtotal - (v_eval->>'discount')::integer
  );
end;
$$;
revoke all on function preview_booking_coupon(uuid, date, date, text) from public, anon;
grant execute on function preview_booking_coupon(uuid, date, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Reserva pública com cupom (uma transação)
-- ---------------------------------------------------------------------------
create or replace function create_booking_with_coupon(
  p_pousada_id uuid,
  p_room_id uuid,
  p_responsible_guest_id uuid,
  p_checkin date,
  p_checkout date,
  p_adults integer,
  p_subtotal integer,
  p_coupon_code text,
  p_origin booking_origin default 'rota_das_pousadas',
  p_special_requests text default '',
  p_expected_discount integer default null,
  p_children integer default 0,
  p_infants integer default 0,
  p_pets boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_subtotal integer;
  v_eval jsonb;
  v_discount integer;
  v_booking jsonb;
  v_id uuid;
  v_total integer;
  v_attempt bigint;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if p_checkout is null or p_checkin is null or p_checkout <= p_checkin then
    raise exception 'A data de saída deve ser posterior à de entrada.';
  end if;
  -- A equipe negocia pelo campo de desconto do balcão; cupom é do hóspede.
  if auth_has_guest_access(p_pousada_id) or auth_has_active_grant(p_pousada_id) then
    raise exception 'Cupom vale só para reserva feita pelo hóspede no site. Na reserva pela equipe, use o campo de desconto.';
  end if;
  if coupon_public_room_pousada(p_room_id) is distinct from p_pousada_id then
    raise exception 'Acomodação inválida para esta pousada.';
  end if;
  if p_checkout - p_checkin > public_stay_max_nights() then
    raise exception 'Pelo site, a reserva pode ter até % noites. Fale com a pousada para estadias maiores.',
      public_stay_max_nights();
  end if;
  v_attempt := coupon_take_attempt(auth.uid(), p_pousada_id);
  if v_attempt is null then
    return jsonb_build_object('ok', false, 'reason', 'too_many_attempts');
  end if;

  select q.total into v_subtotal from room_stay_quote(p_room_id, p_checkin, p_checkout) q;
  -- Trava a linha do cupom até o fim da transação: usos simultâneos fazem fila.
  v_eval := coupon_evaluate(p_pousada_id, p_coupon_code, p_checkin, p_checkout, v_subtotal, auth.uid(), true);
  if v_eval->>'reason' <> 'invalid' then perform coupon_drop_attempt(v_attempt); end if;
  if v_eval->>'reason' <> 'ok' then
    return (v_eval - 'couponId') || jsonb_build_object('ok', false);
  end if;
  v_discount := (v_eval->>'discount')::integer;
  if p_expected_discount is not null and p_expected_discount <> v_discount then
    return jsonb_build_object('ok', false, 'reason', 'changed', 'discount', v_discount);
  end if;

  -- create_booking segue sendo a única porta de criação: confere preço,
  -- disponibilidade, cadastro do hóspede, teto de pendências e prazo de
  -- pagamento. Notação nomeada: parâmetro novo com default não quebra aqui.
  v_booking := create_booking(
    p_pousada_id => p_pousada_id,
    p_room_id => p_room_id,
    p_responsible_guest_id => p_responsible_guest_id,
    p_code => 'RP-CUPOM',
    p_checkin => p_checkin,
    p_checkout => p_checkout,
    p_adults => p_adults,
    p_children => coalesce(p_children, 0),
    p_infants => coalesce(p_infants, 0),
    p_pets => coalesce(p_pets, false),
    p_subtotal => p_subtotal,
    p_fee => 0,
    p_discount => 0,
    p_surcharge => 0,
    p_services_amount => 0,
    p_total => p_subtotal,
    p_status => 'pending'::booking_status,
    p_origin => p_origin,
    p_traveler_user_id => auth.uid(),
    p_special_requests => coalesce(p_special_requests, '')
  );
  v_id := (v_booking->>'id')::uuid;

  update bookings
     set discount = v_discount,
         total = greatest(0, subtotal + fee - v_discount + surcharge + services_amount)
   where id = v_id
  returning total into v_total;

  insert into booking_coupon_redemptions (coupon_id, pousada_id, booking_id, user_id, code, discount)
  values ((v_eval->>'couponId')::uuid, p_pousada_id, v_id, auth.uid(), v_eval->>'code', v_discount);

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'coupon.redeemed', 'bookings', v_id,
          jsonb_build_object('pousadaId', p_pousada_id, 'couponId', v_eval->>'couponId',
                             'code', v_eval->>'code', 'discount', v_discount));

  return jsonb_build_object('ok', true, 'id', v_id, 'code', v_booking->>'code',
                            'discount', v_discount, 'total', v_total);
end;
$$;
revoke all on function create_booking_with_coupon(uuid, uuid, uuid, date, date, integer, integer, text, booking_origin, text, integer, integer, integer, boolean) from public, anon;
grant execute on function create_booking_with_coupon(uuid, uuid, uuid, date, date, integer, integer, text, booking_origin, text, integer, integer, integer, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Reserva cancelada (inclusive expirada) devolve o uso
-- ---------------------------------------------------------------------------
create or replace function release_coupon_on_booking_cancel()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update booking_coupon_redemptions set released_at = now()
   where booking_id = new.id and released_at is null;
  if found then
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'coupon.released', 'bookings', new.id,
            jsonb_build_object('pousadaId', new.pousada_id));
  end if;
  return null;
end;
$$;
revoke all on function release_coupon_on_booking_cancel() from public, anon, authenticated;

drop trigger if exists trg_release_coupon_on_booking_cancel on bookings;
create trigger trg_release_coupon_on_booking_cancel
  after update of status on bookings
  for each row
  when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
  execute function release_coupon_on_booking_cancel();


-- ---------------------------------------------------------------------------
-- 10. Conta excluída (0090 zera bookings.guest_id): o uso perde o vínculo com
--     a conta e as tentativas dela somem. O uso continua contando no cupom.
-- ---------------------------------------------------------------------------
create or replace function unlink_coupon_data_on_guest_removed()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update booking_coupon_redemptions set user_id = null
   where booking_id = new.id and user_id is not null;
  delete from coupon_attempts where user_id = old.guest_id;
  return null;
end;
$$;
revoke all on function unlink_coupon_data_on_guest_removed() from public, anon, authenticated;

drop trigger if exists trg_unlink_coupon_data_on_guest_removed on bookings;
create trigger trg_unlink_coupon_data_on_guest_removed
  after update of guest_id on bookings
  for each row
  when (new.guest_id is null and old.guest_id is not null)
  execute function unlink_coupon_data_on_guest_removed();
