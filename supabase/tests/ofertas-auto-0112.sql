-- Testes da 0112 (ofertas automáticas). Roda depois de ofertas-0111.sql.
-- Pousada B (dono …002) com 3 ex-hóspedes que autorizaram: …121 saiu há 183
-- dias, …122 há 366 dias e …123 há 40 dias.

-- Testes anteriores deixam a B em rascunho; a rodada só olha pousada publicada.
update pousadas set status = 'publicada' where id = '10000000-0000-0000-0000-000000000002';

insert into auth.users(id, email) values
 ('00000000-0000-0000-0000-000000000121', 'seis@example.test'),
 ('00000000-0000-0000-0000-000000000122', 'ano@example.test'),
 ('00000000-0000-0000-0000-000000000123', 'feriado@example.test');

insert into rooms(id, pousada_id, name, capacity, capacity_max, base_price, status, public_visible, operational_status)
select ('20000000-0000-0000-0000-00000011200' || n)::uuid, '10000000-0000-0000-0000-000000000002',
       'Quarto 0112-' || n, 2, 2, 300, 'active', true, 'available'
from generate_series(1, 3) n;

insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, guest_id, created_by,
                     guest_name, checkin, checkout, total, status, origin)
select ('30000000-0000-0000-0000-00000011200' || n)::uuid, 'T112-' || n, '10000000-0000-0000-0000-000000000002',
       ('20000000-0000-0000-0000-00000011200' || n)::uuid, '40000000-0000-0000-0000-000000000002',
       u::uuid, u::uuid, 'Ex', pousada_local_date('10000000-0000-0000-0000-000000000002') - (d + 2),
       pousada_local_date('10000000-0000-0000-0000-000000000002') - d, 600, 'checked_out', 'rota_das_pousadas'
from (values (1, '00000000-0000-0000-0000-000000000121', 183),
             (2, '00000000-0000-0000-0000-000000000122', 366),
             (3, '00000000-0000-0000-0000-000000000123', 40)) v(n, u, d);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000121', false);
select set_offer_consent('10000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000122', false);
select set_offer_consent('10000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000123', false);
select set_offer_consent('10000000-0000-0000-0000-000000000002', true);

-- Configuração: só dono/gestor da própria pousada.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select test_denied($q$select save_auto_offers('10000000-0000-0000-0000-000000000002', true, 10, true, 15, true, 10)$q$,
  'dono de outra pousada não liga');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select test_assert((get_auto_offers('10000000-0000-0000-0000-000000000002')->'feriado'->>'on')::boolean = false,
  'padrão: tudo desligado');
select test_denied($q$select save_auto_offers('10000000-0000-0000-0000-000000000002', true, 70, true, 15, true, 10)$q$,
  'desconto fora do limite');
select save_auto_offers('10000000-0000-0000-0000-000000000002', true, 10, true, 20, true, 12);
select test_assert((get_auto_offers('10000000-0000-0000-0000-000000000002')->'aniversario'->>'percent')::int = 20,
  'configuração salva');
reset role;
select set_config('request.jwt.claim.sub', '', false);

select test_assert(not has_function_privilege('authenticated', 'run_auto_offers(text,date,date)', 'EXECUTE'),
  'rodada só do serviço');

-- Sem feriadão na janela: 6 meses e 1 ano.
select test_assert(run_auto_offers() = '{"offers": 2, "people": 2}'::jsonb, '6 meses e 1 ano');
select test_assert((select o.kind from offer_deliveries d join pousada_offers o on o.id = d.offer_id
  where d.user_id = '00000000-0000-0000-0000-000000000121') = 'seis_meses', '6 meses para quem saiu há 183 dias');
select test_assert((select c.value from offer_deliveries d join pousada_coupons c on c.id = d.coupon_id
  where d.user_id = '00000000-0000-0000-0000-000000000122') = 20, '1 ano com o desconto escolhido');
select test_assert(not exists (select 1 from offer_deliveries where user_id = '00000000-0000-0000-0000-000000000123'),
  'quem saiu há 40 dias não recebe 6 meses nem 1 ano');
select test_assert(run_auto_offers() = '{"offers": 0, "people": 0}'::jsonb, 'não repete no dia seguinte');

-- Feriadão fora da janela (60 dias) não sai; dentro (20 dias) sai uma vez.
select test_assert(run_auto_offers('Teste', current_date + 60, current_date + 63)->>'offers' = '0',
  'feriadão longe demais');
select test_assert(run_auto_offers('Tiradentes', current_date + 20, current_date + 23)
  = '{"offers": 1, "people": 1}'::jsonb, 'feriadão: só quem ainda não recebeu neste mês');
select test_assert((select o.stay_from = current_date + 20 and o.stay_until = current_date + 23
                      and c.stay_from = current_date + 20 and c.value = 12
                      and o.message like 'Feriadão de Tiradentes%'
                    from offer_deliveries d join pousada_offers o on o.id = d.offer_id
                    join pousada_coupons c on c.id = d.coupon_id
                   where d.user_id = '00000000-0000-0000-0000-000000000123'), 'cupom vale para o feriadão');
select test_assert(run_auto_offers('Tiradentes', current_date + 20, current_date + 23)->>'offers' = '0',
  'mesmo feriadão não sai duas vezes');

-- Pousada fora do ar não manda nada.
update pousadas set status = 'rascunho' where id = '10000000-0000-0000-0000-000000000002';
select test_assert(run_auto_offers('Natal', current_date + 30, current_date + 33)->>'offers' = '0',
  'pousada em rascunho fica de fora');
