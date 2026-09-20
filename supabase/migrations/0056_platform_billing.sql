-- =============================================================================
-- Motor de cobrança da assinatura da Rota — plans/subscriptions/invoices.
--
-- Decisão de 19/09/2026 (confirmada com Gibson, ver doc do projeto
-- claude/analise-financeiro-painel-master-2026-09-19.md): plano único,
-- R$59,90/mês por pousada, cobrança automática recorrente via Mercado Pago
-- ASSINATURAS (preapproval API). Isso é uma API DIFERENTE do Checkout Pro
-- usado em `pousada_payment_accounts`/`payments` (0039/0042): lá cada
-- pousada recebe na PRÓPRIA conta MP; aqui é a conta PRÓPRIA da Rota que
-- cobra a pousada. Não confundir as duas integrações.
--
-- Preço em `numeric(14,2)` — mesma precisão de `payments.amount`/
-- `bookings.balance_due` (0042) — e não a convenção "reais inteiros" de
-- `bookings.fee/total`/`platform_expenses.amount`: R$59,90 tem centavos e
-- precisa bater exatamente com o que a API do Mercado Pago cobra/devolve.
--
-- Todo write passa por função SECURITY DEFINER (nenhuma policy de
-- insert/update/delete direta), mesmo padrão de `pousada_payment_accounts`
-- (0039): a criação de assinatura muda quem é cobrado de verdade, e a
-- sincronização de status/fatura vem do webhook (sem sessão de usuário,
-- só service_role — mesmo padrão de `reconcile_marketplace_payment`, 0042).
-- =============================================================================

create table plans (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  price                   numeric(14,2) not null check (price > 0),
  mp_preapproval_plan_id  text,
  active                  boolean not null default true,
  created_at              timestamptz not null default now()
);

-- Plano único decidido com Gibson em 19/09/2026: R$59,90/mês, mesmo valor
-- pra toda pousada. `mp_preapproval_plan_id` começa nulo — é preenchido
-- depois, chamando a API do Mercado Pago com a conta de verdade da Rota
-- (`bootstrapPlatformPlan` em subscription.service.ts), nunca hardcoded
-- aqui: a migration não tem acesso à internet nem aos segredos de produção.
insert into plans (name, price) values ('Padrão', 59.90);

create table subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  pousada_id         uuid not null references pousadas(id) on delete cascade,
  plan_id            uuid not null references plans(id),
  mp_preapproval_id  text unique,
  status             text not null default 'pending'
                       check (status in ('pending', 'authorized', 'paused', 'cancelled')),
  next_billing_date  date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (pousada_id)
);
create index idx_subscriptions_status on subscriptions(status);

create table invoices (
  id               uuid primary key default gen_random_uuid(),
  subscription_id  uuid not null references subscriptions(id) on delete cascade,
  mp_payment_id    text unique,
  amount           numeric(14,2) not null check (amount >= 0),
  status           text not null default 'pending'
                     check (status in ('pending', 'approved', 'rejected', 'refunded', 'cancelled')),
  period_start     date,
  period_end       date,
  paid_at          timestamptz,
  created_at       timestamptz not null default now()
);
create index idx_invoices_subscription on invoices(subscription_id);
create index idx_invoices_status on invoices(status);

alter table plans enable row level security;
alter table subscriptions enable row level security;
alter table invoices enable row level security;

-- Preço não é segredo — qualquer usuário autenticado pode ler (a pousada
-- precisa ver o valor antes de assinar). `anon` fica de fora de propósito.
create policy "plans_read" on plans for select
  using (auth.uid() is not null);

create policy "subscriptions_read" on subscriptions for select
  using (auth_can_manage_pousada(pousada_id) or auth_is_platform_admin());

create policy "invoices_read" on invoices for select
  using (
    exists (
      select 1 from subscriptions s
      where s.id = invoices.subscription_id
        and (auth_can_manage_pousada(s.pousada_id) or auth_is_platform_admin())
    )
  );

-- Nenhuma policy de insert/update/delete em nenhuma das três tabelas — toda
-- escrita passa pelas funções abaixo (security definer) ou pelo service_role
-- do webhook, nunca direto pela tabela.

-- ----------------------------------------------------------------------------
-- create_pending_subscription — chamada pelo proprietário (ou master) ao
-- iniciar a autorização no Mercado Pago. `p_mp_preapproval_id` já vem pronto
-- da API (subscription.service.ts cria lá antes de chamar aqui) — grava como
-- 'pending' até o webhook confirmar a autorização de verdade. Upsert por
-- `pousada_id`: permite reassinar depois de um cancelamento sem duplicar
-- linha (o histórico de faturas antigas continua referenciando o mesmo
-- `subscription_id`, o que é o comportamento desejado pra contabilidade).
-- ----------------------------------------------------------------------------
create or replace function create_pending_subscription(
  p_pousada_id uuid,
  p_plan_id uuid,
  p_mp_preapproval_id text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not (auth_is_active_owner_of(p_pousada_id) or auth_is_platform_admin()) then
    raise exception 'Somente o proprietário pode assinar o plano desta pousada.';
  end if;
  if p_mp_preapproval_id is null or length(p_mp_preapproval_id) = 0 then
    raise exception 'ID de assinatura do Mercado Pago inválido.';
  end if;

  insert into subscriptions (pousada_id, plan_id, mp_preapproval_id, status)
  values (p_pousada_id, p_plan_id, p_mp_preapproval_id, 'pending')
  on conflict (pousada_id) do update set
    plan_id           = excluded.plan_id,
    mp_preapproval_id = excluded.mp_preapproval_id,
    status            = 'pending',
    next_billing_date = null,
    updated_at        = now()
  returning id into v_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'subscription.authorization_started', 'subscriptions', v_id,
      jsonb_build_object('pousadaId', p_pousada_id, 'mpPreapprovalId', p_mp_preapproval_id));

  return v_id;
end;
$$;
revoke all on function create_pending_subscription(uuid, uuid, text) from public, anon;
grant execute on function create_pending_subscription(uuid, uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- sync_subscription_status — chamada só pelo webhook (service_role, sem
-- sessão de usuário), no evento `subscription_preapproval`. Nunca lança para
-- ID desconhecido (webhook pode chegar de outro ambiente/preapproval de
-- teste) — devolve `not_found` e quem chama decide o que fazer.
-- ----------------------------------------------------------------------------
create or replace function sync_subscription_status(
  p_mp_preapproval_id text,
  p_status text,
  p_next_billing_date date
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

-- ----------------------------------------------------------------------------
-- record_subscription_invoice — chamada só pelo webhook, no evento
-- `subscription_authorized_payment` (cada cobrança recorrente de verdade).
-- Idempotente por `mp_payment_id` (unique + on conflict), mesmo espírito de
-- `reconcile_marketplace_payment` (0042) mas mais simples: fatura de
-- assinatura não tem estorno parcial/split pra reconciliar.
-- ----------------------------------------------------------------------------
create or replace function record_subscription_invoice(
  p_mp_preapproval_id text,
  p_mp_payment_id text,
  p_amount numeric,
  p_status text,
  p_period_start date,
  p_period_end date,
  p_paid_at timestamptz
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
