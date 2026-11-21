-- Testes da 0114 (fundadoras: 60 dias sem comissão, 3% por 12 meses, depois
-- 6%). Usa a Pousada Comissão K de comissao-0104.sql (contrato aceito). A
-- posição de fundadora é posta à mão e desfeita no fim: a corrida da 30ª vaga
-- (scripts/test-database.mjs) roda depois e precisa achar 29 fundadoras.

select test_assert(not has_function_privilege('authenticated', 'founder_commission_rate()', 'EXECUTE'), 'percentual interno');

-- Fundadora cuja isenção acabou há 10 dias: está no período de 3%.
update pousadas
   set founder_rank = 30,
       commission_exempt_until = now() - interval '10 days',
       commission_rate_locked_until = now() - interval '10 days' + interval '12 months'
 where id = '10000000-0000-0000-0000-000000010401';

select test_assert(pousada_commission_rate_now('10000000-0000-0000-0000-000000010401') = 0.03,
  'fundadora depois da isenção paga 3% hoje');

insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, checkin, checkout, total, status, origin, created_at) values
 ('30000000-0000-0000-0000-000000011401', 'F-3PCT', '10000000-0000-0000-0000-000000010401', '20000000-0000-0000-0000-000000010401', '40000000-0000-0000-0000-000000010401',
  '2098-06-10', '2098-06-12', 1000, 'checked_in', 'rota_das_pousadas', now()),
 ('30000000-0000-0000-0000-000000011402', 'F-6PCT', '10000000-0000-0000-0000-000000010401', '20000000-0000-0000-0000-000000010401', '40000000-0000-0000-0000-000000010401',
  '2098-06-20', '2098-06-22', 1000, 'checked_in', 'rota_das_pousadas', now() + interval '13 months');
update bookings set status = 'checked_out'
 where id in ('30000000-0000-0000-0000-000000011401', '30000000-0000-0000-0000-000000011402');

select test_assert((select rate = 0.03 and amount = 30 and not exempt from booking_commissions
                     where booking_id = '30000000-0000-0000-0000-000000011401'),
  'reserva criada no período garantido: 3%');
select test_assert((select rate = 0.06 and amount = 60 from booking_commissions
                     where booking_id = '30000000-0000-0000-0000-000000011402'),
  'reserva criada depois dos 12 meses: 6%');

-- Isenta no período de isenção guarda o valor dispensado a 3%.
update pousadas set commission_exempt_until = now() + interval '30 days'
 where id = '10000000-0000-0000-0000-000000010401';
insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, checkin, checkout, total, status, origin, created_at) values
 ('30000000-0000-0000-0000-000000011403', 'F-ISENTA', '10000000-0000-0000-0000-000000010401', '20000000-0000-0000-0000-000000010401', '40000000-0000-0000-0000-000000010401',
  current_date + 50, current_date + 52, 1000, 'checked_in', 'rota_das_pousadas', now());
update bookings set status = 'checked_out' where id = '30000000-0000-0000-0000-000000011403';
select test_assert((select exempt and rate = 0.03 and amount = 30 from booking_commissions
                     where booking_id = '30000000-0000-0000-0000-000000011403'),
  'isenta: valor dispensado calculado a 3%');

-- Extrato mostra o percentual da pousada.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000010401', false);
select test_assert((get_pousada_commission_statement('10000000-0000-0000-0000-000000010401', '2098-06-01')->>'rate')::numeric = 0.03,
  'extrato da fundadora traz 3%');
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- Pousada comum paga 6%.
update pousadas set founder_rank = null, commission_exempt_until = null, commission_rate_locked_until = null
 where id = '10000000-0000-0000-0000-000000010401';
select test_assert(pousada_commission_rate_now('10000000-0000-0000-0000-000000010401') = 0.06, 'pousada comum: 6%');
