-- Simulação de um dia de trabalho da equipe de uma pousada, papel por papel.
--
-- Cada pessoa age com a própria sessão (`set role authenticated` + `sub` do
-- JWT) e chama as MESMAS RPCs e tabelas que o app usa (repositories/*). O que
-- cada papel pode ou não pode fazer segue lib/auth/rbac.ts e
-- lib/auth/dashboard-sections.ts. Onde o banco diverge do app (ou do que se
-- espera do papel), o teste documenta o comportamento ATUAL com `-- ACHADO:`.
--
-- Dados próprios (ids 9e000000-...), nada de priorities.sql além do esquema.
-- Contas:
--   ...01 proprietário  ...02 gestor (admin_pousada)  ...03 recepção
--   ...04 governança    ...05 financeiro              ...06 viajante
--   ...07 dono de OUTRA pousada
-- Pousadas: ...100 (Pousada Papéis, a da equipe)  ...200 (Outra Pousada)
-- Acomodações: ...101 Chalé Ipê (R$ 300)  ...102 Suíte Jatobá (R$ 450)  ...201 (outra pousada)

\set P  '9e000000-0000-0000-0000-000000000100'
\set P2 '9e000000-0000-0000-0000-000000000200'
\set R1 '9e000000-0000-0000-0000-000000000101'
\set R2 '9e000000-0000-0000-0000-000000000102'
\set R3 '9e000000-0000-0000-0000-000000000201'
\set COMO_POSTGRES 'reset role; set request.jwt.claim.sub = '''';'
\set COMO_DONO 'set role authenticated; set request.jwt.claim.sub = ''9e000000-0000-0000-0000-000000000001'';'
\set COMO_GESTOR 'set role authenticated; set request.jwt.claim.sub = ''9e000000-0000-0000-0000-000000000002'';'
\set COMO_RECEPCAO 'set role authenticated; set request.jwt.claim.sub = ''9e000000-0000-0000-0000-000000000003'';'
\set COMO_GOVERNANCA 'set role authenticated; set request.jwt.claim.sub = ''9e000000-0000-0000-0000-000000000004'';'
\set COMO_FINANCEIRO 'set role authenticated; set request.jwt.claim.sub = ''9e000000-0000-0000-0000-000000000005'';'
\set COMO_VIAJANTE 'set role authenticated; set request.jwt.claim.sub = ''9e000000-0000-0000-0000-000000000006'';'
\set COMO_OUTRO_DONO 'set role authenticated; set request.jwt.claim.sub = ''9e000000-0000-0000-0000-000000000007'';'
\set COMO_ANON 'set role anon; set request.jwt.claim.sub = '''';'

-- ---------------------------------------------------------------------------
-- Ajudantes (só neste banco descartável; apagados no fim)
-- ---------------------------------------------------------------------------
-- Executa `q` com os privilégios de quem chamou e DESFAZ tudo. Devolve 'ok' se
-- passou; senão a mensagem do erro (erros que não são `raise exception` vêm
-- com o SQLSTATE na frente, ex.: '42501 new row violates row-level security').
create function test_try(q text) returns text language plpgsql as $$
begin
  execute q;
  raise exception 'TEST_PROBE_OK';
exception when others then
  if sqlerrm = 'TEST_PROBE_OK' then return 'ok'; end if;
  if sqlstate = 'P0001' then return sqlerrm; end if;
  return sqlstate || ' ' || sqlerrm;
end $$;

-- Quantas linhas `q` (UPDATE/DELETE) afetaria com a RLS de quem chamou; desfaz.
create function test_rows(q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute q;
  get diagnostics n = row_count;
  raise exception 'TEST_PROBE_ROWS:%', n;
exception when others then
  if sqlerrm like 'TEST_PROBE_ROWS:%' then return split_part(sqlerrm, ':', 2)::bigint; end if;
  raise;
end $$;

-- Ids criados durante o dia (reservas, comprovante, pedido...).
create function test_id(k text) returns uuid language sql stable as $$
  select nullif(current_setting('papeis.' || k, true), '')::uuid
$$;

-- ---------------------------------------------------------------------------
-- 0. Cadastro (equipe da Rota): contas, as duas pousadas e seus donos
-- ---------------------------------------------------------------------------
insert into auth.users(id, email, raw_user_meta_data) values
 ('9e000000-0000-0000-0000-000000000001', 'dono-9e@example.test',       '{"full_name":"Dona Papéis"}'),
 ('9e000000-0000-0000-0000-000000000002', 'gestor-9e@example.test',     '{"full_name":"Gestor Papéis"}'),
 ('9e000000-0000-0000-0000-000000000003', 'recepcao-9e@example.test',   '{"full_name":"Recepção Papéis"}'),
 ('9e000000-0000-0000-0000-000000000004', 'governanca-9e@example.test', '{"full_name":"Governança Papéis"}'),
 ('9e000000-0000-0000-0000-000000000005', 'financeiro-9e@example.test', '{"full_name":"Financeiro Papéis"}'),
 ('9e000000-0000-0000-0000-000000000006', 'viajante-9e@example.test',   '{"full_name":"Viajante Papéis"}'),
 ('9e000000-0000-0000-0000-000000000007', 'outro-dono-9e@example.test', '{"full_name":"Outro Dono"}');
insert into pousadas(id, slug, name, city, state, status, tenant_status, owner_id, price_per_night, timezone) values
 (:'P',  'pousada-papeis-9e', 'Pousada Papéis', 'São Tomé', 'MG', 'publicada', 'active', '9e000000-0000-0000-0000-000000000001', 300, 'America/Sao_Paulo'),
 (:'P2', 'outra-pousada-9e',  'Outra Pousada',  'Tiradentes', 'MG', 'publicada', 'active', '9e000000-0000-0000-0000-000000000007', 250, 'America/Sao_Paulo');
insert into memberships(user_id, pousada_id, role, status) values
 ('9e000000-0000-0000-0000-000000000001', :'P',  'proprietario', 'active'),
 ('9e000000-0000-0000-0000-000000000007', :'P2', 'proprietario', 'active');
-- "Hoje" no fuso da pousada (o mesmo que set_booking_status usa para o check-in).
select set_config('papeis.hoje', pousada_today(:'P')::text, false);

-- ---------------------------------------------------------------------------
-- 1. Proprietário prepara a casa e monta a equipe
-- ---------------------------------------------------------------------------
:COMO_DONO
-- Acomodações (repositories/rooms.repository.ts insertRoom).
insert into rooms(id, pousada_id, name, capacity, capacity_max, base_price, status, public_visible, operational_status) values
 (:'R1', :'P', 'Chalé Ipê', 2, 2, 300, 'active', true, 'available'),
 (:'R2', :'P', 'Suíte Jatobá', 4, 4, 450, 'active', true, 'available');
-- Item vendável (save_inventory_item, 0078): água a R$ 6, custo R$ 1,50.
select set_config('papeis.agua', save_inventory_item(:'P', null,
  '{"name":"Água mineral","category":"bebidas","unit":"garrafa","trackStock":true,"initialQuantity":"20","unitCost":"1.50","salePrice":"6","showInApp":true}'::jsonb)->>'id', false);
-- Chave Pix (0075) e conta Mercado Pago (0039): só o proprietário.
select save_pousada_pix_settings(:'P', 'email', 'pix-9e@example.test', 'Pousada Papéis', 'São Tomé', true);
select save_payment_account(:'P', 'mp-9e', 'token-cifrado', 'refresh-cifrado', 'pk-teste', false, now() + interval '180 days');
select test_assert((select count(*) from pousada_payment_accounts where pousada_id = :'P') = 1,
  'proprietário vê a conta de pagamento conectada');
-- Despesa (repositories/finance.repository.ts insertExpense).
insert into expenses(pousada_id, description, amount, category, due_date)
values (:'P', 'Conta de luz', 380.00, 'contas', current_setting('papeis.hoje')::date + 10);
-- Convites pelo menu Equipe (invite_membership): um por papel.
select test_assert(invite_membership(:'P', 'gestor-9e@example.test', 'admin_pousada')->>'status' = 'processed', 'convida gestor');
select test_assert(invite_membership(:'P', 'RECEPCAO-9e@example.test', 'recepcionista')->>'status' = 'processed', 'convida recepção (e-mail sem diferenciar maiúsculas)');
select test_assert(invite_membership(:'P', 'governanca-9e@example.test', 'governanca')->>'status' = 'processed', 'convida governança');
select test_assert(invite_membership(:'P', 'financeiro-9e@example.test', 'financeiro_pousada')->>'status' = 'processed', 'convida financeiro');
-- E-mail sem conta: resposta neutra e nenhum vínculo criado.
select test_assert(invite_membership(:'P', 'ainda-sem-conta-9e@example.test', 'recepcionista')->>'status' = 'processed',
  'convite para e-mail sem conta responde igual (não enumera contas)');
select test_assert(test_try(format('select invite_membership(%L, %L, %L)', :'P', 'recepcao-9e@example.test', 'recepcionista'))
  = 'Este e-mail já tem vínculo com esta pousada.', 'convite repetido é recusado');
select test_assert((select count(*) from memberships where pousada_id = :'P' and status = 'invited') = 4,
  'proprietário vê os 4 convites pendentes');
reset role;

-- ---------------------------------------------------------------------------
-- 2. Cada pessoa aceita o convite (tela "Aceitar convite" do painel)
-- ---------------------------------------------------------------------------
-- Ninguém aceita convite alheio (id lido como superusuário, para o teste valer).
select set_config('papeis.convite_recepcao', (select id from memberships
  where user_id = '9e000000-0000-0000-0000-000000000003' and status = 'invited')::text, false);
:COMO_VIAJANTE
select test_assert(test_try(format('select accept_membership_invite(%L)', test_id('convite_recepcao')))
  = 'Convite não encontrado.', 'viajante não aceita o convite de outra pessoa');
:COMO_OUTRO_DONO
select test_assert(test_try(format('select accept_membership_invite(%L)', test_id('convite_recepcao')))
  = 'Convite não encontrado.', 'dono de outra pousada não aceita o convite de outra pessoa');
-- Antes de aceitar, o convidado não enxerga nada da pousada.
:COMO_RECEPCAO
select test_assert((select count(*) from rooms where pousada_id = :'P') = 0, 'convite pendente não dá acesso às acomodações');
select test_assert((select count(*) from expenses) = 0, 'convite pendente não dá acesso ao financeiro');
select accept_membership_invite((select id from memberships where user_id = auth.uid() and status = 'invited'));
:COMO_GESTOR
select accept_membership_invite((select id from memberships where user_id = auth.uid() and status = 'invited'));
:COMO_GOVERNANCA
select accept_membership_invite((select id from memberships where user_id = auth.uid() and status = 'invited'));
:COMO_FINANCEIRO
select accept_membership_invite((select id from memberships where user_id = auth.uid() and status = 'invited'));
:COMO_POSTGRES
select test_assert((select count(*) from memberships where pousada_id = :'P' and status = 'active') = 5, 'equipe completa e ativa');
select test_assert(not exists(select 1 from memberships m join auth.users u on u.id = m.user_id
  where u.email = 'ainda-sem-conta-9e@example.test'), 'e-mail sem conta não ganhou vínculo');

-- Outra pousada tem a sua acomodação, hóspede e reserva (para os testes de isolamento).
:COMO_OUTRO_DONO
insert into rooms(id, pousada_id, name, capacity, capacity_max, base_price, status, public_visible, operational_status)
values (:'R3', :'P2', 'Quarto da Outra', 2, 2, 250, 'active', true, 'available');
select set_config('papeis.hospede_outra', upsert_guest(p_pousada_id := :'P2', p_full_name := 'Hóspede da Outra',
  p_email := 'hospede-outra-9e@example.test', p_source := 'front_desk')->>'id', false);
select set_config('papeis.b_outra', create_booking(
  p_pousada_id := :'P2', p_room_id := :'R3', p_responsible_guest_id := test_id('hospede_outra'), p_code := '9E-OUTRA-1',
  p_checkin := current_setting('papeis.hoje')::date, p_checkout := current_setting('papeis.hoje')::date + 1,
  p_adults := 1, p_children := 0, p_infants := 0, p_pets := false, p_subtotal := 250, p_fee := 0, p_discount := 0,
  p_surcharge := 0, p_services_amount := 0, p_total := 250, p_status := 'confirmed', p_origin := 'balcao')->>'id', false);
insert into expenses(pousada_id, description, amount) values (:'P2', 'Despesa da outra pousada', 99);
reset role;

-- ---------------------------------------------------------------------------
-- 3. Gestor (admin_pousada): acomodação e tarifa sim; equipe e conta de pagamento não
-- ---------------------------------------------------------------------------
:COMO_GESTOR
-- Edita a acomodação (repositories/rooms.repository.ts updateRoom).
select test_assert(test_rows(format('update rooms set base_price = 320, description = %L where id = %L',
  'Chalé com varanda', :'R1')) = 1, 'gestor pode editar a acomodação');
update rooms set base_price = 320, description = 'Chalé com varanda' where id = :'R1';
-- Regra de tarifa (0087), em datas distantes para não mexer no preço de hoje.
insert into rate_rules(pousada_id, room_id, name, first_night, last_night, kind, value, min_nights)
values (:'P', null, 'Réveillon', '2097-12-29', '2098-01-02', 'fixed', 900, 3);
select test_assert((select count(*) from rate_rules where pousada_id = :'P') = 1, 'gestor cria regra de tarifa');
-- Despesa (canManageExpenses = pousada:edit; RLS expenses_write).
insert into expenses(pousada_id, description, amount, category) values (:'P', 'Gás', 140.00, 'contas');
-- Vê a equipe (member:view) — nomes pela RPC, vínculos pela tabela.
select test_assert((select count(*) from list_membership_names(:'P')) = 5, 'gestor vê os nomes da equipe');
select test_assert((select count(*) from memberships where pousada_id = :'P') = 5, 'gestor vê os vínculos da equipe');
-- Não convida, não muda papel, não suspende (member:invite/update_role/suspend são só do proprietário).
select test_assert(test_try(format('select invite_membership(%L, %L, %L)', :'P', 'novo-9e@example.test', 'recepcionista'))
  = 'Você não tem permissão para convidar membros nesta pousada.', 'gestor não convida');
select test_assert(test_try(format('select update_member_role(%L, %L, %L)', :'P',
  (select id from memberships where user_id = '9e000000-0000-0000-0000-000000000004'), 'recepcionista'))
  = 'Você não tem permissão para gerenciar membros nesta pousada.', 'gestor não muda papel');
select test_assert(test_try(format('select suspend_member(%L, %L, %L)', :'P',
  (select id from memberships where user_id = '9e000000-0000-0000-0000-000000000003'), 'Motivo qualquer'))
  = 'Você não tem permissão para gerenciar membros nesta pousada.', 'gestor não suspende');
-- Nem a conta de pagamento, nem a chave Pix.
select test_assert(test_try(format('select save_payment_account(%L, %L, %L, %L, %L, false, null)', :'P', 'x', 'x', 'x', 'x'))
  = 'Somente o proprietário pode conectar a conta de pagamento desta pousada.', 'gestor não conecta conta de pagamento');
select test_assert(test_try(format('select save_pousada_pix_settings(%L, %L, %L, %L, %L, true)', :'P', 'email', 'x@x.test', 'X', 'Y'))
  = 'Só o proprietário pode alterar a chave Pix da pousada.', 'gestor não troca a chave Pix');
-- A linha com os tokens continua só do proprietário (RLS da 0053); o gestor vê
-- o status pela RPC sem token (0091).
select test_assert((select count(*) from pousada_payment_accounts where pousada_id = :'P') = 0,
  'gestor não lê a linha com os tokens da conta de pagamento');
select test_assert((get_payment_account_status(:'P')->>'connected')::boolean,
  'gestor vê que a conta de pagamento está conectada (0091)');
reset role;

-- ---------------------------------------------------------------------------
-- 4. Viajante reserva pelo site e manda o comprovante Pix
-- ---------------------------------------------------------------------------
:COMO_VIAJANTE
select set_config('papeis.hospede_site', ensure_traveler_guest(:'P', 'Viajante Papéis', 'viajante-9e@example.test')->>'id', false);
-- 2 noites na Suíte Jatobá (R$ 450) = R$ 900, o valor que a vitrine mostrou.
select test_assert((select stay_total from list_bookable_rooms('pousada-papeis-9e', current_setting('papeis.hoje')::date,
  current_setting('papeis.hoje')::date + 2, 2) where id = :'R2') = 900, 'vitrine cota a estadia');
select set_config('papeis.b2', create_booking(:'P', :'R2', test_id('hospede_site'), 'X',
  current_setting('papeis.hoje')::date, current_setting('papeis.hoje')::date + 2, 2, 0, 0, false,
  900, 0, 0, 0, 0, 900, 'pending', 'rota_das_pousadas', '9e000000-0000-0000-0000-000000000006')->>'id', false);
reset role;
-- O arquivo chega pelo Storage (bucket payment-proofs, pasta = id da reserva).
insert into storage.objects(bucket_id, name, metadata)
values ('payment-proofs', test_id('b2') || '/comprovante.png', '{"mimetype":"image/png","size":"2048"}');
:COMO_VIAJANTE
select set_config('papeis.comprovante', submit_payment_proof(test_id('b2'), test_id('b2') || '/comprovante.png',
  'comprovante.png', 'image/png', 2048)->>'id', false);
select test_assert((select count(*) from list_my_bookings()) = 1 and (select status from list_my_bookings()) = 'pending',
  'viajante vê a própria reserva aguardando pagamento');
reset role;

-- ---------------------------------------------------------------------------
-- 5. Recepção: balcão, confirmação, check-in, pagamento, consumo, check-out
-- ---------------------------------------------------------------------------
:COMO_RECEPCAO
-- Lê o que a tela de Reservas e a Nova reserva leem.
select test_assert((select count(*) from bookings where pousada_id = :'P') = 1, 'recepção vê a reserva que chegou pelo site');
select test_assert((select count(*) from rooms where pousada_id = :'P') = 2, 'recepção vê as acomodações (Nova reserva)');
select test_assert((select count(*) from rate_rules where pousada_id = :'P') = 1, 'recepção lê as tarifas');
select test_assert((select total from quote_room_stay(:'R1', current_setting('papeis.hoje')::date,
  current_setting('papeis.hoje')::date + 2)) = 640, 'recepção cota a estadia com o preço novo do gestor');
-- Cadastra o hóspede de balcão (upsert_guest) e cria a reserva como pendente.
select set_config('papeis.hospede_balcao', upsert_guest(p_pousada_id := :'P', p_full_name := 'Hóspede de Balcão',
  p_email := 'balcao-9e@example.test', p_phone := '(31) 90000-0001', p_source := 'front_desk')->>'id', false);
select set_config('papeis.b1', create_booking(
  p_pousada_id := :'P', p_room_id := :'R1', p_responsible_guest_id := test_id('hospede_balcao'), p_code := '9E-BALCAO-1',
  p_checkin := current_setting('papeis.hoje')::date, p_checkout := current_setting('papeis.hoje')::date + 2,
  p_adults := 2, p_children := 0, p_infants := 0, p_pets := false, p_subtotal := 640, p_fee := 0, p_discount := 0,
  p_surcharge := 0, p_services_amount := 0, p_total := 640, p_status := 'pending', p_origin := 'balcao',
  p_payment_due_at := now() + interval '24 hours')->>'id', false);
-- Reserva futura já confirmada (para o teste de check-in fora da data).
select set_config('papeis.b3', create_booking(
  p_pousada_id := :'P', p_room_id := :'R2', p_responsible_guest_id := test_id('hospede_balcao'), p_code := '9E-FUTURA-1',
  p_checkin := current_setting('papeis.hoje')::date + 5, p_checkout := current_setting('papeis.hoje')::date + 6,
  p_adults := 2, p_children := 0, p_infants := 0, p_pets := false, p_subtotal := 450, p_fee := 0, p_discount := 0,
  p_surcharge := 0, p_services_amount := 0, p_total := 450, p_status := 'confirmed', p_origin := 'whatsapp')->>'id', false);
-- Confirma (botão "Confirmar") e faz o check-in na data.
select set_booking_status(test_id('b1'), 'confirmed', null);
select set_booking_status(test_id('b1'), 'checked_in', null);
select test_assert(test_try(format('select set_booking_status(%L, %L, null)', test_id('b3'), 'checked_in'))
  like 'Check-in só pode ser feito a partir de %', 'check-in antes da data é recusado');
-- Sinal no balcão (0086): R$ 320 em dinheiro.
select test_assert((register_booking_payment(test_id('b1'), 320, 'dinheiro', 'Sinal na chegada')->>'remaining')::numeric = 320,
  'recepção registra o sinal no balcão');
-- Lança consumo (2 águas) e recebe o consumo.
select test_assert((staff_create_order(test_id('b1'), ('[{"itemId":"' || test_id('agua') || '","quantity":2}]')::jsonb, 'Frigobar')->>'total')::numeric = 12,
  'recepção lança consumo');
select test_assert((get_booking_consumption(test_id('b1'))->>'delivered')::numeric = 12, 'conta de consumo soma o lançamento');
select register_consumption_payment(test_id('b1'), 12, 'dinheiro', '');
-- Confere o comprovante Pix da reserva do site e aprova (review_payment_proof).
select test_assert(get_booking_pix_instructions(test_id('b2'))->'lastProof'->>'status' = 'submitted', 'recepção vê o comprovante em análise');
-- (o financeiro tenta antes, na seção 7; a aprovação de verdade fica para depois dele)
-- O que a recepção NÃO pode:
select test_assert(test_rows(format('update rooms set base_price = 1 where id = %L', :'R1')) = 0,
  'recepção não muda o preço da acomodação');
select test_assert(test_try(format('insert into rate_rules(pousada_id, name, first_night, last_night, kind, value) values (%L, %L, %L, %L, %L, 1)',
  :'P', 'Recepção', '2097-05-01', '2097-05-02', 'fixed')) like '42501 %', 'recepção não cria regra de tarifa');
select test_assert(test_rows('update rate_rules set value = 1') = 0, 'recepção não altera regra de tarifa');
select test_assert((select count(*) from expenses) = 0, 'recepção não vê despesas');
select test_assert(test_try(format('select invite_membership(%L, %L, %L)', :'P', 'novo-9e@example.test', 'recepcionista'))
  = 'Você não tem permissão para convidar membros nesta pousada.', 'recepção não convida membro');
select test_assert((select count(*) from list_membership_names(:'P')) = 0, 'recepção não lista a equipe');
select test_assert((select count(*) from memberships where pousada_id = :'P') = 1, 'recepção só vê o próprio vínculo');
select test_assert(test_try(format('select save_payment_account(%L, %L, %L, %L, %L, false, null)', :'P', 'x', 'x', 'x', 'x'))
  = 'Somente o proprietário pode conectar a conta de pagamento desta pousada.', 'recepção não conecta conta de pagamento');
select test_assert(test_try(format('select save_pousada_pix_settings(%L, %L, %L, %L, %L, true)', :'P', 'email', 'x@x.test', 'X', 'Y'))
  = 'Só o proprietário pode alterar a chave Pix da pousada.', 'recepção não troca a chave Pix');
select test_assert(test_try(format('select update_room_operational_status(%L, %L, %L)', :'P', :'R1', 'cleaning'))
  = 'Você não tem permissão para alterar o status operacional nesta pousada.', 'recepção não muda o status de limpeza');
select test_assert(test_try(format('select create_room_block(%L, %L, %L, now() + interval ''30 days'', now() + interval ''31 days'', %L)',
  :'P', :'R2', 'maintenance', 'Pintura')) = 'Você não tem permissão para bloquear acomodações nesta pousada.', 'recepção não bloqueia acomodação');
select test_assert(test_try(format('select register_inventory_movement(%L, %L, 5)', test_id('agua'), 'ajuste'))
  = 'Seu perfil não pode ajustar o estoque.', 'recepção não ajusta estoque');
select test_assert(test_rows(format('update pousadas set description = %L where id = %L', 'x', :'P')) = 0,
  'recepção não mexe nas configurações da pousada');
reset role;

-- ---------------------------------------------------------------------------
-- 6. Governança: lista de limpeza e pedidos; nada de reservas, hóspedes ou dinheiro
-- ---------------------------------------------------------------------------
:COMO_GOVERNANCA
select test_assert((select count(*) from list_rooms_for_housekeeping(:'P')) = 2, 'governança lê a lista de governança');
select update_room_operational_status(:'P', :'R2', 'cleaning');
select update_room_operational_status(:'P', :'R2', 'inspection_pending');
select update_room_operational_status(:'P', :'R2', 'available');
select test_assert((select operational_status from list_rooms_for_housekeeping(:'P') where id = :'R2') = 'available',
  'governança muda o status operacional do quarto');
-- Estoque: dá baixa de perda (inventory:move) e ajusta (regra própria da governança).
select register_inventory_movement(test_id('agua'), 'perda', 1, null, 'Garrafa quebrada');
select test_assert(test_try(format('select save_inventory_item(%L, null, %L::jsonb)', :'P', '{"name":"Toalha"}'))
  = 'Seu perfil não pode cadastrar itens do estoque.', 'governança não cadastra item do estoque');
-- O que NÃO pode:
select test_assert((select count(*) from bookings) = 0, 'governança não lê reservas');
select test_assert((select count(*) from guests) = 0, 'governança não lê hóspedes');
select test_assert((select count(*) from booking_guests) = 0, 'governança não lê acompanhantes');
select test_assert((select count(*) from payments) = 0, 'governança não lê pagamentos');
select test_assert((select count(*) from consumption_payments) = 0, 'governança não lê pagamentos de consumo');
select test_assert((select count(*) from expenses) = 0, 'governança não lê despesas');
select test_assert((select count(*) from rooms) = 0, 'governança não lê a tabela de acomodações (preço) — só a projeção');
select test_assert(test_try(format('select consumption_totals_by_pousada(%L)', :'P'))
  = 'Sem acesso ao consumo desta pousada.', 'governança não lê o consumo');
select test_assert(test_try(format('select get_booking_consumption(%L)', test_id('b2'))) = 'Sem acesso a esta conta.',
  'governança não lê a conta de consumo da reserva do site');
-- Corrigido na 0091: reserva de balcão (guest_id nulo) não abre mais o consumo.
select test_assert(test_try(format('select get_booking_consumption(%L)', test_id('b1'))) = 'Sem acesso a esta conta.',
  'governança não lê o consumo de reserva de balcão (0091)');
select test_assert(test_try(format('select set_booking_status(%L, %L, null)', test_id('b3'), 'cancelled'))
  = 'Você não tem permissão sobre esta reserva.', 'governança não mexe em reserva');
select test_assert(test_try(format('select staff_create_order(%L, %L::jsonb, %L)', test_id('b1'),
  '[{"itemId":"' || test_id('agua') || '","quantity":1}]', '')) = 'Seu perfil não pode lançar consumo.', 'governança não lança consumo');
select test_assert(test_try(format('select register_booking_payment(%L, 10, %L, %L)', test_id('b1'), 'dinheiro', ''))
  = 'Reserva não encontrada.', 'governança não registra pagamento');
select test_assert(test_rows(format('update rooms set base_price = 1 where id = %L', :'R2')) = 0, 'governança não muda preço');
-- ACHADO: governança tem `order:manage` e lê guest_orders/guest_order_items
-- (RLS 0078) com os VALORES (total, unit_price), e inventory_items /
-- inventory_movements com custo e preço de venda (RLS = qualquer membro).
-- O app esconde (orderPermissions.showPrices, inventoryPermissions.seeCosts),
-- mas a API REST entrega. Mesmo vale para a recepção em custo de estoque.
select test_assert((select count(*) from guest_orders where total > 0) = 1, 'ACHADO: governança lê o valor dos pedidos');
select test_assert((select unit_cost from inventory_items where id = test_id('agua')) = 1.50, 'ACHADO: governança lê o custo do estoque');
reset role;

-- ---------------------------------------------------------------------------
-- 7. Financeiro: lê o financeiro como o app; não opera a casa
-- ---------------------------------------------------------------------------
:COMO_FINANCEIRO
-- Mesmas leituras de features/financeiro/services/finance.service.ts getFinance.
select test_assert((select count(*) from (select id, code, guest_name, guest_email, guest_phone, responsible_guest_id, room_id,
  checkin, checkout, guests, subtotal, fee, total, balance_due, status, origin, payment_due_at, created_at
  from bookings where pousada_id = :'P') r) = 3, 'financeiro lê as reservas (receita)');
select test_assert((select count(*) from expenses where pousada_id = :'P') = 2, 'financeiro lê as despesas');
select test_assert((select delivered from consumption_totals_by_pousada(:'P') where booking_id = test_id('b1')) = 12,
  'financeiro lê o consumo por reserva');
select test_assert((select count(*) from consumption_payments where pousada_id = :'P') = 1, 'financeiro lê os pagamentos de consumo');
select test_assert((select count(*) from payments where booking_id = test_id('b1')) = 1, 'financeiro lê os pagamentos da diária');
select test_assert((get_booking_consumption(test_id('b1'))->>'paid')::numeric = 12, 'financeiro lê a conta de consumo');
-- Estorna o sinal lançado na forma errada (payment:refund).
select reverse_booking_payment((select id from payments where booking_id = test_id('b1') and status = 'aprovado'),
  'Era Pix, não dinheiro');
-- O que NÃO pode:
select test_assert(test_try(format('select set_booking_status(%L, %L, null)', test_id('b3'), 'checked_in'))
  = 'Você não tem permissão sobre esta reserva.', 'financeiro não faz check-in');
select test_assert(test_try(format('select update_room_operational_status(%L, %L, %L)', :'P', :'R1', 'cleaning'))
  = 'Você não tem permissão para alterar o status operacional nesta pousada.', 'financeiro não mexe em quarto');
select test_assert(test_rows(format('update rooms set base_price = 1 where id = %L', :'R1')) = 0, 'financeiro não muda preço');
select test_assert((select count(*) from rooms) = 0, 'financeiro não lê acomodações');
select test_assert((select count(*) from guests) = 0, 'financeiro não lê a ficha dos hóspedes');
select test_assert(test_try(format('insert into expenses(pousada_id, description, amount) values (%L, %L, 1)', :'P', 'x'))
  like '42501 %', 'financeiro não lança despesa (só proprietário/gestor)');
select test_assert(test_rows('update expenses set paid = true') = 0, 'financeiro não quita despesa');
select test_assert(test_try(format('select staff_create_order(%L, %L::jsonb, %L)', test_id('b1'),
  '[{"itemId":"' || test_id('agua') || '","quantity":1}]', '')) = 'Seu perfil não pode lançar consumo.', 'financeiro não lança consumo');
select test_assert(test_try(format('select set_guest_order_status(%L, %L, null)',
  (select id from guest_orders limit 1), 'preparando')) = 'Pedido não encontrado.', 'financeiro não opera pedidos');
-- Decisão do Gibson (23/10/2026): o financeiro APROVA comprovante Pix
-- (`payment:register` no rbac.ts e review_payment_proof no banco). Na tela ele
-- abre o detalhe da reserva só para pagamentos, sem mudar status. A tentativa
-- abaixo passa e é desfeita.
select test_assert(test_try(format('select review_payment_proof(%L, true, null, null)', test_id('comprovante'))) = 'ok',
  'financeiro aprova comprovante Pix');
-- ACHADO: booking_guests_read usa auth_has_operational_access, que inclui o
-- financeiro; a ficha `guests` não (guest:manage). Nome, nascimento e
-- documento (cifrado) dos acompanhantes ficam legíveis para o financeiro.
select test_assert((select count(*) from booking_guests) = 3, 'ACHADO: financeiro lê acompanhantes (dados pessoais)');
reset role;

-- Recepção aprova o Pix e acerta o restante do balcão; check-out.
:COMO_RECEPCAO
select test_assert((review_payment_proof(test_id('comprovante'), true, null, null)->>'confirmed')::boolean,
  'recepção aprova o comprovante e a reserva do site é confirmada');
select register_booking_payment(test_id('b1'), 320, 'pix', 'Sinal (lançado de novo na forma certa)');
select test_assert((register_booking_payment(test_id('b1'), 320, 'cartao_debito', 'Saldo na saída')->>'remaining')::numeric = 0,
  'recepção quita a diária no check-out');
select test_assert(test_try(format('select register_booking_payment(%L, 1, %L, %L)', test_id('b1'), 'dinheiro', ''))
  = 'Esta reserva já está paga.', 'não recebe duas vezes');
select test_assert(test_try(format('select reverse_booking_payment(%L, %L)',
  (select id from payments where booking_id = test_id('b1') and status = 'aprovado' limit 1), 'teste'))
  = 'Pagamento não encontrado.', 'recepção não estorna (payment:refund)');
select set_booking_status(test_id('b1'), 'checked_out', null);
reset role;
select test_assert((select status = 'checked_out' and balance_due = 0 and amount_received = 640 from bookings where id = test_id('b1')),
  'reserva de balcão fechada e paga');
select test_assert((select status from bookings where id = test_id('b2')) = 'confirmed', 'reserva do site confirmada pelo Pix');

-- ---------------------------------------------------------------------------
-- 8. Hóspede pede pelo app da estadia; governança entrega; financeiro recebe
-- ---------------------------------------------------------------------------
:COMO_VIAJANTE
select test_assert((get_guest_stay(test_id('b2'))->>'canOrder')::boolean, 'hóspede pode pedir durante a estadia');
select set_config('papeis.pedido', place_guest_order(test_id('b2'),
  ('[{"itemId":"' || test_id('agua') || '","quantity":3}]')::jsonb, 'Sem gelo')->>'orderId', false);
:COMO_GOVERNANCA
select set_guest_order_status(test_id('pedido'), 'preparando', null);
select set_guest_order_status(test_id('pedido'), 'entregue', null);
-- Depois do check-out da recepção, o Chalé vai para limpeza.
select update_room_operational_status(:'P', :'R1', 'awaiting_cleaning');
select update_room_operational_status(:'P', :'R1', 'cleaning');
:COMO_FINANCEIRO
select register_consumption_payment(test_id('b2'), 18, 'cartao_credito', '');
reset role;
select test_assert((select quantity from inventory_items where id = test_id('agua')) = 20 - 2 - 1 - 3,
  'estoque baixou: 2 do balcão, 1 perda, 3 do app');
select test_assert((select status from guest_orders where id = test_id('pedido')) = 'entregue', 'pedido entregue pela governança');
select test_assert((booking_consumption_summary(test_id('b2'))->>'paid')::numeric = 18, 'consumo do app pago');

-- ---------------------------------------------------------------------------
-- 9. Proprietário: tudo da própria pousada
-- ---------------------------------------------------------------------------
:COMO_DONO
select set_booking_status(test_id('b2'), 'checked_in', null);
select test_assert((select count(*) from bookings where pousada_id = :'P') = 3, 'proprietário vê as reservas');
select test_assert((select count(*) from guests where pousada_id = :'P') = 2, 'proprietário vê os hóspedes');
select test_assert((select count(*) from expenses where pousada_id = :'P') = 2, 'proprietário vê as despesas');
select test_assert((select count(*) from list_rooms_for_housekeeping(:'P')) = 2, 'proprietário vê a governança');
select update_room_operational_status(:'P', :'R1', 'available');
select create_room_block(:'P', :'R2', 'maintenance', (current_setting('papeis.hoje')::date + 30)::timestamptz,
  (current_setting('papeis.hoje')::date + 31)::timestamptz, 'Pintura');
select test_assert((select count(*) from list_membership_names(:'P')) = 5, 'proprietário vê a equipe');
-- Troca papel e suspende/reativa (só o proprietário).
select update_member_role(:'P', (select id from memberships where user_id = '9e000000-0000-0000-0000-000000000004'), 'governanca');
select suspend_member(:'P', (select id from memberships where user_id = '9e000000-0000-0000-0000-000000000003'), 'Teste de suspensão');
:COMO_RECEPCAO
select test_assert((select count(*) from bookings) = 0, 'recepção suspensa perde o acesso às reservas');
select test_assert(test_try(format('select register_booking_payment(%L, 1, %L, %L)', test_id('b2'), 'dinheiro', ''))
  = 'Reserva não encontrada.', 'recepção suspensa não registra pagamento');
:COMO_DONO
select reactivate_member(:'P', (select id from memberships where user_id = '9e000000-0000-0000-0000-000000000003'));
:COMO_RECEPCAO
select test_assert((select count(*) from bookings where pousada_id = :'P') = 3, 'recepção reativada volta a ver as reservas');
reset role;

-- Pendência de balcão da OUTRA pousada com prazo vencido (cenário do achado
-- de expire_pending_booking). Gravada como superusuário: a RPC de criação não
-- aceita prazo no passado.
insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, checkin, checkout, total, status, origin, payment_due_at)
values ('9e000000-0000-0000-0000-000000000299', '9E-OUTRA-VENCIDA', :'P2', :'R3', test_id('hospede_outra'),
  current_setting('papeis.hoje')::date + 60, current_setting('papeis.hoje')::date + 61, 250, 'pending', 'balcao',
  now() - interval '1 hour');

-- ---------------------------------------------------------------------------
-- 10. Isolamento: ninguém da pousada lê nem escreve a outra
-- ---------------------------------------------------------------------------
-- Dono da outra pousada contra a Pousada Papéis.
:COMO_OUTRO_DONO
select test_assert((select count(*) from bookings where pousada_id = :'P') = 0, 'outro dono não vê reservas');
select test_assert((select count(*) from guests where pousada_id = :'P') = 0, 'outro dono não vê hóspedes');
select test_assert((select count(*) from expenses where pousada_id = :'P') = 0, 'outro dono não vê despesas');
select test_assert((select count(*) from rooms where pousada_id = :'P') = 0, 'outro dono não vê acomodações');
select test_assert((select count(*) from rate_rules where pousada_id = :'P') = 0, 'outro dono não vê tarifas');
select test_assert((select count(*) from memberships where pousada_id = :'P') = 0, 'outro dono não vê a equipe');
select test_assert((select count(*) from list_membership_names(:'P')) = 0, 'outro dono não lista nomes da equipe');
select test_assert((select count(*) from list_rooms_for_housekeeping(:'P')) = 0, 'outro dono não vê a governança');
select test_assert((select count(*) from guest_orders where pousada_id = :'P') = 0, 'outro dono não vê pedidos');
select test_assert((select count(*) from inventory_items where pousada_id = :'P') = 0, 'outro dono não vê estoque');
select test_assert(test_rows(format('update rooms set base_price = 1 where pousada_id = %L', :'P')) = 0, 'outro dono não muda preço');
select test_assert(test_rows(format('delete from expenses where pousada_id = %L', :'P')) = 0, 'outro dono não apaga despesa');
select test_assert(test_try(format('select set_booking_status(%L, %L, %L)', test_id('b3'), 'cancelled', 'sabotagem'))
  = 'Você não tem permissão sobre esta reserva.', 'outro dono não cancela reserva alheia');
select test_assert(test_try(format('select register_booking_payment(%L, 1, %L, %L)', test_id('b3'), 'dinheiro', ''))
  = 'Reserva não encontrada.', 'outro dono não registra pagamento alheio');
select test_assert(test_try(format('select update_room_operational_status(%L, %L, %L)', :'P', :'R1', 'blocked'))
  = 'Você não tem permissão para alterar o status operacional nesta pousada.', 'outro dono não muda quarto alheio');
select test_assert(test_try(format('select invite_membership(%L, %L, %L)', :'P', 'outro-dono-9e@example.test', 'proprietario'))
  = 'Você não tem permissão para convidar membros nesta pousada.', 'outro dono não se convida');
select test_assert(test_try(format('select get_booking_consumption(%L)', test_id('b2'))) = 'Sem acesso a esta conta.',
  'outro dono não lê consumo alheio (reserva do site)');
select test_assert(test_try(format('select get_booking_consumption(%L)', test_id('b1'))) = 'Sem acesso a esta conta.',
  'outro dono não lê o consumo de reserva de balcão alheia (0091)');
select test_assert(test_try(format('select quote_room_stay(%L, current_date + 1, current_date + 2)', :'R1'))
  = 'Acomodação não encontrada.', 'outro dono não cota acomodação alheia');
select test_assert(test_try(format('select upsert_guest(p_pousada_id := %L, p_full_name := %L)', :'P', 'Intruso'))
  = 'Você não tem permissão para gerenciar hóspedes nesta pousada.', 'outro dono não cadastra hóspede alheio');
select test_assert(test_try(format('select register_inventory_movement(%L, %L, 1)', test_id('agua'), 'saida'))
  = 'Item não encontrado.', 'outro dono não mexe no estoque alheio');
-- Equipe da Pousada Papéis contra a outra pousada.
:COMO_RECEPCAO
select test_assert((select count(*) from bookings where pousada_id = :'P2') = 0, 'recepção não vê reservas da outra pousada');
select test_assert((select count(*) from guests where pousada_id = :'P2') = 0, 'recepção não vê hóspedes da outra pousada');
select test_assert(test_try(format('select set_booking_status(%L, %L, null)', test_id('b_outra'), 'checked_in'))
  = 'Você não tem permissão sobre esta reserva.', 'recepção não faz check-in na outra pousada');
select test_assert(test_try(format('select create_booking(p_pousada_id := %L, p_room_id := %L, p_responsible_guest_id := %L, p_code := %L, p_checkin := current_date + 40, p_checkout := current_date + 41, p_adults := 1, p_children := 0, p_infants := 0, p_pets := false, p_subtotal := 1, p_fee := 0, p_discount := 0, p_surcharge := 0, p_services_amount := 0, p_total := 1, p_status := %L, p_origin := %L)',
  :'P2', :'R3', test_id('hospede_outra'), 'INTRUSO', 'confirmed', 'balcao'))
  = 'Você não tem permissão para criar esta reserva.', 'recepção não cria reserva na outra pousada');
select test_assert(test_try(format('select expire_pending_booking(%L)', '9e000000-0000-0000-0000-000000000299'))
  = 'Você não tem permissão sobre esta reserva.', 'recepção não expira pendência de balcão da outra pousada (0091)');
:COMO_GOVERNANCA
select test_assert((select count(*) from list_rooms_for_housekeeping(:'P2')) = 0, 'governança não vê quartos da outra pousada');
select test_assert(test_try(format('select update_room_operational_status(%L, %L, %L)', :'P2', :'R3', 'cleaning'))
  = 'Você não tem permissão para alterar o status operacional nesta pousada.', 'governança não mexe na outra pousada');
select test_assert(test_try(format('select update_room_operational_status(%L, %L, %L)', :'P', :'R3', 'cleaning'))
  = 'Acomodação não pertence a esta pousada.', 'governança não usa a própria pousada para mexer em quarto alheio');
:COMO_FINANCEIRO
select test_assert((select count(*) from expenses where pousada_id = :'P2') = 0, 'financeiro não vê despesas da outra pousada');
select test_assert(test_try(format('select consumption_totals_by_pousada(%L)', :'P2'))
  = 'Sem acesso ao consumo desta pousada.', 'financeiro não vê consumo da outra pousada');
:COMO_GESTOR
select test_assert(test_rows(format('update rooms set base_price = 1 where id = %L', :'R3')) = 0, 'gestor não muda preço da outra pousada');
select test_assert(test_try(format('insert into rate_rules(pousada_id, name, first_night, last_night, kind, value) values (%L, %L, %L, %L, %L, 1)',
  :'P2', 'Intrusa', '2097-05-01', '2097-05-02', 'fixed')) like '42501 %', 'gestor não cria tarifa na outra pousada');
reset role;

-- ---------------------------------------------------------------------------
-- 11. Viajante só vê o que é dele; anônimo não vê nada
-- ---------------------------------------------------------------------------
:COMO_VIAJANTE
select test_assert((select count(*) from list_my_bookings()) = 1, 'viajante lista só a própria reserva');
select test_assert((select count(*) from list_my_bookings(test_id('b1'))) = 0, 'viajante não abre reserva de balcão');
select test_assert((select count(*) from bookings) = 0, 'viajante não lê a tabela de reservas (0085)');
select test_assert((select count(*) from guests) = 0, 'viajante não lê fichas de hóspedes');
select test_assert((select count(*) from expenses) = 0, 'viajante não lê despesas');
select test_assert((select count(*) from payments) = 1, 'viajante vê o próprio pagamento (Pix aprovado)');
select test_assert((select count(*) from guest_orders) = 1, 'viajante vê o próprio pedido');
select test_assert(test_try(format('select get_guest_stay(%L)', test_id('b1'))) = 'Reserva não encontrada.',
  'viajante não abre a estadia de outra pessoa');
select test_assert(test_try(format('select place_guest_order(%L, %L::jsonb, %L)', test_id('b1'),
  '[{"itemId":"' || test_id('agua') || '","quantity":1}]', '')) = 'Reserva não encontrada.', 'viajante não pede na conta de outra pessoa');
select test_assert(test_try(format('select register_booking_payment(%L, 1, %L, %L)', test_id('b2'), 'dinheiro', ''))
  = 'Reserva não encontrada.', 'viajante não registra pagamento (nem na própria reserva)');
select test_assert(test_try(format('select set_booking_status(%L, %L, null)', test_id('b2'), 'checked_out'))
  = 'Você só pode cancelar esta reserva enquanto ela não for confirmada.', 'viajante não faz check-out sozinho');
select test_assert(test_try(format('select update_room_operational_status(%L, %L, %L)', :'P', :'R1', 'cleaning'))
  = 'Você não tem permissão para alterar o status operacional nesta pousada.', 'viajante não mexe em quarto');
select test_assert((select count(*) from list_rooms_for_housekeeping(:'P')) = 0, 'viajante não vê a governança');
reset role;
:COMO_ANON
select test_invisible('select count(*) from bookings');
select test_invisible('select count(*) from guests');
select test_invisible('select count(*) from expenses');
select test_invisible('select count(*) from guest_orders');
select test_assert(not has_function_privilege('anon', 'register_booking_payment(uuid,numeric,text,text)', 'EXECUTE'),
  'anon não registra pagamento');
select test_assert(not has_function_privilege('anon', 'update_room_operational_status(uuid,uuid,room_operational_status)', 'EXECUTE'),
  'anon não muda status de quarto');
reset role;

-- ---------------------------------------------------------------------------
-- 12. Trilha de auditoria do dia (quem fez o quê)
-- ---------------------------------------------------------------------------
:COMO_POSTGRES
select test_assert(exists(select 1 from audit_log where action = 'booking.checked_in' and target_id = test_id('b1')
  and actor_id = '9e000000-0000-0000-0000-000000000003'), 'check-in auditado com a recepção');
select test_assert(exists(select 1 from audit_log where action = 'booking.checked_out' and target_id = test_id('b1')
  and actor_id = '9e000000-0000-0000-0000-000000000003'), 'check-out auditado com a recepção');
select test_assert(exists(select 1 from audit_log where action = 'booking_payment.reversed' and target_id = test_id('b1')
  and actor_id = '9e000000-0000-0000-0000-000000000005'), 'estorno auditado com o financeiro');
select test_assert(exists(select 1 from audit_log where action = 'payment_proof.approved' and target_id = test_id('b2')
  and actor_id = '9e000000-0000-0000-0000-000000000003'), 'aprovação do Pix auditada com a recepção');
select test_assert(not exists(select 1 from audit_log where action = 'payment_proof.approved'
  and actor_id = '9e000000-0000-0000-0000-000000000005'), 'a tentativa do financeiro foi desfeita (não ficou na auditoria)');
select test_assert(exists(select 1 from audit_log where action = 'room.operational_status_changed' and target_id = :'R2'
  and actor_id = '9e000000-0000-0000-0000-000000000004'), 'limpeza auditada com a governança');
select test_assert(exists(select 1 from audit_log where action = 'member.suspended'
  and actor_id = '9e000000-0000-0000-0000-000000000001'), 'suspensão auditada com o proprietário');

drop function test_try(text);
drop function test_rows(text);
drop function test_id(text);
