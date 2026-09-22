-- =============================================================================
-- 0061 — Corrige `sync_subscription_status`/`record_subscription_invoice`
-- (0056) pra aceitar os parâmetros de data como nulos.
--
-- Bug latente descoberto ao regenerar `database.types.ts` pra 0060: nenhum
-- parâmetro de `date`/`timestamptz` dessas duas funções tinha `default null`
-- na 0056 — sem isso, o gerador de tipos do Supabase assume `string`
-- obrigatório (nunca `string | null`) mesmo o Postgres aceitando `null` em
-- qualquer parâmetro sem `not null`. `repositories/subscriptions.repository.ts`
-- sempre foi escrito contra `string | null` de propósito (nem toda resposta do
-- Mercado Pago traz `next_payment_date`/`date_approved` — ver
-- `sync.service.ts`/comentário da 0056), então o app SEMPRE pôde mandar
-- `null` aqui; só o tipo gerado é que mentia. Mesma lição já documentada em
-- `upsert_guest` (0058): parâmetro opcional-sem-default quebra a inferência.
--
-- Corpo das duas funções idêntico ao da 0056 — só os parâmetros ganham
-- `default null`. Sem `drop function` antes: a assinatura (nomes/tipos/
-- quantidade de parâmetros) não muda, então não há overload ambíguo.
-- =============================================================================

create or replace function sync_subscription_status(
  p_mp_preapproval_id text,
  p_status text,
  p_next_billing_date date default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if p_status not in ('pending', 'authorized', 'paused', 'cancelled') then
    raise exception 'Status de assinatura inválido: %', p_status;
  end if;

  update subscriptions
    set status = p_status, next_billing_date = p_next_billing_date, updated_at = now()
    where mp_preapproval_id = p_mp_preapproval_id
    returning id into v_id;

  if v_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (null, 'subscription.status_synced', 'subscriptions', v_id,
      jsonb_build_object('mpPreapprovalId', p_mp_preapproval_id, 'status', p_status));

  return jsonb_build_object('status', 'ok', 'subscriptionId', v_id);
end;
$$;
revoke all on function sync_subscription_status(text, text, date) from public, anon, authenticated;
grant execute on function sync_subscription_status(text, text, date) to service_role;

create or replace function record_subscription_invoice(
  p_mp_preapproval_id text,
  p_mp_payment_id text,
  p_amount numeric,
  p_status text,
  p_period_start date default null,
  p_period_end date default null,
  p_paid_at timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_subscription_id uuid;
  v_invoice_id uuid;
begin
  if p_status not in ('pending', 'approved', 'rejected', 'refunded', 'cancelled') then
    raise exception 'Status de fatura inválido: %', p_status;
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'Valor de fatura inválido.';
  end if;

  select id into v_subscription_id from subscriptions where mp_preapproval_id = p_mp_preapproval_id;
  if v_subscription_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  insert into invoices (subscription_id, mp_payment_id, amount, status, period_start, period_end, paid_at)
  values (v_subscription_id, p_mp_payment_id, p_amount, p_status, p_period_start, p_period_end, p_paid_at)
  on conflict (mp_payment_id) do update set
    status     = excluded.status,
    paid_at    = excluded.paid_at
  returning id into v_invoice_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (null, 'subscription.invoice_recorded', 'invoices', v_invoice_id,
      jsonb_build_object('subscriptionId', v_subscription_id, 'status', p_status, 'amount', p_amount));

  return jsonb_build_object('status', 'ok', 'invoiceId', v_invoice_id);
end;
$$;
revoke all on function record_subscription_invoice(text, text, numeric, text, date, date, timestamptz)
  from public, anon, authenticated;
grant execute on function record_subscription_invoice(text, text, numeric, text, date, date, timestamptz)
  to service_role;
