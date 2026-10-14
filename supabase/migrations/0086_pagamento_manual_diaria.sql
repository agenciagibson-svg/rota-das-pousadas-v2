-- 0086 — Pagamento da diária registrado pela equipe.
--
-- Até aqui a diária só "entrava" por Mercado Pago (webhook) ou Pix direto
-- (comprovante aprovado). Hóspede que paga no balcão — dinheiro, cartão na
-- maquininha, Pix na chave da recepção, transferência — ficava com "Falta
-- receber" para sempre, e o financeiro não fechava.
--
-- register_booking_payment: registra um valor recebido (até o saldo). Se a
--   reserva estava pendente e o saldo zera, ela é confirmada.
-- reverse_booking_payment: estorna um lançamento manual feito errado (não
--   apaga: marca o pagamento como estornado e devolve o valor ao saldo).
--   Mesmos papéis do estorno de consumo: proprietário, gestor e financeiro.

create or replace function public.register_booking_payment(
  p_booking_id uuid,
  p_amount numeric,
  p_method text,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pousada uuid;
  v_b bookings%rowtype;
  v_amount numeric(14,2);
  v_id uuid;
  v_remaining numeric(14,2);
  v_confirmed boolean := false;
begin
  -- Permissão antes do lock (mesmo padrão de register_consumption_payment).
  select pousada_id into v_pousada from bookings where id = p_booking_id;
  if v_pousada is null or not auth_has_operational_access(v_pousada) then
    raise exception 'Reserva não encontrada.';
  end if;
  if p_method is null
     or p_method not in ('pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'transferencia', 'outro') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  select * into v_b from bookings where id = p_booking_id for update;
  if v_b.status not in ('pending', 'confirmed', 'checked_in', 'checked_out') then
    raise exception 'Esta reserva não aceita pagamento (situação: %).', v_b.status;
  end if;
  if v_b.balance_due <= 0 then
    raise exception 'Esta reserva já está paga.';
  end if;

  v_amount := round(coalesce(p_amount, 0), 2);
  if v_amount <= 0 then raise exception 'Informe o valor recebido.'; end if;
  if v_amount > v_b.balance_due then
    raise exception 'O valor passa do que falta receber (R$ %).',
      to_char(v_b.balance_due, 'FM999G999G990D00');
  end if;

  insert into payments (booking_id, provider_ref, amount, status, method,
                        provider_updated_at, refunded_amount, credited_amount)
  values (v_b.id, 'manual:' || gen_random_uuid(), v_amount, 'aprovado', 'manual_' || p_method,
          now(), 0, v_amount)
  returning id into v_id;

  update bookings set amount_received = amount_received + v_amount,
         version = version + 1, updated_at = now()
   where id = v_b.id;
  v_remaining := v_b.balance_due - v_amount;

  if v_b.status = 'pending' and v_remaining <= 0 then
    update bookings set status = 'confirmed', payment_due_at = null where id = v_b.id;
    v_confirmed := true;
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'booking.confirmed', 'bookings', v_b.id,
            jsonb_build_object('source', 'manual_payment', 'from', v_b.status, 'paymentId', v_id));
  end if;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'booking_payment.registered', 'bookings', v_b.id,
          jsonb_build_object('pousadaId', v_b.pousada_id, 'paymentId', v_id, 'amount', v_amount,
                             'method', p_method, 'note', left(coalesce(p_note, ''), 200),
                             'remaining', greatest(v_remaining, 0)));

  return jsonb_build_object('bookingId', v_b.id, 'paymentId', v_id, 'amount', v_amount,
                            'remaining', greatest(v_remaining, 0), 'confirmed', v_confirmed);
end;
$$;

revoke all on function public.register_booking_payment(uuid, numeric, text, text) from public, anon;
grant execute on function public.register_booking_payment(uuid, numeric, text, text) to authenticated, service_role;

create or replace function public.reverse_booking_payment(p_payment_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p payments%rowtype;
  v_pousada uuid;
begin
  select b.pousada_id into v_pousada
    from payments p join bookings b on b.id = p.booking_id
   where p.id = p_payment_id;
  if v_pousada is null
     or not auth_has_pousada_role(v_pousada, array['proprietario', 'admin_pousada', 'financeiro_pousada']) then
    raise exception 'Pagamento não encontrado.';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Informe o motivo do estorno.';
  end if;

  select * into v_p from payments where id = p_payment_id for update;
  if v_p.provider_ref is null or v_p.provider_ref not like 'manual:%' then
    raise exception 'Só pagamentos registrados pela equipe podem ser estornados aqui.';
  end if;
  if v_p.status <> 'aprovado' then
    raise exception 'Este pagamento já foi estornado.';
  end if;

  update payments set status = 'estornado', refunded_amount = amount, provider_updated_at = now()
   where id = v_p.id;
  update bookings set amount_received = greatest(amount_received - v_p.amount, 0),
         version = version + 1, updated_at = now()
   where id = v_p.booking_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'booking_payment.reversed', 'bookings', v_p.booking_id,
          jsonb_build_object('pousadaId', v_pousada, 'paymentId', v_p.id, 'amount', v_p.amount,
                             'reason', left(trim(p_reason), 190)));

  return jsonb_build_object('bookingId', v_p.booking_id, 'amount', v_p.amount);
end;
$$;

revoke all on function public.reverse_booking_payment(uuid, text) from public, anon;
grant execute on function public.reverse_booking_payment(uuid, text) to authenticated, service_role;
