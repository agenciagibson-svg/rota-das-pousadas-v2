-- =============================================================================
-- 0109 — Fechamento automático da estadia e conta em aberto no check-out
--
-- App único (spec claude/app-unico-loja-estadia-2026-11-20.md, etapa 2):
--
--   (A) bookings ganha `checked_out_auto` (fechada pelo sistema) e
--       `checkout_open_note` (motivo de fechar com consumo em aberto).
--   (B) `booking_auto_close_at`: quando a estadia fecha sozinha — 4 horas
--       depois do horário de check-out da pousada, no último dia, no fuso da
--       pousada (horário vazio ou inválido = 12:00). Espelho em
--       features/app-fases/phase.ts (AUTO_CLOSE_HOURS).
--   (C) `close_overdue_stays`: fecha as estadias `checked_in` que passaram
--       desse horário. Idempotente; chamada pela rodada diária, ao abrir o
--       painel e o app da estadia. Com consumo em aberto, fecha mesmo assim e
--       deixa a pendência anotada (o saldo continua na conta da reserva).
--   (D) `set_booking_status`: check-out pela equipe com consumo em aberto
--       (entregue e não pago, ou pedido ainda em preparo) só com motivo, que
--       fica na reserva e na auditoria. Sem motivo, recusa com o valor.
--
-- O check-out automático passa pelo mesmo gatilho de comissão (0104) e pelo
-- pedido de avaliação (0089), como um check-out feito pela equipe.
--
-- Aditiva e idempotente. Rollback em supabase/rollback/0109_rollback.sql.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- (A) Colunas
-- ----------------------------------------------------------------------------
alter table bookings
  add column if not exists checked_out_auto boolean not null default false,
  add column if not exists checkout_open_note text;

comment on column bookings.checked_out_auto is
  '0109: check-out feito pelo sistema (4h depois do horário de check-out, a pousada não fechou).';
comment on column bookings.checkout_open_note is
  '0109: estadia fechada com consumo em aberto — motivo da equipe ou aviso do fechamento automático.';

-- bookings tem grant por coluna desde a 0105 (contato do hóspede oculto):
-- coluna nova precisa do mesmo grant de leitura (a RLS continua filtrando linhas).
grant select (checked_out_auto, checkout_open_note) on public.bookings to anon, authenticated;

create index if not exists idx_bookings_checked_in_checkout
  on bookings(checkout) where status = 'checked_in';

-- ----------------------------------------------------------------------------
-- (B) Quando a estadia fecha sozinha
-- ----------------------------------------------------------------------------
create or replace function booking_auto_close_at(p_pousada_id uuid, p_checkout date)
returns timestamptz
language sql stable security definer set search_path = public as $$
  select (
    p_checkout
    + case when p.checkout_time ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]'
           then substring(p.checkout_time from '^(([01]?[0-9]|2[0-3]):[0-5][0-9])')::time
           else time '12:00' end
    + interval '4 hours'
  ) at time zone coalesce(nullif(p.timezone, ''), 'America/Sao_Paulo')
  from pousadas p where p.id = p_pousada_id;
$$;
revoke all on function booking_auto_close_at(uuid, date) from public, anon, authenticated;

-- Consumo em aberto de uma reserva: entregue e não pago + pedidos ainda abertos.
create or replace function booking_open_consumption(p_booking_id uuid)
returns numeric
language sql stable security definer set search_path = public as $$
  select greatest(0, (s->>'delivered')::numeric - (s->>'paid')::numeric) + (s->>'open')::numeric
  from (select booking_consumption_summary(p_booking_id) as s) x;
$$;
revoke all on function booking_open_consumption(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- (C) Fechamento automático
-- ----------------------------------------------------------------------------
create or replace function close_overdue_stays()
returns integer
language plpgsql volatile security definer set search_path = public as $$
declare
  v_b record;
  v_open numeric;
  v_count integer := 0;
begin
  for v_b in
    select b.id, b.pousada_id
      from bookings b
     where b.status = 'checked_in'
       and b.checkout <= current_date + 1
       and now() >= booking_auto_close_at(b.pousada_id, b.checkout)
     for update skip locked
  loop
    v_open := booking_open_consumption(v_b.id);
    update bookings set
      status = 'checked_out',
      version = version + 1,
      updated_at = now(),
      checked_out_at = now(),
      checked_out_by = null,
      checked_out_auto = true,
      checkout_open_note = case when v_open > 0.009
        then 'Fechada automaticamente com consumo em aberto de R$ ' || to_char(v_open, 'FM999999990.00')
        else checkout_open_note end
    where id = v_b.id and status = 'checked_in';

    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (null, 'booking.checked_out_auto', 'bookings', v_b.id,
            jsonb_build_object('from', 'checked_in', 'to', 'checked_out', 'openConsumption', v_open));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function close_overdue_stays() from public, anon;
grant execute on function close_overdue_stays() to authenticated, service_role;

comment on function close_overdue_stays() is
  '0109: fecha (checked_out, checked_out_auto) as estadias em curso 4h depois do horário de check-out do último dia. Idempotente.';

-- ----------------------------------------------------------------------------
-- (D) set_booking_status — 0048 + regra da conta em aberto no check-out.
-- Mesma assinatura: `create or replace` preserva grants.
-- ----------------------------------------------------------------------------
create or replace function set_booking_status(
  p_booking_id uuid, p_new_status booking_status, p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_current record;
  v_is_staff boolean;
  v_allowed boolean;
  v_today date;
  v_open numeric := 0;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;

  select * into v_current from bookings where id = p_booking_id for update;
  if v_current.id is null then raise exception 'Reserva não encontrada.'; end if;

  -- [0048] era `auth_is_platform_admin()`; segue o padrão da 0047 (item B):
  -- equipe da plataforma só com concessão ativa e justificada.
  v_is_staff := auth_has_guest_access(v_current.pousada_id) or auth_has_active_grant(v_current.pousada_id);

  if not v_is_staff then
    if v_current.guest_id is distinct from auth.uid() then
      raise exception 'Você não tem permissão sobre esta reserva.';
    end if;
    if p_new_status <> 'cancelled' or v_current.status not in ('quote', 'pending') then
      raise exception 'Você só pode cancelar esta reserva enquanto ela não for confirmada.';
    end if;
  end if;

  v_allowed := (v_current.status, p_new_status) in (
    ('quote', 'pending'), ('quote', 'confirmed'), ('quote', 'cancelled'),
    ('pending', 'confirmed'), ('pending', 'cancelled'),
    ('confirmed', 'cancelled'), ('confirmed', 'no_show'),
    -- 0048: ciclo da estadia
    ('confirmed', 'checked_in'),
    ('checked_in', 'checked_out')
  );
  if not v_allowed then
    raise exception 'Transição de % para % não é permitida.', v_current.status, p_new_status;
  end if;
  if p_new_status in ('cancelled', 'no_show') and (p_reason is null or length(trim(p_reason)) < 3) then
    raise exception 'Descreva o motivo.';
  end if;

  -- Check-in só a partir da data de entrada, no fuso da pousada.
  if p_new_status = 'checked_in' then
    select (now() at time zone coalesce(nullif(p.timezone, ''), 'America/Sao_Paulo'))::date
      into v_today
      from pousadas p where p.id = v_current.pousada_id;
    if v_today < v_current.checkin then
      raise exception 'Check-in só pode ser feito a partir de %.', to_char(v_current.checkin, 'DD/MM/YYYY');
    end if;
  end if;

  -- [0109] Check-out com consumo em aberto só com motivo (fica na reserva).
  if p_new_status = 'checked_out' then
    v_open := booking_open_consumption(p_booking_id);
    if v_open > 0.009 and (p_reason is null or length(trim(p_reason)) < 3) then
      raise exception 'Há consumo em aberto de R$ %. Registre o pagamento antes do check-out ou informe o motivo para fechar com pendência.',
        to_char(v_open, 'FM999999990.00');
    end if;
  end if;

  update bookings set
    status = p_new_status,
    version = version + 1,
    updated_by = auth.uid(),
    updated_at = now(),
    cancelled_by = case when p_new_status = 'cancelled' then auth.uid() else cancelled_by end,
    cancelled_at = case when p_new_status = 'cancelled' then now() else cancelled_at end,
    cancellation_reason = case when p_new_status = 'cancelled' then p_reason else cancellation_reason end,
    no_show_by = case when p_new_status = 'no_show' then auth.uid() else no_show_by end,
    no_show_at = case when p_new_status = 'no_show' then now() else no_show_at end,
    no_show_reason = case when p_new_status = 'no_show' then p_reason else no_show_reason end,
    checked_in_by = case when p_new_status = 'checked_in' then auth.uid() else checked_in_by end,
    checked_in_at = case when p_new_status = 'checked_in' then now() else checked_in_at end,
    checked_out_by = case when p_new_status = 'checked_out' then auth.uid() else checked_out_by end,
    checked_out_at = case when p_new_status = 'checked_out' then now() else checked_out_at end,
    checked_out_auto = case when p_new_status = 'checked_out' then false else checked_out_auto end,
    checkout_open_note = case
      when p_new_status = 'checked_out' and v_open > 0.009 then left(trim(p_reason), 300)
      when p_new_status = 'checked_out' then null
      else checkout_open_note end
  where id = p_booking_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(),
          case p_new_status
            when 'confirmed' then 'booking.confirmed'
            when 'cancelled' then 'booking.cancelled'
            when 'no_show' then 'booking.no_show'
            when 'checked_in' then 'booking.checked_in'
            when 'checked_out' then 'booking.checked_out'
            else 'booking.status_changed'
          end,
          'bookings', p_booking_id,
          jsonb_build_object('from', v_current.status, 'to', p_new_status, 'reason', p_reason)
            || case when v_open > 0.009 then jsonb_build_object('openConsumption', v_open) else '{}'::jsonb end);

  return jsonb_build_object('id', p_booking_id, 'status', p_new_status);
end;
$$;

comment on function set_booking_status(uuid, booking_status, text) is
  '0048 + 0109: transições da reserva; check-out com consumo em aberto exige motivo (fica em checkout_open_note). Só equipe; hóspede só cancela antes da confirmação.';
