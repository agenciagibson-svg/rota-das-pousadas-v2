-- 0104 — Registro da comissão por reserva. Dados exclusivamente sintéticos.
-- Roda depois de contrato-0103.sql (há versão de contrato publicada), com a
-- pousada B (…002, sem contrato aceito), master …009 e comercial …083.
-- A isenção é montada direto nas colunas (sem publicar a pousada), para não
-- gastar uma posição de fundadora do teste de concorrência da 0103.

select test_assert(not has_table_privilege('authenticated', 'public.booking_commissions', 'SELECT'), 'authenticated não lê comissões direto');
select test_assert(not has_table_privilege('authenticated', 'public.booking_commissions', 'INSERT'), 'authenticated não grava comissão direto');
select test_assert(not has_function_privilege('anon', 'public.get_pousada_commission_statement(uuid, date)', 'EXECUTE'), 'anon não vê extrato');
select test_assert(not has_function_privilege('anon', 'public.list_platform_commissions(date)', 'EXECUTE'), 'anon não vê comissões da plataforma');
select test_assert(not has_function_privilege('authenticated', 'public.record_booking_commission(uuid)', 'EXECUTE'), 'gravação da comissão não é chamada pela API');
select test_assert(not has_function_privilege('authenticated', 'public.platform_commission_rate()', 'EXECUTE'), 'percentual não é chamado pela API');

-- ---------------------------------------------------------------------------
-- Atores, pousada K com contrato aceito há 10 dias, quarto e hóspede
-- ---------------------------------------------------------------------------
insert into auth.users(id, email) values
 ('00000000-0000-0000-0000-000000010401', 'dono-k@example.test'),
 ('00000000-0000-0000-0000-000000010402', 'financeiro-k@example.test'),
 ('00000000-0000-0000-0000-000000010403', 'recepcao-k@example.test');
insert into pousadas(id, slug, name, city, state, status, tenant_status, owner_id, price_per_night) values
 ('10000000-0000-0000-0000-000000010401', 'pousada-comissao-k', 'Pousada Comissão K', 'Gonçalves', 'MG',
  'em_analise', 'onboarding', '00000000-0000-0000-0000-000000010401', 500);
insert into memberships(user_id, pousada_id, role, status) values
 ('00000000-0000-0000-0000-000000010401', '10000000-0000-0000-0000-000000010401', 'proprietario', 'active'),
 ('00000000-0000-0000-0000-000000010402', '10000000-0000-0000-0000-000000010401', 'financeiro_pousada', 'active'),
 ('00000000-0000-0000-0000-000000010403', '10000000-0000-0000-0000-000000010401', 'recepcionista', 'active');
insert into rooms(id, pousada_id, name, capacity, capacity_max, base_price, status, public_visible, operational_status) values
 ('20000000-0000-0000-0000-000000010401', '10000000-0000-0000-0000-000000010401', 'Chalé K', 2, 2, 500, 'active', true, 'available');
insert into guests(id, pousada_id, full_name) values
 ('40000000-0000-0000-0000-000000010401', '10000000-0000-0000-0000-000000010401', 'Hóspede de Teste K');
insert into pousada_contract_acceptances(pousada_id, contract_version_id, accepted_by_name, accepted_by_email, accepted_at, rendered_body, body_sha256)
select '10000000-0000-0000-0000-000000010401', c.id, 'Dono K', 'dono-k@example.test', now() - interval '10 days',
       'texto de teste', encode(sha256(convert_to('texto de teste', 'UTF8')), 'hex')
from contract_versions c where c.code = 'teste-v2';

-- Reservas em datas distantes entre si (mesmo quarto, sem sobreposição).
insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, checkin, checkout, total, status, origin, created_at) values
 ('30000000-0000-0000-0000-000000010401', 'COM-ROTA',    '10000000-0000-0000-0000-000000010401', '20000000-0000-0000-0000-000000010401', '40000000-0000-0000-0000-000000010401', '2098-03-10', '2098-03-12', 1000,   'checked_in', 'rota_das_pousadas', now()),
 ('30000000-0000-0000-0000-000000010402', 'COM-BALCAO',  '10000000-0000-0000-0000-000000010401', '20000000-0000-0000-0000-000000010401', '40000000-0000-0000-0000-000000010401', '2098-03-14', '2098-03-16', 800,    'checked_in', 'balcao', now()),
 ('30000000-0000-0000-0000-000000010403', 'COM-BIO',     '10000000-0000-0000-0000-000000010401', '20000000-0000-0000-0000-000000010401', '40000000-0000-0000-0000-000000010401', '2098-03-18', '2098-03-20', 335,    'checked_in', 'link_bio', now()),
 ('30000000-0000-0000-0000-000000010404', 'COM-ANTES',   '10000000-0000-0000-0000-000000010401', '20000000-0000-0000-0000-000000010401', '40000000-0000-0000-0000-000000010401', '2098-03-22', '2098-03-24', 700,    'checked_in', 'rota_das_pousadas', now() - interval '20 days'),
 ('30000000-0000-0000-0000-000000010405', 'COM-AIRBNB',  '10000000-0000-0000-0000-000000010401', '20000000-0000-0000-0000-000000010401', '40000000-0000-0000-0000-000000010401', '2098-03-26', '2098-03-28', 900,    'checked_in', 'airbnb', now()),
 ('30000000-0000-0000-0000-000000010406', 'COM-CANCEL',  '10000000-0000-0000-0000-000000010401', '20000000-0000-0000-0000-000000010401', '40000000-0000-0000-0000-000000010401', '2098-04-02', '2098-04-04', 600,    'confirmed',  'rota_das_pousadas', now()),
 ('30000000-0000-0000-0000-000000010407', 'COM-ABRIL',   '10000000-0000-0000-0000-000000010401', '20000000-0000-0000-0000-000000010401', '40000000-0000-0000-0000-000000010401', '2098-04-10', '2098-04-12', 450,    'checked_in', 'rota_das_pousadas', now());

-- ---------------------------------------------------------------------------
-- Check-out: só a reserva vinda da plataforma, com contrato já aceito, gera comissão
-- ---------------------------------------------------------------------------
update bookings set status = 'checked_out' where id in (
  '30000000-0000-0000-0000-000000010401', '30000000-0000-0000-0000-000000010402',
  '30000000-0000-0000-0000-000000010403', '30000000-0000-0000-0000-000000010404',
  '30000000-0000-0000-0000-000000010405', '30000000-0000-0000-0000-000000010407');
update bookings set status = 'cancelled' where id = '30000000-0000-0000-0000-000000010406';

select test_assert((select count(*) from booking_commissions where pousada_id = '10000000-0000-0000-0000-000000010401') = 3,
  'só as três reservas da plataforma com contrato aceito geram comissão');
select test_assert((select base_amount = 1000 and rate = 0.06 and amount = 60 and not exempt and period_month = '2098-03-01'
                    from booking_commissions where booking_id = '30000000-0000-0000-0000-000000010401'),
  '6% de R$ 1.000 = R$ 60, no mês do check-out');
select test_assert((select amount = 20.10 and origin = 'link_bio' from booking_commissions where booking_id = '30000000-0000-0000-0000-000000010403'),
  'link da bio conta como plataforma; valor em centavos (R$ 335 × 6% = R$ 20,10)');
select test_assert(not exists(select 1 from booking_commissions where booking_id = '30000000-0000-0000-0000-000000010402'), 'balcão não gera comissão');
select test_assert(not exists(select 1 from booking_commissions where booking_id = '30000000-0000-0000-0000-000000010405'), 'Airbnb não gera comissão');
select test_assert(not exists(select 1 from booking_commissions where booking_id = '30000000-0000-0000-0000-000000010404'), 'reserva criada antes do aceite do contrato não gera comissão');
select test_assert(not exists(select 1 from booking_commissions where booking_id = '30000000-0000-0000-0000-000000010406'), 'cancelada não gera comissão');

-- Pousada sem contrato aceito (B): reserva da plataforma não gera nada.
insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, checkin, checkout, total, status, origin) values
 ('30000000-0000-0000-0000-000000010410', 'COM-SEMCONTRATO', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', '2098-05-10', '2098-05-12', 900, 'checked_in', 'rota_das_pousadas');
update bookings set status = 'checked_out' where id = '30000000-0000-0000-0000-000000010410';
select test_assert(not exists(select 1 from booking_commissions where booking_id = '30000000-0000-0000-0000-000000010410'),
  'pousada sem contrato aceito: nada é registrado');

-- Check-out desfeito e refeito: a linha sai e volta, sem duplicar.
update bookings set status = 'checked_in' where id = '30000000-0000-0000-0000-000000010401';
select test_assert(not exists(select 1 from booking_commissions where booking_id = '30000000-0000-0000-0000-000000010401'), 'check-out desfeito tira a comissão');
update bookings set status = 'checked_out' where id = '30000000-0000-0000-0000-000000010401';
select test_assert((select count(*) from booking_commissions where booking_id = '30000000-0000-0000-0000-000000010401') = 1, 'check-out refeito registra uma vez só');

-- ---------------------------------------------------------------------------
-- Isenção de lançamento: criada no período E check-in até 90 dias depois do fim
-- ---------------------------------------------------------------------------
update pousadas set commission_exempt_until = now() + interval '60 days'
 where id = '10000000-0000-0000-0000-000000010401';
insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, checkin, checkout, total, status, origin, created_at) values
 ('30000000-0000-0000-0000-000000010421', 'COM-ISENTA', '10000000-0000-0000-0000-000000010401', '20000000-0000-0000-0000-000000010401', '40000000-0000-0000-0000-000000010401',
  current_date + 30, current_date + 32, 1000, 'checked_in', 'rota_das_pousadas', now()),
 ('30000000-0000-0000-0000-000000010422', 'COM-LIMITE', '10000000-0000-0000-0000-000000010401', '20000000-0000-0000-0000-000000010401', '40000000-0000-0000-0000-000000010401',
  (now() + interval '148 days')::date, (now() + interval '150 days')::date, 1000, 'checked_in', 'rota_das_pousadas', now()),
 ('30000000-0000-0000-0000-000000010423', 'COM-LONGE',  '10000000-0000-0000-0000-000000010401', '20000000-0000-0000-0000-000000010401', '40000000-0000-0000-0000-000000010401',
  (now() + interval '160 days')::date, (now() + interval '162 days')::date, 1000, 'checked_in', 'rota_das_pousadas', now());
update bookings set status = 'checked_out' where id in (
  '30000000-0000-0000-0000-000000010421', '30000000-0000-0000-0000-000000010422', '30000000-0000-0000-0000-000000010423');
select test_assert((select exempt and exempt_reason = 'lancamento' and amount = 60 from booking_commissions where booking_id = '30000000-0000-0000-0000-000000010421'),
  'reserva criada no período com check-in próximo: isenta, com o valor dispensado guardado');
select test_assert((select exempt from booking_commissions where booking_id = '30000000-0000-0000-0000-000000010422'),
  'check-in 88 dias depois do fim da isenção: ainda isenta');
select test_assert((select not exempt and amount = 60 from booking_commissions where booking_id = '30000000-0000-0000-0000-000000010423'),
  'check-in mais de 90 dias depois do fim da isenção: paga comissão');

-- Isenção já terminada: reserva criada depois paga.
update pousadas set commission_exempt_until = now() - interval '1 day'
 where id = '10000000-0000-0000-0000-000000010401';
insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, checkin, checkout, total, status, origin, created_at) values
 ('30000000-0000-0000-0000-000000010424', 'COM-DEPOIS', '10000000-0000-0000-0000-000000010401', '20000000-0000-0000-0000-000000010401', '40000000-0000-0000-0000-000000010401',
  current_date + 40, current_date + 42, 500, 'checked_in', 'rota_das_pousadas', now());
update bookings set status = 'checked_out' where id = '30000000-0000-0000-0000-000000010424';
select test_assert((select not exempt and amount = 30 from booking_commissions where booking_id = '30000000-0000-0000-0000-000000010424'),
  'reserva criada depois do fim da isenção paga comissão');
-- As já registradas como isentas continuam isentas (o passado não é reescrito).
select test_assert((select exempt from booking_commissions where booking_id = '30000000-0000-0000-0000-000000010421'),
  'mudar a data da isenção não reescreve comissão já registrada');

-- ---------------------------------------------------------------------------
-- Extrato da pousada: dono e financeiro veem; recepção e estranhos não
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000010401', false);
do $$ declare s jsonb; m jsonb; begin
  s := get_pousada_commission_statement('10000000-0000-0000-0000-000000010401', '2098-03-15');
  perform test_assert((s->>'rate')::numeric = 0.06 and (s->>'hasContract')::boolean, 'extrato traz o percentual e o contrato');
  perform test_assert(s->>'month' = '2098-03-01', 'qualquer dia do mês seleciona o mês');
  perform test_assert(jsonb_array_length(s->'items') = 2, 'março/2098 tem as duas reservas da plataforma');
  perform test_assert(s->'items'->0->>'code' = 'COM-ROTA' and (s->'items'->0->>'amount')::numeric = 60, 'item com código e valor');
  select x into m from jsonb_array_elements(s->'months') x where x->>'month' = '2098-03-01';
  perform test_assert((m->>'bookings')::int = 2 and (m->>'base')::numeric = 1335 and (m->>'due')::numeric = 80.10 and (m->>'waived')::numeric = 0,
    'resumo de março: base R$ 1.335, devido R$ 80,10');
  select x into m from jsonb_array_elements(s->'months') x where x->>'month' = '2098-04-01';
  perform test_assert((m->>'due')::numeric = 27.00, 'abril tem a reserva de R$ 450 (R$ 27,00)');
  -- Sem mês: abre no mais recente com comissão.
  s := get_pousada_commission_statement('10000000-0000-0000-0000-000000010401');
  perform test_assert(s->>'month' = '2098-04-01', 'sem mês informado abre no mais recente');
  -- Isenta aparece como dispensada, não como devida.
  perform test_assert((select sum((x->>'waived')::numeric) from jsonb_array_elements(s->'months') x) = 120.00,
    'duas reservas isentas somam R$ 120,00 dispensados');
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000010402', false);
select test_assert(jsonb_array_length(get_pousada_commission_statement('10000000-0000-0000-0000-000000010401', '2098-03-01')->'items') = 2,
  'financeiro da pousada vê o extrato');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000010403', false);
do $$ begin
  begin
    perform get_pousada_commission_statement('10000000-0000-0000-0000-000000010401');
    raise exception 'FALHOU: recepção viu o extrato de comissão';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
do $$ begin
  begin
    perform get_pousada_commission_statement('10000000-0000-0000-0000-000000010401');
    raise exception 'FALHOU: dono de outra pousada viu o extrato de comissão';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
  begin
    perform list_platform_commissions();
    raise exception 'FALHOU: dono de pousada viu as comissões da plataforma';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Visão da plataforma: só financeiro da plataforma e master
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000083', false);
do $$ begin
  begin
    perform list_platform_commissions();
    raise exception 'FALHOU: comercial viu as comissões da plataforma';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000009', false);
do $$ declare s jsonb; begin
  s := list_platform_commissions('2098-03-01');
  perform test_assert(jsonb_array_length(s->'pousadas') = 1 and s->'pousadas'->0->>'name' = 'Pousada Comissão K', 'master vê a pousada do mês');
  perform test_assert((s->'pousadas'->0->>'due')::numeric = 80.10 and (s->'pousadas'->0->>'bookings')::int = 2, 'total devido por pousada no mês');
  perform test_assert(jsonb_array_length(s->'months') >= 2, 'resumo por mês da plataforma');
  -- O master também abre o extrato de uma pousada.
  perform test_assert((get_pousada_commission_statement('10000000-0000-0000-0000-000000010401', '2098-03-01')->>'month') = '2098-03-01',
    'financeiro da plataforma abre o extrato da pousada');
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- Apagar a reserva leva a comissão junto (limpeza de dados de teste).
delete from bookings where id = '30000000-0000-0000-0000-000000010424';
select test_assert(not exists(select 1 from booking_commissions where booking_id = '30000000-0000-0000-0000-000000010424'), 'comissão sai junto com a reserva');
