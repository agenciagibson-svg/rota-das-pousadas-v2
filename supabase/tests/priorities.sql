-- Dados exclusivamente sintéticos. Executado após todas as migrations.
create function test_assert(condition boolean, message text) returns void language plpgsql as $$
begin if condition is distinct from true then raise exception 'TEST: %', message; end if; end $$;
create function test_invisible(query text) returns void language plpgsql as $$
declare rows bigint; begin
  execute query into rows;
  if rows <> 0 then raise exception 'TEST: dados privados visíveis'; end if;
exception when insufficient_privilege then null;
end $$;
insert into auth.users(id, email) values
 ('00000000-0000-0000-0000-000000000001', 'owner-a@example.test'),
 ('00000000-0000-0000-0000-000000000002', 'owner-b@example.test');
insert into pousadas(id, slug, name, city, state, status, tenant_status, owner_id, price_per_night, tags) values
 ('10000000-0000-0000-0000-000000000001', 'pousada-a', 'Pousada A', 'São Tomé', 'MG', 'publicada', 'active', '00000000-0000-0000-0000-000000000001', 200, array['Chalé romântico']),
 ('10000000-0000-0000-0000-000000000002', 'pousada-b', 'Pousada B', 'Outra cidade', 'MG', 'publicada', 'active', '00000000-0000-0000-0000-000000000002', 300, '{}');
insert into memberships(user_id, pousada_id, role, status) values
 ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'proprietario', 'active'),
 ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'proprietario', 'active');
insert into rooms(id, pousada_id, name, capacity, capacity_max, base_price, status, public_visible, operational_status) values
 ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Duplo', 2, 2, 200, 'active', true, 'available'),
 ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Família', 4, 4, 400, 'active', true, 'available'),
 ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Duplo B', 2, 2, 300, 'active', true, 'available');
insert into guests(id, pousada_id, full_name) values
 ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Hóspede privado A'),
 ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Hóspede privado B');
insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, checkin, checkout, total, status) values
 ('30000000-0000-0000-0000-000000000001', 'PAYMENT', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '2099-11-01', '2099-11-03', 1000, 'pending'),
 ('30000000-0000-0000-0000-000000000002', 'OCCUPIED', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '2099-10-10', '2099-10-12', 400, 'confirmed');

-- 0070: pendência com prazo vencido não segura o quarto na busca pública.
insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, checkin, checkout, total, status, payment_due_at) values
 ('30000000-0000-0000-0000-000000000090', 'EXPIRED', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '2099-12-20', '2099-12-22', 400, 'pending', now() - interval '1 hour'),
 ('30000000-0000-0000-0000-000000000091', 'HELD', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '2099-12-20', '2099-12-22', 800, 'pending', now() + interval '1 hour');

set role anon;
select test_invisible('select count(*) from guests');
select test_invisible('select count(*) from bookings');
select test_invisible('select count(*) from rooms');
select test_assert((search_public_pousadas('sao tome')->>'total')::int = 1, 'busca sem acentos');
select test_assert((search_public_pousadas('romantico')->>'total')::int = 1, 'busca por tags');
select test_assert((search_public_pousadas('%,()')->>'total')::int = 0, 'pontuação literal sem injeção de filtro');
select test_assert((search_public_pousadas('', 1, 1)->'items'->0->>'slug') = 'pousada-a', 'página 1');
select test_assert((search_public_pousadas('', 2, 1)->'items'->0->>'slug') = 'pousada-b', 'página 2');
select test_assert((search_public_pousadas('', 1, 24, '2099-10-10', '2099-10-12', 4)->>'total')::int = 1, 'capacidade');
select test_assert((select count(*) from list_bookable_rooms('pousada-a', '2099-10-10', '2099-10-12', 2)) = 1, 'exclui quarto ocupado');
select test_assert((select count(*) from list_bookable_rooms('pousada-a', '2099-10-12', '2099-10-13', 2)) = 2, 'checkout não conflita');
select test_assert((select count(*) from list_bookable_rooms('pousada-a', '2099-12-20', '2099-12-22', 2)) = 1, 'pendência vencida libera o quarto; dentro do prazo segura (0070)');
select test_assert(not has_function_privilege('anon', 'reconcile_marketplace_payment(uuid,text,numeric,payment_status,text,text,timestamptz,numeric)', 'EXECUTE'), 'anon não reconcilia pagamento');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select test_assert((select count(*) from guests) = 1, 'owner A só vê seus hóspedes');
select test_assert(not exists(select 1 from rooms where pousada_id = '10000000-0000-0000-0000-000000000002'), 'owner A não vê quartos B');
select test_assert(not has_function_privilege('authenticated', 'reconcile_marketplace_payment(uuid,text,numeric,payment_status,text,text,timestamptz,numeric)', 'EXECUTE'), 'owner não forja pagamento');
do $$ declare changed integer; begin
  update guests set full_name = 'ADULTERADO' where pousada_id = '10000000-0000-0000-0000-000000000002';
  get diagnostics changed = row_count;
  perform test_assert(changed = 0, 'escrita cruzada bloqueada');
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select test_assert((select count(*) from guests) = 1, 'owner B só vê seus hóspedes');
select test_assert((select count(*) from bookings) = 0, 'owner B não vê reservas A');
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- Regras adicionais de disponibilidade.
update rooms set operational_status = 'maintenance' where id = '20000000-0000-0000-0000-000000000002';
select test_assert((search_public_pousadas('sao tome', 1, 24, '2099-10-10', '2099-10-12', 2)->>'total')::int = 0, 'pousada sem oferta elegível');
update rooms set operational_status = 'available' where id = '20000000-0000-0000-0000-000000000002';
update pousadas set tenant_status = 'suspended' where slug = 'pousada-b';
select test_assert((search_public_pousadas()->>'total')::int = 1, 'tenant suspenso excluído');
update pousadas set tenant_status = 'active' where slug = 'pousada-b';

set role service_role;
select reconcile_marketplace_payment('30000000-0000-0000-0000-000000000001', '111', 600.50, 'pendente', 'pix', 'BRL', '2026-09-01T12:00:00Z', 0);
select test_assert((select amount_received from bookings where code = 'PAYMENT') = 0, 'pendente não credita');
select reconcile_marketplace_payment('30000000-0000-0000-0000-000000000001', '111', 600.50, 'aprovado', 'pix', 'BRL', '2026-09-01T12:01:00Z', 0);
select test_assert((select amount_received from bookings where code = 'PAYMENT') = 600.50, 'preserva centavos');
select test_assert((select status from bookings where code = 'PAYMENT') = 'pending', 'parcial não confirma');
select reconcile_marketplace_payment('30000000-0000-0000-0000-000000000001', '111', 600.50, 'aprovado', 'pix', 'BRL', '2026-09-01T12:01:00Z', 0);
select test_assert((select amount_received from bookings where code = 'PAYMENT') = 600.50, 'retry não duplica');
select reconcile_marketplace_payment('30000000-0000-0000-0000-000000000001', '112', 399.50, 'aprovado', 'pix', 'BRL', '2026-09-01T12:02:00Z', 0);
select test_assert((select status from bookings where code = 'PAYMENT') = 'confirmed', 'total confirma');
select reconcile_marketplace_payment('30000000-0000-0000-0000-000000000001', '111', 600.50, 'aprovado', 'pix', 'BRL', '2026-09-01T12:03:00Z', 100.25);
select test_assert((select amount_received from bookings where code = 'PAYMENT') = 899.75, 'estorno parcial corrige saldo');
select reconcile_marketplace_payment('30000000-0000-0000-0000-000000000001', '111', 600.50, 'pendente', 'pix', 'BRL', '2026-09-01T12:00:00Z', 0);
select test_assert((select amount_received from bookings where code = 'PAYMENT') = 899.75, 'evento antigo não regride saldo');
do $$ begin
  begin
    perform reconcile_marketplace_payment('30000000-0000-0000-0000-000000000001', '113', 1000, 'aprovado', 'pix', 'USD', now(), 0);
    raise exception 'TEST: moeda inválida aceita';
  exception when raise_exception then
    if sqlerrm <> 'Moeda divergente da reserva.' then raise; end if;
  end;
  begin
    perform reconcile_marketplace_payment('30000000-0000-0000-0000-000000000002', '111', 600.50, 'aprovado', 'pix', 'BRL', now(), 0);
    raise exception 'TEST: referência cruzada aceita';
  exception when raise_exception then
    if sqlerrm <> 'Referência ou valor do pagamento divergente.' then raise; end if;
  end;
end $$;
select reconcile_marketplace_payment('30000000-0000-0000-0000-000000000001', '111', 600.50, 'estornado', 'pix', 'BRL', '2026-09-01T12:04:00Z', 600.50);
select reconcile_marketplace_payment('30000000-0000-0000-0000-000000000001', '112', 399.50, 'estornado', 'pix', 'BRL', '2026-09-01T12:04:00Z', 399.50);
select test_assert((select amount_received from bookings where code = 'PAYMENT') = 0, 'estorno integral');
reset role;

-- Canais (0062): noite ocupada no Airbnb/Booking não pode ser vendida de novo
-- pela Rota. O feed da OTA pode devolver a própria reserva da Rota (eco do iCal
-- exportado): editar sem mudar as noites continua permitido.
insert into channel_calendars(id, pousada_id, room_id, provider, import_url, export_token) values
 ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'airbnb', 'https://example.test/duplo.ics', 'teste-export-duplo'),
 ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'booking', 'https://example.test/familia.ics', 'teste-export-familia');
insert into channel_events(calendar_id, pousada_id, room_id, uid, starts_on, ends_on, summary) values
 ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'ota-1', '2099-09-01', '2099-09-04', 'Reserved');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
do $$ begin
  begin
    perform create_booking(
      p_pousada_id := '10000000-0000-0000-0000-000000000001', p_room_id := '20000000-0000-0000-0000-000000000001',
      p_responsible_guest_id := '40000000-0000-0000-0000-000000000001', p_code := 'CANAL-CONFLITO',
      p_checkin := '2099-09-03', p_checkout := '2099-09-05', p_adults := 2, p_children := 0, p_infants := 0,
      p_pets := false, p_subtotal := 400, p_fee := 0, p_discount := 0, p_surcharge := 0,
      p_services_amount := 0, p_total := 400, p_status := 'confirmed', p_origin := 'balcao');
    raise exception 'TEST: reserva de balcão aceita sobre noite vendida pela OTA';
  exception when raise_exception then
    if sqlerrm <> 'Esta acomodação já está ocupada no Airbnb nesse período (calendário sincronizado).' then raise; end if;
  end;
end $$;
select create_booking(
  p_pousada_id := '10000000-0000-0000-0000-000000000001', p_room_id := '20000000-0000-0000-0000-000000000001',
  p_responsible_guest_id := '40000000-0000-0000-0000-000000000001', p_code := 'CANAL-LIVRE',
  p_checkin := '2099-09-04', p_checkout := '2099-09-06', p_adults := 2, p_children := 0, p_infants := 0,
  p_pets := false, p_subtotal := 400, p_fee := 0, p_discount := 0, p_surcharge := 0,
  p_services_amount := 0, p_total := 400, p_status := 'confirmed', p_origin := 'balcao');
select test_assert(exists(select 1 from bookings where code = 'CANAL-LIVRE'), 'saída da OTA libera a noite seguinte');
select create_booking(
  p_pousada_id := '10000000-0000-0000-0000-000000000001', p_room_id := '20000000-0000-0000-0000-000000000002',
  p_responsible_guest_id := '40000000-0000-0000-0000-000000000001', p_code := 'CANAL-ECO',
  p_checkin := '2099-09-10', p_checkout := '2099-09-12', p_adults := 2, p_children := 0, p_infants := 0,
  p_pets := false, p_subtotal := 800, p_fee := 0, p_discount := 0, p_surcharge := 0,
  p_services_amount := 0, p_total := 800, p_status := 'confirmed', p_origin := 'balcao');
reset role;
-- O feed devolve a própria reserva (10–12) emendada a uma noite fechada na OTA (12–13).
insert into channel_events(calendar_id, pousada_id, room_id, uid, starts_on, ends_on, summary) values
 ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'ota-eco', '2099-09-10', '2099-09-13', 'CLOSED - Not available');
set role authenticated;
select update_booking(
  p_booking_id := (select id from bookings where code = 'CANAL-ECO'),
  p_version := (select version from bookings where code = 'CANAL-ECO'),
  p_room_id := '20000000-0000-0000-0000-000000000002', p_responsible_guest_id := '40000000-0000-0000-0000-000000000001',
  p_checkin := '2099-09-10', p_checkout := '2099-09-12', p_adults := 3, p_children := 0, p_infants := 0,
  p_pets := false, p_subtotal := 800, p_fee := 0, p_discount := 0, p_surcharge := 0,
  p_services_amount := 0, p_total := 800, p_origin := 'balcao', p_expected_arrival_time := null,
  p_special_requests := '', p_internal_notes := '');
select test_assert((select adults from bookings where code = 'CANAL-ECO') = 3, 'eco da OTA não trava edição sem noites novas');
do $$ begin
  begin
    perform update_booking(
      p_booking_id := (select id from bookings where code = 'CANAL-ECO'),
      p_version := (select version from bookings where code = 'CANAL-ECO'),
      p_room_id := '20000000-0000-0000-0000-000000000002', p_responsible_guest_id := '40000000-0000-0000-0000-000000000001',
      p_checkin := '2099-09-10', p_checkout := '2099-09-13', p_adults := 3, p_children := 0, p_infants := 0,
      p_pets := false, p_subtotal := 1200, p_fee := 0, p_discount := 0, p_surcharge := 0,
      p_services_amount := 0, p_total := 1200, p_origin := 'balcao', p_expected_arrival_time := null,
      p_special_requests := '', p_internal_notes := '');
    raise exception 'TEST: edição estendeu a reserva sobre noite fechada pela OTA';
  exception when raise_exception then
    if sqlerrm <> 'Esta acomodação já está ocupada no Booking.com nesse período (calendário sincronizado).' then raise; end if;
  end;
end $$;
reset role;

-- Hóspede reaproveitado (0063): a "Nova reserva" acha o cadastro pelo e-mail ou
-- telefone e não pode apagar o que o formulário não envia.
insert into guests(id, pousada_id, full_name, email, phone, birth_date, city, state, address,
  internal_notes, document_type, document_number, document_number_hash, document_last4,
  marketing_consent, preferences) values
 ('40000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'Maria Aparecida da Silva',
  'maria@example.test', '(31) 99999-0000', '1980-05-20', 'Belo Horizonte', 'MG', 'Rua das Flores, 10',
  'Prefere quarto térreo', 'cpf', 'documento-cifrado-sintetico', 'hash-sintetico', '0000', true, array['café sem glúten']);
set role authenticated;
select test_assert(
  (upsert_guest(p_pousada_id := '10000000-0000-0000-0000-000000000001', p_full_name := 'Maria',
    p_email := ' MARIA@example.test', p_phone := '(31) 98888-7777')->>'id') = '40000000-0000-0000-0000-000000000010',
  'nova reserva reaproveita o hóspede pelo e-mail');
select test_assert((select full_name = 'Maria Aparecida da Silva' and birth_date = '1980-05-20'
    and city = 'Belo Horizonte' and state = 'MG' and address = 'Rua das Flores, 10'
    and internal_notes = 'Prefere quarto térreo' and document_type = 'cpf'
    and document_number = 'documento-cifrado-sintetico' and document_last4 = '0000'
    and marketing_consent and preferences = array['café sem glúten'] and email = 'maria@example.test'
  from guests where id = '40000000-0000-0000-0000-000000000010'), 'nova reserva não apaga a ficha do hóspede');
select test_assert((select phone from guests where id = '40000000-0000-0000-0000-000000000010') = '(31) 98888-7777',
  'contato informado na reserva atualiza a ficha');
-- A edição pelo perfil (com o id) continua gravando exatamente o que o formulário envia.
select upsert_guest(p_pousada_id := '10000000-0000-0000-0000-000000000001',
  p_guest_id := '40000000-0000-0000-0000-000000000010', p_full_name := 'Maria Aparecida da Silva',
  p_email := 'maria@example.test', p_phone := '(31) 98888-7777', p_address := null);
select test_assert((select address is null from guests where id = '40000000-0000-0000-0000-000000000010'),
  'edição pelo perfil ainda limpa campo esvaziado');
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- Assinatura (0064): o master liga o plano ao Mercado Pago por RPC, uma vez só.
-- `plans` não tem policy de escrita: o UPDATE direto do app afetava 0 linhas.
insert into auth.users(id, email) values ('00000000-0000-0000-0000-000000000009', 'master@example.test');
update profiles set platform_role = 'master' where id = '00000000-0000-0000-0000-000000000009';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
do $$ begin
  begin
    perform set_plan_preapproval_id((select id from plans where active limit 1), 'mp-plano-teste');
    raise exception 'TEST: proprietário ligou o plano da plataforma';
  exception when raise_exception then
    if sqlerrm <> 'Somente master pode configurar o plano de assinatura da plataforma.' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000009', false);
select test_assert(set_plan_preapproval_id((select id from plans where active limit 1), 'mp-plano-teste')->>'status' = 'ok',
  'master liga o plano ao Mercado Pago');
select test_assert((select mp_preapproval_plan_id from plans where active limit 1) = 'mp-plano-teste', 'id do plano gravado');
select test_assert(set_plan_preapproval_id((select id from plans where active limit 1), 'mp-plano-teste')->>'status' = 'already_set',
  'repetir o mesmo id não muda nada');
do $$ begin
  begin
    perform set_plan_preapproval_id((select id from plans where active limit 1), 'mp-plano-outro');
    raise exception 'TEST: plano religado a outro id do Mercado Pago';
  exception when raise_exception then
    if sqlerrm not like 'Este plano já está ligado a outro plano do Mercado Pago%' then raise; end if;
  end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- Pousadas (0065): só a equipe da Rota publica pousada ou mexe em nota,
-- situação da conta, dono e demais colunas de controle.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
do $$ begin
  begin
    update pousadas set status = 'arquivada' where id = '10000000-0000-0000-0000-000000000001';
    raise exception 'TEST: dono mudou a publicação da própria pousada';
  exception when raise_exception then
    if sqlerrm not like 'Só a equipe da Rota pode alterar%' then raise; end if;
  end;
  begin
    update pousadas set rating = 5, reviews = 999 where id = '10000000-0000-0000-0000-000000000001';
    raise exception 'TEST: dono inflou a nota da própria pousada';
  exception when raise_exception then
    if sqlerrm not like 'Só a equipe da Rota pode alterar%' then raise; end if;
  end;
  begin
    insert into pousadas(slug, name, city, state, status, owner_id)
    values ('pousada-atalho', 'Pousada Atalho', 'Cidade', 'MG', 'publicada', '00000000-0000-0000-0000-000000000001');
    raise exception 'TEST: dono criou pousada já publicada';
  exception when raise_exception then
    if sqlerrm not like 'Pousada nova começa em análise%' then raise; end if;
  end;
end $$;
do $$ declare changed integer; begin
  update pousadas set description = 'Descrição revisada pelo dono da pousada A.'
  where id = '10000000-0000-0000-0000-000000000001';
  get diagnostics changed = row_count;
  perform test_assert(changed = 1, 'dono continua salvando as configurações');
end $$;
select test_assert(create_pousada('Pousada Nova', 'Cidade', 'MG', 'Pousada nova cadastrada pelo dono.', 150,
  'pousada-nova-teste') = 'pousada-nova-teste', 'cadastro pelo /anunciar continua funcionando');
select test_assert((select status from pousadas where slug = 'pousada-nova-teste') = 'em_analise', 'cadastro nasce em análise');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000009', false);
do $$ declare changed integer; begin
  update pousadas set status = 'publicada' where slug = 'pousada-nova-teste';
  get diagnostics changed = row_count;
  perform test_assert(changed = 1, 'equipe da Rota publica a pousada');
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- Avaliações (0066): só avalia quem se hospedou naquela pousada (estadia
-- encerrada); a pousada só responde, e o hóspede não escreve a resposta.
insert into auth.users(id, email) values ('00000000-0000-0000-0000-000000000011', 'viajante@example.test');
insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, guest_id, checkin, checkout, total, status) values
 ('30000000-0000-0000-0000-000000000011', 'ESTADIA-FIM', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', '2099-03-01', '2099-03-03', 400, 'checked_out'),
 ('30000000-0000-0000-0000-000000000012', 'ESTADIA-FUTURA', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', '2099-04-01', '2099-04-03', 400, 'confirmed');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);
do $$ begin
  begin
    insert into reviews(pousada_id, booking_id, author_id, rating, text) values
      ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000011',
       '00000000-0000-0000-0000-000000000011', 1, 'nunca estive aqui');
    raise exception 'TEST: avaliação de pousada onde não se hospedou';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into reviews(pousada_id, booking_id, author_id, rating, text) values
      ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000012',
       '00000000-0000-0000-0000-000000000011', 5, 'antes de chegar');
    raise exception 'TEST: avaliação antes do fim da estadia';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into reviews(pousada_id, booking_id, author_id, rating, text, response) values
      ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000011',
       '00000000-0000-0000-0000-000000000011', 5, 'ótimo', 'resposta forjada da pousada');
    raise exception 'TEST: hóspede escreveu a resposta da pousada';
  exception when insufficient_privilege then null;
  end;
end $$;
insert into reviews(id, pousada_id, booking_id, author_id, rating, text) values
 ('60000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000011', 3, 'bom, mas barulhento');
select test_assert(exists(select 1 from reviews where id = '60000000-0000-0000-0000-000000000011'), 'hóspede avalia a estadia encerrada');
do $$ begin
  begin
    update reviews set response = 'resposta forjada' where id = '60000000-0000-0000-0000-000000000011';
    raise exception 'TEST: autor alterou a resposta da pousada';
  exception when raise_exception then
    if sqlerrm <> 'Só a pousada responde à avaliação.' then raise; end if;
  end;
end $$;
update reviews set text = 'bom, mas um pouco barulhento' where id = '60000000-0000-0000-0000-000000000011';
select test_assert((select text from reviews where id = '60000000-0000-0000-0000-000000000011') = 'bom, mas um pouco barulhento',
  'autor edita o próprio comentário');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
do $$ begin
  begin
    update reviews set rating = 5 where id = '60000000-0000-0000-0000-000000000011';
    raise exception 'TEST: dono mudou a nota do hóspede';
  exception when raise_exception then
    if sqlerrm <> 'A pousada só pode responder à avaliação, não alterar a nota ou o comentário do hóspede.' then raise; end if;
  end;
end $$;
update reviews set response = 'Obrigado! Já trocamos a janela do quarto.' where id = '60000000-0000-0000-0000-000000000011';
select test_assert((select rating = 3 and response like 'Obrigado!%' from reviews where id = '60000000-0000-0000-0000-000000000011'),
  'dono responde sem mexer na nota');
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- Reserva pelo site (0067): o "hoje" é o do fuso da pousada, não o de UTC
-- (das 21h à meia-noite em Brasília o banco recusava a entrada no mesmo dia),
-- e quem chega pelo link da bio fica marcado como `link_bio`.
-- Fuso em que a data local difere da de UTC agora: a oeste (UTC-12) de manhã
-- em UTC, a leste (UTC+14) no resto do dia — o teste vale a qualquer hora.
update pousadas set timezone = case when extract(hour from now() at time zone 'UTC') < 11
  then 'Etc/GMT+12' else 'Pacific/Kiritimati' end
where id = '10000000-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);
do $$
declare
  v_local date := (now() at time zone (select timezone from pousadas where id = '10000000-0000-0000-0000-000000000001'))::date;
  v_utc date := (now() at time zone 'UTC')::date;
  v_guest uuid := (ensure_traveler_guest('10000000-0000-0000-0000-000000000001', 'Viajante Teste', 'viajante@example.test')->>'id')::uuid;
begin
  perform test_assert(v_local <> v_utc, 'cenário com a data da pousada diferente da de UTC');
  if v_local < v_utc then
    -- Na pousada ainda é "ontem" em UTC: a entrada hoje (data local) vale.
    perform create_booking('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', v_guest,
      'SITE-HOJE', v_local, v_local + 1, 1, 0, 0, false, 200, 0, 0, 0, 0, 200, 'pending',
      'rota_das_pousadas', '00000000-0000-0000-0000-000000000011');
  else
    -- Na pousada já é amanhã: a data de UTC virou passado.
    begin
      perform create_booking('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', v_guest,
        'SITE-ONTEM', v_utc, v_utc + 1, 1, 0, 0, false, 200, 0, 0, 0, 0, 200, 'pending',
        'rota_das_pousadas', '00000000-0000-0000-0000-000000000011');
      raise exception 'TEST: reserva pelo site aceitou data que já passou no fuso da pousada';
    exception when raise_exception then
      if sqlerrm <> 'A data de entrada não pode ser no passado.' then raise; end if;
    end;
  end if;
  begin
    perform create_booking('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', v_guest,
      'SITE-BALCAO', v_local + 20, v_local + 21, 1, 0, 0, false, 200, 0, 0, 0, 0, 200, 'pending',
      'balcao', '00000000-0000-0000-0000-000000000011');
    raise exception 'TEST: reserva pelo site gravou origem de balcão';
  exception when raise_exception then
    if sqlerrm <> 'Origem inválida para reserva pública.' then raise; end if;
  end;
  perform create_booking('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', v_guest,
    'SITE-BIO', v_local + 20, v_local + 21, 1, 0, 0, false, 200, 0, 0, 0, 0, 200, 'pending',
    'link_bio', '00000000-0000-0000-0000-000000000011');
end $$;
select test_assert((select count(*) from bookings where origin = 'link_bio' and guest_id = '00000000-0000-0000-0000-000000000011') = 1,
  'reserva vinda do link da bio fica marcada como link_bio');
reset role;
select set_config('request.jwt.claim.sub', '', false);
-- Fuso inválido gravado nas Configurações cai em Brasília em vez de travar a reserva.
update pousadas set timezone = 'Brasília' where id = '10000000-0000-0000-0000-000000000001';
select test_assert(pousada_local_date('10000000-0000-0000-0000-000000000001') = (now() at time zone 'America/Sao_Paulo')::date,
  'fuso inválido usa a data de Brasília');
select test_assert(not has_function_privilege('authenticated', 'pousada_local_date(uuid)', 'EXECUTE'), 'helper de data não é RPC pública');
update pousadas set timezone = 'America/Sao_Paulo' where id = '10000000-0000-0000-0000-000000000001';

-- Membros (0068): a RLS de `profiles` só mostra o próprio perfil, então a tela
-- de Membros exibia "Sem nome" para toda a equipe. A RPC devolve só o nome dos
-- membros da pousada, e só para quem pode ver a equipe (mesma regra dos e-mails).
insert into auth.users(id, email) values ('00000000-0000-0000-0000-000000000012', 'recepcao-a@example.test');
update profiles set full_name = 'Recepção da Pousada A' where id = '00000000-0000-0000-0000-000000000012';
insert into memberships(user_id, pousada_id, role, status) values
 ('00000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', 'recepcionista', 'active');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select test_assert(not exists(select 1 from profiles where id = '00000000-0000-0000-0000-000000000012'),
  'perfil de outro membro segue invisível pela tabela');
select test_assert((select full_name from list_membership_names('10000000-0000-0000-0000-000000000001')
  where user_id = '00000000-0000-0000-0000-000000000012') = 'Recepção da Pousada A', 'dono vê o nome da equipe');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false);
select test_assert((select count(*) from list_membership_names('10000000-0000-0000-0000-000000000001')) = 0,
  'recepção não lista a equipe');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select test_assert((select count(*) from list_membership_names('10000000-0000-0000-0000-000000000001')) = 0,
  'dono de outra pousada não lista a equipe');
reset role;
select set_config('request.jwt.claim.sub', '', false);
select test_assert(not has_function_privilege('anon', 'list_membership_names(uuid)', 'EXECUTE'), 'anon não lista nomes');
