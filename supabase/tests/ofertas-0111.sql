-- Testes da 0111 (ofertas para ex-hóspedes). Roda depois de cara-0110.sql.
-- Pousada A (dono …001, recepção …085); viajantes sintéticos …111 (já se
-- hospedou), …112 (nunca se hospedou) e …113 (se hospedou, sem autorização).

insert into auth.users(id, email) values
 ('00000000-0000-0000-0000-000000000111', 'ex-hospede@example.test'),
 ('00000000-0000-0000-0000-000000000112', 'curioso@example.test'),
 ('00000000-0000-0000-0000-000000000113', 'calado@example.test');

insert into rooms(id, pousada_id, name, capacity, capacity_max, base_price, status, public_visible, operational_status)
values ('20000000-0000-0000-0000-000000111101', '10000000-0000-0000-0000-000000000001', 'Quarto 0111', 2, 2, 200, 'active', true, 'available');

insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, guest_id, created_by,
                     guest_name, checkin, checkout, total, status, origin)
values
 ('30000000-0000-0000-0000-000000111101', 'T111-A', '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000111101', '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-000000000111', 'Ex Hóspede',
  current_date - 60, current_date - 57, 600, 'checked_out', 'rota_das_pousadas'),
 ('30000000-0000-0000-0000-000000111102', 'T111-B', '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000111101', '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000113', '00000000-0000-0000-0000-000000000113', 'Calado',
  current_date - 40, current_date - 38, 400, 'checked_out', 'rota_das_pousadas');

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------
select test_assert(not has_function_privilege('anon', 'set_offer_consent(uuid,boolean)', 'EXECUTE'), 'anon não autoriza');
select test_assert(not has_function_privilege('anon', 'send_pousada_offer(uuid,integer,integer,date,date,text)', 'EXECUTE'), 'anon não envia');
select test_assert(not has_function_privilege('authenticated', 'list_offer_emails_due(integer)', 'EXECUTE'), 'lista de e-mails só do serviço');
select test_assert(not has_function_privilege('authenticated', 'create_offer_for_audience(uuid,text,integer,integer,date,date,text,uuid,uuid[])', 'EXECUTE'), 'criação interna');
select test_assert(not has_table_privilege('authenticated', 'offer_deliveries', 'SELECT'), 'envios não legíveis pela API');
select test_assert(not has_table_privilege('authenticated', 'offer_consents', 'SELECT'), 'autorizações não legíveis pela API');

-- ---------------------------------------------------------------------------
-- Autorização
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000112', false);
select test_denied($q$select set_offer_consent('10000000-0000-0000-0000-000000000001', true)$q$,
  'quem nunca se hospedou não autoriza');
select set_offer_consent('10000000-0000-0000-0000-000000000001', false);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000111', false);
select set_offer_consent('10000000-0000-0000-0000-000000000001', true);
select test_assert((select granted from my_offer_consents()
  where pousada_id = '10000000-0000-0000-0000-000000000001'), 'autorização registrada');
reset role;
select set_config('request.jwt.claim.sub', '', false);
select test_assert((select source_booking_id from offer_consents
  where user_id = '00000000-0000-0000-0000-000000000111') = '30000000-0000-0000-0000-000000111101',
  'guarda a estadia de origem');
select test_assert((select count(*) from audit_log where action = 'offer_consent.granted') = 1, 'auditada');

-- ---------------------------------------------------------------------------
-- Envio
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000085', false);
select test_denied($q$select send_pousada_offer('10000000-0000-0000-0000-000000000001', 15)$q$,
  'recepção não envia oferta');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select test_denied($q$select send_pousada_offer('10000000-0000-0000-0000-000000000001', 60)$q$, 'desconto acima de 50%');
select test_denied($q$select send_pousada_offer('10000000-0000-0000-0000-000000000001', 15, 3)$q$, 'validade curta demais');
select test_assert((count_offer_audience('10000000-0000-0000-0000-000000000001')->>'reachable')::int = 1,
  'público: só quem autorizou');
select test_assert((send_pousada_offer('10000000-0000-0000-0000-000000000001', 15, 30, null, null, 'Volte no verão')
  ->>'sent')::int = 1, 'enviada para 1');
select test_assert((send_pousada_offer('10000000-0000-0000-0000-000000000001', 20)->>'sent')::int = 0,
  'segunda oferta no mesmo mês não chega');
reset role;
select set_config('request.jwt.claim.sub', '', false);

select test_assert((select count(*) from pousada_offers where pousada_id = '10000000-0000-0000-0000-000000000001') = 1,
  'oferta sem destinatário não fica registrada');
select test_assert((select code ~ '^VOLTA[A-Z0-9]{6}$' and max_uses = 1 and value = 15
                      and guest_user_id = '00000000-0000-0000-0000-000000000111'
                      and valid_until = pousada_local_date('10000000-0000-0000-0000-000000000001') + 30
                    from pousada_coupons where offer_id is not null), 'cupom de uma pessoa, uso único, 30 dias');

-- Cupom só vale para quem recebeu.
select test_assert(coupon_evaluate('10000000-0000-0000-0000-000000000001',
  (select code from pousada_coupons where offer_id is not null), current_date + 30, current_date + 32,
  400, '00000000-0000-0000-0000-000000000111', false)->>'reason' = 'ok', 'quem recebeu usa');
select test_assert(coupon_evaluate('10000000-0000-0000-0000-000000000001',
  (select code from pousada_coupons where offer_id is not null), current_date + 30, current_date + 32,
  400, '00000000-0000-0000-0000-000000000112', false)->>'reason' = 'invalid', 'outra conta: código inválido');

-- Fora da lista de cupons da pousada.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select test_assert(not exists (select 1 from list_pousada_coupons('10000000-0000-0000-0000-000000000001')
  where code like 'VOLTA%'), 'cupom de oferta fora da lista de cupons');
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- E-mail pela rodada, marcado só depois de sair.
select test_assert((select count(*) from list_offer_emails_due(50)) = 1, 'e-mail na fila');
select test_assert((select email from list_offer_emails_due(50)) = 'ex-hospede@example.test', 'para o e-mail da conta');
select mark_offer_email((select delivery_id from list_offer_emails_due(50)), false);
select test_assert((select count(*) from list_offer_emails_due(50)) = 1, 'falha volta para a fila');
select mark_offer_email((select delivery_id from list_offer_emails_due(50)), true);
select test_assert((select count(*) from list_offer_emails_due(50)) = 0, 'enviado sai da fila');

-- Oferta no app, abertura e reserva.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000111', false);
select test_assert((select count(*) from my_active_offers()) = 1, 'oferta aparece para quem recebeu');
select mark_offer_opened((select code from my_active_offers()));
select set_offer_consent('10000000-0000-0000-0000-000000000001', false);
select test_assert((select count(*) from my_active_offers()) = 0, 'desistiu: some do app');
select set_offer_consent('10000000-0000-0000-0000-000000000001', true);
select test_assert((select count(*) from my_active_offers()) = 1, 'autorizou de novo: volta');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000112', false);
select test_assert((select count(*) from my_active_offers()) = 0, 'e não para os outros');
reset role;
select set_config('request.jwt.claim.sub', '', false);
select test_assert((select opened_at is not null from offer_deliveries), 'abertura registrada');

insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, guest_id, created_by,
                     guest_name, checkin, checkout, total, status, origin)
values ('30000000-0000-0000-0000-000000111103', 'T111-C', '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000111101', '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-000000000111', 'Ex Hóspede',
  current_date + 30, current_date + 32, 340, 'confirmed', 'rota_das_pousadas');
insert into booking_coupon_redemptions (coupon_id, pousada_id, booking_id, user_id, code, discount)
select id, pousada_id, '30000000-0000-0000-0000-000000111103', guest_user_id, code, 60
  from pousada_coupons where offer_id is not null;
select test_assert((select booking_id from offer_deliveries) = '30000000-0000-0000-0000-000000111103',
  'reserva feita com a oferta');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select test_assert((select recipients = 1 and emailed = 1 and opened = 1 and booked = 1 and revenue = 340
  from get_pousada_offer_report('10000000-0000-0000-0000-000000000001')), 'relatório da oferta');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000085', false);
select test_denied($q$select * from get_pousada_offer_report('10000000-0000-0000-0000-000000000001')$q$,
  'recepção não vê o relatório');

reset role;
select set_config('request.jwt.claim.sub', '', false);
