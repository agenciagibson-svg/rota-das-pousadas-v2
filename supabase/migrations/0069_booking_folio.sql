-- =============================================================================
-- 0069 — Conta do hóspede: consumo por pedido e pagamento no balcão.
--
-- Até aqui só o Mercado Pago registrava pagamento (webhook →
-- `reconcile_marketplace_payment`, 0042). Dinheiro, PIX direto ou cartão na
-- maquininha não tinham onde ser lançados: a reserva ficava com saldo a
-- receber para sempre. E o que o hóspede consumia na pousada não entrava na
-- conta.
--
-- (1) `booking_charges`: um lançamento por pedido (descrição, quantidade e
--     valor unitário, com centavos). `bookings.charges_amount` guarda a soma
--     dos lançamentos ativos, e o saldo (`balance_due`) passa a ser
--     total + consumo − recebido.
-- (2) `payments` ganha a origem (`mercadopago` | `manual`), quem registrou,
--     observação e os campos de estorno. Pagamento manual entra aprovado e
--     soma em `amount_received`, como o do Mercado Pago.
-- (3) Nada é apagado: consumo lançado por engano é cancelado e pagamento
--     manual é estornado, sempre com motivo e auditoria. Pagamento do Mercado
--     Pago só é estornado pelo próprio Mercado Pago (o webhook atualiza).
--
-- Permissões (espelham lib/auth/rbac.ts):
--   lançar consumo e registrar pagamento = `payment:register` →
--     `auth_has_operational_access` (proprietário, admin_pousada, recepção,
--     financeiro) ou master da plataforma;
--   cancelar consumo e estornar pagamento = `payment:refund` →
--     `auth_has_finance_access` (proprietário, admin_pousada, financeiro) ou
--     master. A recepção lança, mas não desfaz.
--
-- Status: consumo só em reserva confirmada, hospedada ou encerrada (a
-- pendente ainda aguarda o pagamento da estadia, que o Mercado Pago cobra
-- pelo saldo). Pagamento manual também na pendente: se quitar, confirma a
-- reserva, como o webhook faz; se for sinal, tira o prazo de pagamento, para
-- a expiração automática (0050) não cancelar reserva que já recebeu dinheiro.
-- =============================================================================

-- (1) Pagamentos: origem, quem registrou e estorno. Tudo o que já existe veio
-- do webhook do Mercado Pago, daí o default.
alter table payments
  add column if not exists source text not null default 'mercadopago',
  add column if not exists recorded_by uuid references profiles(id),
  add column if not exists notes text not null default '',
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by uuid references profiles(id),
  add column if not exists reversal_reason text;
alter table payments drop constraint if exists payments_source_check;
alter table payments add constraint payments_source_check check (source in ('mercadopago', 'manual'));
alter table payments drop constraint if exists payments_manual_method_check;
alter table payments add constraint payments_manual_method_check
  check (source <> 'manual' or method in ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito'));

-- (2) Consumo. Escrita só pelas RPCs abaixo (security definer): sem policy de
-- insert/update/delete. Leitura para quem opera a reserva (mesma regra de
-- `payments_read`, 0020).
create table if not exists booking_charges (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references bookings(id) on delete cascade,
  pousada_id          uuid not null references pousadas(id) on delete cascade,
  description         text not null check (length(description) between 1 and 120),
  quantity            integer not null check (quantity between 1 and 999),
  unit_price          numeric(14,2) not null check (unit_price > 0 and unit_price <= 100000),
  amount              numeric(14,2) generated always as (quantity * unit_price) stored,
  created_by          uuid references profiles(id),
  created_at          timestamptz not null default now(),
  cancelled_at        timestamptz,
  cancelled_by        uuid references profiles(id),
  cancellation_reason text
);
create index if not exists idx_booking_charges_booking on booking_charges(booking_id);
alter table booking_charges enable row level security;
drop policy if exists "booking_charges_read" on booking_charges;
create policy "booking_charges_read" on booking_charges for select
  using (auth_has_operational_access(pousada_id) or auth_has_active_grant(pousada_id));

-- (3) Saldo com consumo. Coluna gerada só muda recriando (mesmo caminho da 0042).
alter table bookings add column if not exists charges_amount numeric(14,2) not null default 0;
alter table bookings drop constraint if exists bookings_charges_amount_nonneg;
alter table bookings add constraint bookings_charges_amount_nonneg check (charges_amount >= 0);
alter table bookings drop column if exists balance_due;
alter table bookings add column balance_due numeric(14,2)
  generated always as (total + charges_amount - amount_received) stored;

-- ----------------------------------------------------------------------------
-- Lançar consumo (um por pedido).
-- ----------------------------------------------------------------------------
create or replace function add_booking_charge(
  p_booking_id uuid, p_description text, p_quantity integer, p_unit_price numeric
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_booking bookings%rowtype;
  v_description text := trim(coalesce(p_description, ''));
  v_charge booking_charges%rowtype;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then raise exception 'Reserva não encontrada.'; end if;
  if not (auth_has_operational_access(v_booking.pousada_id) or auth_is_platform_master()) then
    raise exception 'Você não tem permissão para lançar consumo nesta reserva.';
  end if;
  if v_booking.status not in ('confirmed', 'checked_in', 'checked_out') then
    raise exception 'Consumo só pode ser lançado em reserva confirmada, hospedada ou encerrada.';
  end if;
  if length(v_description) not between 1 and 120 then
    raise exception 'Descreva o consumo em até 120 caracteres.';
  end if;
  if p_quantity is null or p_quantity not between 1 and 999 then
    raise exception 'Quantidade inválida.';
  end if;
  if p_unit_price is null or p_unit_price <= 0 or p_unit_price > 100000 or p_unit_price <> round(p_unit_price, 2) then
    raise exception 'Valor unitário inválido.';
  end if;

  insert into booking_charges (booking_id, pousada_id, description, quantity, unit_price, created_by)
  values (p_booking_id, v_booking.pousada_id, v_description, p_quantity, p_unit_price, auth.uid())
  returning * into v_charge;

  update bookings set charges_amount = charges_amount + v_charge.amount, version = version + 1,
    updated_by = auth.uid(), updated_at = now()
  where id = p_booking_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'booking.charge_added', 'booking_charges', v_charge.id,
          jsonb_build_object('bookingId', p_booking_id, 'description', v_description, 'quantity', p_quantity,
                             'unitPrice', p_unit_price, 'amount', v_charge.amount));

  return jsonb_build_object('id', v_charge.id, 'amount', v_charge.amount);
end;
$$;

-- ----------------------------------------------------------------------------
-- Cancelar consumo lançado por engano (fica registrado, com motivo).
-- ----------------------------------------------------------------------------
create or replace function cancel_booking_charge(p_charge_id uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_booking_id uuid;
  v_pousada_id uuid;
  v_charge booking_charges%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  select booking_id, pousada_id into v_booking_id, v_pousada_id from booking_charges where id = p_charge_id;
  if v_booking_id is null then raise exception 'Lançamento não encontrado.'; end if;
  if not (auth_has_finance_access(v_pousada_id) or auth_is_platform_master()) then
    raise exception 'Você não tem permissão para cancelar consumo.';
  end if;
  if length(v_reason) not between 3 and 300 then
    raise exception 'Informe o motivo do cancelamento (3 a 300 caracteres).';
  end if;

  -- Mesma ordem de locks dos pagamentos: reserva, depois o lançamento.
  perform 1 from bookings where id = v_booking_id for update;
  select * into v_charge from booking_charges where id = p_charge_id for update;
  if v_charge.cancelled_at is not null then raise exception 'Este consumo já foi cancelado.'; end if;

  update booking_charges set cancelled_at = now(), cancelled_by = auth.uid(), cancellation_reason = v_reason
  where id = p_charge_id;
  update bookings set charges_amount = charges_amount - v_charge.amount, version = version + 1,
    updated_by = auth.uid(), updated_at = now()
  where id = v_booking_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'booking.charge_cancelled', 'booking_charges', p_charge_id,
          jsonb_build_object('bookingId', v_booking_id, 'amount', v_charge.amount, 'reason', v_reason));

  return jsonb_build_object('id', p_charge_id, 'amount', v_charge.amount);
end;
$$;

-- ----------------------------------------------------------------------------
-- Registrar pagamento feito na pousada (dinheiro, PIX direto, cartão).
-- ----------------------------------------------------------------------------
create or replace function register_manual_payment(
  p_booking_id uuid, p_method text, p_amount numeric, p_notes text default ''
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_booking bookings%rowtype;
  v_notes text := trim(coalesce(p_notes, ''));
  v_payment_id uuid;
  v_balance numeric(14,2);
  v_confirmed boolean := false;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then raise exception 'Reserva não encontrada.'; end if;
  if not (auth_has_operational_access(v_booking.pousada_id) or auth_is_platform_master()) then
    raise exception 'Você não tem permissão para registrar pagamento nesta reserva.';
  end if;
  if v_booking.status not in ('pending', 'confirmed', 'checked_in', 'checked_out') then
    raise exception 'Esta reserva não aceita pagamento.';
  end if;
  if p_method is null or p_method not in ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito') then
    raise exception 'Forma de pagamento inválida.';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'Valor inválido.';
  end if;
  -- Teto no saldo: evita erro de digitação (R$ 5.000 no lugar de R$ 500).
  if p_amount > v_booking.balance_due then
    raise exception 'Valor maior que o saldo em aberto (R$ %).',
      replace(to_char(v_booking.balance_due, 'FM9999999990.00'), '.', ',');
  end if;
  if length(v_notes) > 300 then raise exception 'Observação muito longa (máximo de 300 caracteres).'; end if;

  insert into payments (booking_id, amount, method, status, source, provider_updated_at,
                        refunded_amount, credited_amount, recorded_by, notes)
  values (p_booking_id, p_amount, p_method, 'aprovado', 'manual', now(), 0, p_amount, auth.uid(), v_notes)
  returning id into v_payment_id;

  v_balance := v_booking.balance_due - p_amount;
  update bookings set amount_received = amount_received + p_amount, version = version + 1,
    updated_by = auth.uid(), updated_at = now()
  where id = p_booking_id;

  if v_booking.status = 'pending' then
    if v_balance <= 0 then
      update bookings set status = 'confirmed' where id = p_booking_id;
      v_confirmed := true;
      insert into audit_log (actor_id, action, target_table, target_id, metadata)
      values (auth.uid(), 'booking.confirmed', 'bookings', p_booking_id,
              jsonb_build_object('source', 'manual_payment', 'from', 'pending'));
    else
      update bookings set payment_due_at = null where id = p_booking_id;
    end if;
  end if;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'payment.manual_recorded', 'payments', v_payment_id,
          jsonb_build_object('bookingId', p_booking_id, 'method', p_method, 'amount', p_amount));

  return jsonb_build_object('paymentId', v_payment_id, 'balanceDue', v_balance, 'confirmed', v_confirmed);
end;
$$;

-- ----------------------------------------------------------------------------
-- Estornar pagamento manual registrado por engano (fica registrado, com motivo).
-- ----------------------------------------------------------------------------
create or replace function reverse_manual_payment(p_payment_id uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_booking_id uuid;
  v_pousada_id uuid;
  v_payment payments%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  select p.booking_id, b.pousada_id into v_booking_id, v_pousada_id
  from payments p join bookings b on b.id = p.booking_id where p.id = p_payment_id;
  if v_booking_id is null then raise exception 'Pagamento não encontrado.'; end if;
  if not (auth_has_finance_access(v_pousada_id) or auth_is_platform_master()) then
    raise exception 'Você não tem permissão para estornar pagamentos.';
  end if;
  if length(v_reason) not between 3 and 300 then
    raise exception 'Informe o motivo do estorno (3 a 300 caracteres).';
  end if;

  -- Mesma ordem de locks do webhook (0042): reserva, depois o pagamento.
  perform 1 from bookings where id = v_booking_id for update;
  select * into v_payment from payments where id = p_payment_id for update;
  if v_payment.source <> 'manual' then
    raise exception 'Pagamento do Mercado Pago é estornado pelo próprio Mercado Pago.';
  end if;
  if v_payment.status <> 'aprovado' or v_payment.reversed_at is not null then
    raise exception 'Este pagamento já foi estornado.';
  end if;

  update payments set status = 'estornado', refunded_amount = amount, credited_amount = 0,
    reversed_at = now(), reversed_by = auth.uid(), reversal_reason = v_reason, provider_updated_at = now()
  where id = p_payment_id;
  update bookings set amount_received = amount_received - v_payment.credited_amount, version = version + 1,
    updated_by = auth.uid(), updated_at = now()
  where id = v_booking_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'payment.manual_reversed', 'payments', p_payment_id,
          jsonb_build_object('bookingId', v_booking_id, 'method', v_payment.method,
                             'amount', v_payment.amount, 'reason', v_reason));

  return jsonb_build_object('paymentId', p_payment_id, 'amount', v_payment.amount);
end;
$$;

revoke all on function add_booking_charge(uuid, text, integer, numeric) from public, anon;
grant execute on function add_booking_charge(uuid, text, integer, numeric) to authenticated;
revoke all on function cancel_booking_charge(uuid, text) from public, anon;
grant execute on function cancel_booking_charge(uuid, text) to authenticated;
revoke all on function register_manual_payment(uuid, text, numeric, text) from public, anon;
grant execute on function register_manual_payment(uuid, text, numeric, text) to authenticated;
revoke all on function reverse_manual_payment(uuid, text) from public, anon;
grant execute on function reverse_manual_payment(uuid, text) to authenticated;
