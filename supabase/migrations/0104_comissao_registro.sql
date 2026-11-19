-- =============================================================================
-- 0104 — Registro da comissão da Rota por reserva e extratos.
--
-- Modelo v1.2 (docs/04_BUSINESS_ARCHITECTURE.md §9): 6% sobre a reserva
-- originada pela plataforma, pagos pela pousada. Esta migration só REGISTRA
-- quanto é devido e mostra o extrato. Não cobra nada: a separação no cartão e
-- a fatura do Pix direto são entregas seguintes.
--
-- 1. booking_commissions: uma linha por reserva que gera comissão, gravada
--    quando a reserva faz check-out (hospedagem efetivada). Guarda a base, o
--    percentual e o valor como foram calculados na hora: mudar o percentual
--    depois não reescreve o passado.
--
-- 2. Quando gera comissão (tudo ao mesmo tempo):
--    - origem da reserva é a plataforma: `rota_das_pousadas` ou `link_bio`;
--    - a pousada já tinha aceitado o contrato quando a reserva foi criada
--      (0103). Sem contrato aceito, nada é registrado: é o interruptor.
--    Reserva de balcão, telefone, WhatsApp e de outros canais nunca entra.
--
-- 3. Isenção de lançamento (fundadoras, 0103): reserva criada até
--    `commission_exempt_until` e com check-in até 90 dias depois dessa data
--    fica registrada como isenta. O valor que seria cobrado continua na linha,
--    para o extrato mostrar quanto a pousada deixou de pagar.
--
-- 4. Base: `bookings.total` (diárias, taxas e serviços da reserva, já com
--    desconto de cupom). Consumo durante a estadia (pedidos) não entra.
--    Cancelamento e não comparecimento com valor retido ainda NÃO geram linha
--    (cláusula 4.2 do contrato): entram com a cobrança.
--
-- Rollback: supabase/rollback/0104_rollback.sql
-- =============================================================================

-- O percentual vigente. O mesmo número está em lib/platform-commission.ts
-- (textos do site); um teste confere que os dois não divergem.
create or replace function platform_commission_rate()
returns numeric
language sql immutable set search_path = public as $$
  select 0.06::numeric;
$$;
revoke all on function platform_commission_rate() from public, anon, authenticated;

create table booking_commissions (
  booking_id    uuid primary key references bookings(id) on delete cascade,
  pousada_id    uuid not null references pousadas(id) on delete cascade,
  -- Mês do check-out (primeiro dia): é o mês em que a comissão entra no extrato.
  period_month  date not null check (extract(day from period_month) = 1),
  origin        booking_origin not null,
  base_amount   numeric(12,2) not null check (base_amount >= 0),
  rate          numeric(5,4) not null check (rate >= 0 and rate <= 1),
  -- Sempre base × percentual, inclusive quando isenta (é o valor dispensado).
  amount        numeric(12,2) not null check (amount >= 0),
  exempt        boolean not null default false,
  exempt_reason text not null default '' check (exempt_reason in ('', 'lancamento')),
  created_at    timestamptz not null default now(),
  check (exempt = (exempt_reason <> ''))
);
create index idx_booking_commissions_pousada_mes on booking_commissions(pousada_id, period_month);
create index idx_booking_commissions_mes on booking_commissions(period_month);

alter table booking_commissions enable row level security;
-- Sem policy de propósito: só as funções SECURITY DEFINER abaixo tocam a tabela.
revoke all on booking_commissions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Grava (ou desfaz) a comissão de uma reserva. Função interna.
-- ---------------------------------------------------------------------------
create or replace function record_booking_commission(p_booking_id uuid)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_b bookings%rowtype;
  v_exempt_until timestamptz;
  v_exempt boolean;
  v_rate numeric;
begin
  select * into v_b from bookings b where b.id = p_booking_id;
  if v_b.id is null then return; end if;

  -- Deixou de ser check-out (correção de status) ou nunca gerou comissão:
  -- a linha, se existir, sai.
  if v_b.status <> 'checked_out'
     or v_b.origin not in ('rota_das_pousadas', 'link_bio')
     or not exists (
       select 1 from pousada_contract_acceptances a
        where a.pousada_id = v_b.pousada_id and a.accepted_at <= v_b.created_at) then
    delete from booking_commissions where booking_id = p_booking_id;
    return;
  end if;

  select p.commission_exempt_until into v_exempt_until
  from pousadas p where p.id = v_b.pousada_id;
  v_exempt := v_exempt_until is not null
    and v_b.created_at <= v_exempt_until
    and v_b.checkin <= (v_exempt_until + interval '90 days')::date;
  v_rate := platform_commission_rate();

  insert into booking_commissions (
    booking_id, pousada_id, period_month, origin, base_amount, rate, amount, exempt, exempt_reason)
  values (
    v_b.id, v_b.pousada_id, date_trunc('month', v_b.checkout)::date, v_b.origin,
    greatest(v_b.total, 0), v_rate, round(greatest(v_b.total, 0) * v_rate, 2),
    v_exempt, case when v_exempt then 'lancamento' else '' end)
  -- Check-out refeito depois de uma correção: recalcula com os dados atuais.
  on conflict (booking_id) do update
    set period_month = excluded.period_month, origin = excluded.origin,
        base_amount = excluded.base_amount, rate = excluded.rate, amount = excluded.amount,
        exempt = excluded.exempt, exempt_reason = excluded.exempt_reason;
end;
$$;
revoke all on function record_booking_commission(uuid) from public, anon, authenticated;

create or replace function trg_booking_commission()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform record_booking_commission(new.id);
  return null;
end;
$$;
revoke all on function trg_booking_commission() from public, anon, authenticated;

-- Só quando a reserva entra ou sai de "checked_out": o resto da vida da
-- reserva não passa por aqui.
create trigger trg_booking_commission
  after update of status on bookings
  for each row
  when (old.status is distinct from new.status
        and (new.status = 'checked_out' or old.status = 'checked_out'))
  execute function trg_booking_commission();

-- ---------------------------------------------------------------------------
-- Extrato da pousada (painel → Financeiro)
-- ---------------------------------------------------------------------------
-- Quem vê o financeiro da pousada (dono, gestor, financeiro) e o financeiro da
-- plataforma. `p_month` = qualquer dia do mês; nulo = o mês mais recente com
-- comissão.
create or replace function get_pousada_commission_statement(
  p_pousada_id uuid, p_month date default null
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_month date;
  v_p pousadas%rowtype;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not (auth_has_finance_access(p_pousada_id) or auth_can_manage_platform_finance()) then
    raise exception 'Pousada não encontrada.';
  end if;
  select * into v_p from pousadas p where p.id = p_pousada_id;
  if v_p.id is null then raise exception 'Pousada não encontrada.'; end if;

  v_month := coalesce(
    date_trunc('month', p_month)::date,
    (select max(c.period_month) from booking_commissions c where c.pousada_id = p_pousada_id),
    date_trunc('month', now() at time zone 'America/Sao_Paulo')::date);

  return jsonb_build_object(
    'rate', platform_commission_rate(),
    'hasContract', exists (select 1 from pousada_contract_acceptances a where a.pousada_id = p_pousada_id),
    'exemptUntil', v_p.commission_exempt_until,
    'month', v_month,
    'months', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.month desc) from (
        select c.period_month as month, count(*) as bookings, sum(c.base_amount) as base,
               coalesce(sum(c.amount) filter (where not c.exempt), 0) as due,
               coalesce(sum(c.amount) filter (where c.exempt), 0) as waived
        from booking_commissions c
        where c.pousada_id = p_pousada_id
        group by c.period_month order by c.period_month desc limit 12) m), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'bookingId', c.booking_id, 'code', b.code, 'checkin', b.checkin,
               'checkout', b.checkout, 'origin', c.origin, 'base', c.base_amount,
               'rate', c.rate, 'amount', c.amount, 'exempt', c.exempt)
             order by b.checkout, b.code)
      from booking_commissions c join bookings b on b.id = c.booking_id
      where c.pousada_id = p_pousada_id and c.period_month = v_month), '[]'::jsonb)
  );
end;
$$;
revoke all on function get_pousada_commission_statement(uuid, date) from public, anon;
grant execute on function get_pousada_commission_statement(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Visão da plataforma (/admin → Financeiro)
-- ---------------------------------------------------------------------------
create or replace function list_platform_commissions(p_month date default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_month date;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not auth_can_manage_platform_finance() then
    raise exception 'O financeiro da plataforma é exclusivo de financeiro_plataforma/master.';
  end if;

  v_month := coalesce(
    date_trunc('month', p_month)::date,
    (select max(c.period_month) from booking_commissions c),
    date_trunc('month', now() at time zone 'America/Sao_Paulo')::date);

  return jsonb_build_object(
    'rate', platform_commission_rate(),
    'month', v_month,
    'months', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.month desc) from (
        select c.period_month as month, count(*) as bookings,
               count(distinct c.pousada_id) as pousadas, sum(c.base_amount) as base,
               coalesce(sum(c.amount) filter (where not c.exempt), 0) as due,
               coalesce(sum(c.amount) filter (where c.exempt), 0) as waived
        from booking_commissions c
        group by c.period_month order by c.period_month desc limit 12) m), '[]'::jsonb),
    'pousadas', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.due desc, x.name) from (
        select p.id as "pousadaId", p.name, p.founder_rank as "founderRank",
               p.commission_exempt_until as "exemptUntil", count(*) as bookings,
               sum(c.base_amount) as base,
               coalesce(sum(c.amount) filter (where not c.exempt), 0) as due,
               coalesce(sum(c.amount) filter (where c.exempt), 0) as waived
        from booking_commissions c join pousadas p on p.id = c.pousada_id
        where c.period_month = v_month
        group by p.id, p.name, p.founder_rank, p.commission_exempt_until) x), '[]'::jsonb)
  );
end;
$$;
revoke all on function list_platform_commissions(date) from public, anon;
grant execute on function list_platform_commissions(date) to authenticated;
