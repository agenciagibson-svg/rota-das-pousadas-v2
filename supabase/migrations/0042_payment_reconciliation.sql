-- Valores monetários permanecem em reais, agora com centavos, sem arredondamento.
alter table payments alter column amount type numeric(14,2);
alter table bookings drop column balance_due;
alter table bookings alter column amount_received type numeric(14,2);
alter table bookings add column balance_due numeric(14,2)
  generated always as (total - amount_received) stored;
alter table payments add column provider_updated_at timestamptz,
  add column refunded_amount numeric(14,2) not null default 0,
  add column credited_amount numeric(14,2) not null default 0;

-- Interrompe a migration se o histórico antigo exige reconciliação manual.
-- Nunca inventa um saldo nem sobrescreve recebimentos já registrados.
do $$ begin
  if exists (select 1 from bookings b join payments p on p.booking_id = b.id
    where p.status = 'aprovado' group by b.id having sum(p.amount) > b.amount_received) then
    raise exception 'Reconcilie pagamentos aprovados históricos antes de aplicar 0042.';
  end if;
end $$;
update payments set credited_amount = amount where status = 'aprovado';

-- O endpoint antigo não valida moeda/versão; fecha sua execução durante a migração.
revoke all on function record_payment_and_confirm_booking(uuid, text, integer, payment_status, text, jsonb)
  from public, anon, authenticated, service_role;

create or replace function reconcile_marketplace_payment(
  p_booking_id uuid, p_provider_ref text, p_amount numeric, p_status payment_status,
  p_method text, p_currency text, p_updated_at timestamptz, p_refunded_amount numeric default 0
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_booking bookings%rowtype;
  v_payment payments%rowtype;
  v_credit numeric(14,2);
  v_received numeric(14,2);
  v_payment_id uuid;
begin
  if p_provider_ref is null or p_provider_ref !~ '^[0-9]+$' or length(p_provider_ref) > 40
    or p_updated_at is null or p_status is null or p_amount is null
    or p_amount <= 0 or p_amount >= 1000000000000 or p_amount <> round(p_amount, 2)
    or p_refunded_amount is null or p_refunded_amount < 0
    or p_refunded_amount > p_amount or p_refunded_amount <> round(p_refunded_amount, 2) then
    raise exception 'Pagamento inválido.';
  end if;
  -- Mesma ordem de locks em todos os eventos: pagamento, depois reserva.
  perform pg_advisory_xact_lock(hashtextextended('mercadopago:' || p_provider_ref, 0));
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then raise exception 'Reserva não encontrada.'; end if;
  if p_currency is distinct from v_booking.currency or p_currency <> 'BRL' then
    raise exception 'Moeda divergente da reserva.';
  end if;
  select * into v_payment from payments where provider_ref = p_provider_ref for update;
  if found then
    if v_payment.booking_id <> p_booking_id or v_payment.amount <> p_amount then
      raise exception 'Referência ou valor do pagamento divergente.';
    end if;
    if v_payment.provider_updated_at > p_updated_at then
      return jsonb_build_object('status', 'stale', 'paymentId', v_payment.id);
    end if;
    if v_payment.provider_updated_at = p_updated_at then
      if v_payment.status <> p_status or v_payment.refunded_amount <> p_refunded_amount then
        raise exception 'Eventos divergentes para a mesma versão do pagamento.';
      end if;
      return jsonb_build_object('status', 'already_recorded', 'paymentId', v_payment.id);
    end if;
  end if;
  v_credit := case when p_status = 'aprovado' then p_amount - p_refunded_amount else 0 end;
  v_received := v_booking.amount_received + v_credit - coalesce(v_payment.credited_amount, 0);
  if v_received < 0 then raise exception 'Saldo inconsistente: revisão financeira necessária.'; end if;

  insert into payments(booking_id, provider_ref, amount, status, method, provider_updated_at, refunded_amount, credited_amount)
    values(p_booking_id, p_provider_ref, p_amount, p_status, p_method, p_updated_at, p_refunded_amount, v_credit)
  on conflict(provider_ref) do update set status = excluded.status, method = excluded.method,
    provider_updated_at = excluded.provider_updated_at, refunded_amount = excluded.refunded_amount,
    credited_amount = excluded.credited_amount
  returning id into v_payment_id;

  update bookings set amount_received = v_received, version = version + 1, updated_at = now()
    where id = p_booking_id;
  if p_status = 'aprovado' and p_refunded_amount = 0 and v_booking.total > 0
    and v_received >= v_booking.total and v_booking.status in ('quote', 'pending') then
    update bookings set status = 'confirmed' where id = p_booking_id;
    insert into audit_log(actor_id, action, target_table, target_id, metadata)
      values(null, 'booking.confirmed', 'bookings', p_booking_id,
        jsonb_build_object('source', 'mercadopago_webhook', 'from', v_booking.status));
  end if;
  -- Estorno não cancela estadia automaticamente; fica registrado para a operação.
  insert into audit_log(actor_id, action, target_table, target_id, metadata)
    values(null, 'payment.reconciled', 'payments', v_payment_id,
      jsonb_build_object('bookingId', p_booking_id, 'status', p_status, 'amount', p_amount,
        'refundedAmount', p_refunded_amount, 'providerUpdatedAt', p_updated_at,
        'requiresReview', p_status = 'estornado' or p_refunded_amount > 0
          or v_received > v_booking.total or v_booking.status in ('cancelled', 'no_show')));
  return jsonb_build_object('status', 'ok', 'paymentId', v_payment_id);
end;
$$;
revoke all on function reconcile_marketplace_payment(uuid, text, numeric, payment_status, text, text, timestamptz, numeric)
  from public, anon, authenticated;
grant execute on function reconcile_marketplace_payment(uuid, text, numeric, payment_status, text, text, timestamptz, numeric)
  to service_role;
