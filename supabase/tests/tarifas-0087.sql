-- 0087: tarifas por temporada, estadia mínima e fotos por acomodação.
-- Roda depois de priorities.sql (pousada-a: quartos Duplo R$200 e Família R$400).
-- Datas em 2098 para não colidir com as reservas de teste de priorities.sql.
insert into auth.users(id, email) values
 ('00000000-0000-0000-0000-000000000871', 'viajante-0087@example.test'),
 ('00000000-0000-0000-0000-000000000872', 'recepcao-0087@example.test');
insert into memberships(user_id, pousada_id, role, status) values
 ('00000000-0000-0000-0000-000000000872', '10000000-0000-0000-0000-000000000001', 'recepcionista', 'active');

-- ---------------------------------------------------------------------------
-- Dono cria regras; recepção lê mas não escreve; outra pousada não vê
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
insert into rate_rules(id, pousada_id, room_id, name, first_night, last_night, weekdays, kind, value, min_nights) values
 -- geral: fim de semana +50% (noites de sexta e sábado)
 ('87000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', null, 'Fim de semana',
  '2098-01-01', '2098-12-31', array[5, 6]::smallint[], 'percent', 50, null),
 -- geral: Carnaval com preço fixo e mínimo de 4 noites
 ('87000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', null, 'Carnaval',
  '2098-02-27', '2098-03-03', null, 'fixed', 500, 4),
 -- só o Duplo: Carnaval mais caro (vence a geral por ser da acomodação)
 ('87000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Carnaval Duplo',
  '2098-02-27', '2098-03-03', null, 'fixed', 650, null);
update rooms set gallery = array['https://exemplo.supabase.co/storage/v1/object/public/pousadas/10000000-0000-0000-0000-000000000001/acomodacoes/a.jpg']
 where id = '20000000-0000-0000-0000-000000000001';
select test_assert((select count(*) from rate_rules) = 3, 'dono lê as regras da pousada');

do $$ begin
  begin
    insert into rate_rules(pousada_id, room_id, name, first_night, last_night, kind, value)
    values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'Quarto alheio',
            '2098-05-01', '2098-05-02', 'fixed', 1);
    raise exception 'TEST: regra apontou para acomodação de outra pousada';
  exception when raise_exception then
    if sqlerrm <> 'A acomodação escolhida não é desta pousada.' then raise; end if;
  end;
  begin
    insert into rate_rules(pousada_id, name, first_night, last_night, kind, value)
    values ('10000000-0000-0000-0000-000000000001', 'Desconto absurdo', '2098-05-01', '2098-05-02', 'percent', -95);
    raise exception 'TEST: aceitou desconto acima de 90%%';
  exception when check_violation then null;
  end;
  begin
    update rooms set gallery = array_fill('x'::text, array[13]) where id = '20000000-0000-0000-0000-000000000002';
    raise exception 'TEST: aceitou 13 fotos na acomodação';
  exception when check_violation then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000872', false);
select test_assert((select count(*) from rate_rules) = 3, 'recepção lê as regras (lança reserva no balcão)');
do $$ declare changed integer; begin
  begin
    insert into rate_rules(pousada_id, name, first_night, last_night, kind, value)
    values ('10000000-0000-0000-0000-000000000001', 'Recepção', '2098-05-01', '2098-05-02', 'fixed', 1);
    raise exception 'TEST: recepção criou regra de preço';
  exception when insufficient_privilege then null;
  end;
  update rate_rules set value = 1 where id = '87000000-0000-0000-0000-000000000002';
  get diagnostics changed = row_count;
  perform test_assert(changed = 0, 'recepção não altera regra de preço');
end $$;
select test_assert((select total from quote_room_stay('20000000-0000-0000-0000-000000000002', '2098-03-02', '2098-03-05')) = 500 + 500 + 400,
  'recepção cota a estadia pelas regras');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select test_assert((select count(*) from rate_rules) = 0, 'dono de outra pousada não vê as regras');
do $$ declare changed integer; begin
  delete from rate_rules where id = '87000000-0000-0000-0000-000000000002';
  get diagnostics changed = row_count;
  perform test_assert(changed = 0, 'dono de outra pousada não apaga regra');
  begin
    perform quote_room_stay('20000000-0000-0000-0000-000000000001', '2098-03-02', '2098-03-05');
    raise exception 'TEST: outra pousada cotou acomodação alheia';
  exception when raise_exception then
    if sqlerrm <> 'Acomodação não encontrada.' then raise; end if;
  end;
end $$;
reset role;

select test_assert(exists(select 1 from audit_log where action = 'rate_rule.insert'
  and target_id = '87000000-0000-0000-0000-000000000001'), 'regra nova fica na auditoria');

-- ---------------------------------------------------------------------------
-- Preço noite a noite e vitrine
-- ---------------------------------------------------------------------------
-- 2098-01-06 é segunda; 2098-01-09 quinta; 2098-01-10 sexta; 2098-01-11 sábado.
select test_assert(room_night_price('20000000-0000-0000-0000-000000000002', '2098-01-06') = 400, 'dia de semana: diária-base');
select test_assert(room_night_price('20000000-0000-0000-0000-000000000002', '2098-01-10') = 600, 'sexta: +50%');
select test_assert(room_night_price('20000000-0000-0000-0000-000000000002', '2098-03-01') = 500, 'Carnaval geral vence o fim de semana (período mais curto)');
select test_assert(room_night_price('20000000-0000-0000-0000-000000000001', '2098-03-01') = 650, 'regra da acomodação vence a geral');
select test_assert((select total from room_stay_quote('20000000-0000-0000-0000-000000000002', '2098-01-09', '2098-01-12')) = 400 + 600 + 600,
  'estadia soma noite a noite (qui + sex + sáb)');
select test_assert((select min_nights from room_stay_quote('20000000-0000-0000-0000-000000000002', '2098-02-26', '2098-02-28')) = 4,
  'chegar antes do Carnaval não fura o mínimo do período');
select test_assert((select min_nights from room_stay_quote('20000000-0000-0000-0000-000000000002', '2098-01-05', '2098-01-07')) = 1,
  'sem regra de mínimo: 1 noite');

set role anon;
select test_assert(not has_function_privilege('anon', 'room_night_price(uuid,date)', 'EXECUTE'), 'anon não chama o cálculo interno');
select test_assert(not has_function_privilege('anon', 'quote_room_stay(uuid,date,date)', 'EXECUTE'), 'anon não cota pela RPC da equipe');
select test_invisible('select count(*) from rate_rules');
select test_assert((select stay_total from list_bookable_rooms('pousada-a', '2098-01-09', '2098-01-12', 2) where name = 'Família') = 1600,
  'vitrine mostra o total da estadia com a temporada');
-- (o Família está ocupado nessas datas por security-0083)
select test_assert((select min_nights from list_bookable_rooms('pousada-a', '2098-03-01', '2098-03-03', 2) where name = 'Duplo') = 4,
  'vitrine avisa o mínimo de noites');
select test_assert((select coalesce(array_length(gallery, 1), 0) from list_bookable_rooms('pousada-a', null, null, 1) where name = 'Duplo') = 1,
  'vitrine traz as fotos da acomodação');
select test_assert((select stay_total from list_bookable_rooms('pousada-a', null, null, 1) where name = 'Duplo') is null,
  'sem datas não há total de estadia');
reset role;

-- ---------------------------------------------------------------------------
-- Reserva pública cobra a temporada e respeita o mínimo
-- ---------------------------------------------------------------------------
update pousadas set timezone = 'America/Sao_Paulo' where id = '10000000-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000871', false);
do $$
declare
  v_guest uuid := (ensure_traveler_guest('10000000-0000-0000-0000-000000000001', 'Viajante 0087', 'viajante-0087@example.test')->>'id')::uuid;
begin
  -- valor da diária-base (sem a temporada) é recusado
  begin
    perform create_booking('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', v_guest,
      'X', '2098-01-09', '2098-01-12', 2, 0, 0, false, 1200, 0, 0, 0, 0, 1200, 'pending',
      'rota_das_pousadas', '00000000-0000-0000-0000-000000000871');
    raise exception 'TEST: aceitou o preço sem a regra de fim de semana';
  exception when raise_exception then
    if sqlerrm <> 'O valor da reserva mudou. Volte à busca para revisar antes de reservar.' then raise; end if;
  end;
  -- abaixo do mínimo do Carnaval
  begin
    perform create_booking('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', v_guest,
      'X', '2098-03-01', '2098-03-03', 2, 0, 0, false, 1000, 0, 0, 0, 0, 1000, 'pending',
      'rota_das_pousadas', '00000000-0000-0000-0000-000000000871');
    raise exception 'TEST: aceitou estadia abaixo do mínimo';
  exception when raise_exception then
    if sqlerrm <> 'Para estas datas a estadia mínima é de 4 noites.' then raise; end if;
  end;
  -- valor certo passa
  perform create_booking('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', v_guest,
    'X', '2098-01-09', '2098-01-12', 2, 0, 0, false, 1600, 0, 0, 0, 0, 1600, 'pending',
    'rota_das_pousadas', '00000000-0000-0000-0000-000000000871');
end $$;
reset role;
select test_assert((select total from bookings where guest_id = '00000000-0000-0000-0000-000000000871') = 1600,
  'reserva gravada com o total da temporada');

-- Equipe no balcão continua livre para negociar o valor.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select create_booking('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001',
  'BALCAO-0087', '2098-03-01', '2098-03-03', 2, 0, 0, false, 700, 0, 0, 0, 0, 700, 'confirmed', 'balcao');
reset role;
select test_assert((select total from bookings where code = 'BALCAO-0087') = 700, 'balcão grava o valor combinado');
select set_config('request.jwt.claim.sub', '', false);
