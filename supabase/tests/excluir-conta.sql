-- 0090 — Excluir a própria conta. Dados exclusivamente sintéticos.
-- Roda depois de priorities.sql e security-0083.sql (reaproveita a pousada A,
-- os quartos, o hóspede 40…01, o dono 00…01 e o master 00…09).

-- Contas de teste:
--   91 viajante sem reserva em aberto (vai excluir)
--   92 viajante com reserva futura (recusado)
--   93 conta-alvo de uma tentativa de excluir "outro" (fica intacta)
--   94 viajante com estadia que termina HOJE, ligada só pela ficha (recusado)
--   95 dona de pousada já encerrada (pode excluir)
insert into auth.users(id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000091', 'Exclui@Example.test', '{"full_name":"Viajante Exclui"}'),
 ('00000000-0000-0000-0000-000000000092', 'futura@example.test', '{"full_name":"Viajante Futura"}'),
 ('00000000-0000-0000-0000-000000000093', 'alvo@example.test', '{"full_name":"Conta Alvo"}'),
 ('00000000-0000-0000-0000-000000000094', 'hoje@example.test', '{"full_name":"Estadia Hoje"}'),
 ('00000000-0000-0000-0000-000000000095', 'encerrada@example.test', '{"full_name":"Dona Encerrada"}');

-- Conta 91: cadastro completo, favoritos, equipe em B, convite em A, estadia
-- antiga com pagamento e avaliação, tentativas de login guardadas.
insert into traveler_profiles(user_id, phone, birth_date, document_type, document_number, document_last4, cep, address, city, state)
values ('00000000-0000-0000-0000-000000000091', '31999990000', '1990-01-01', 'CPF', 'cifrado:abc', '1234', '30000000', 'Rua Teste, 1', 'BH', 'MG');
insert into favorites(user_id, pousada_id) values ('00000000-0000-0000-0000-000000000091', '10000000-0000-0000-0000-000000000001');
insert into favorite_alerts(user_id, pousada_id) values ('00000000-0000-0000-0000-000000000091', '10000000-0000-0000-0000-000000000001');
insert into memberships(user_id, pousada_id, role, status) values
 ('00000000-0000-0000-0000-000000000091', '10000000-0000-0000-0000-000000000002', 'recepcionista', 'active'),
 ('00000000-0000-0000-0000-000000000091', '10000000-0000-0000-0000-000000000001', 'admin_pousada', 'invited');
insert into guests(id, pousada_id, user_id, full_name, email, phone, document_number) values
 ('40000000-0000-0000-0000-000000000910', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000091',
  'Viajante Exclui', 'exclui@example.test', '31999990000', 'cifrado:abc');
insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, guest_id, created_by, checkin, checkout, total, status, origin, guest_name) values
 ('30000000-0000-0000-0000-000000000910', 'EXCLUI-ANTIGA', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000910', '00000000-0000-0000-0000-000000000091', '00000000-0000-0000-0000-000000000091',
  '2020-01-10', '2020-01-12', 400, 'checked_out', 'rota_das_pousadas', 'Viajante Exclui'),
 -- Cancelada no futuro não segura a exclusão.
 ('30000000-0000-0000-0000-000000000920', 'EXCLUI-CANCEL', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000910', '00000000-0000-0000-0000-000000000091', '00000000-0000-0000-0000-000000000091',
  '2099-07-01', '2099-07-03', 400, 'cancelled', 'rota_das_pousadas', 'Viajante Exclui');
insert into payments(booking_id, amount, method, status, provider_ref) values
 ('30000000-0000-0000-0000-000000000910', 400, 'pix', 'aprovado', 'teste-0090');
insert into reviews(id, pousada_id, booking_id, author_id, rating, text) values
 ('60000000-0000-0000-0000-000000000910', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000910',
  '00000000-0000-0000-0000-000000000091', 4, 'café da manhã ótimo');
insert into login_attempts(email, ip, success) values ('exclui@example.test', '203.0.113.9', false);
insert into password_reset_requests(email, ip) values ('exclui@example.test', '203.0.113.9');

-- Conta 92: reserva confirmada no futuro.
insert into guests(id, pousada_id, user_id, full_name) values
 ('40000000-0000-0000-0000-000000000920', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000092', 'Viajante Futura');
insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, guest_id, checkin, checkout, total, status) values
 ('30000000-0000-0000-0000-000000000930', 'FUTURA-0090', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000920', '00000000-0000-0000-0000-000000000092', '2099-06-01', '2099-06-03', 400, 'confirmed');

-- Conta 94: em estadia, checkout HOJE no fuso da pousada, ligada só pela ficha.
insert into guests(id, pousada_id, user_id, full_name) values
 ('40000000-0000-0000-0000-000000000940', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000094', 'Estadia Hoje');
insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, checkin, checkout, total, status) values
 ('30000000-0000-0000-0000-000000000940', 'HOJE-0090', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000940',
  pousada_local_date('10000000-0000-0000-0000-000000000001') - 2,
  pousada_local_date('10000000-0000-0000-0000-000000000001'), 800, 'checked_in');

-- Conta 95: dona de pousada arquivada.
insert into pousadas(id, slug, name, city, state, status, tenant_status, owner_id) values
 ('10000000-0000-0000-0000-000000000095', 'pousada-encerrada-0090', 'Pousada Encerrada', 'Cidade', 'MG', 'arquivada', 'inactive',
  '00000000-0000-0000-0000-000000000095');
insert into memberships(user_id, pousada_id, role, status) values
 ('00000000-0000-0000-0000-000000000095', '10000000-0000-0000-0000-000000000095', 'proprietario', 'active');

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------
select test_assert(not has_function_privilege('anon', 'delete_my_account()', 'EXECUTE'), 'anon não executa delete_my_account');
select test_assert(not has_function_privilege('service_role', 'delete_my_account()', 'EXECUTE'), 'service_role não executa delete_my_account');
select test_assert(has_function_privilege('authenticated', 'delete_my_account()', 'EXECUTE'), 'authenticated executa delete_my_account');
select test_assert(not has_column_privilege('authenticated', 'public.profiles', 'deleted_at', 'UPDATE'), 'cliente não grava deleted_at direto');

set role anon;
do $$ begin
  begin
    perform delete_my_account();
    raise exception 'TEST: anônimo excluiu conta';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Recusas
-- ---------------------------------------------------------------------------
create function test_delete_refused(p_as uuid, p_expected text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_as::text, true);
  begin
    perform delete_my_account();
    raise exception 'TEST: exclusão deveria ser recusada para %', p_as;
  exception when raise_exception then
    if sqlerrm <> p_expected then raise; end if;
  end;
end $$;
grant execute on function test_delete_refused(uuid, text) to authenticated;

set role authenticated;
select test_delete_refused('00000000-0000-0000-0000-000000000092',
  'Você tem uma reserva em andamento. Cancele ou aguarde o fim da estadia antes de excluir a conta.');
select test_delete_refused('00000000-0000-0000-0000-000000000094',
  'Você tem uma reserva em andamento. Cancele ou aguarde o fim da estadia antes de excluir a conta.');
select test_delete_refused('00000000-0000-0000-0000-000000000001',
  'Transfira ou encerre sua pousada antes de excluir a conta. Fale com o suporte.');
select test_delete_refused('00000000-0000-0000-0000-000000000009',
  'Contas da equipe da Rota das Pousadas são encerradas pelo suporte. Fale com o suporte.');
reset role;
select set_config('request.jwt.claim.sub', '', false);
select test_assert((select deleted_at is null and full_name = 'Viajante Futura' from profiles where id = '00000000-0000-0000-0000-000000000092'),
  'recusa não mexe na conta');
select test_assert((select guest_id = '00000000-0000-0000-0000-000000000092' from bookings where code = 'FUTURA-0090'),
  'recusa não desvincula a reserva');

-- ---------------------------------------------------------------------------
-- Exclusão de verdade (conta 91)
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000091', false);
select test_assert(delete_my_account()->>'status' = 'deleted', 'viajante sem reserva em aberto exclui a conta');
select test_assert(delete_my_account()->>'status' = 'already_deleted', 'repetir é inofensivo (etapa do Auth pode ser refeita)');
-- Sessão antiga (JWT ainda válido) não escreve mais.
select test_denied($q$insert into favorites(user_id, pousada_id) values ('00000000-0000-0000-0000-000000000091', '10000000-0000-0000-0000-000000000001')$q$,
  'conta excluída não favorita');
select test_denied($q$update profiles set full_name = 'Voltei' where id = '00000000-0000-0000-0000-000000000091'$q$,
  'conta excluída não renomeia o perfil');
select test_denied($q$insert into traveler_profiles(user_id) values ('00000000-0000-0000-0000-000000000091')$q$,
  'conta excluída não recria o perfil de viajante');
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- Dados pessoais sumiram.
select test_assert(not exists(select 1 from traveler_profiles where user_id = '00000000-0000-0000-0000-000000000091'), 'perfil de viajante apagado');
select test_assert(not exists(select 1 from favorites where user_id = '00000000-0000-0000-0000-000000000091'), 'favoritos apagados');
select test_assert(not exists(select 1 from favorite_alerts where user_id = '00000000-0000-0000-0000-000000000091'), 'alertas apagados');
select test_assert(not exists(select 1 from memberships where user_id = '00000000-0000-0000-0000-000000000091'), 'equipe e convites apagados');
select test_assert(not exists(select 1 from login_attempts where email = 'exclui@example.test'), 'tentativas de login apagadas');
select test_assert(not exists(select 1 from password_reset_requests where email = 'exclui@example.test'), 'pedidos de nova senha apagados');
select test_assert((select full_name = 'Conta excluída' and avatar_url is null and deleted_at is not null
                    from profiles where id = '00000000-0000-0000-0000-000000000091'), 'profile anonimizado');
select test_assert(not exists(select 1 from guests where user_id = '00000000-0000-0000-0000-000000000091'), 'fichas desvinculadas');
select test_assert(not exists(select 1 from bookings where guest_id = '00000000-0000-0000-0000-000000000091'), 'reservas desvinculadas');
select test_assert((select metadata::text not ilike '%exclui%' and metadata ? 'bookingsUnlinked'
                    from audit_log where action = 'account.deleted' and actor_id = '00000000-0000-0000-0000-000000000091'),
  'auditoria gravada sem dado pessoal');

-- O que é da pousada continua existindo.
select test_assert(exists(select 1 from guests where id = '40000000-0000-0000-0000-000000000910' and document_number = 'cifrado:abc'),
  'ficha FNRH da pousada preservada');
select test_assert((select count(*) from bookings where id in ('30000000-0000-0000-0000-000000000910', '30000000-0000-0000-0000-000000000920')) = 2,
  'reservas preservadas');
select test_assert(exists(select 1 from payments where provider_ref = 'teste-0090'), 'pagamento preservado');
select test_assert((select rating = 4 and text = 'café da manhã ótimo' from reviews where id = '60000000-0000-0000-0000-000000000910'),
  'avaliação preservada (nota e texto)');

-- A pousada ainda lê tudo pelo painel.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select test_assert(exists(select 1 from bookings where code = 'EXCLUI-ANTIGA' and guest_name = 'Viajante Exclui'), 'pousada lê a reserva');
select test_assert(exists(select 1 from guests where id = '40000000-0000-0000-0000-000000000910'), 'pousada lê a ficha');
select test_assert(exists(select 1 from list_pousada_reviews('10000000-0000-0000-0000-000000000001')
                          where id = '60000000-0000-0000-0000-000000000910'), 'pousada lê a avaliação');
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ---------------------------------------------------------------------------
-- Um usuário não exclui outro: a RPC não recebe id, sempre age sobre auth.uid().
-- A conta 93 chama; só ela é afetada — a 92 (e todas as outras) ficam.
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000093', false);
select test_assert(delete_my_account()->>'status' = 'deleted', 'conta 93 exclui a si mesma');
do $$ declare changed integer; begin
  -- Nem a escrita direta pela API marca outra conta.
  update profiles set full_name = 'Conta excluída' where id = '00000000-0000-0000-0000-000000000092';
  get diagnostics changed = row_count;
  perform test_assert(changed = 0, 'não altera o profile de outra pessoa');
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select test_assert((select deleted_at is null and full_name = 'Viajante Futura' from profiles where id = '00000000-0000-0000-0000-000000000092'),
  'outra conta intacta');
select test_assert((select count(*) from profiles where deleted_at is not null) = 2, 'só as duas contas que pediram foram excluídas');

-- ---------------------------------------------------------------------------
-- Dona de pousada já encerrada pode excluir; o vínculo histórico fica.
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000095', false);
select test_assert(delete_my_account()->>'status' = 'deleted', 'dona de pousada encerrada exclui a conta');
reset role;
select set_config('request.jwt.claim.sub', '', false);
select test_assert((select owner_id = '00000000-0000-0000-0000-000000000095' from pousadas where id = '10000000-0000-0000-0000-000000000095'),
  'pousada encerrada continua apontando para a lápide');

drop function test_delete_refused(uuid, text);
