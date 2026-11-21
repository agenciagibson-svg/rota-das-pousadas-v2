-- =============================================================================
-- 0114 — Fundadoras: 60 dias sem comissão, 3% por 12 meses, depois 6%
--
-- Decisão de 21/11/2026 (mais ousada que a 0103, que garantia 6% por 12 meses):
-- as 30 primeiras pousadas publicadas têm
--   1. 60 dias sem comissão (reserva criada no período, check-in até 90 dias
--      depois do fim dele — regra da 0104, sem mudança);
--   2. 3% nos 12 meses seguintes (reserva criada até
--      `commission_rate_locked_until` = publicação + 60 dias + 12 meses);
--   3. depois, o percentual normal (6%).
--
-- E corrige: a 0103 só marcava a fundadora quando havia contrato publicado. O
-- contrato espera o advogado, e uma pousada publicada agora ficaria sem a
-- condição de lançamento. Agora a primeira publicação marca a fundadora com ou
-- sem contrato (com contrato vigente, o aceite continua obrigatório).
--
-- A comissão continua só registrando com contrato aceito (interruptor da 0104).
-- Fundadoras já marcadas ganham as datas novas. O percentual de cada reserva é
-- gravado na hora: mudar depois não reescreve o passado.
--
-- Rollback em supabase/rollback/0114_rollback.sql.
-- =============================================================================

-- O percentual das fundadoras no período garantido. O mesmo número está em
-- lib/platform-commission.ts; um teste confere que os dois não divergem.
create or replace function founder_commission_rate()
returns numeric
language sql immutable set search_path = public as $$
  select 0.03::numeric;
$$;
revoke all on function founder_commission_rate() from public, anon, authenticated;

-- Percentual que a pousada paga hoje (extrato do painel).
create or replace function pousada_commission_rate_now(p_pousada_id uuid)
returns numeric
language sql stable security definer set search_path = public as $$
  select case when p.founder_rank is not null and now() < p.commission_rate_locked_until
              then founder_commission_rate() else platform_commission_rate() end
  from pousadas p where p.id = p_pousada_id;
$$;
revoke all on function pousada_commission_rate_now(uuid) from public, anon, authenticated;

-- Fundadoras já marcadas: 3% até 12 meses depois do fim da isenção.
update pousadas
   set commission_rate_locked_until = commission_exempt_until + interval '12 months'
 where founder_rank is not null and commission_exempt_until is not null;

-- ---------------------------------------------------------------------------
-- Primeira publicação (0103) — fundadora com ou sem contrato.
-- ---------------------------------------------------------------------------
create or replace function pousada_first_publication()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_version uuid;
  v_founders integer;
begin
  -- Pousada que já nasce publicada (carga feita pela equipe da Rota; o dono não
  -- consegue, 0065): só registra a data. A regra do aceite vale para a
  -- publicação feita pelo painel, que é sempre uma mudança de situação.
  if tg_op = 'INSERT' then
    if new.status = 'publicada' and new.first_published_at is null then
      new.first_published_at := now();
    end if;
    return new;
  end if;

  if new.status <> 'publicada' or old.status = 'publicada' or old.first_published_at is not null then
    return new;
  end if;

  v_version := current_contract_version_id();
  if v_version is not null then
    if not exists (
      select 1 from pousada_contract_acceptances a
       where a.pousada_id = new.id and a.contract_version_id = v_version) then
      raise exception 'Esta pousada ainda não aceitou o contrato. O proprietário aceita em Configurações → Contrato; depois disso ela pode ser publicada.';
    end if;
  end if;

  -- [0114] Fundadora na primeira publicação, com ou sem contrato vigente (a
  -- 0103 só marcava com contrato, e o contrato espera o advogado). Uma
  -- publicação por vez decide a posição: sem a trava, duas publicações
  -- simultâneas contariam o mesmo total e a 31ª entraria como fundadora.
  perform pg_advisory_xact_lock(hashtext('rota:pousadas:founder_rank'));
  select count(*) into v_founders from pousadas where founder_rank is not null;
  if v_founders < 30 and new.founder_rank is null then
    new.founder_rank := (select coalesce(max(founder_rank), 0) + 1 from pousadas);
    -- 60 dias sem comissão; depois 3% por 12 meses; depois o percentual normal.
    new.commission_exempt_until := now() + interval '60 days';
    new.commission_rate_locked_until := now() + interval '60 days' + interval '12 months';
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'pousada.founder_assigned', 'pousadas', new.id,
            jsonb_build_object('rank', new.founder_rank));
  end if;

  new.first_published_at := now();
  return new;
end;
$$;
revoke all on function pousada_first_publication() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Registro da comissão (0104) — 3% para fundadoras no período garantido.
-- ---------------------------------------------------------------------------
create or replace function record_booking_commission(p_booking_id uuid)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_b bookings%rowtype;
  v_exempt_until timestamptz;
  v_exempt boolean;
  v_rate numeric;
  v_founder smallint;
  v_locked_until timestamptz;
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

  select p.commission_exempt_until, p.founder_rank, p.commission_rate_locked_until
    into v_exempt_until, v_founder, v_locked_until
  from pousadas p where p.id = v_b.pousada_id;
  v_exempt := v_exempt_until is not null
    and v_b.created_at <= v_exempt_until
    and v_b.checkin <= (v_exempt_until + interval '90 days')::date;
  -- [0114] Fundadora: 3% para reserva criada até o fim do período garantido
  -- (60 dias de isenção + 12 meses). Isenta guarda o valor dispensado a 3%.
  v_rate := case when v_founder is not null and v_b.created_at < v_locked_until
                 then founder_commission_rate() else platform_commission_rate() end;

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

-- ---------------------------------------------------------------------------
-- Extrato da pousada (0104) — mostra o percentual que ela paga hoje.
-- ---------------------------------------------------------------------------
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
    'rate', pousada_commission_rate_now(p_pousada_id),
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
