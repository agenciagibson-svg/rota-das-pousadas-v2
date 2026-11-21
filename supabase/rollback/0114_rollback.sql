-- Rollback da 0114 (fundadoras a 3%). Volta as três funções às versões da
-- 0103/0104 e o prazo garantido das fundadoras para publicação + 12 meses.
-- Comissões já registradas a 3% ficam como estão (o passado não é reescrito).
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

    -- Uma publicação por vez decide a posição: sem a trava, duas publicações
    -- simultâneas contariam o mesmo total e a 31ª entraria como fundadora.
    perform pg_advisory_xact_lock(hashtext('rota:pousadas:founder_rank'));
    select count(*) into v_founders from pousadas where founder_rank is not null;
    if v_founders < 30 then
      new.founder_rank := (select coalesce(max(founder_rank), 0) + 1 from pousadas);
      new.commission_exempt_until := now() + interval '60 days';
      new.commission_rate_locked_until := now() + interval '12 months';
      insert into audit_log (actor_id, action, target_table, target_id, metadata)
      values (auth.uid(), 'pousada.founder_assigned', 'pousadas', new.id,
              jsonb_build_object('rank', new.founder_rank));
    end if;
  end if;

  new.first_published_at := now();
  return new;
end;
$$;

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

update pousadas
   set commission_rate_locked_until = commission_exempt_until - interval '60 days' + interval '12 months'
 where founder_rank is not null and commission_exempt_until is not null;
drop function if exists public.pousada_commission_rate_now(uuid);
drop function if exists public.founder_commission_rate();
