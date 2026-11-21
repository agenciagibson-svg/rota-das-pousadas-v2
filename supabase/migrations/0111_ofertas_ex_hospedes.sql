-- =============================================================================
-- 0111 — Ofertas da pousada para ex-hóspedes (com autorização)
--
-- App único (spec claude/app-unico-loja-estadia-2026-11-20.md, etapa 4):
--
--   (A) offer_consents: o ex-hóspede autoriza (ou não) receber ofertas de UMA
--       pousada. Padrão: não. Só quem já se hospedou lá (check-out feito)
--       pode autorizar; cancelar a autorização vale sempre. LGPD: guarda
--       quando e por qual estadia; tudo auditado.
--   (B) pousada_coupons ganha guest_user_id/offer_id: o cupom de oferta é de
--       UMA pessoa, uso único, com validade. Para qualquer outra conta o
--       código responde como inválido (coupon_evaluate). Esses cupons não
--       aparecem na lista de cupons da pousada.
--   (C) pousada_offers e offer_deliveries: cada oferta e cada envio (cupom,
--       e-mail, abertura e reserva feita com ele).
--   (D) send_pousada_offer: dono/gestor manda uma oferta para os ex-hóspedes
--       que autorizaram, respeitando os limites — no máximo 1 oferta por mês
--       de cada pousada e 3 por mês somando todas para a mesma pessoa.
--       Quem envia o e-mail é a Rota: a pousada nunca vê e-mail nem telefone.
--   (E) E-mails pela rodada de ofertas (service_role), marcados só depois de
--       sair; abertura e reserva registradas; relatório para o painel.
--
-- Aditiva e idempotente. Rollback em supabase/rollback/0111_rollback.sql.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- (A) Autorização
-- ----------------------------------------------------------------------------
create table if not exists offer_consents (
  user_id           uuid not null references auth.users(id) on delete cascade,
  pousada_id        uuid not null references pousadas(id) on delete cascade,
  granted           boolean not null,
  source_booking_id uuid references bookings(id) on delete set null,
  granted_at        timestamptz,
  updated_at        timestamptz not null default now(),
  primary key (user_id, pousada_id)
);
alter table offer_consents enable row level security;
revoke all on offer_consents from anon, authenticated;
-- Sem policy: leitura e escrita só pelas RPCs abaixo.

create or replace function set_offer_consent(p_pousada_id uuid, p_granted boolean)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_booking uuid;
begin
  if auth.uid() is null then raise exception 'Faça login.'; end if;
  if p_granted then
    select b.id into v_booking from bookings b
     where b.pousada_id = p_pousada_id and b.guest_id = auth.uid() and b.status = 'checked_out'
     order by b.checkout desc limit 1;
    if v_booking is null then
      raise exception 'Só quem já se hospedou nesta pousada pode receber ofertas dela.';
    end if;
  end if;

  insert into offer_consents (user_id, pousada_id, granted, source_booking_id, granted_at, updated_at)
  values (auth.uid(), p_pousada_id, p_granted, v_booking,
          case when p_granted then now() end, now())
  on conflict (user_id, pousada_id) do update
    set granted = excluded.granted,
        source_booking_id = coalesce(excluded.source_booking_id, offer_consents.source_booking_id),
        granted_at = case when excluded.granted then now() else offer_consents.granted_at end,
        updated_at = now();

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), case when p_granted then 'offer_consent.granted' else 'offer_consent.revoked' end,
          'pousadas', p_pousada_id, jsonb_build_object('bookingId', v_booking));
  return jsonb_build_object('granted', p_granted);
end;
$$;
revoke all on function set_offer_consent(uuid, boolean) from public, anon;
grant execute on function set_offer_consent(uuid, boolean) to authenticated;

-- Autorizações do usuário logado (app e página "Ofertas" da conta).
create or replace function my_offer_consents()
returns table (pousada_id uuid, pousada_name text, pousada_slug text, granted boolean, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.pousada_id, p.name, p.slug, c.granted, c.updated_at
    from offer_consents c join pousadas p on p.id = c.pousada_id
   where c.user_id = auth.uid()
   order by c.updated_at desc;
$$;
revoke all on function my_offer_consents() from public, anon;
grant execute on function my_offer_consents() to authenticated;

-- ----------------------------------------------------------------------------
-- (B) Cupom de uma pessoa só
-- ----------------------------------------------------------------------------
alter table pousada_coupons
  add column if not exists guest_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists offer_id uuid;
-- Código de oferta: VOLTA + 6 letras/números.
create index if not exists idx_pousada_coupons_guest on pousada_coupons(guest_user_id)
  where guest_user_id is not null;

-- ----------------------------------------------------------------------------
-- (C) Ofertas e envios
-- ----------------------------------------------------------------------------
create table if not exists pousada_offers (
  id          uuid primary key default gen_random_uuid(),
  pousada_id  uuid not null references pousadas(id) on delete cascade,
  kind        text not null default 'manual'
                check (kind in ('manual', 'seis_meses', 'feriado', 'aniversario')),
  percent     integer not null check (percent between 5 and 50),
  valid_days  integer not null default 30 check (valid_days between 7 and 90),
  stay_from   date,
  stay_until  date,
  message     text not null default '' check (char_length(message) <= 200),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint pousada_offers_stay check (stay_from is null or stay_until is null or stay_until > stay_from)
);
create index if not exists idx_pousada_offers_pousada on pousada_offers(pousada_id, created_at desc);
alter table pousada_offers enable row level security;
revoke all on pousada_offers from anon, authenticated;

alter table pousada_coupons
  drop constraint if exists pousada_coupons_offer_fk;
alter table pousada_coupons
  add constraint pousada_coupons_offer_fk foreign key (offer_id) references pousada_offers(id) on delete set null;

create table if not exists offer_deliveries (
  id             uuid primary key default gen_random_uuid(),
  offer_id       uuid not null references pousada_offers(id) on delete cascade,
  pousada_id     uuid not null references pousadas(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  coupon_id      uuid not null references pousada_coupons(id) on delete cascade,
  created_at     timestamptz not null default now(),
  email_sent_at  timestamptz,
  email_attempts smallint not null default 0,
  opened_at      timestamptz,
  booking_id     uuid references bookings(id) on delete set null
);
create index if not exists idx_offer_deliveries_user on offer_deliveries(user_id, created_at desc);
create index if not exists idx_offer_deliveries_offer on offer_deliveries(offer_id);
create index if not exists idx_offer_deliveries_email_pending on offer_deliveries(created_at)
  where email_sent_at is null;
alter table offer_deliveries enable row level security;
revoke all on offer_deliveries from anon, authenticated;

-- Limites por pessoa (espelho em features/app-fases/offers.ts).
create or replace function offer_recipient_allowed(p_user uuid, p_pousada_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
           select 1 from offer_deliveries d
            where d.user_id = p_user and d.pousada_id = p_pousada_id
              and d.created_at > now() - interval '30 days')
     and (select count(*) from offer_deliveries d
           where d.user_id = p_user and d.created_at > now() - interval '30 days') < 3;
$$;
revoke all on function offer_recipient_allowed(uuid, uuid) from public, anon, authenticated;

-- Ex-hóspedes que autorizaram e ainda podem receber agora.
create or replace function offer_audience(p_pousada_id uuid)
returns table (user_id uuid)
language sql stable security definer set search_path = public as $$
  select c.user_id
    from offer_consents c
    join auth.users u on u.id = c.user_id
   where c.pousada_id = p_pousada_id and c.granted
     and exists (select 1 from bookings b
                  where b.pousada_id = p_pousada_id and b.guest_id = c.user_id and b.status = 'checked_out')
     -- Hospedado de novo ou com viagem marcada para lá: oferta não faz sentido.
     and not exists (select 1 from bookings b
                      where b.pousada_id = p_pousada_id and b.guest_id = c.user_id
                        and b.status in ('pending', 'confirmed', 'checked_in'))
     and offer_recipient_allowed(c.user_id, p_pousada_id);
$$;
revoke all on function offer_audience(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- (D) Enviar uma oferta
-- ----------------------------------------------------------------------------
-- Cria a oferta, um cupom de uso único para cada pessoa e o registro do envio.
-- Interna: o painel chama send_pousada_offer; a rodada automática (etapa 5),
-- o serviço.
create or replace function create_offer_for_audience(
  p_pousada_id uuid, p_kind text, p_percent integer, p_valid_days integer,
  p_stay_from date, p_stay_until date, p_message text, p_actor uuid,
  p_only_users uuid[] default null
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_offer uuid;
  v_user uuid;
  v_code text;
  v_coupon uuid;
  v_today date := pousada_local_date(p_pousada_id);
  v_sent integer := 0;
begin
  insert into pousada_offers (pousada_id, kind, percent, valid_days, stay_from, stay_until, message, created_by)
  values (p_pousada_id, p_kind, p_percent, coalesce(p_valid_days, 30), p_stay_from, p_stay_until,
          left(btrim(coalesce(p_message, '')), 200), p_actor)
  returning id into v_offer;

  for v_user in
    select a.user_id from offer_audience(p_pousada_id) a
     where p_only_users is null or a.user_id = any(p_only_users)
  loop
    loop
      v_code := 'VOLTA' || upper(substr(md5(random()::text || clock_timestamp()::text || v_user::text), 1, 6));
      exit when v_code ~ '^VOLTA[A-Z0-9]{6}$'
        and not exists (select 1 from pousada_coupons where pousada_id = p_pousada_id and code = v_code);
    end loop;
    insert into pousada_coupons (pousada_id, code, kind, value, valid_from, valid_until,
                                 stay_from, stay_until, max_uses, active, created_by, guest_user_id, offer_id)
    values (p_pousada_id, v_code, 'percent', p_percent, v_today, v_today + coalesce(p_valid_days, 30),
            p_stay_from, p_stay_until, 1, true, p_actor, v_user, v_offer)
    returning id into v_coupon;
    insert into offer_deliveries (offer_id, pousada_id, user_id, coupon_id)
    values (v_offer, p_pousada_id, v_user, v_coupon);
    v_sent := v_sent + 1;
  end loop;

  if v_sent = 0 then
    delete from pousada_offers where id = v_offer;
    return jsonb_build_object('offerId', null, 'sent', 0);
  end if;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (p_actor, 'offer.sent', 'pousada_offers', v_offer,
          jsonb_build_object('pousadaId', p_pousada_id, 'kind', p_kind, 'percent', p_percent, 'recipients', v_sent));
  return jsonb_build_object('offerId', v_offer, 'sent', v_sent);
end;
$$;
revoke all on function create_offer_for_audience(uuid, text, integer, integer, date, date, text, uuid, uuid[])
  from public, anon, authenticated;

create or replace function send_pousada_offer(
  p_pousada_id uuid, p_percent integer, p_valid_days integer default 30,
  p_stay_from date default null, p_stay_until date default null, p_message text default ''
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null or not auth_can_manage_pousada(p_pousada_id) then
    raise exception 'Só o dono ou o gestor da pousada envia ofertas.';
  end if;
  if p_percent is null or p_percent not between 5 and 50 then
    raise exception 'O desconto vai de 5%% a 50%%.';
  end if;
  if p_valid_days is null or p_valid_days not between 7 and 90 then
    raise exception 'A validade vai de 7 a 90 dias.';
  end if;
  if p_stay_until is not null and p_stay_until <= coalesce(p_stay_from, pousada_local_date(p_pousada_id)) then
    raise exception 'O período da estadia precisa terminar depois de começar.';
  end if;
  return create_offer_for_audience(p_pousada_id, 'manual', p_percent, p_valid_days,
                                   p_stay_from, p_stay_until, p_message, auth.uid());
end;
$$;
revoke all on function send_pousada_offer(uuid, integer, integer, date, date, text) from public, anon;
grant execute on function send_pousada_offer(uuid, integer, integer, date, date, text) to authenticated;

-- Quantas pessoas a próxima oferta alcança (painel, antes de enviar).
create or replace function count_offer_audience(p_pousada_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not auth_can_manage_pousada(p_pousada_id) then
    raise exception 'Sem permissão.';
  end if;
  return jsonb_build_object(
    'consented', (select count(*) from offer_consents c where c.pousada_id = p_pousada_id and c.granted),
    'reachable', (select count(*) from offer_audience(p_pousada_id))
  );
end;
$$;
revoke all on function count_offer_audience(uuid) from public, anon;
grant execute on function count_offer_audience(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- (E) E-mail, abertura, reserva e relatório
-- ----------------------------------------------------------------------------
-- Envios ainda sem e-mail (até 3 tentativas, nos últimos 7 dias). Só service_role.
create or replace function list_offer_emails_due(p_limit integer default 50)
returns table (
  delivery_id uuid, email text, guest_name text, pousada_name text, pousada_slug text,
  code text, percent integer, valid_until date, stay_from date, stay_until date, message text
)
language sql stable security definer set search_path = public as $$
  select d.id, u.email::text, split_part(trim(coalesce(pr.full_name, '')), ' ', 1),
         p.name, p.slug, c.code, o.percent, c.valid_until, o.stay_from, o.stay_until, o.message
    from offer_deliveries d
    join pousada_offers o on o.id = d.offer_id
    join pousada_coupons c on c.id = d.coupon_id
    join pousadas p on p.id = d.pousada_id
    join auth.users u on u.id = d.user_id
    left join profiles pr on pr.id = d.user_id
   where d.email_sent_at is null and d.email_attempts < 3
     and d.created_at > now() - interval '7 days'
     and coalesce(u.email, '') <> ''
     -- Desistiu depois do envio: não manda.
     and exists (select 1 from offer_consents oc
                  where oc.user_id = d.user_id and oc.pousada_id = d.pousada_id and oc.granted)
   order by d.created_at
   limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;
revoke all on function list_offer_emails_due(integer) from public, anon, authenticated;
grant execute on function list_offer_emails_due(integer) to service_role;

create or replace function mark_offer_email(p_delivery_id uuid, p_sent boolean)
returns void
language sql volatile security definer set search_path = public as $$
  update offer_deliveries
     set email_attempts = email_attempts + 1,
         email_sent_at = case when p_sent then now() else email_sent_at end
   where id = p_delivery_id and email_sent_at is null;
$$;
revoke all on function mark_offer_email(uuid, boolean) from public, anon, authenticated;
grant execute on function mark_offer_email(uuid, boolean) to service_role;

-- Ofertas valendo para o usuário logado (loja e app). Marca como aberta.
create or replace function my_active_offers()
returns table (
  delivery_id uuid, pousada_name text, pousada_slug text, code text, percent integer,
  valid_until date, stay_from date, stay_until date, message text
)
language sql stable security definer set search_path = public as $$
  select d.id, p.name, p.slug, c.code, c.value, c.valid_until, c.stay_from, c.stay_until, o.message
    from offer_deliveries d
    join pousada_coupons c on c.id = d.coupon_id
    join pousada_offers o on o.id = d.offer_id
    join pousadas p on p.id = d.pousada_id
   where d.user_id = auth.uid() and d.booking_id is null and c.active
     and (c.valid_until is null or c.valid_until >= pousada_local_date(d.pousada_id))
     and exists (select 1 from offer_consents oc
                  where oc.user_id = d.user_id and oc.pousada_id = d.pousada_id and oc.granted)
   order by c.valid_until nulls last, d.created_at desc;
$$;
revoke all on function my_active_offers() from public, anon;
grant execute on function my_active_offers() to authenticated;

create or replace function mark_offer_opened(p_code text)
returns void
language sql volatile security definer set search_path = public as $$
  update offer_deliveries d set opened_at = now()
    from pousada_coupons c
   where c.id = d.coupon_id and c.code = upper(btrim(coalesce(p_code, '')))
     and d.user_id = auth.uid() and d.opened_at is null;
$$;
revoke all on function mark_offer_opened(text) from public, anon;
grant execute on function mark_offer_opened(text) to authenticated;

-- Reserva feita com o cupom da oferta: entra no relatório.
create or replace function trg_offer_delivery_booked()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update offer_deliveries set booking_id = new.booking_id,
                              opened_at = coalesce(opened_at, now())
   where coupon_id = new.coupon_id and booking_id is null;
  return null;
end;
$$;
revoke all on function trg_offer_delivery_booked() from public, anon, authenticated;
drop trigger if exists trg_offer_delivery_booked on booking_coupon_redemptions;
create trigger trg_offer_delivery_booked
  after insert on booking_coupon_redemptions
  for each row execute function trg_offer_delivery_booked();

-- Relatório do painel: cada oferta com enviados, abertos e reservas (sem nomes).
create or replace function get_pousada_offer_report(p_pousada_id uuid)
returns table (
  offer_id uuid, kind text, percent integer, valid_days integer, stay_from date, stay_until date,
  message text, created_at timestamptz, recipients integer, emailed integer, opened integer,
  booked integer, revenue numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not (auth_can_manage_pousada(p_pousada_id) or auth_has_active_grant(p_pousada_id)) then
    raise exception 'Sem permissão.';
  end if;
  return query
  select o.id, o.kind, o.percent, o.valid_days, o.stay_from, o.stay_until, o.message, o.created_at,
         count(d.id)::integer,
         count(d.email_sent_at)::integer,
         count(d.opened_at)::integer,
         count(b.id)::integer,
         coalesce(sum(b.total), 0)::numeric
    from pousada_offers o
    left join offer_deliveries d on d.offer_id = o.id
    left join bookings b on b.id = d.booking_id and b.status <> 'cancelled'
   where o.pousada_id = p_pousada_id
   group by o.id
   order by o.created_at desc
   limit 50;
end;
$$;
revoke all on function get_pousada_offer_report(uuid) from public, anon;
grant execute on function get_pousada_offer_report(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- coupon_evaluate e list_pousada_coupons (0100) com o cupom de uma pessoa só.
-- ----------------------------------------------------------------------------
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
  -- [0111] Cupom de oferta: só a pessoa que recebeu usa. Para os outros é
  -- como se não existisse (mesma resposta de código inválido).
  if v_c.guest_user_id is not null and v_c.guest_user_id is distinct from p_user then
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
    -- [0111] cupons de oferta (um por ex-hóspede) ficam no relatório das ofertas.
    and c.guest_user_id is null
  order by c.active desc, c.created_at desc;
end;
$$;
revoke all on function list_pousada_coupons(uuid) from public, anon;
grant execute on function list_pousada_coupons(uuid) to authenticated;
