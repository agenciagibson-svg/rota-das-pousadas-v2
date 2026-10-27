-- 0096: mover reserva pelo mapa de ocupação (move_booking).
-- Pousada própria (C) para não depender das reservas dos outros arquivos.
-- Datas em 2096; as regras de "passado" usam a data de hoje da pousada.
insert into auth.users(id, email) values
 ('00000000-0000-0000-0000-000000000961', 'dono-0096@example.test'),
 ('00000000-0000-0000-0000-000000000962', 'recepcao-0096@example.test'),
 ('00000000-0000-0000-0000-000000000963', 'financeiro-0096@example.test'),
 ('00000000-0000-0000-0000-000000000964', 'governanca-0096@example.test');
insert into pousadas(id, slug, name, city, state, status, tenant_status, owner_id, price_per_night, timezone) values
 ('96000000-0000-0000-0000-000000000001', 'pousada-0096', 'Pousada 0096', 'Tiradentes', 'MG', 'publicada', 'active',
  '00000000-0000-0000-0000-000000000961', 300, 'America/Sao_Paulo');
insert into memberships(user_id, pousada_id, role, status) values
 ('00000000-0000-0000-0000-000000000961', '96000000-0000-0000-0000-000000000001', 'proprietario', 'active'),
 ('00000000-0000-0000-0000-000000000962', '96000000-0000-0000-0000-000000000001', 'recepcionista', 'active'),
 ('00000000-0000-0000-0000-000000000963', '96000000-0000-0000-0000-000000000001', 'financeiro_pousada', 'active'),
 ('00000000-0000-0000-0000-000000000964', '96000000-0000-0000-0000-000000000001', 'governanca', 'active');
insert into rooms(id, pousada_id, name, capacity, capacity_max, base_price, status, public_visible, operational_status) values
 ('96100000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000001', 'Chalé 1', 2, 2, 300, 'active', true, 'available'),
 ('96100000-0000-0000-0000-000000000002', '96000000-0000-0000-0000-000000000001', 'Chalé 2', 2, 2, 300, 'active', true, 'available'),
 ('96100000-0000-0000-0000-000000000003', '96000000-0000-0000-0000-000000000001', 'Suíte família', 4, 4, 500, 'active', true, 'available'),
 ('96100000-0000-0000-0000-000000000004', '96000000-0000-0000-0000-000000000001', 'Chalé 3', 2, 2, 300, 'active', true, 'maintenance');
insert into guests(id, pousada_id, full_name) values
 ('96200000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000001', 'Hóspede 0096');
-- Tarifa: noites de março/2096 a R$ 400 em toda a pousada.
insert into rate_rules(pousada_id, room_id, name, first_night, last_night, kind, value) values
 ('96000000-0000-0000-0000-000000000001', null, 'Março', '2096-03-01', '2096-03-31', 'fixed', 400);

insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, checkin, checkout,
                     adults, children, subtotal, discount, surcharge, total, status, origin) values
 -- Reserva que vai ser movida: 2 noites, R$ 550 combinados (diárias 600 - desconto 50).
 ('96300000-0000-0000-0000-000000000001', 'MOV-1', '96000000-0000-0000-0000-000000000001', '96100000-0000-0000-0000-000000000001',
  '96200000-0000-0000-0000-000000000001', '2096-02-10', '2096-02-12', 2, 0, 600, 50, 0, 550, 'confirmed', 'balcao'),
 -- Ocupa o Chalé 2 de 10 a 12/02.
 ('96300000-0000-0000-0000-000000000002', 'MOV-2', '96000000-0000-0000-0000-000000000001', '96100000-0000-0000-0000-000000000002',
  '96200000-0000-0000-0000-000000000001', '2096-02-10', '2096-02-12', 2, 0, 600, 0, 0, 600, 'confirmed', 'balcao'),
 -- Família com 4 pessoas (não cabe num chalé).
 ('96300000-0000-0000-0000-000000000003', 'MOV-FAM', '96000000-0000-0000-0000-000000000001', '96100000-0000-0000-0000-000000000003',
  '96200000-0000-0000-0000-000000000001', '2096-02-20', '2096-02-23', 3, 1, 1500, 0, 0, 1500, 'pending', 'whatsapp'),
 -- Espelho do Airbnb.
 ('96300000-0000-0000-0000-000000000004', 'MOV-AIRBNB', '96000000-0000-0000-0000-000000000001', '96100000-0000-0000-0000-000000000002',
  '96200000-0000-0000-0000-000000000001', '2096-04-01', '2096-04-03', 2, 0, 600, 0, 0, 600, 'confirmed', 'airbnb'),
 -- Concluída.
 ('96300000-0000-0000-0000-000000000005', 'MOV-FIM', '96000000-0000-0000-0000-000000000001', '96100000-0000-0000-0000-000000000002',
  '96200000-0000-0000-0000-000000000001', '2096-05-01', '2096-05-03', 2, 0, 600, 0, 0, 600, 'checked_out', 'balcao');

-- Em estadia: entrou anteontem, sai amanhã (no fuso da pousada).
insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, checkin, checkout,
                     adults, children, subtotal, total, status, origin)
select '96300000-0000-0000-0000-000000000006', 'MOV-STAY', '96000000-0000-0000-0000-000000000001', '96100000-0000-0000-0000-000000000003',
       '96200000-0000-0000-0000-000000000001', pousada_local_date('96000000-0000-0000-0000-000000000001') - 2,
       pousada_local_date('96000000-0000-0000-0000-000000000001') + 1, 2, 0, 1500, 1500, 'checked_in', 'balcao';

-- Bloqueio no Chalé 2 de 15 a 17/02 e noite vendida no Booking no Chalé 1 em 25/02.
insert into room_blocks(pousada_id, room_id, block_type, starts_at, ends_at, reason) values
 ('96000000-0000-0000-0000-000000000001', '96100000-0000-0000-0000-000000000002', 'maintenance',
  '2096-02-15T00:00:00Z', '2096-02-17T00:00:00Z', 'Pintura');
insert into channel_calendars(id, pousada_id, room_id, provider, import_url, export_token) values
 ('96400000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000001', '96100000-0000-0000-0000-000000000001',
  'booking', 'https://example.test/0096.ics', 'teste-export-0096');
insert into channel_events(calendar_id, pousada_id, room_id, uid, starts_on, ends_on, summary) values
 ('96400000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000001', '96100000-0000-0000-0000-000000000001',
  'ota-0096', '2096-02-25', '2096-02-26', 'CLOSED');

-- "Hoje" da pousada, lido antes de trocar de papel (a função não é da API).
select set_config('test.today_0096', pousada_local_date('96000000-0000-0000-0000-000000000001')::text, false);

-- Ninguém de fora chama.
select test_assert(not has_function_privilege('anon', 'move_booking(uuid,integer,uuid,date,date,boolean)', 'EXECUTE'),
  'anon não move reserva');

-- ---------------------------------------------------------------------------
-- Permissão: financeiro, governança e dono de outra pousada não movem
-- ---------------------------------------------------------------------------
set role authenticated;
do $$
declare v_user text;
begin
  foreach v_user in array array['00000000-0000-0000-0000-000000000963', '00000000-0000-0000-0000-000000000964',
                                '00000000-0000-0000-0000-000000000002'] loop
    perform set_config('request.jwt.claim.sub', v_user, false);
    begin
      perform move_booking('96300000-0000-0000-0000-000000000001', 1, '96100000-0000-0000-0000-000000000003',
                           '2096-02-10', '2096-02-12');
      raise exception 'TEST: % moveu reserva sem booking:manage', v_user;
    exception when raise_exception then
      if sqlerrm <> 'Você não tem permissão para mover esta reserva.' then raise; end if;
    end;
  end loop;
  -- Reserva inexistente dá a mesma resposta.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000962', false);
  begin
    perform move_booking('96300000-0000-0000-0000-0000000000ff', 1, '96100000-0000-0000-0000-000000000003',
                         '2096-02-10', '2096-02-12');
    raise exception 'TEST: reserva inexistente';
  exception when raise_exception then
    if sqlerrm <> 'Você não tem permissão para mover esta reserva.' then raise; end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Recepção: regras de quarto, conflito, capacidade, canal e status
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000962', false);
do $$
declare
  v_version integer;
begin
  select version into v_version from bookings where id = '96300000-0000-0000-0000-000000000001';

  -- versão velha
  begin
    perform move_booking('96300000-0000-0000-0000-000000000001', v_version - 1, '96100000-0000-0000-0000-000000000003',
                         '2096-02-10', '2096-02-12');
    raise exception 'TEST: aceitou versão antiga';
  exception when raise_exception then
    if sqlerrm <> 'Esta reserva foi alterada por outro usuário. Recarregue e tente novamente.' then raise; end if;
  end;
  -- outra reserva no destino
  begin
    perform move_booking('96300000-0000-0000-0000-000000000001', v_version, '96100000-0000-0000-0000-000000000002',
                         '2096-02-11', '2096-02-13');
    raise exception 'TEST: moveu por cima de outra reserva';
  exception when raise_exception then
    if sqlerrm <> 'Já existe uma reserva (MOV-2) conflitando com este período.' then raise; end if;
  end;
  -- bloqueio no destino
  begin
    perform move_booking('96300000-0000-0000-0000-000000000001', v_version, '96100000-0000-0000-0000-000000000002',
                         '2096-02-14', '2096-02-16');
    raise exception 'TEST: moveu para dia bloqueado';
  exception when raise_exception then
    if sqlerrm <> 'Esta acomodação está bloqueada nesse período.' then raise; end if;
  end;
  -- noite vendida no Booking (iCal)
  begin
    perform move_booking('96300000-0000-0000-0000-000000000001', v_version, '96100000-0000-0000-0000-000000000001',
                         '2096-02-24', '2096-02-26');
    raise exception 'TEST: moveu para noite vendida no canal';
  exception when raise_exception then
    if sqlerrm <> 'Esta acomodação já está ocupada no Booking.com nesse período (calendário sincronizado).' then raise; end if;
  end;
  -- quarto em manutenção
  begin
    perform move_booking('96300000-0000-0000-0000-000000000001', v_version, '96100000-0000-0000-0000-000000000004',
                         '2096-02-10', '2096-02-12');
    raise exception 'TEST: moveu para quarto em manutenção';
  exception when raise_exception then
    if sqlerrm not like 'Esta acomodação está indisponível por status operacional%' then raise; end if;
  end;
  -- quarto de outra pousada
  begin
    perform move_booking('96300000-0000-0000-0000-000000000001', v_version, '20000000-0000-0000-0000-000000000003',
                         '2096-02-10', '2096-02-12');
    raise exception 'TEST: moveu para quarto de outra pousada';
  exception when raise_exception then
    if sqlerrm <> 'Acomodação não pertence a esta pousada.' then raise; end if;
  end;
  -- capacidade: família de 4 num chalé de 2
  begin
    perform move_booking('96300000-0000-0000-0000-000000000003',
                         (select version from bookings where id = '96300000-0000-0000-0000-000000000003'),
                         '96100000-0000-0000-0000-000000000001', '2096-02-20', '2096-02-23');
    raise exception 'TEST: família coube num chalé de 2';
  exception when raise_exception then
    if sqlerrm <> 'Capacidade máxima de 2 hóspedes para esta acomodação.' then raise; end if;
  end;
  -- espelho do Airbnb
  begin
    perform move_booking('96300000-0000-0000-0000-000000000004',
                         (select version from bookings where id = '96300000-0000-0000-0000-000000000004'),
                         '96100000-0000-0000-0000-000000000001', '2096-04-01', '2096-04-03');
    raise exception 'TEST: moveu reserva do Airbnb';
  exception when raise_exception then
    if sqlerrm <> 'Reserva do Airbnb não se move por aqui: mude primeiro no canal e depois ajuste em Editar reserva.' then raise; end if;
  end;
  -- concluída
  begin
    perform move_booking('96300000-0000-0000-0000-000000000005',
                         (select version from bookings where id = '96300000-0000-0000-0000-000000000005'),
                         '96100000-0000-0000-0000-000000000001', '2096-05-01', '2096-05-03');
    raise exception 'TEST: moveu reserva concluída';
  exception when raise_exception then
    if sqlerrm <> 'Só dá para mover reserva aguardando pagamento, confirmada ou em estadia.' then raise; end if;
  end;
  -- entrada no passado
  begin
    perform move_booking('96300000-0000-0000-0000-000000000001', v_version, '96100000-0000-0000-0000-000000000001',
                         current_setting('test.today_0096')::date - 1,
                         current_setting('test.today_0096')::date + 1);
    raise exception 'TEST: entrada no passado';
  exception when raise_exception then
    if sqlerrm <> 'A nova entrada não pode ser no passado.' then raise; end if;
  end;
  -- nada mudou
  begin
    perform move_booking('96300000-0000-0000-0000-000000000001', v_version, '96100000-0000-0000-0000-000000000001',
                         '2096-02-10', '2096-02-12');
    raise exception 'TEST: aceitou mudança vazia';
  exception when raise_exception then
    if sqlerrm <> 'A reserva já está nesse quarto e nessas datas.' then raise; end if;
  end;
  -- saída antes da entrada
  begin
    perform move_booking('96300000-0000-0000-0000-000000000001', v_version, '96100000-0000-0000-0000-000000000001',
                         '2096-02-12', '2096-02-12');
    raise exception 'TEST: aceitou zero noites';
  exception when raise_exception then
    if sqlerrm <> 'A data de saída deve ser posterior à de entrada.' then raise; end if;
  end;
end $$;
select test_assert((select room_id::text || checkin || checkout || total || version from bookings
                    where id = '96300000-0000-0000-0000-000000000001')
                   = '96100000-0000-0000-0000-0000000000012096-02-102096-02-125501',
  'tentativas recusadas não mudam nada');

-- Move para a suíte em março, mantendo o valor combinado.
select test_assert((move_booking('96300000-0000-0000-0000-000000000001', 1, '96100000-0000-0000-0000-000000000003',
                                 '2096-03-10', '2096-03-12')->>'total')::int = 550, 'mover mantém o valor combinado');
select test_assert((select room_id = '96100000-0000-0000-0000-000000000003' and checkin = '2096-03-10'
                           and checkout = '2096-03-12' and total = 550 and subtotal = 600 and version = 2
                    from bookings where id = '96300000-0000-0000-0000-000000000001'), 'quarto e datas mudam');
-- Estende (puxar a borda) com o valor pelas tarifas: 3 noites × R$ 400 - desconto 50 = 1150.
select test_assert((move_booking('96300000-0000-0000-0000-000000000001', 2, '96100000-0000-0000-0000-000000000003',
                                 '2096-03-10', '2096-03-13', true)->>'total')::int = 1150,
  'valor novo = diárias das tarifas + ajustes da reserva');
select test_assert((select subtotal = 1200 and discount = 50 and total = 1150 and version = 3
                    from bookings where id = '96300000-0000-0000-0000-000000000001'), 'subtotal vira o das tarifas');
reset role;

select test_assert((select count(*) from audit_log where target_id = '96300000-0000-0000-0000-000000000001'
                    and action = 'booking.period_changed' and metadata->>'via' = 'mapa_ocupacao') = 2,
  'mudança de datas na auditoria');
select test_assert((select count(*) from audit_log where target_id = '96300000-0000-0000-0000-000000000001'
                    and action = 'booking.room_changed' and actor_id = '00000000-0000-0000-0000-000000000962') = 1,
  'troca de quarto na auditoria com quem fez');
select test_assert(exists(select 1 from audit_log where target_id = '96300000-0000-0000-0000-000000000001'
                    and action = 'booking.values_changed' and (metadata->>'from')::int = 550 and (metadata->>'to')::int = 1150),
  'mudança de valor na auditoria');

-- Valor novo abaixo do que já foi pago: recusa.
update bookings set amount_received = 1150 where id = '96300000-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000961', false);
do $$ begin
  begin
    perform move_booking('96300000-0000-0000-0000-000000000001', 3, '96100000-0000-0000-0000-000000000003',
                         '2096-03-10', '2096-03-11', true);
    raise exception 'TEST: valor novo ficou abaixo do pago';
  exception when raise_exception then
    if sqlerrm <> 'O valor novo fica abaixo do que já foi pago. Mantenha o valor combinado ou ajuste em Editar reserva.' then raise; end if;
  end;
end $$;
-- Mantendo o valor, encurtar é permitido (a pousada decide a devolução depois).
select move_booking('96300000-0000-0000-0000-000000000001', 3, '96100000-0000-0000-0000-000000000003', '2096-03-10', '2096-03-11');
select test_assert((select total from bookings where id = '96300000-0000-0000-0000-000000000001') = 1150,
  'encurtar sem escolher o valor novo não mexe no total pago');

-- ---------------------------------------------------------------------------
-- Em estadia: só a saída muda
-- ---------------------------------------------------------------------------
do $$
declare
  v_today date := current_setting('test.today_0096')::date;
begin
  begin
    perform move_booking('96300000-0000-0000-0000-000000000006', 1, '96100000-0000-0000-0000-000000000002',
                         v_today - 2, v_today + 1);
    raise exception 'TEST: trocou quarto de hóspede em estadia';
  exception when raise_exception then
    if sqlerrm <> 'O hóspede já fez check-in: aqui só dá para mudar a data de saída.' then raise; end if;
  end;
  begin
    perform move_booking('96300000-0000-0000-0000-000000000006', 1, '96100000-0000-0000-0000-000000000003',
                         v_today - 1, v_today + 1);
    raise exception 'TEST: mudou a entrada de hóspede em estadia';
  exception when raise_exception then
    if sqlerrm <> 'O hóspede já fez check-in: aqui só dá para mudar a data de saída.' then raise; end if;
  end;
  begin
    perform move_booking('96300000-0000-0000-0000-000000000006', 1, '96100000-0000-0000-0000-000000000003',
                         v_today - 2, v_today - 1);
    raise exception 'TEST: saída antes de hoje';
  exception when raise_exception then
    if sqlerrm <> 'A nova saída não pode ser antes de hoje.' then raise; end if;
  end;
  perform move_booking('96300000-0000-0000-0000-000000000006', 1, '96100000-0000-0000-0000-000000000003',
                       v_today - 2, v_today + 3);
  perform test_assert((select checkout = v_today + 3 and checkin = v_today - 2 from bookings
                       where id = '96300000-0000-0000-0000-000000000006'), 'em estadia estende a saída');
end $$;

-- ---------------------------------------------------------------------------
-- Pendência vencida no caminho é expirada (como na criação)
-- ---------------------------------------------------------------------------
reset role;
insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, checkin, checkout,
                     adults, children, subtotal, total, status, origin, payment_due_at) values
 ('96300000-0000-0000-0000-000000000007', 'MOV-VENCIDA', '96000000-0000-0000-0000-000000000001', '96100000-0000-0000-0000-000000000001',
  '96200000-0000-0000-0000-000000000001', '2096-06-10', '2096-06-12', 2, 0, 600, 600, 'pending', 'balcao', now() - interval '1 hour');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000962', false);
select move_booking('96300000-0000-0000-0000-000000000002', 1, '96100000-0000-0000-0000-000000000001', '2096-06-10', '2096-06-12');
reset role;
select test_assert((select status from bookings where id = '96300000-0000-0000-0000-000000000007') = 'cancelled',
  'pendência vencida no destino é expirada');
select test_assert(exists(select 1 from audit_log where target_id = '96300000-0000-0000-0000-000000000007'
                          and action = 'booking.expired'), 'expiração na auditoria');
select set_config('request.jwt.claim.sub', '', false);

-- Base do teste de concorrência (concurrent-move.sql): duas reservas em
-- quartos diferentes que vão disputar a mesma suíte nas mesmas datas.
insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, checkin, checkout,
                     adults, children, subtotal, total, status, origin) values
 ('96300000-0000-0000-0000-0000000000a1', 'RACE-MOV-1', '96000000-0000-0000-0000-000000000001', '96100000-0000-0000-0000-000000000001',
  '96200000-0000-0000-0000-000000000001', '2096-08-01', '2096-08-03', 2, 0, 600, 600, 'confirmed', 'balcao'),
 ('96300000-0000-0000-0000-0000000000a2', 'RACE-MOV-2', '96000000-0000-0000-0000-000000000001', '96100000-0000-0000-0000-000000000002',
  '96200000-0000-0000-0000-000000000001', '2096-08-05', '2096-08-07', 2, 0, 600, 600, 'confirmed', 'balcao');
