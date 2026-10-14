-- Testes da 0083 (segurança, rodada 4). Roda DEPOIS de priorities.sql, que cria
-- test_assert e os usuários/pousadas base. Dados exclusivamente sintéticos.
-- Atores: owner A (…001), owner B (…002), master (…009), comum (…081),
-- marketing (…082), comercial (…083).

insert into auth.users(id, email) values
 ('00000000-0000-0000-0000-000000000084', 'hospede-83@example.test'),
 ('00000000-0000-0000-0000-000000000085', 'recepcao-a@example.test');
insert into memberships(id, user_id, pousada_id, role, status) values
 ('83200000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000085', '10000000-0000-0000-0000-000000000001', 'recepcionista', 'active');
insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, guest_id, checkin, checkout, total, status, payment_due_at) values
 ('30000000-0000-0000-0000-000000000831', 'T83-PEND', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000084', '2098-03-01', '2098-03-03', 800, 'pending', now() + interval '2 hours'),
 ('30000000-0000-0000-0000-000000000832', 'T83-STAY', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000084', '2098-04-01', '2098-04-03', 400, 'confirmed', null);
insert into booking_guests(booking_id, full_name, guest_type, document_type, document_number) values
 ('30000000-0000-0000-0000-000000000831', 'Acompanhante Teste', 'adult', 'cpf', 'cifrado-de-teste');

-- ---------------------------------------------------------------------------
-- (A) Papel de plataforma sem concessão não opera pousada alheia
-- ---------------------------------------------------------------------------
select test_assert(not exists (
  select 1 from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.prosrc like '%auth_is_platform_admin()%'
    -- leitura para a equipe da Rota (2) + set_booking_status, que só cita o helper num comentário
    and p.proname not in ('get_link_report', 'list_platform_hosts', 'set_booking_status')
), 'nenhuma RPC de escrita aceita "qualquer papel de plataforma"');
select test_assert(not exists (
  select 1 from pg_policies
  where schemaname = 'public' and cmd <> 'SELECT'
    and coalesce(qual, '') || coalesce(with_check, '') like '%auth_is_platform_admin()%'
), 'nenhuma policy de escrita aceita "qualquer papel de plataforma"');

create function test_denied(query text, label text) returns void language plpgsql as $$
begin
  begin
    execute query;
  exception
    when raise_exception or insufficient_privilege or check_violation or sqlstate 'P0429' then return;
  end;
  raise exception 'TEST: % — passou e não devia', label;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000082', false);
select test_denied($q$select set_booking_companions('30000000-0000-0000-0000-000000000831', 1, '[]'::jsonb)$q$,
  'marketing edita acompanhantes');
select test_denied($q$select expire_pending_booking('30000000-0000-0000-0000-000000000831')$q$,
  'marketing expira reserva alheia');
select test_denied($q$select update_room_operational_status('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'available')$q$,
  'marketing muda status operacional');
select test_denied($q$select save_payment_account('10000000-0000-0000-0000-000000000001', 'mp-x', 'tok', 'ref', 'pk', true, now() + interval '1 day')$q$,
  'marketing troca a conta de pagamento');
select test_denied($q$select create_pending_subscription('10000000-0000-0000-0000-000000000001', gen_random_uuid(), 'pre-x')$q$,
  'marketing assina plano por outra pousada');
do $$ begin
  begin
    perform suspend_member('10000000-0000-0000-0000-000000000001', '83200000-0000-0000-0000-000000000001', 'Teste de suspensão');
    raise exception 'TEST: marketing suspendeu membro de outra pousada';
  exception when raise_exception then
    if sqlerrm <> 'Você não tem permissão para gerenciar membros nesta pousada.' then raise; end if;
  end;
end $$;
select test_assert((select count(*) from list_rooms_for_housekeeping('10000000-0000-0000-0000-000000000001')) = 0,
  'marketing não lista governança');
select test_assert((select count(*) from booking_guests) = 0, 'marketing não lê acompanhantes');
do $$ declare changed integer; begin
  update booking_guests set full_name = 'ADULTERADO';
  get diagnostics changed = row_count;
  perform test_assert(changed = 0, 'marketing não altera acompanhantes');
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- Com concessão ativa (0047), o mesmo usuário passa a ler os acompanhantes.
insert into platform_access_grants(pousada_id, granted_to, granted_by, reason, expires_at)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000082',
        '00000000-0000-0000-0000-000000000009', 'Teste de concessão ativa (0083)', now() + interval '1 hour');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000082', false);
select test_assert((select count(*) from booking_guests where booking_id = '30000000-0000-0000-0000-000000000831') = 1, 'com concessão ativa, lê acompanhantes');
reset role;
select set_config('request.jwt.claim.sub', '', false);
delete from platform_access_grants where granted_to = '00000000-0000-0000-0000-000000000082';

-- A equipe da própria pousada e o dono seguem operando.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select test_assert((select count(*) from booking_guests where booking_id = '30000000-0000-0000-0000-000000000831') = 1, 'dono lê acompanhantes');
select test_assert((select count(*) from list_rooms_for_housekeeping('10000000-0000-0000-0000-000000000001')) = 2,
  'dono lista governança');
select suspend_member('10000000-0000-0000-0000-000000000001', '83200000-0000-0000-0000-000000000001', 'Teste de suspensão');
select reactivate_member('10000000-0000-0000-0000-000000000001', '83200000-0000-0000-0000-000000000001');
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ---------------------------------------------------------------------------
-- (B) Trava de login só pelo servidor, por e-mail + IP
-- ---------------------------------------------------------------------------
select test_assert(not has_function_privilege('anon', 'assert_login_not_locked(text,text)', 'EXECUTE'), 'anon não consulta a trava');
select test_assert(not has_function_privilege('authenticated', 'assert_login_not_locked(text,text)', 'EXECUTE'), 'authenticated não consulta a trava');
select test_assert(not has_function_privilege('anon', 'record_login_attempt(text,text,boolean)', 'EXECUTE'), 'anon não grava tentativa');
select test_assert(not has_function_privilege('authenticated', 'record_login_attempt(text,text,boolean)', 'EXECUTE'), 'authenticated não grava tentativa');
select test_assert(has_function_privilege('service_role', 'assert_login_not_locked(text,text)', 'EXECUTE'), 'servidor consulta a trava');
select test_assert(has_function_privilege('service_role', 'record_login_attempt(text,text,boolean)', 'EXECUTE'), 'servidor grava tentativa');
select test_assert(to_regprocedure('assert_login_not_locked(text)') is null, 'assinatura antiga removida');

set role service_role;
select record_login_attempt('Dono@Example.test', '203.0.113.7', false) from generate_series(1, 5);
-- A trava chega com código próprio (o app reconhece por ele, não pelo texto).
do $$ begin
  begin
    perform assert_login_not_locked('dono@example.test', '203.0.113.7');
    raise exception 'TEST: origem com 5 falhas seguiu liberada';
  exception when sqlstate 'P0429' then null;
  end;
end $$;
-- Outro endereço (o dono de verdade) não é travado pelas falhas do atacante.
select assert_login_not_locked('dono@example.test', '198.51.100.9');
select assert_login_not_locked('dono@example.test', null);
-- Nem com muitas falhas espalhadas por endereços diferentes: não existe teto
-- por e-mail, que deixaria qualquer um travar o dono.
select record_login_attempt('dono@example.test', '203.0.113.' || g, false) from generate_series(10, 34) g;
select assert_login_not_locked('dono@example.test', '198.51.100.9');
-- IPv6 conta por /64: trocar o final do endereço não zera a contagem.
select record_login_attempt('v6@example.test', '2001:db8:1:1::' || g, false) from generate_series(1, 5) g;
select test_denied($q$select assert_login_not_locked('v6@example.test', '2001:db8:1:1:ffff::9')$q$, 'mesmo /64 não travou');
select assert_login_not_locked('v6@example.test', '2001:db8:1:2::1');
-- Uma rede testando senha de muitas contas trava a rede, não as contas.
select record_login_attempt('conta' || g || '@example.test', '192.0.2.50', false) from generate_series(1, 30) g;
select test_denied($q$select assert_login_not_locked('qualquer@example.test', '192.0.2.50')$q$, 'rede com 30 falhas seguiu liberada');
select assert_login_not_locked('conta1@example.test', '198.51.100.9');
-- Sem endereço conhecido, 5 falhas sem endereço travam (comportamento antigo).
select record_login_attempt('semip@example.test', null, false) from generate_series(1, 5);
select test_denied($q$select assert_login_not_locked('semip@example.test', null)$q$, 'sem IP não travou');
select assert_login_not_locked('semip@example.test', '198.51.100.9');
-- IPv4 mapeado em IPv6 é tratado como o IPv4 que é (não como um /64 comum a todos).
reset role;
select test_assert(login_ip_key('::ffff:203.0.113.7') = '203.0.113.7', 'IPv4 mapeado vira IPv4');
select test_assert(login_ip_key('::ffff:203.0.113.7') <> login_ip_key('::ffff:198.51.100.9'), 'IPv4 mapeados diferentes, chaves diferentes');
set role service_role;
-- Endereço malformado não derruba a checagem.
select assert_login_not_locked('dono@example.test', 'não-é-ip');
reset role;

-- ---------------------------------------------------------------------------
-- (C) Orçamento só pelo servidor
-- ---------------------------------------------------------------------------
select test_assert(not has_function_privilege('anon',
  'create_quote_request(uuid,text,text,text,date,date,integer,integer,boolean,text,text,boolean)', 'EXECUTE'), 'anon não cria orçamento direto');
select test_assert(not has_function_privilege('authenticated',
  'create_quote_request(uuid,text,text,text,date,date,integer,integer,boolean,text,text,boolean)', 'EXECUTE'), 'authenticated não cria orçamento direto');
set role service_role;
select test_assert((create_quote_request('10000000-0000-0000-0000-000000000001', 'Visitante Teste', '(35) 99999-0000',
  null, null, null, 2, 0, false, '', '', true)->>'status') = 'ok', 'servidor cria orçamento');
reset role;

-- ---------------------------------------------------------------------------
-- (D) Comprovante Pix: teto de arquivos e metadados do arquivo
-- ---------------------------------------------------------------------------
insert into pousada_pix_settings(pousada_id, pix_key, key_type, holder_name, city, enabled)
values ('10000000-0000-0000-0000-000000000001', 'pix@pousada-a.test', 'email', 'Pousada A', 'Sao Tome', true)
on conflict (pousada_id) do update set enabled = true;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000084', false);
select test_assert(payment_proof_upload_allowed('30000000-0000-0000-0000-000000000831/a.jpg'), 'hóspede sobe na reserva pendente');
select test_assert(not payment_proof_upload_allowed('30000000-0000-0000-0000-000000000832/a.jpg'), 'não sobe em reserva confirmada');
select test_assert(not payment_proof_upload_allowed('30000000-0000-0000-0000-000000000001/a.jpg'), 'não sobe em reserva alheia');
reset role;
select set_config('request.jwt.claim.sub', '', false);

insert into storage.objects(bucket_id, name, metadata) values
 ('payment-proofs', '30000000-0000-0000-0000-000000000831/grande.pdf', '{"size": 20000000, "mimetype": "application/pdf"}'),
 ('payment-proofs', '30000000-0000-0000-0000-000000000831/script.html', '{"size": 100, "mimetype": "text/html"}'),
 ('payment-proofs', '30000000-0000-0000-0000-000000000831/ok.jpg', '{"size": 4096, "mimetype": "image/jpeg"}');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000084', false);
select test_denied($q$select submit_payment_proof('30000000-0000-0000-0000-000000000831',
  '30000000-0000-0000-0000-000000000831/grande.pdf', 'grande.pdf', 'application/pdf', 1000)$q$, 'tamanho declarado venceu o real');
select test_denied($q$select submit_payment_proof('30000000-0000-0000-0000-000000000831',
  '30000000-0000-0000-0000-000000000831/script.html', 'x.jpg', 'image/jpeg', 100)$q$, 'tipo declarado venceu o real');
select test_assert((submit_payment_proof('30000000-0000-0000-0000-000000000831',
  '30000000-0000-0000-0000-000000000831/ok.jpg', 'ok.jpg', 'application/pdf', 999999999)->>'id') is not null, 'comprovante válido entra');
reset role;
select set_config('request.jwt.claim.sub', '', false);
select test_assert((select mime_type = 'image/jpeg' and size_bytes = 4096 from payment_proofs
  where file_path = '30000000-0000-0000-0000-000000000831/ok.jpg'), 'grava tipo e tamanho do arquivo guardado');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000084', false);
-- Pasta fora da forma canônica aponta para a mesma reserva: recusada.
select test_assert(not payment_proof_upload_allowed('{30000000-0000-0000-0000-000000000831}/a.jpg'), 'pasta com chaves recusada');
select test_assert(not payment_proof_upload_allowed('30000000000000000000000000000831/a.jpg'), 'pasta sem hífens recusada');
select test_assert(not payment_proof_upload_allowed('30000000-0000-0000-0000-000000000831'), 'arquivo sem pasta recusado');
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into storage.objects(bucket_id, name)
select 'payment-proofs', '30000000-0000-0000-0000-000000000831/extra-' || g || '.jpg' from generate_series(1, 17) g;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000084', false);
select test_assert(not payment_proof_upload_allowed('30000000-0000-0000-0000-000000000831/vinte-e-um.jpg'), 'teto de 20 arquivos por reserva');
-- A policy de verdade: o INSERT no bucket é recusado.
do $$ begin
  begin
    insert into storage.objects(bucket_id, name) values ('payment-proofs', '30000000-0000-0000-0000-000000000831/vinte-e-um.jpg');
    raise exception 'TEST: upload acima do teto passou';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ---------------------------------------------------------------------------
-- (E) create_pousada: teto de cadastros em análise · (F) excluir pousada
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000081', false);
select create_pousada('Teste Um', 'Cidade', 'mg', 'Descrição de teste da pousada.', 200, 'teste-83-um');
select create_pousada('Teste Dois', 'Cidade', 'mg', 'Descrição de teste da pousada.', 200, 'teste-83-dois');
select test_denied($q$select create_pousada('Teste Três', 'Cidade', 'mg', 'Descrição de teste da pousada.', 200, 'teste-83-tres')$q$,
  'terceiro cadastro em análise');
-- O teto não pode ser contornado por INSERT direto na tabela.
select test_denied($q$insert into pousadas (slug, name, city, state, status, owner_id, tenant_status, price_per_night)
  values ('spam-83', 'Spam', 'Cidade', 'MG', 'em_analise', '00000000-0000-0000-0000-000000000081', 'active', 100)$q$,
  'dono inseriu pousada direto na tabela');
do $$ declare changed integer; begin
  delete from pousadas where slug = 'teste-83-um';
  get diagnostics changed = row_count;
  perform test_assert(changed = 0, 'dono não exclui a própria pousada');
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000083', false);
do $$ declare changed integer; begin
  delete from pousadas where slug = 'teste-83-um';
  get diagnostics changed = row_count;
  perform test_assert(changed = 1, 'comercial exclui pousada');
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ---------------------------------------------------------------------------
-- (I) Vínculos de pousada em rascunho não aparecem para anônimo
-- ---------------------------------------------------------------------------
insert into experiences(id, slug, name, icon) values ('83000000-0000-0000-0000-000000000001', 'teste-83', 'Experiência teste', 'star')
  on conflict do nothing;
insert into pousada_experiences(pousada_id, experience_id)
select p.id, '83000000-0000-0000-0000-000000000001' from pousadas p where p.slug in ('teste-83-dois', 'pousada-a');
set role anon;
select test_assert((select count(*) from pousada_experiences where experience_id = '83000000-0000-0000-0000-000000000001') = 1,
  'anônimo só vê vínculo de pousada publicada');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000081', false);
select test_assert((select count(*) from pousada_experiences where experience_id = '83000000-0000-0000-0000-000000000001') = 2,
  'dono vê o vínculo do próprio rascunho');
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ---------------------------------------------------------------------------
-- (G)(H) Estoque, pedidos e conta de consumo
-- ---------------------------------------------------------------------------
insert into inventory_items(id, pousada_id, name, quantity, track_stock, sale_price) values
 ('83100000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Água 500ml', 0, true, 6.50);

set role authenticated;
-- Dono de OUTRA pousada: mesma resposta de item inexistente, sem lock.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
do $$ begin
  begin
    perform register_inventory_movement('83100000-0000-0000-0000-000000000001', 'entrada', 1);
    raise exception 'TEST: outra pousada movimentou estoque';
  exception when raise_exception then
    if sqlerrm <> 'Item não encontrado.' then raise; end if;
  end;
end $$;
-- Recepção dá entrada, mas não lança despesa nem ajusta.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000085', false);
select register_inventory_movement('83100000-0000-0000-0000-000000000001', 'entrada', 2);
select test_denied($q$select register_inventory_movement('83100000-0000-0000-0000-000000000001', 'entrada', 1, 5, '', true)$q$,
  'recepção lançou despesa');
select test_denied($q$select register_inventory_movement('83100000-0000-0000-0000-000000000001', 'ajuste', 50)$q$,
  'recepção ajustou estoque');
-- Dono compra 10 × R$ 5,55: despesa de R$ 55,50, sem arredondar.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select register_inventory_movement('83100000-0000-0000-0000-000000000001', 'entrada', 10, 5.55, 'Compra teste', true);
select register_inventory_movement('83100000-0000-0000-0000-000000000001', 'perda', 1, null, 'Quebrou');
select test_denied($q$select register_inventory_movement('83100000-0000-0000-0000-000000000001', 'entrada', 1, 'NaN'::numeric, '', true)$q$,
  'custo NaN virou despesa');
select test_denied($q$select register_inventory_movement('83100000-0000-0000-0000-000000000001', 'entrada', 'NaN'::numeric)$q$,
  'quantidade NaN entrou no estoque');
select test_denied($q$insert into expenses (pousada_id, description, amount) values ('10000000-0000-0000-0000-000000000001', 'x', 'NaN')$q$,
  'despesa NaN por insert direto');
reset role;
select set_config('request.jwt.claim.sub', '', false);
select test_assert((select amount from expenses where description like 'Compra: Água 500ml%') = 55.50, 'despesa da compra com centavos');
select test_assert((select quantity from inventory_items where id = '83100000-0000-0000-0000-000000000001') = 11, 'saldo do estoque');
select test_assert((select count(*) from audit_log where action = 'inventory.perda') = 1, 'perda auditada');
select test_assert((select count(*) from audit_log where action = 'inventory.entrada'
  and (metadata->>'expenseAmount')::numeric = 55.50) = 1, 'compra lançada no financeiro auditada');
select test_assert((select count(*) from audit_log where action = 'inventory.entrada') = 1, 'entrada comum não polui a auditoria');

-- Pedido entregue + pagamento de consumo + estorno.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000085', false);
select staff_create_order('30000000-0000-0000-0000-000000000832',
  '[{"itemId": "83100000-0000-0000-0000-000000000001", "quantity": 2}]'::jsonb, 'Frigobar');
select register_consumption_payment('30000000-0000-0000-0000-000000000832', 13.00, 'dinheiro', '');
select test_denied($q$select reverse_consumption_payment((select id from consumption_payments
  where booking_id = '30000000-0000-0000-0000-000000000832' and reverses_id is null), 'Valor errado')$q$,
  'recepção estornou pagamento');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select test_denied($q$select register_consumption_payment('30000000-0000-0000-0000-000000000832', 1, 'pix', '')$q$,
  'outra pousada registrou pagamento');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select test_denied($q$select reverse_consumption_payment((select id from consumption_payments
  where booking_id = '30000000-0000-0000-0000-000000000832' and reverses_id is null), '')$q$, 'estorno sem motivo');
select reverse_consumption_payment((select id from consumption_payments
  where booking_id = '30000000-0000-0000-0000-000000000832' and reverses_id is null), 'Valor digitado errado');
select test_denied($q$select reverse_consumption_payment((select id from consumption_payments
  where booking_id = '30000000-0000-0000-0000-000000000832' and reverses_id is null), 'De novo')$q$, 'estorno em dobro');
select test_denied($q$select reverse_consumption_payment((select id from consumption_payments
  where booking_id = '30000000-0000-0000-0000-000000000832' and reverses_id is not null), 'Estorno do estorno')$q$,
  'estorno de estorno');
select test_assert((get_booking_consumption('30000000-0000-0000-0000-000000000832')->>'paid')::numeric = 0,
  'estorno zera o pago');
select test_assert((get_booking_consumption('30000000-0000-0000-0000-000000000832')->>'delivered')::numeric = 13.00,
  'consumo entregue continua na conta');
-- Depois do estorno dá para registrar o valor certo.
select register_consumption_payment('30000000-0000-0000-0000-000000000832', 13.00, 'pix', 'Valor certo');
reset role;
select set_config('request.jwt.claim.sub', '', false);
select test_assert((select count(*) from audit_log where action = 'guest_order.delivered') = 1, 'entrega auditada');
select test_assert((select count(*) from audit_log where action = 'consumption_payment.registered') = 2, 'pagamentos de consumo auditados');
select test_assert((select count(*) from audit_log where action = 'consumption_payment.reversed') = 1, 'estorno auditado');
select test_assert((select quantity from inventory_items where id = '83100000-0000-0000-0000-000000000001') = 9, 'entrega baixou o estoque');

-- ---------------------------------------------------------------------------
-- (J) Recebe on-line? Só o dono da reserva pergunta
-- ---------------------------------------------------------------------------
select test_assert(not has_function_privilege('anon', 'booking_can_pay_online(uuid)', 'EXECUTE'), 'anon não pergunta');
insert into pousada_payment_accounts(pousada_id, mp_user_id, access_token, refresh_token)
values ('10000000-0000-0000-0000-000000000001', 'mp-teste', 'cifrado', 'cifrado')
on conflict (pousada_id) do nothing;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000084', false);
select test_assert(booking_can_pay_online('30000000-0000-0000-0000-000000000831'), 'hóspede da reserva: recebe on-line');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000081', false);
select test_assert(not booking_can_pay_online('30000000-0000-0000-0000-000000000831'), 'outro usuário não descobre');
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ---------------------------------------------------------------------------
-- (L) Cifragem retroativa do documento de acompanhante: só o servidor
-- ---------------------------------------------------------------------------
select test_assert(not has_function_privilege('authenticated', 'list_booking_guests_pending_document_backfill(integer)', 'EXECUTE'),
  'authenticated não lista documentos pendentes');
select test_assert(not has_function_privilege('authenticated', 'apply_booking_guest_document_backfill(uuid,text)', 'EXECUTE'),
  'authenticated não regrava documento');
insert into booking_guests(id, booking_id, full_name, guest_type, document_type, document_number) values
 ('83300000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000832', 'Antigo em claro', 'adult', 'cpf', '123.456.789-09');
set role service_role;
select test_assert(exists(select 1 from list_booking_guests_pending_document_backfill(2000)
  where id = '83300000-0000-0000-0000-000000000001'), 'documento em claro aparece como pendente');
select test_denied($q$select apply_booking_guest_document_backfill('83300000-0000-0000-0000-000000000001', '12345678909')$q$,
  'backfill aceitou valor em claro');
select apply_booking_guest_document_backfill('83300000-0000-0000-0000-000000000001',
  'gWIn3kGJAsx2pFPU:SbV9YtAyKS2+PYCUUPOjpg==:c2VncmVkbw==');
select test_assert(not exists(select 1 from list_booking_guests_pending_document_backfill(2000)
  where id = '83300000-0000-0000-0000-000000000001'), 'documento cifrado sai da lista de pendentes');
reset role;

-- ---------------------------------------------------------------------------
-- (M) Concessão não sobrevive à perda do papel de plataforma
-- ---------------------------------------------------------------------------
insert into platform_access_grants(pousada_id, granted_to, granted_by, reason, expires_at)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000082',
        '00000000-0000-0000-0000-000000000009', 'Teste de desligamento (0083)', now() + interval '1 hour');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000082', false);
select test_assert(auth_has_active_grant('10000000-0000-0000-0000-000000000001'), 'concessão vale enquanto há papel');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000009', false);
select test_assert(revoke_platform_role_by_email('marketing@example.test')->>'status' = 'ok', 'master remove o papel');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000082', false);
select test_assert(not auth_has_active_grant('10000000-0000-0000-0000-000000000001'), 'sem papel, a concessão não vale');
select test_assert((select count(*) from bookings) = 0, 'ex-equipe não lê reservas');
select test_assert((select count(*) from booking_guests) = 0, 'ex-equipe não lê acompanhantes');
reset role;
select set_config('request.jwt.claim.sub', '', false);
select test_assert((select revoked_at is not null from platform_access_grants
  where reason = 'Teste de desligamento (0083)'), 'concessão encerrada junto com o papel');
select test_assert((select count(*) from audit_log where action = 'platform_access.revoked'
  and metadata->>'reason' = 'papel de plataforma removido') = 1, 'encerramento automático auditado');
-- Receber um papel de novo não reabre a concessão antiga.
update profiles set platform_role = 'marketing' where id = '00000000-0000-0000-0000-000000000082';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000082', false);
select test_assert(not auth_has_active_grant('10000000-0000-0000-0000-000000000001'), 'papel novo não reabre concessão antiga');
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ---------------------------------------------------------------------------
-- (N) Totais de consumo no banco · (O) aviso volta para a fila · (P) internas
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select test_assert((select delivered = 13.00 and paid = 13.00 from consumption_totals_by_pousada('10000000-0000-0000-0000-000000000001')
  where booking_id = '30000000-0000-0000-0000-000000000832'), 'totais de consumo: entregue 13, pago 13 (com estorno no meio)');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select test_denied($q$select * from consumption_totals_by_pousada('10000000-0000-0000-0000-000000000001')$q$,
  'outra pousada leu totais de consumo');
reset role;
select set_config('request.jwt.claim.sub', '', false);

select test_assert(not has_function_privilege('authenticated', 'release_payment_reviews_notification(uuid[])', 'EXECUTE'),
  'authenticated não devolve aviso à fila');
insert into payment_reviews(id, pousada_id, booking_id, kind, source, ref, amount, notified_at)
values ('83400000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
        '30000000-0000-0000-0000-000000000832', 'estorno', 'mercado_pago', 'teste-0083', 10, now());
set role service_role;
select test_assert(release_payment_reviews_notification(array['83400000-0000-0000-0000-000000000001']::uuid[]) = 1,
  'aviso que falhou volta para a fila');
select test_assert(exists(select 1 from claim_payment_reviews_to_notify() where review_id = '83400000-0000-0000-0000-000000000001'),
  'e é pego de novo na próxima rodada');
reset role;

select test_assert(not has_function_privilege('authenticated',
  'assert_room_available_for_booking(uuid,uuid,date,date,integer,integer,boolean,uuid)', 'EXECUTE'),
  'checagem interna de disponibilidade fechada para a API');
select test_assert(not has_function_privilege('anon', 'consume_oauth_state_nonce(text)', 'EXECUTE'), 'anon não consome nonce');

-- Nenhuma função security definer que ESCREVE fica executável por anon, fora
-- das que são públicas de propósito.
select test_assert(not exists (
  select 1 from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prosecdef and p.provolatile = 'v'
    and has_function_privilege('anon', p.oid, 'EXECUTE')
    and p.prorettype <> 'trigger'::regtype  -- gatilho não é chamável pela API
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and p.proname not in (
      'record_link_event'  -- contador de visita da página da bio (teto por minuto)
    )
), 'função de escrita aberta a anon');

-- Conflito de reserva: o viajante não recebe o código da reserva de outra pessoa.
create function test_conflict_message(p_as uuid) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_as::text, true);
  begin
    perform assert_room_available_for_booking('10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001', '2099-10-10', '2099-10-12', 1, 0, false, null);
  exception when raise_exception then
    return sqlerrm;
  end;
  return null;
end $$;
select test_assert(test_conflict_message('00000000-0000-0000-0000-000000000001') like '%(OCCUPIED)%',
  'equipe da pousada vê qual reserva conflita');
select test_assert(test_conflict_message('00000000-0000-0000-0000-000000000084')
  = 'Este período não está mais disponível para esta acomodação.', 'viajante não vê o código da reserva alheia');
