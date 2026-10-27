-- 0094: calendário com preço por dia e link da reserva para o acompanhante.
-- Roda depois de priorities.sql (test_assert / test_invisible). Pousada própria
-- (pousada-cal) com datas relativas a hoje: o calendário só aceita até ~2 anos à frente.
-- Dados exclusivamente sintéticos.
insert into auth.users(id, email) values
 ('00000000-0000-0000-0000-000000000941', 'dono-0094@example.test'),
 ('00000000-0000-0000-0000-000000000942', 'viajante-0094@example.test'),
 ('00000000-0000-0000-0000-000000000943', 'curioso-0094@example.test');
insert into pousadas(id, slug, name, city, state, status, tenant_status, owner_id, price_per_night,
                     address, cep, checkin_time, checkout_time, timezone) values
 ('94000000-0000-0000-0000-000000000001', 'pousada-cal', 'Pousada Calendário', 'Tiradentes', 'MG',
  'publicada', 'active', '00000000-0000-0000-0000-000000000941', 150,
  'Rua das Flores, 10', '36325-000', '15:00', '11:00', 'America/Sao_Paulo'),
 ('94000000-0000-0000-0000-000000000002', 'pousada-rascunho', 'Pousada Rascunho', 'Tiradentes', 'MG',
  'rascunho', 'onboarding', '00000000-0000-0000-0000-000000000941', 150, '', '', '14:00', '12:00', 'America/Sao_Paulo');
insert into rooms(id, pousada_id, name, capacity, capacity_max, base_price, status, public_visible, operational_status) values
 ('94000000-0000-0000-0000-000000000011', '94000000-0000-0000-0000-000000000001', 'Simples', 2, 2, 150, 'active', true, 'available'),
 ('94000000-0000-0000-0000-000000000012', '94000000-0000-0000-0000-000000000001', 'Suíte', 4, 4, 300, 'active', true, 'available'),
 -- Oculta do público e mais barata: nunca pode virar o "a partir de".
 ('94000000-0000-0000-0000-000000000013', '94000000-0000-0000-0000-000000000001', 'Interna', 2, 2, 50, 'active', false, 'available'),
 ('94000000-0000-0000-0000-000000000014', '94000000-0000-0000-0000-000000000002', 'Rascunho', 2, 2, 100, 'active', true, 'available');
insert into guests(id, pousada_id, user_id, full_name, email, phone) values
 ('94000000-0000-0000-0000-000000000021', '94000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000942',
  'Viajante Noventa e Quatro', 'viajante-0094@example.test', '(34) 90000-0094');

-- Dia-base: hoje no fuso da pousada.
create temp table cal_base as select pousada_local_date('94000000-0000-0000-0000-000000000001') as d;
grant select on cal_base to anon, authenticated;

-- Simples ocupada em D+5 e D+6; Suíte ocupada só em D+5 → D+5 sem vaga, D+6 só a Suíte.
insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, guest_id, checkin, checkout, adults, total, status)
select '94000000-0000-0000-0000-000000000031', 'CAL-A', '94000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000011',
       '94000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000942', d + 5, d + 7, 2, 300, 'confirmed' from cal_base;
insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, checkin, checkout, adults, total, status)
select '94000000-0000-0000-0000-000000000032', 'CAL-B', '94000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000012',
       '94000000-0000-0000-0000-000000000021', d + 5, d + 6, 2, 300, 'confirmed' from cal_base;
-- Noite vendida no Airbnb (0044) na Suíte em D+30.
insert into channel_calendars(id, pousada_id, room_id, provider, export_token)
values ('94000000-0000-0000-0000-000000000041', '94000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000012', 'airbnb', 'token-0094-teste');
insert into channel_events(calendar_id, pousada_id, room_id, uid, starts_on, ends_on)
select '94000000-0000-0000-0000-000000000041', '94000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000012', 'uid-0094', d + 30, d + 31 from cal_base;
-- Feriado: diária fixa de 500 e mínimo de 3 noites em D+10 e D+11; Simples +100% em D+20.
insert into rate_rules(pousada_id, room_id, name, first_night, last_night, kind, value, min_nights)
select '94000000-0000-0000-0000-000000000001'::uuid, null::uuid, 'Feriado', d + 10, d + 11, 'fixed', 500, 3 from cal_base
union all
select '94000000-0000-0000-0000-000000000001'::uuid, '94000000-0000-0000-0000-000000000011'::uuid, 'Festival', d + 20, d + 20, 'percent', 100, null from cal_base;

-- ---------------------------------------------------------------------------
-- 1. Calendário com preço (anônimo, como a página pública)
-- ---------------------------------------------------------------------------
set role anon;
select set_config('request.jwt.claim.sub', '', false);
create temp view cal as
  select c.* from cal_base b, public_price_calendar('pousada-cal', b.d - 1, b.d + 60, 1) c;

select test_assert((select count(*) from cal) = 61, 'um registro por noite pedida (fim exclusivo)');
select test_assert((select not available and from_price is null from cal, cal_base where night = d - 1), 'ontem não se reserva');
select test_assert((select from_price from cal, cal_base where night = d + 1) = 150,
  'a partir de = menor diária livre, sem a acomodação oculta');
select test_assert((select min_nights from cal, cal_base where night = d + 1) = 1, 'sem regra: mínimo de 1 noite');
select test_assert((select not available and from_price is null from cal, cal_base where night = d + 5), 'noite sem nenhuma vaga');
select test_assert((select from_price from cal, cal_base where night = d + 6) = 300, 'só a Suíte livre: preço dela');
select test_assert((select available from cal, cal_base where night = d + 7), 'dia do check-out da reserva fica livre');
select test_assert((select from_price from cal, cal_base where night = d + 10) = 500, 'feriado com diária fixa');
select test_assert((select min_nights from cal, cal_base where night = d + 10) = 3, 'feriado avisa o mínimo de noites');
select test_assert((select from_price from cal, cal_base where night = d + 20) = 300, 'percentual só na Simples: 150 × 2');
select test_assert((select from_price from cal, cal_base where night = d + 30) = 150, 'noite vendida na OTA tira a Suíte');
-- Mesma conta da vitrine/reserva (list_bookable_rooms → room_stay_quote).
select test_assert((select from_price from cal, cal_base where night = d + 10)
  = (select min(stay_total) from cal_base, list_bookable_rooms('pousada-cal', d + 10, d + 11, 1)),
  'preço do dia = cotação de uma noite da vitrine');

select test_assert((select c.from_price from cal_base b, public_price_calendar('pousada-cal', b.d + 1, b.d + 2, 3) c) = 300,
  '3 hóspedes: só a Suíte cabe');
select test_assert((select not c.available from cal_base b,
  public_price_calendar('pousada-cal', b.d + 6, b.d + 7, 1, '94000000-0000-0000-0000-000000000011') c),
  'acomodação escolhida: só ela conta');
select test_assert((select count(*) from cal_base b, public_price_calendar('pousada-rascunho', b.d, b.d + 30, 1)) = 0,
  'pousada não publicada não mostra calendário');
select test_assert((select count(*) from cal_base b, public_price_calendar('nao-existe', b.d, b.d + 30, 1)) = 0,
  'slug inexistente: vazio');
select test_assert((select count(*) from cal_base b, public_price_calendar('pousada-cal', b.d, b.d + 62, 2)) = 62,
  'janela de 62 dias é aceita');
do $$ declare v_d date := (select d from cal_base); begin
  begin
    perform * from public_price_calendar('pousada-cal', v_d, v_d + 63, 1);
    raise exception 'TEST: aceitou janela acima do limite';
  exception when raise_exception then
    if sqlerrm <> 'Período do calendário inválido.' then raise; end if;
  end;
  begin
    perform * from public_price_calendar('pousada-cal', v_d + 800, v_d + 801, 1);
    raise exception 'TEST: aceitou varrer anos à frente';
  exception when raise_exception then
    if sqlerrm <> 'Período do calendário inválido.' then raise; end if;
  end;
  begin
    perform * from public_price_calendar('pousada-cal', v_d, v_d + 10, 0);
    raise exception 'TEST: aceitou 0 hóspedes';
  exception when raise_exception then
    if sqlerrm <> 'Período do calendário inválido.' then raise; end if;
  end;
end $$;
drop view cal;

-- ---------------------------------------------------------------------------
-- 2. Link da reserva para o acompanhante
-- ---------------------------------------------------------------------------
select test_assert(not has_function_privilege('anon', 'share_my_booking(uuid,boolean)', 'EXECUTE'), 'anon não cria link');
select test_assert(not has_function_privilege('anon', 'revoke_my_booking_share(uuid)', 'EXECUTE'), 'anon não revoga link');
select test_assert(not has_function_privilege('anon', 'new_booking_share_token()', 'EXECUTE'), 'anon não gera token');
select test_invisible('select count(*) from booking_share_links');
reset role;

create temp table share_tokens(label text primary key, token text);
grant select, insert on share_tokens to anon, authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000943', false);
do $$ begin
  begin
    perform share_my_booking('94000000-0000-0000-0000-000000000031');
    raise exception 'TEST: outra conta criou link da reserva alheia';
  exception when raise_exception then
    if sqlerrm <> 'Reserva não encontrada.' then raise; end if;
  end;
  begin
    perform share_my_booking('94000000-0000-0000-0000-000000000032');
    raise exception 'TEST: criou link de reserva sem dono';
  exception when raise_exception then
    if sqlerrm <> 'Reserva não encontrada.' then raise; end if;
  end;
end $$;
select test_invisible('select count(*) from booking_share_links');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000942', false);
insert into share_tokens values ('primeiro', share_my_booking('94000000-0000-0000-0000-000000000031'));
select test_assert((select length(token) from share_tokens where label = 'primeiro') = 43, 'token de 43 caracteres');
select test_assert((select token ~ '^[A-Za-z0-9_-]+$' from share_tokens where label = 'primeiro'), 'token seguro para URL');
select test_assert(share_my_booking('94000000-0000-0000-0000-000000000031') = (select token from share_tokens where label = 'primeiro'),
  'pedir de novo devolve o mesmo link');
insert into share_tokens values ('renovado', share_my_booking('94000000-0000-0000-0000-000000000031', true));
select test_assert((select count(distinct token) from share_tokens) = 2, 'gerar outro troca o token');
select test_invisible('select count(*) from booking_share_links');
-- A equipe da pousada também não lê a tabela.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000941', false);
select test_invisible('select count(*) from booking_share_links');
reset role;
select test_assert(exists(select 1 from audit_log where action = 'booking.share_renewed'
  and target_id = '94000000-0000-0000-0000-000000000031'), 'troca do link fica na auditoria');

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select test_assert(get_shared_booking((select token from share_tokens where label = 'primeiro')) is null,
  'link antigo para de funcionar');
select test_assert((select (j->>'code') = 'CAL-A' and (j->>'pousadaName') = 'Pousada Calendário'
    and (j->>'address') = 'Rua das Flores, 10' and (j->>'checkinTime') = '15:00'
    and (j->>'checkoutTime') = '11:00' and (j->>'status') = 'confirmed'
    and (j->>'checkin')::date = (select d + 5 from cal_base)
  from (select get_shared_booking((select token from share_tokens where label = 'renovado')) as j) s),
  'link mostra pousada, endereço, datas, horários e código');
select test_assert((select array_agg(k order by k) from (select jsonb_object_keys(
    get_shared_booking((select token from share_tokens where label = 'renovado'))) k) s)
  = array['address', 'cep', 'checkin', 'checkinTime', 'checkout', 'checkoutTime', 'city', 'code',
          'pousadaName', 'state', 'status'],
  'link não traz valor, documento, e-mail, telefone nem hóspedes');
select test_assert(get_shared_booking('curto') is null, 'token fora do formato: nada');
select test_assert(get_shared_booking(repeat('a', 43)) is null, 'token inexistente: nada');
reset role;

-- Reserva cancelada: o link só diz que foi cancelada.
update bookings set status = 'cancelled' where id = '94000000-0000-0000-0000-000000000031';
set role anon;
select test_assert(get_shared_booking((select token from share_tokens where label = 'renovado')) = '{"status": "cancelled"}'::jsonb,
  'cancelada: sem detalhes');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000942', false);
do $$ begin
  begin
    perform share_my_booking('94000000-0000-0000-0000-000000000031', true);
    raise exception 'TEST: gerou link de reserva cancelada';
  exception when raise_exception then
    if sqlerrm <> 'Esta reserva foi cancelada.' then raise; end if;
  end;
end $$;
-- Revogar apaga o link.
select revoke_my_booking_share('94000000-0000-0000-0000-000000000031');
reset role;
select test_assert(not exists(select 1 from booking_share_links where booking_id = '94000000-0000-0000-0000-000000000031'),
  'revogar apaga o link');

-- Revisão de 26/10: só reserva ativa gera link, e o link expira 7 dias depois da saída.
update bookings set status = 'checked_out' where id = '94000000-0000-0000-0000-000000000031';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000942', false);
do $$ begin
  begin
    perform share_my_booking('94000000-0000-0000-0000-000000000031');
    raise exception 'TEST: gerou link de estadia encerrada';
  exception when raise_exception then
    if sqlerrm <> 'Só dá para compartilhar uma reserva ativa.' then raise; end if;
  end;
end $$;
reset role;
update bookings set status = 'confirmed' where id = '94000000-0000-0000-0000-000000000031';
set role authenticated;
insert into share_tokens values ('expira', share_my_booking('94000000-0000-0000-0000-000000000031'));
reset role;
update bookings set status = 'checked_out', checkin = current_date - 12, checkout = current_date - 10
  where id = '94000000-0000-0000-0000-000000000031';
set role anon;
select test_assert(get_shared_booking((select token from share_tokens where label = 'expira')) is null,
  'link deixa de abrir 7 dias depois da saída');
reset role;
update bookings set checkin = current_date - 4, checkout = current_date - 2
  where id = '94000000-0000-0000-0000-000000000031';
set role anon;
select test_assert(get_shared_booking((select token from share_tokens where label = 'expira'))->>'status' = 'finished',
  'até 7 dias depois da saída o link ainda abre como estadia concluída');
reset role;

-- Conta excluída (0090 zera guest_id): o link deixa de abrir.
update bookings set status = 'confirmed' where id = '94000000-0000-0000-0000-000000000031';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000942', false);
insert into share_tokens values ('final', share_my_booking('94000000-0000-0000-0000-000000000031'));
reset role;
update bookings set guest_id = null where id = '94000000-0000-0000-0000-000000000031';
set role anon;
select test_assert(get_shared_booking((select token from share_tokens where label = 'final')) is null,
  'reserva sem dono (conta excluída) não abre pelo link');
reset role;
select set_config('request.jwt.claim.sub', '', false);
