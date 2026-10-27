-- Testes da 0097 (relatório do mês por e-mail + fichas antigas completadas pelo
-- perfil do viajante). Roda depois de priorities.sql (usa só `test_assert`);
-- cria pousadas, usuários e reservas próprios. Dados exclusivamente sintéticos.

insert into auth.users(id, email) values
 ('00000000-0000-0000-0000-000000009701', 'dono-97@example.test'),
 ('00000000-0000-0000-0000-000000009702', ' Gestor-97@Example.test '),
 ('00000000-0000-0000-0000-000000009703', 'recepcao-97@example.test'),
 ('00000000-0000-0000-0000-000000009704', 'ex-gestor-97@example.test'),
 ('00000000-0000-0000-0000-000000009711', 'viajante-97@example.test'),
 ('00000000-0000-0000-0000-000000009712', 'outra-conta-97@example.test');

insert into pousadas(id, slug, name, city, state, status, tenant_status, owner_id, price_per_night) values
 ('10000000-0000-0000-0000-000000009701', 'pousada-97', 'Pousada 97', 'Tiradentes', 'MG', 'publicada', 'active', '00000000-0000-0000-0000-000000009701', 300),
 ('10000000-0000-0000-0000-000000009702', 'pousada-97-sem-quarto', 'Pousada 97 sem quarto', 'Tiradentes', 'MG', 'publicada', 'active', '00000000-0000-0000-0000-000000009701', 300),
 ('10000000-0000-0000-0000-000000009703', 'pousada-97-rascunho', 'Pousada 97 rascunho', 'Tiradentes', 'MG', 'rascunho', 'onboarding', '00000000-0000-0000-0000-000000009701', 300),
 ('10000000-0000-0000-0000-000000009704', 'pousada-97-suspensa', 'Pousada 97 suspensa', 'Tiradentes', 'MG', 'publicada', 'suspended', '00000000-0000-0000-0000-000000009701', 300);

insert into memberships(user_id, pousada_id, role, status) values
 ('00000000-0000-0000-0000-000000009701', '10000000-0000-0000-0000-000000009701', 'proprietario', 'active'),
 ('00000000-0000-0000-0000-000000009702', '10000000-0000-0000-0000-000000009701', 'admin_pousada', 'active'),
 ('00000000-0000-0000-0000-000000009703', '10000000-0000-0000-0000-000000009701', 'recepcionista', 'active'),
 ('00000000-0000-0000-0000-000000009704', '10000000-0000-0000-0000-000000009701', 'admin_pousada', 'revoked');

insert into rooms(id, pousada_id, name, capacity, capacity_max, base_price, status, public_visible, operational_status) values
 ('20000000-0000-0000-0000-000000009701', '10000000-0000-0000-0000-000000009701', 'Q1', 2, 2, 300, 'active', true, 'available'),
 ('20000000-0000-0000-0000-000000009702', '10000000-0000-0000-0000-000000009701', 'Q2', 2, 2, 300, 'active', true, 'maintenance'),
 ('20000000-0000-0000-0000-000000009703', '10000000-0000-0000-0000-000000009701', 'Q3', 2, 2, 300, 'inactive', false, 'available'),
 ('20000000-0000-0000-0000-000000009704', '10000000-0000-0000-0000-000000009702', 'Q inativo', 2, 2, 300, 'inactive', false, 'available'),
 ('20000000-0000-0000-0000-000000009705', '10000000-0000-0000-0000-000000009703', 'Q rascunho', 2, 2, 300, 'active', true, 'available'),
 ('20000000-0000-0000-0000-000000009706', '10000000-0000-0000-0000-000000009704', 'Q suspensa', 2, 2, 300, 'active', true, 'available');

-- Fichas: …9711 é a ficha antiga do viajante (sem telefone/documento);
-- …9712 é ficha vinculada a uma conta que nunca reservou aqui; …9713 é ficha
-- já completa (nada a mudar); …9714 é ficha de balcão sem conta.
insert into traveler_profiles(user_id, phone, whatsapp, birth_date, nationality, country, document_type,
                              document_number, document_number_hash, document_last4, cep, address, city, state,
                              emergency_contact, dietary_restrictions, accessibility_needs) values
 ('00000000-0000-0000-0000-000000009711', '(31) 99999-0001', '(31) 99999-0001', '1990-05-04', 'Brasileira', 'BR', 'CPF',
  'cifrado-perfil', 'hash-perfil', '0001', '35000-000', 'Rua das Flores, 10', 'Belo Horizonte', 'MG',
  '{"name": "Contato", "phone": "(31) 98888-0000"}', 'Sem glúten', ''),
 ('00000000-0000-0000-0000-000000009712', '(31) 97777-0002', null, '1985-01-01', 'Brasileira', 'BR', 'CPF',
  'cifrado-outro', 'hash-outro', '0002', null, null, 'Ouro Preto', 'MG', '{}', '', '');

insert into guests(id, pousada_id, user_id, full_name, email, phone, city, internal_notes, document_type) values
 ('40000000-0000-0000-0000-000000009711', '10000000-0000-0000-0000-000000009701', '00000000-0000-0000-0000-000000009711',
  'Viajante 97', 'viajante-97@example.test', null, 'Cidade digitada pela recepção', 'nota da pousada', null),
 ('40000000-0000-0000-0000-000000009712', '10000000-0000-0000-0000-000000009701', '00000000-0000-0000-0000-000000009712',
  'Conta sem reserva', null, null, null, '', null),
 ('40000000-0000-0000-0000-000000009714', '10000000-0000-0000-0000-000000009701', null,
  'Hóspede de balcão', null, null, null, '', null);

-- Reservas da pousada 97. Mês do relatório: setembro/2026; comparação: agosto.
insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, guest_id, created_by,
                     checkin, checkout, total, status, origin) values
 ('30000000-0000-0000-0000-000000009701', 'R97-SET-SITE', '10000000-0000-0000-0000-000000009701', '20000000-0000-0000-0000-000000009701',
  '40000000-0000-0000-0000-000000009711', '00000000-0000-0000-0000-000000009711', '00000000-0000-0000-0000-000000009711',
  '2026-09-10', '2026-09-12', 600, 'checked_out', 'rota_das_pousadas'),
 ('30000000-0000-0000-0000-000000009702', 'R97-SET-AIRBNB', '10000000-0000-0000-0000-000000009701', '20000000-0000-0000-0000-000000009702',
  '40000000-0000-0000-0000-000000009714', null, '00000000-0000-0000-0000-000000009701',
  '2026-09-29', '2026-10-02', 900, 'checked_out', 'airbnb'),
 ('30000000-0000-0000-0000-000000009703', 'R97-SET-CANCEL', '10000000-0000-0000-0000-000000009701', '20000000-0000-0000-0000-000000009701',
  '40000000-0000-0000-0000-000000009714', null, '00000000-0000-0000-0000-000000009701',
  '2026-09-20', '2026-09-22', 500, 'cancelled', 'balcao'),
 ('30000000-0000-0000-0000-000000009704', 'R97-AGO', '10000000-0000-0000-0000-000000009701', '20000000-0000-0000-0000-000000009701',
  '40000000-0000-0000-0000-000000009714', null, '00000000-0000-0000-0000-000000009701',
  '2026-08-30', '2026-09-01', 400, 'checked_out', 'balcao'),
 ('30000000-0000-0000-0000-000000009705', 'R97-FORA', '10000000-0000-0000-0000-000000009701', '20000000-0000-0000-0000-000000009701',
  '40000000-0000-0000-0000-000000009714', null, '00000000-0000-0000-0000-000000009701',
  '2026-06-01', '2026-06-03', 400, 'checked_out', 'balcao');

-- ===========================================================================
-- (A) Relatório do mês
-- ===========================================================================

-- Permissões: só service_role. Nem anon nem usuário logado (nem o dono).
select test_assert(not has_function_privilege(r, f, 'EXECUTE'), format('%s não executa %s', r, f))
from unnest(array['anon', 'authenticated']) r,
     unnest(array['list_monthly_report_pousadas(date,integer)', 'get_monthly_report_pousada(uuid)',
                  'list_monthly_report_bookings(uuid,date,date)', 'list_monthly_report_recipients(uuid)',
                  'claim_monthly_report(uuid,date)', 'mark_monthly_report_sent(uuid,date,integer)',
                  'release_monthly_report(uuid,date)', 'monthly_report_active_rooms(uuid)',
                  'list_guests_pending_profile_backfill(uuid,integer)',
                  'apply_guest_profile_backfill(uuid,text,text,text)',
                  'guest_profile_backfill_fields(uuid)']) f;
select test_assert(has_function_privilege('service_role', f, 'EXECUTE'), format('service_role executa %s', f))
from unnest(array['list_monthly_report_pousadas(date,integer)', 'get_monthly_report_pousada(uuid)',
                  'list_monthly_report_bookings(uuid,date,date)', 'list_monthly_report_recipients(uuid)',
                  'claim_monthly_report(uuid,date)', 'mark_monthly_report_sent(uuid,date,integer)',
                  'release_monthly_report(uuid,date)', 'list_guests_pending_profile_backfill(uuid,integer)',
                  'apply_guest_profile_backfill(uuid,text,text,text)']) f;
select test_assert(not has_function_privilege('service_role', f, 'EXECUTE'), format('%s é helper interno', f))
from unnest(array['monthly_report_active_rooms(uuid)', 'guest_profile_backfill_fields(uuid)']) f;
select test_assert(not has_table_privilege(r, 'monthly_reports_sent', p), format('%s sem %s na tabela de controle', r, p))
from unnest(array['anon', 'authenticated']) r, unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) p;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000009701', false);
do $$ begin
  begin
    perform * from list_monthly_report_bookings('10000000-0000-0000-0000-000000009701', '2026-08-01', '2026-10-01');
    raise exception 'TEST: usuário logado leu reservas pelo relatório';
  exception when insufficient_privilege then null;
  end;
  begin
    perform claim_monthly_report('10000000-0000-0000-0000-000000009701', '2026-09-01');
    raise exception 'TEST: usuário logado silenciou o relatório';
  exception when insufficient_privilege then null;
  end;
  begin
    perform apply_guest_profile_backfill('40000000-0000-0000-0000-000000009712', null, null, null);
    raise exception 'TEST: usuário logado copiou perfil de viajante';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from monthly_reports_sent;
    raise exception 'TEST: usuário logado leu a tabela de controle';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

set role service_role;

-- Elegíveis: publicada, tenant ativo, com quarto ativo.
create temp table t97_list as
  select * from list_monthly_report_pousadas('2026-09-01', 200)
  where pousada_id::text like '10000000-0000-0000-0000-00000000970%';
select test_assert((select array_agg(name order by name) from t97_list) = array['Pousada 97'],
  'só a pousada publicada com quarto ativo: ' || coalesce((select string_agg(name, ',') from t97_list), '(nenhuma)'));
select test_assert((select active_rooms from t97_list) = 2, 'conta só quartos ativos (manutenção conta, inativo não)');
select test_assert((select active_rooms from get_monthly_report_pousada('10000000-0000-0000-0000-000000009702')) = 0,
  'prévia acha pousada fora da lista');

do $$ begin
  perform * from list_monthly_report_pousadas('2026-09-15', 10);
  raise exception 'TEST: aceitou mês que não começa no dia 1';
exception when others then
  if sqlerrm not like 'Mês inválido%' then raise; end if;
end $$;

-- Reservas: só as que cruzam a janela, só status que o painel conta, sem dado pessoal.
create temp table t97_b as
  select * from list_monthly_report_bookings('10000000-0000-0000-0000-000000009701', '2026-08-01', '2026-10-01');
select test_assert((select count(*) from t97_b) = 3, 'agosto+setembro: 3 reservas (cancelada e junho ficam fora)');
select test_assert(not exists (select 1 from t97_b where status = 'cancelled'), 'cancelada não volta');
select test_assert((select origin from t97_b where checkin = '2026-09-29') = 'airbnb', 'devolve a origem');
do $$ begin
  perform * from list_monthly_report_bookings('10000000-0000-0000-0000-000000009701', '2026-01-01', '2026-10-01');
  raise exception 'TEST: aceitou janela de 9 meses';
exception when others then
  if sqlerrm not like 'Período inválido%' then raise; end if;
end $$;

-- Destinatários: proprietário e gestor ativos, e-mail normalizado.
select test_assert((select array_agg(email order by email) from list_monthly_report_recipients('10000000-0000-0000-0000-000000009701'))
                   = array['dono-97@example.test', 'gestor-97@example.test'],
  'proprietário + gestor ativos; sem recepção nem vínculo revogado');

-- Trava: reserva a vez uma vez só; marca; não volta à lista.
select test_assert(claim_monthly_report('10000000-0000-0000-0000-000000009701', '2026-09-01'), 'primeira rodada pega a vez');
select test_assert(not claim_monthly_report('10000000-0000-0000-0000-000000009701', '2026-09-01'), 'rodada simultânea não pega');
select test_assert(not exists (select 1 from list_monthly_report_pousadas('2026-09-01', 200)
                               where pousada_id = '10000000-0000-0000-0000-000000009701'), 'em envio sai da lista');
-- Falha no envio: devolve a vez e a pousada volta.
select release_monthly_report('10000000-0000-0000-0000-000000009701', '2026-09-01');
select test_assert(exists (select 1 from list_monthly_report_pousadas('2026-09-01', 200)
                           where pousada_id = '10000000-0000-0000-0000-000000009701'), 'falha devolve a pousada para a próxima rodada');
select test_assert(claim_monthly_report('10000000-0000-0000-0000-000000009701', '2026-09-01'), 'pega a vez de novo');
select test_assert(mark_monthly_report_sent('10000000-0000-0000-0000-000000009701', '2026-09-01', 2), 'marca enviado');
select test_assert(not mark_monthly_report_sent('10000000-0000-0000-0000-000000009701', '2026-09-01', 2), 'marcar de novo não muda nada');
select release_monthly_report('10000000-0000-0000-0000-000000009701', '2026-09-01');
select test_assert(not claim_monthly_report('10000000-0000-0000-0000-000000009701', '2026-09-01'), 'enviado nunca é pego de novo');
select test_assert(not exists (select 1 from list_monthly_report_pousadas('2026-09-01', 200)
                               where pousada_id = '10000000-0000-0000-0000-000000009701'), 'enviado sai da lista');
select test_assert(exists (select 1 from list_monthly_report_pousadas('2026-10-01', 200)
                           where pousada_id = '10000000-0000-0000-0000-000000009701'), 'mês seguinte é outro relatório');
reset role;
select test_assert((select sent_at is not null and recipients = 2 from monthly_reports_sent
                    where pousada_id = '10000000-0000-0000-0000-000000009701' and month = '2026-09-01'),
  'linha de controle com envio e número de destinatários');
select test_assert((select count(*) from audit_log where action = 'pousada.monthly_report.sent'
                    and target_id = '10000000-0000-0000-0000-000000009701') = 1, 'auditoria do envio gravada uma vez');
-- Vez esquecida (processo morreu): depois de 30 minutos pode ser pega.
update monthly_reports_sent set sent_at = null, claimed_at = now() - interval '31 minutes'
 where pousada_id = '10000000-0000-0000-0000-000000009701' and month = '2026-09-01';
set role service_role;
select test_assert(claim_monthly_report('10000000-0000-0000-0000-000000009701', '2026-09-01'), 'vez abandonada é retomada');
reset role;

-- ===========================================================================
-- (B) Fichas antigas
-- ===========================================================================
set role service_role;
create temp table t97_pend as select * from list_guests_pending_profile_backfill(null, 500)
  where guest_id::text like '40000000-0000-0000-0000-00000000971%';
select test_assert((select array_agg(guest_id) from t97_pend) = array['40000000-0000-0000-0000-000000009711'::uuid],
  'só a ficha do viajante que reservou aqui (conta sem reserva e balcão ficam fora)');
select test_assert((select fields from t97_pend) =
  array['phone', 'whatsapp', 'document', 'birth_date', 'nationality', 'state', 'address', 'cep', 'emergency_contact', 'dietary_restrictions'],
  'campos vazios que o perfil tem (cidade já preenchida fica fora): ' || (select fields::text from t97_pend));
select test_assert((select profile_document_number = 'cifrado-perfil' and profile_document_number_hash = 'hash-perfil' from t97_pend),
  'documento do perfil volta cifrado, com o hash');

-- Hash diferente do perfil: documento recusado, o resto é preenchido.
select test_assert(not ('document' = any(apply_guest_profile_backfill('40000000-0000-0000-0000-000000009711', 'doc-falso', 'hash-errado', '9999'))),
  'documento com hash de outra pessoa não entra');
reset role;
select test_assert((select phone = '(31) 99999-0001' and document_number is null and city = 'Cidade digitada pela recepção'
                           and internal_notes = 'nota da pousada' and birth_date = '1990-05-04'
                           and emergency_contact->>'name' = 'Contato' and dietary_restrictions = 'Sem glúten'
                    from guests where id = '40000000-0000-0000-0000-000000009711'),
  'preenche só os vazios e não toca no que a pousada digitou');

set role service_role;
select test_assert((select fields from list_guests_pending_profile_backfill(null, 500)
                    where guest_id = '40000000-0000-0000-0000-000000009711') = array['document'],
  'sobrou só o documento');
select test_assert(apply_guest_profile_backfill('40000000-0000-0000-0000-000000009711', 'cifrado-de-novo', 'hash-perfil', '0001') = array['document'],
  'documento cifrado pelo app com o hash do perfil entra');
reset role;
select test_assert((select document_number = 'cifrado-de-novo' and document_number_hash = 'hash-perfil'
                           and document_last4 = '0001' and document_type = 'CPF'
                    from guests where id = '40000000-0000-0000-0000-000000009711'), 'documento gravado com hash e 4 últimos');
select test_assert((select count(*) from audit_log where action = 'guest.profile_backfill'
                    and target_id = '40000000-0000-0000-0000-000000009711') = 2, 'auditoria por aplicação, só nomes de campo');

-- Idempotente: nada mais a fazer, e rodar de novo não muda nada.
set role service_role;
select test_assert(not exists (select 1 from list_guests_pending_profile_backfill(null, 500)
                               where guest_id::text like '40000000-0000-0000-0000-00000000971%'), 'nada pendente');
select test_assert(apply_guest_profile_backfill('40000000-0000-0000-0000-000000009711', 'outro', 'hash-perfil', '0001') = '{}',
  'aplicar de novo não muda nada');
select test_assert(apply_guest_profile_backfill('40000000-0000-0000-0000-000000009712', 'cifrado-outro', 'hash-outro', '0002') = '{}',
  'ficha ligada a conta que não reservou aqui não recebe dados');
reset role;
select test_assert((select document_number = 'cifrado-de-novo' from guests where id = '40000000-0000-0000-0000-000000009711'),
  'documento existente nunca é sobrescrito');
-- Uma vez por ficha: se a pousada apagar um campo depois, a rotina não o traz de volta.
update guests set phone = null where id = '40000000-0000-0000-0000-000000009711';
set role service_role;
select test_assert(not exists (select 1 from list_guests_pending_profile_backfill(null, 500)
                               where guest_id = '40000000-0000-0000-0000-000000009711'),
  'ficha já completada não volta à lista');
select test_assert(apply_guest_profile_backfill('40000000-0000-0000-0000-000000009711') = '{}',
  'ficha já completada não recebe o campo apagado de novo');
reset role;
select test_assert((select phone is null from guests where id = '40000000-0000-0000-0000-000000009711'),
  'campo apagado pela pousada continua apagado');
set role authenticated;
do $$ begin
  begin
    perform 1 from guest_profile_backfills;
    raise exception 'TEST: authenticated leu guest_profile_backfills';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select test_assert((select phone is null and document_number is null from guests where id = '40000000-0000-0000-0000-000000009712'),
  'conta sem reserva continua sem dados do perfil');

-- Cursor: p_after pula as fichas já vistas. (Tira a marca de "feita" só para
-- o teste: a ficha volta a ter o telefone pendente.)
delete from guest_profile_backfills where guest_id = '40000000-0000-0000-0000-000000009711';
set role service_role;
select test_assert(exists (select 1 from list_guests_pending_profile_backfill(null, 500) where guest_id = '40000000-0000-0000-0000-000000009711'),
  'sem a marca, o telefone apagado aparece como pendente');
select test_assert(not exists (select 1 from list_guests_pending_profile_backfill('40000000-0000-0000-0000-000000009711', 500)
                               where guest_id = '40000000-0000-0000-0000-000000009711'), 'cursor pula a ficha');
reset role;
