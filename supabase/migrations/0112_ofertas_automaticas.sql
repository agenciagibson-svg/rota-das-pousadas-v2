-- =============================================================================
-- 0112 — Ofertas automáticas para ex-hóspedes
--
-- App único (spec claude/app-unico-loja-estadia-2026-11-20.md, etapa 5). A
-- pousada liga cada uma no painel e escolhe o desconto; a rodada diária das
-- ofertas (/api/cron/ofertas, 10h de Brasília) cria e manda:
--
--   seis_meses   6 meses depois do check-out (janela de 7 dias para a rodada
--                que falhar não perder ninguém);
--   aniversario  1 ano depois do check-out (mesma janela);
--   feriado      o próximo feriadão entre 7 e 45 dias à frente — o cupom vale
--                para estadias naquele feriadão, até a véspera dele. A lista
--                de feriados vem do app (features/feriados).
--
-- Tudo passa por `create_offer_for_audience` (0111): só quem autorizou, com os
-- mesmos limites (1 por mês da pousada, 3 por mês no total) e um cupom de uso
-- único por pessoa. Repetição: a mesma pessoa não recebe a mesma automática de
-- novo em 120 dias (6 meses / 1 ano) e cada feriadão sai uma vez por pousada.
--
-- Aditiva e idempotente. Rollback em supabase/rollback/0112_rollback.sql.
-- =============================================================================

create table if not exists pousada_auto_offers (
  pousada_id          uuid primary key references pousadas(id) on delete cascade,
  seis_meses_on       boolean not null default false,
  seis_meses_percent  integer not null default 10 check (seis_meses_percent between 5 and 50),
  aniversario_on      boolean not null default false,
  aniversario_percent integer not null default 15 check (aniversario_percent between 5 and 50),
  feriado_on          boolean not null default false,
  feriado_percent     integer not null default 10 check (feriado_percent between 5 and 50),
  updated_by          uuid references auth.users(id) on delete set null,
  updated_at          timestamptz not null default now()
);
alter table pousada_auto_offers enable row level security;
revoke all on pousada_auto_offers from anon, authenticated;

create or replace function get_auto_offers(p_pousada_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v pousada_auto_offers%rowtype;
begin
  if auth.uid() is null or not auth_can_manage_pousada(p_pousada_id) then
    raise exception 'Sem permissão.';
  end if;
  select * into v from pousada_auto_offers where pousada_id = p_pousada_id;
  return jsonb_build_object(
    'seisMeses',   jsonb_build_object('on', coalesce(v.seis_meses_on, false),  'percent', coalesce(v.seis_meses_percent, 10)),
    'aniversario', jsonb_build_object('on', coalesce(v.aniversario_on, false), 'percent', coalesce(v.aniversario_percent, 15)),
    'feriado',     jsonb_build_object('on', coalesce(v.feriado_on, false),     'percent', coalesce(v.feriado_percent, 10))
  );
end;
$$;
revoke all on function get_auto_offers(uuid) from public, anon;
grant execute on function get_auto_offers(uuid) to authenticated;

create or replace function save_auto_offers(
  p_pousada_id uuid,
  p_seis_meses_on boolean, p_seis_meses_percent integer,
  p_aniversario_on boolean, p_aniversario_percent integer,
  p_feriado_on boolean, p_feriado_percent integer
) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null or not auth_can_manage_pousada(p_pousada_id) then
    raise exception 'Só o dono ou o gestor da pousada muda as ofertas automáticas.';
  end if;
  insert into pousada_auto_offers (pousada_id, seis_meses_on, seis_meses_percent, aniversario_on,
    aniversario_percent, feriado_on, feriado_percent, updated_by, updated_at)
  values (p_pousada_id, p_seis_meses_on, p_seis_meses_percent, p_aniversario_on,
    p_aniversario_percent, p_feriado_on, p_feriado_percent, auth.uid(), now())
  on conflict (pousada_id) do update set
    seis_meses_on = excluded.seis_meses_on, seis_meses_percent = excluded.seis_meses_percent,
    aniversario_on = excluded.aniversario_on, aniversario_percent = excluded.aniversario_percent,
    feriado_on = excluded.feriado_on, feriado_percent = excluded.feriado_percent,
    updated_by = excluded.updated_by, updated_at = now();
  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'offer.auto_settings', 'pousadas', p_pousada_id,
          jsonb_build_object('seisMeses', p_seis_meses_on, 'aniversario', p_aniversario_on, 'feriado', p_feriado_on));
end;
$$;
revoke all on function save_auto_offers(uuid, boolean, integer, boolean, integer, boolean, integer) from public, anon;
grant execute on function save_auto_offers(uuid, boolean, integer, boolean, integer, boolean, integer) to authenticated;

-- Quem fez check-out na pousada entre `p_from` e `p_to` dias atrás (última
-- estadia), sem ter recebido esta automática da pousada nos últimos 120 dias.
create or replace function auto_offer_targets(p_pousada_id uuid, p_kind text, p_from integer, p_to integer)
returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(x.guest_id), '{}')
    from (
      select b.guest_id, max(b.checkout) as last_checkout
        from bookings b
       where b.pousada_id = p_pousada_id and b.status = 'checked_out' and b.guest_id is not null
       group by b.guest_id
    ) x
   where x.last_checkout between pousada_local_date(p_pousada_id) - p_to
                             and pousada_local_date(p_pousada_id) - p_from
     and not exists (
       select 1 from offer_deliveries d join pousada_offers o on o.id = d.offer_id
        where d.user_id = x.guest_id and d.pousada_id = p_pousada_id and o.kind = p_kind
          and d.created_at > now() - interval '120 days');
$$;
revoke all on function auto_offer_targets(uuid, text, integer, integer) from public, anon, authenticated;

-- Rodada diária (service_role). O feriadão vem do app; nulo = nenhum na janela.
create or replace function run_auto_offers(
  p_holiday_name text default null, p_holiday_from date default null, p_holiday_until date default null
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v pousada_auto_offers%rowtype;
  v_today date;
  v_users uuid[];
  v_r jsonb;
  v_offers integer := 0;
  v_people integer := 0;
  v_valid integer;
begin
  for v in
    select a.* from pousada_auto_offers a join pousadas p on p.id = a.pousada_id
     where (a.seis_meses_on or a.aniversario_on or a.feriado_on)
       and p.status = 'publicada'
  loop
    v_today := pousada_local_date(v.pousada_id);

    if v.seis_meses_on then
      v_users := auto_offer_targets(v.pousada_id, 'seis_meses', 182, 188);
      if cardinality(v_users) > 0 then
        v_r := create_offer_for_audience(v.pousada_id, 'seis_meses', v.seis_meses_percent, 30, null, null,
                 'Faz 6 meses da sua estadia. Que tal voltar?', null, v_users);
        v_offers := v_offers + (v_r->>'offerId' is not null)::int;
        v_people := v_people + (v_r->>'sent')::int;
      end if;
    end if;

    if v.aniversario_on then
      v_users := auto_offer_targets(v.pousada_id, 'aniversario', 365, 371);
      if cardinality(v_users) > 0 then
        v_r := create_offer_for_audience(v.pousada_id, 'aniversario', v.aniversario_percent, 30, null, null,
                 'Faz 1 ano da sua estadia aqui. Volte para comemorar!', null, v_users);
        v_offers := v_offers + (v_r->>'offerId' is not null)::int;
        v_people := v_people + (v_r->>'sent')::int;
      end if;
    end if;

    if v.feriado_on and p_holiday_from is not null and p_holiday_until > p_holiday_from
       and p_holiday_from - v_today between 7 and 45
       and not exists (select 1 from pousada_offers o
                        where o.pousada_id = v.pousada_id and o.kind = 'feriado'
                          and o.stay_from = p_holiday_from) then
      v_valid := least(90, greatest(7, p_holiday_from - v_today));
      v_r := create_offer_for_audience(v.pousada_id, 'feriado', v.feriado_percent, v_valid,
               p_holiday_from, p_holiday_until,
               left('Feriadão de ' || coalesce(nullif(btrim(p_holiday_name), ''), 'feriado')
                    || ': garanta sua volta com desconto.', 200), null, null);
      v_offers := v_offers + (v_r->>'offerId' is not null)::int;
      v_people := v_people + (v_r->>'sent')::int;
    end if;
  end loop;
  return jsonb_build_object('offers', v_offers, 'people', v_people);
end;
$$;
revoke all on function run_auto_offers(text, date, date) from public, anon, authenticated;
grant execute on function run_auto_offers(text, date, date) to service_role;
