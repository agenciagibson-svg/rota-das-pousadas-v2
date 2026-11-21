-- Testes da 0109 (fechamento automático da estadia e conta em aberto).
-- Roda DEPOIS de priorities.sql e security-0083.sql (test_assert, test_denied,
-- pousada A, recepção …085). Dados exclusivamente sintéticos.

insert into rooms(id, pousada_id, name, capacity, capacity_max, base_price, status, public_visible, operational_status)
select ('20000000-0000-0000-0000-0000001090' || lpad(n::text, 2, '0'))::uuid,
       '10000000-0000-0000-0000-000000000001', 'Quarto 0109-' || n, 2, 2, 200, 'active', true, 'available'
from generate_series(1, 8) n;

update pousadas set timezone = 'America/Sao_Paulo', checkout_time = '08:00'
 where id = '10000000-0000-0000-0000-000000000001';

create function t109_d(n integer) returns date language sql as $$
  select pousada_local_date('10000000-0000-0000-0000-000000000001') + n;
$$;
create function t109_b(n integer) returns uuid language sql as $$
  select ('30000000-0000-0000-0000-0000001090' || lpad(n::text, 2, '0'))::uuid;
$$;
create function t109_room(n integer) returns uuid language sql as $$
  select ('20000000-0000-0000-0000-0000001090' || lpad(n::text, 2, '0'))::uuid;
$$;

insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, guest_id, created_by,
                     guest_name, checkin, checkout, total, status, origin)
select t109_b(n), 'T109-' || n, '10000000-0000-0000-0000-000000000001', t109_room(n),
       '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000084',
       '00000000-0000-0000-0000-000000000084', 'Hóspede 0109',
       t109_d(ci), t109_d(co), 400, st::booking_status, 'rota_das_pousadas'
from (values
  (1, -3, -1, 'checked_in'),   -- passou do check-out: fecha
  (2, -3, -1, 'checked_in'),   -- passou, com consumo em aberto: fecha com pendência
  (3, -1,  1, 'checked_in'),   -- ainda em estadia
  (4, -3, -1, 'confirmed'),    -- nunca fez check-in: o sistema não mexe
  (5, -2,  1, 'checked_in'),   -- check-out manual sem consumo
  (6, -2,  2, 'checked_in')    -- check-out manual com consumo
) v(n, ci, co, st);

-- Consumo entregue e não pago (R$ 30) na 2 e na 6.
insert into guest_orders(pousada_id, booking_id, status, source, total)
values ('10000000-0000-0000-0000-000000000001', t109_b(2), 'entregue', 'equipe', 30),
       ('10000000-0000-0000-0000-000000000001', t109_b(6), 'entregue', 'equipe', 30);

-- ---------------------------------------------------------------------------
-- Horário do fechamento automático
-- ---------------------------------------------------------------------------
update pousadas set checkout_time = '11:00' where id = '10000000-0000-0000-0000-000000000001';
select test_assert(booking_auto_close_at('10000000-0000-0000-0000-000000000001', '2026-12-13')
  = '2026-12-13 15:00:00-03'::timestamptz, 'check-out 11h fecha às 15h (Brasília)');
update pousadas set checkout_time = '25:00' where id = '10000000-0000-0000-0000-000000000001';
select test_assert(booking_auto_close_at('10000000-0000-0000-0000-000000000001', '2026-12-13')
  = '2026-12-13 16:00:00-03'::timestamptz, 'horário inválido usa 12h');
update pousadas set checkout_time = '11:00:00', timezone = 'America/Cuiaba'
 where id = '10000000-0000-0000-0000-000000000001';
select test_assert(booking_auto_close_at('10000000-0000-0000-0000-000000000001', '2026-12-13')
  = '2026-12-13 15:00:00-04'::timestamptz, 'fuso da pousada (Cuiabá) e horário com segundos');
update pousadas set checkout_time = '08:00', timezone = 'America/Sao_Paulo'
 where id = '10000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------
select test_assert(not has_function_privilege('anon', 'close_overdue_stays()', 'EXECUTE'), 'anon não fecha estadias');
select test_assert(has_function_privilege('authenticated', 'close_overdue_stays()', 'EXECUTE'), 'app e painel podem disparar');
select test_assert(not has_function_privilege('authenticated', 'booking_open_consumption(uuid)', 'EXECUTE'), 'saldo interno');
select test_assert(not has_function_privilege('authenticated', 'booking_auto_close_at(uuid,date)', 'EXECUTE'), 'horário interno');

-- ---------------------------------------------------------------------------
-- Fechamento automático
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000084', false);
select test_assert(close_overdue_stays() >= 2, 'fecha as vencidas');
reset role;
select set_config('request.jwt.claim.sub', '', false);

select test_assert((select status = 'checked_out' and checked_out_auto and checked_out_by is null
                      and checked_out_at is not null and checkout_open_note is null
                    from bookings where id = t109_b(1)), 'vencida sem consumo: fechada pelo sistema');
select test_assert((select status = 'checked_out' and checked_out_auto
                      and checkout_open_note like '%consumo em aberto de R$ 30.00%'
                    from bookings where id = t109_b(2)), 'vencida com consumo: fechada com pendência');
select test_assert((select status from bookings where id = t109_b(3)) = 'checked_in', 'em estadia continua');
select test_assert((select status from bookings where id = t109_b(4)) = 'confirmed', 'sem check-in o sistema não mexe');
select test_assert((select count(*) from audit_log where action = 'booking.checked_out_auto'
                      and target_id in (t109_b(1), t109_b(2))) = 2, 'auditado');
select test_assert(close_overdue_stays() = 0, 'idempotente');

-- ---------------------------------------------------------------------------
-- Check-out pela equipe com conta em aberto
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000085', false);
select set_booking_status(t109_b(5), 'checked_out');
select test_denied($q$select set_booking_status(t109_b(6), 'checked_out')$q$,
  'check-out com consumo em aberto sem motivo');
select test_denied($q$select set_booking_status(t109_b(6), 'checked_out', '  ')$q$,
  'motivo em branco');
select set_booking_status(t109_b(6), 'checked_out', 'Hóspede vai pagar por Pix amanhã');
reset role;
select set_config('request.jwt.claim.sub', '', false);

select test_assert((select status = 'checked_out' and not checked_out_auto and checkout_open_note is null
                      and checked_out_by = '00000000-0000-0000-0000-000000000085'
                    from bookings where id = t109_b(5)), 'check-out normal sem pendência');
select test_assert((select checkout_open_note = 'Hóspede vai pagar por Pix amanhã' and not checked_out_auto
                    from bookings where id = t109_b(6)), 'motivo da pendência fica na reserva');
select test_assert((select (metadata->>'openConsumption')::numeric = 30 from audit_log
                     where action = 'booking.checked_out' and target_id = t109_b(6)), 'valor em aberto na auditoria');
