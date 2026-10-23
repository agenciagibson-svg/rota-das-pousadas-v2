-- Testes da 0088 (pré-check-in online). Roda DEPOIS de priorities.sql e
-- security-0083.sql (test_assert, test_denied, pousadas A/B, quartos).
-- Dados exclusivamente sintéticos. Atores: hóspede dono (…088), outro
-- hóspede (…089), dono da pousada A (…001), dono da pousada B (…002).

insert into auth.users(id, email) values
 ('00000000-0000-0000-0000-000000000088', 'hospede-88@example.test'),
 ('00000000-0000-0000-0000-000000000089', 'hospede-89@example.test');

insert into guests(id, pousada_id, user_id, full_name, phone, document_type, document_number, document_number_hash, document_last4) values
 ('40000000-0000-0000-0000-000000000088', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000088',
  'Hóspede Oitenta Oito', '(34) 91111-0000', 'CPF', 'AAAAAAAAAAAAAAAA:BBBBBBBBBBBBBBBBBBBBBB==:T0xEQ1BG', repeat('a', 64), '0909'),
 ('40000000-0000-0000-0000-000000000089', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000089',
  'Hóspede Oitenta Nove', null, null, null, null, null);

insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, guest_id, checkin, checkout, adults, children, infants, total, status) values
 -- Reserva certa: Família (capacidade 4), 3 adultos.
 ('30000000-0000-0000-0000-000000000881', 'PRE-OK', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000088', '00000000-0000-0000-0000-000000000088', '2097-05-01', '2097-05-03', 3, 0, 0, 800, 'confirmed'),
 ('30000000-0000-0000-0000-000000000882', 'PRE-CANC', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000088', '00000000-0000-0000-0000-000000000088', '2097-05-01', '2097-05-03', 2, 0, 0, 400, 'cancelled'),
 ('30000000-0000-0000-0000-000000000883', 'PRE-IN', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000088', '00000000-0000-0000-0000-000000000088', '2097-06-01', '2097-06-03', 2, 0, 0, 400, 'checked_in'),
 -- Conta da reserva é a do …088, mas a ficha responsável não é dele.
 ('30000000-0000-0000-0000-000000000884', 'PRE-FICHA-ALHEIA', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000088', '2097-07-01', '2097-07-03', 2, 0, 0, 400, 'confirmed'),
 -- Reserva do outro hóspede.
 ('30000000-0000-0000-0000-000000000885', 'PRE-OUTRO', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000089', '00000000-0000-0000-0000-000000000089', '2097-08-01', '2097-08-03', 2, 0, 0, 400, 'pending'),
 -- Estadia que já passou no calendário (sem check-in marcado).
 ('30000000-0000-0000-0000-000000000886', 'PRE-PASSADA', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000088', '00000000-0000-0000-0000-000000000088', '2001-01-01', '2001-01-03', 2, 0, 0, 400, 'confirmed');

insert into booking_guests(id, booking_id, guest_id, full_name, guest_type, document_type, document_number) values
 ('88000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000881', '40000000-0000-0000-0000-000000000088', 'Hóspede Oitenta Oito', 'responsible', null, null),
 ('88000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000881', null, 'Acompanhante Antigo', 'adult', 'RG', 'CCCCCCCCCCCCCCCC:DDDDDDDDDDDDDDDDDDDDDD==:QU5USUdP'),
 ('88000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000885', '40000000-0000-0000-0000-000000000089', 'Hóspede Oitenta Nove', 'responsible', null, null),
 ('88000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000885', null, 'Acompanhante do Outro', 'adult', 'RG', 'EEEEEEEEEEEEEEEE:FFFFFFFFFFFFFFFFFFFFFF==:T1VUUk8='),
 ('88000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000881', null, 'Filha Pequena', 'child', null, null);
-- Anotação da equipe sobre o acompanhante: o reenvio da ficha pelo hóspede não pode apagá-la.
update booking_guests set has_special_needs = true, operational_notes = 'Cadeira de rodas'
 where id = '88000000-0000-0000-0000-000000000002';
-- Criança sem documento também pode ter anotação da equipe.
update booking_guests set operational_notes = 'Berço no quarto'
 where id = '88000000-0000-0000-0000-000000000005';

-- Atalho: envio válido com o que cada teste quiser trocar.
create function test_submit(
  p_booking uuid,
  p_companions jsonb default '[]'::jsonb,
  p_doc text default null,
  p_doc_type text default null,
  p_hash text default null,
  p_last4 text default null,
  p_arrival text default '15:30'
) returns jsonb language sql as $$
  select submit_precheckin(
    p_booking, '(34) 92222-1111', '1985-04-10', 'Brasileira', null, 'Uberlândia', 'mg',
    'Rua das Flores, 100 - Centro', '38400-000', p_doc_type, p_doc, p_hash, p_last4,
    p_companions, p_arrival);
$$;
grant execute on function test_submit(uuid, jsonb, text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Anônimo não executa nada
-- ---------------------------------------------------------------------------
select test_assert(not has_function_privilege('anon',
  'submit_precheckin(uuid,text,date,text,text,text,text,text,text,text,text,text,text,jsonb,text)', 'EXECUTE'),
  'anon não executa submit_precheckin');
select test_assert(not has_function_privilege('anon', 'get_my_precheckin(uuid)', 'EXECUTE'),
  'anon não executa get_my_precheckin');
select test_assert(not has_function_privilege('anon', 'list_my_bookings(uuid)', 'EXECUTE'),
  'anon não executa list_my_bookings (grant mantido após recriar)');
select test_assert(has_function_privilege('authenticated', 'list_my_bookings(uuid)', 'EXECUTE'),
  'authenticated segue com list_my_bookings');
select test_assert(not has_function_privilege('authenticated', 'precheckin_is_encrypted_document(text)', 'EXECUTE'),
  'helper interno fechado');
set role anon;
select test_denied($q$select test_submit('30000000-0000-0000-0000-000000000881')$q$, 'anônimo envia ficha');
select test_denied($q$select get_my_precheckin('30000000-0000-0000-0000-000000000881')$q$, 'anônimo lê ficha');
reset role;

-- ---------------------------------------------------------------------------
-- Outro usuário não lê nem grava
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000089', false);
select test_assert(get_my_precheckin('30000000-0000-0000-0000-000000000881') is null, 'outro hóspede não lê a ficha');
select test_denied($q$select test_submit('30000000-0000-0000-0000-000000000881')$q$, 'outro hóspede envia ficha alheia');
reset role;
select test_assert((select precheckin_completed_at from bookings where code = 'PRE-OK') is null, 'ficha alheia segue pendente');
select test_assert((select phone from guests where id = '40000000-0000-0000-0000-000000000088') = '(34) 91111-0000',
  'ficha do responsável intacta após tentativa alheia');

-- ---------------------------------------------------------------------------
-- Dono da reserva: leitura sem documento cifrado
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000088', false);
select test_assert(get_my_precheckin('30000000-0000-0000-0000-000000000881')->'responsible'->>'documentLast4' = '0909',
  'dono lê os 4 últimos do documento');
select test_assert(get_my_precheckin('30000000-0000-0000-0000-000000000881')::text not like '%AAAAAAAAAAAAAAAA:%'
  and get_my_precheckin('30000000-0000-0000-0000-000000000881')::text not like '%CCCCCCCCCCCCCCCC:%',
  'leitura nunca devolve documento cifrado');
select test_assert(jsonb_array_length(get_my_precheckin('30000000-0000-0000-0000-000000000881')->'companions') = 2,
  'leitura traz só acompanhantes (sem o responsável)');
select test_assert((get_my_precheckin('30000000-0000-0000-0000-000000000881')->>'maxCompanions')::int = 2
  and (get_my_precheckin('30000000-0000-0000-0000-000000000881')->>'canSubmit')::boolean,
  'leitura traz o limite de acompanhantes e se ainda dá para enviar');
select test_assert(not (get_my_precheckin('30000000-0000-0000-0000-000000000882')->>'canSubmit')::boolean
  and not (get_my_precheckin('30000000-0000-0000-0000-000000000886')->>'canSubmit')::boolean,
  'cancelada e estadia passada não aceitam envio');
select test_assert(get_my_precheckin('30000000-0000-0000-0000-000000000884') is null,
  'reserva com ficha responsável de outra pessoa não abre');

-- Validações no banco
select test_denied($q$select test_submit('30000000-0000-0000-0000-000000000881', '[]', '123.456.789-09', 'CPF', repeat('b', 64), '8909')$q$,
  'documento em claro recusado');
select test_denied($q$select test_submit('30000000-0000-0000-0000-000000000881',
  '[{"fullName":"A Um","guestType":"adult","birthDate":"1990-01-01","documentType":"RG","documentNumber":"GGGGGGGGGGGGGGGG:HHHHHHHHHHHHHHHHHHHHHH==:QQ=="},
    {"fullName":"A Dois","guestType":"adult","birthDate":"1990-01-01","documentType":"RG","documentNumber":"GGGGGGGGGGGGGGGG:HHHHHHHHHHHHHHHHHHHHHH==:QQ=="},
    {"fullName":"A Tres","guestType":"adult","birthDate":"1990-01-01","documentType":"RG","documentNumber":"GGGGGGGGGGGGGGGG:HHHHHHHHHHHHHHHHHHHHHH==:QQ=="}]')$q$,
  'mais acompanhantes que a reserva');
select test_denied($q$select test_submit('30000000-0000-0000-0000-000000000881',
  '[{"fullName":"Sem Doc","guestType":"adult","birthDate":"1990-01-01"}]')$q$, 'adulto sem documento');
select test_denied($q$select test_submit('30000000-0000-0000-0000-000000000881',
  '[{"fullName":"Outro Responsavel","guestType":"responsible"}]')$q$, 'acompanhante não vira responsável');
select test_denied($q$select test_submit('30000000-0000-0000-0000-000000000881',
  '[{"fullName":"Pega Doc","guestType":"adult","birthDate":"1990-01-01","keepDocumentOf":"88000000-0000-0000-0000-000000000004"}]')$q$,
  'não reaproveita documento de acompanhante de outra reserva');
select test_denied($q$select test_submit('30000000-0000-0000-0000-000000000881',
  '[{"fullName":"Pega Nota","guestType":"child","birthDate":"2018-01-01","previousId":"88000000-0000-0000-0000-000000000004"}]')$q$,
  'não puxa anotação de acompanhante de outra reserva');
select test_denied($q$select test_submit('30000000-0000-0000-0000-000000000881',
  '[{"fullName":"Pega Nota","guestType":"child","birthDate":"2018-01-01","previousId":"88000000-0000-0000-0000-000000000001"}]')$q$,
  'não puxa a linha do responsável como acompanhante');
select test_denied($q$select test_submit('30000000-0000-0000-0000-000000000881', '[]', null, null, null, null, '25:99')$q$,
  'horário de chegada inválido');
select test_denied($q$select submit_precheckin('30000000-0000-0000-0000-000000000881', '(34) 92222-1111', '2015-01-01', 'Brasileira', null,
  'Uberlândia', 'MG', 'Rua das Flores, 100', null, null, null, null, null, '[]', null)$q$, 'responsável menor de idade');
select test_denied($q$select submit_precheckin('30000000-0000-0000-0000-000000000881', '(34) 92222-1111', '1985-04-10', 'Brasileira', null,
  'Uberlândia', 'XX', 'Rua das Flores, 100', null, null, null, null, null, '[]', null)$q$, 'UF inválida');
select test_denied($q$select submit_precheckin('30000000-0000-0000-0000-000000000881', '(34) 92222-1111', '1985-04-10', 'Brasileira', null,
  'Uberlândia', 'MG', repeat('x', 301), null, null, null, null, null, '[]', null)$q$, 'endereço longo demais');

select test_denied($q$select submit_precheckin('30000000-0000-0000-0000-000000000881', '(34) 92222-1111', '1985-04-10', 'Estrangeira', 'Argentina',
  'Buenos Aires', null, 'Calle Falsa 123', null, null, null, null, null, '[]', null)$q$,
  'estrangeiro sem passaporte não aproveita o CPF salvo');

-- Status e posse
select test_denied($q$select test_submit('30000000-0000-0000-0000-000000000882')$q$, 'reserva cancelada');
select test_denied($q$select test_submit('30000000-0000-0000-0000-000000000883')$q$, 'reserva já com check-in');
select test_denied($q$select test_submit('30000000-0000-0000-0000-000000000886')$q$, 'estadia que já passou');
select test_denied($q$select test_submit('30000000-0000-0000-0000-000000000884')$q$, 'ficha responsável de outra pessoa');
select test_denied($q$select test_submit('30000000-0000-0000-0000-000000000885')$q$, 'reserva de outro hóspede');

-- Escrita direta nas tabelas continua bloqueada para o hóspede
do $$ declare changed integer; begin
  update guests set phone = 'x' where id = '40000000-0000-0000-0000-000000000088';
  get diagnostics changed = row_count;
  perform test_assert(changed = 0, 'hóspede não grava guests direto');
  update bookings set precheckin_completed_at = now() where id = '30000000-0000-0000-0000-000000000881';
  get diagnostics changed = row_count;
  perform test_assert(changed = 0, 'hóspede não marca a ficha direto');
  delete from booking_guests where booking_id = '30000000-0000-0000-0000-000000000881';
  get diagnostics changed = row_count;
  perform test_assert(changed = 0, 'hóspede não apaga acompanhantes direto');
end $$;

-- Envio válido: troca o documento, mantém o do acompanhante antigo, criança sem
-- documento e um bebê.
select test_submit('30000000-0000-0000-0000-000000000881',
  '[{"fullName":"Acompanhante Antigo","guestType":"adult","birthDate":"1988-02-02","keepDocumentOf":"88000000-0000-0000-0000-000000000002"},
    {"fullName":"Filha Pequena","guestType":"child","birthDate":"2018-03-03","previousId":"88000000-0000-0000-0000-000000000005"},
    {"fullName":"Bebê","guestType":"infant"}]',
  'IIIIIIIIIIIIIIII:JJJJJJJJJJJJJJJJJJJJJJ==:Tk9WTw==', 'CPF', repeat('c', 64), '1234');
select test_assert((list_my_bookings('30000000-0000-0000-0000-000000000881'))
  .precheckin_completed_at is not null, 'list_my_bookings devolve a ficha enviada');
select test_assert(get_my_precheckin('30000000-0000-0000-0000-000000000881')->>'precheckinCompletedAt' is not null,
  'leitura mostra a ficha enviada');
reset role;
select set_config('request.jwt.claim.sub', '', false);

select test_assert((select precheckin_completed_at is not null and expected_arrival_time = '15:30'
  from bookings where code = 'PRE-OK'), 'reserva marcada e horário gravado');
select test_assert((select phone = '(34) 92222-1111' and city = 'Uberlândia' and state = 'MG' and country = 'BR'
    and birth_date = '1985-04-10' and nationality = 'Brasileira' and cep = '38400-000'
    and document_last4 = '1234' and document_number like 'IIIIIIIIIIIIIIII:%' and document_number_hash = repeat('c', 64)
  from guests where id = '40000000-0000-0000-0000-000000000088'), 'ficha do responsável atualizada');
select test_assert((select count(*) from booking_guests where booking_id = '30000000-0000-0000-0000-000000000881' and guest_type <> 'responsible') = 3,
  'acompanhantes substituídos');
select test_assert((select document_number from booking_guests
  where booking_id = '30000000-0000-0000-0000-000000000881' and full_name = 'Acompanhante Antigo') = 'CCCCCCCCCCCCCCCC:DDDDDDDDDDDDDDDDDDDDDD==:QU5USUdP',
  'documento do acompanhante mantido sem passar pelo cliente');
select test_assert((select has_special_needs and operational_notes = 'Cadeira de rodas' from booking_guests
  where booking_id = '30000000-0000-0000-0000-000000000881' and full_name = 'Acompanhante Antigo'),
  'anotação da equipe sobre o acompanhante continua depois do reenvio');
select test_assert((select operational_notes = 'Berço no quarto' and document_number is null from booking_guests
  where booking_id = '30000000-0000-0000-0000-000000000881' and full_name = 'Filha Pequena'),
  'anotação da equipe sobre criança sem documento continua (previousId)');
select test_assert((select operational_notes = '' and not has_special_needs from booking_guests
  where booking_id = '30000000-0000-0000-0000-000000000881' and full_name = 'Bebê'),
  'acompanhante novo começa sem anotação');
select test_assert((select count(*) from booking_guests
  where booking_id = '30000000-0000-0000-0000-000000000881' and guest_type = 'responsible'
    and id = '88000000-0000-0000-0000-000000000001' and guest_id = '40000000-0000-0000-0000-000000000088') = 1,
  'linha do responsável intacta');
select test_assert((select responsible_guest_id from bookings where code = 'PRE-OK') = '40000000-0000-0000-0000-000000000088',
  'responsável da reserva não muda');
select test_assert((select count(*) from booking_guests where booking_id = '30000000-0000-0000-0000-000000000885') = 2,
  'outra reserva intacta');
select test_assert(exists (select 1 from audit_log where action = 'booking.precheckin_submitted'
    and target_id = '30000000-0000-0000-0000-000000000881'), 'envio auditado');
select test_assert(not exists (select 1 from audit_log where action = 'booking.precheckin_submitted'
    and (metadata::text like '%9222%' or metadata::text like '%Uberl%' or metadata::text like '%Filha%' or metadata::text like '%IIII%')),
  'auditoria sem dado pessoal');

-- Reenviar com um adulto sem documento novo nem antigo é recusado (o antigo
-- já pertence à linha nova; id antigo deixou de existir).
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000088', false);
select test_denied($q$select test_submit('30000000-0000-0000-0000-000000000881',
  '[{"fullName":"Acompanhante Antigo","guestType":"adult","birthDate":"1988-02-02","keepDocumentOf":"88000000-0000-0000-0000-000000000002"}]')$q$,
  'id de acompanhante substituído não vale mais');
-- Reenvio sem acompanhantes e mantendo o documento do responsável.
select test_submit('30000000-0000-0000-0000-000000000881', '[]', null, null, null, null, null);
reset role;
select test_assert((select document_last4 from guests where id = '40000000-0000-0000-0000-000000000088') = '1234',
  'reenvio sem documento mantém o documento');
select test_assert((select count(*) from booking_guests where booking_id = '30000000-0000-0000-0000-000000000881') = 1,
  'reenvio sem acompanhantes deixa só o responsável');
select test_assert((select expected_arrival_time from bookings where code = 'PRE-OK') is null, 'horário pode ser limpo');

-- ---------------------------------------------------------------------------
-- Equipe: dono da pousada lê a marca; dono de outra pousada não
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select test_assert((select precheckin_completed_at is not null from bookings where code = 'PRE-OK'),
  'equipe da pousada lê precheckin_completed_at');
select test_assert((select precheckin_completed_at is null from bookings where code = 'PRE-OUTRO'),
  'equipe vê ficha pendente');
select test_denied($q$select test_submit('30000000-0000-0000-0000-000000000881')$q$, 'equipe não envia a ficha pelo hóspede');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select test_assert(not exists (select 1 from bookings where code = 'PRE-OK'), 'outra pousada não vê a reserva');
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- E-mails: contexto traz a marca
set role service_role;
select test_assert((get_booking_notification_context('30000000-0000-0000-0000-000000000881')->>'precheckinDone')::boolean,
  'contexto do e-mail sabe que a ficha foi enviada');
select test_assert(not (get_booking_notification_context('30000000-0000-0000-0000-000000000885')->>'precheckinDone')::boolean,
  'contexto do e-mail sabe que a ficha está pendente');
reset role;

drop function test_submit(uuid, jsonb, text, text, text, text, text);
