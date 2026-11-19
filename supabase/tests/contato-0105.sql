-- 0105 — Contato do hóspede liberado só depois do pagamento. Dados sintéticos.
-- Pousada L (…010501) com dono, recepção e um viajante que reserva pelo site;
-- pousada M (…010502) de outro dono. Master …009 vem de priorities.sql.

-- ---------------------------------------------------------------------------
-- Permissões por coluna
-- ---------------------------------------------------------------------------
select test_assert(not has_column_privilege('authenticated', 'public.bookings', 'guest_email', 'SELECT'), 'authenticated não lê bookings.guest_email');
select test_assert(not has_column_privilege('authenticated', 'public.bookings', 'guest_phone', 'SELECT'), 'authenticated não lê bookings.guest_phone');
select test_assert(not has_column_privilege('anon', 'public.bookings', 'guest_email', 'SELECT'), 'anon não lê bookings.guest_email');
select test_assert(not has_column_privilege('authenticated', 'public.guests', 'email', 'SELECT'), 'authenticated não lê guests.email');
select test_assert(not has_column_privilege('authenticated', 'public.guests', 'phone', 'SELECT'), 'authenticated não lê guests.phone');
select test_assert(not has_column_privilege('authenticated', 'public.guests', 'whatsapp', 'SELECT'), 'authenticated não lê guests.whatsapp');
select test_assert(not has_column_privilege('authenticated', 'public.guests', 'email_normalized', 'SELECT'), 'authenticated não lê guests.email_normalized');
select test_assert(not has_column_privilege('authenticated', 'public.guests', 'phone_normalized', 'SELECT'), 'authenticated não lê guests.phone_normalized');

-- Toda outra coluna continua legível (pega coluna nova sem grant em migration futura).
select test_assert(not exists (
  select 1 from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'bookings'
    and c.column_name not in ('guest_email', 'guest_phone')
    and not has_column_privilege('authenticated', 'public.bookings', c.column_name, 'SELECT')
), 'authenticated lê todas as outras colunas de bookings (grant em coluna nova?)');
select test_assert(not exists (
  select 1 from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'guests'
    and c.column_name not in ('email', 'phone', 'whatsapp', 'email_normalized', 'phone_normalized')
    and not has_column_privilege('authenticated', 'public.guests', c.column_name, 'SELECT')
), 'authenticated lê todas as outras colunas de guests (grant em coluna nova?)');

select test_assert(not has_function_privilege('anon', 'public.get_booking_guest_contacts(uuid[])', 'EXECUTE'), 'anon não lê contato de reserva');
select test_assert(not has_function_privilege('anon', 'public.get_guest_contacts(uuid[])', 'EXECUTE'), 'anon não lê contato de ficha');
select test_assert(not has_function_privilege('anon', 'public.list_platform_pix_proofs(date)', 'EXECUTE'), 'anon não lista comprovantes');
select test_assert(not has_function_privilege('authenticated', 'public.booking_contact_released(uuid)', 'EXECUTE'), 'regra de liberação não é chamada pela API');
select test_assert(not has_function_privilege('authenticated', 'public.guest_contact_released(uuid)', 'EXECUTE'), 'regra de liberação da ficha não é chamada pela API');

-- ---------------------------------------------------------------------------
-- Atores e dados
-- ---------------------------------------------------------------------------
insert into auth.users(id, email) values
 ('00000000-0000-0000-0000-000000010501', 'dono-l@example.test'),
 ('00000000-0000-0000-0000-000000010502', 'recepcao-l@example.test'),
 ('00000000-0000-0000-0000-000000010503', 'viajante-l@example.test'),
 ('00000000-0000-0000-0000-000000010504', 'dono-m@example.test');
insert into pousadas(id, slug, name, city, state, status, tenant_status, owner_id, price_per_night) values
 ('10000000-0000-0000-0000-000000010501', 'pousada-contato-l', 'Pousada Contato L', 'Gonçalves', 'MG',
  'em_analise', 'onboarding', '00000000-0000-0000-0000-000000010501', 400),
 ('10000000-0000-0000-0000-000000010502', 'pousada-contato-m', 'Pousada Contato M', 'Gonçalves', 'MG',
  'em_analise', 'onboarding', '00000000-0000-0000-0000-000000010504', 400);
insert into memberships(user_id, pousada_id, role, status) values
 ('00000000-0000-0000-0000-000000010501', '10000000-0000-0000-0000-000000010501', 'proprietario', 'active'),
 ('00000000-0000-0000-0000-000000010502', '10000000-0000-0000-0000-000000010501', 'recepcionista', 'active'),
 ('00000000-0000-0000-0000-000000010504', '10000000-0000-0000-0000-000000010502', 'proprietario', 'active');
insert into rooms(id, pousada_id, name, capacity, capacity_max, base_price, status, public_visible, operational_status) values
 ('20000000-0000-0000-0000-000000010501', '10000000-0000-0000-0000-000000010501', 'Chalé L', 2, 2, 400, 'active', true, 'available');

-- Ficha do viajante (como ensure_traveler_guest cria) e ficha de balcão.
insert into guests(id, pousada_id, user_id, full_name, email, phone, whatsapp, source, created_by) values
 ('40000000-0000-0000-0000-000000010501', '10000000-0000-0000-0000-000000010501',
  '00000000-0000-0000-0000-000000010503', 'Viajante L', 'viajante-l@example.test', '(35) 99999-0001', '35999990001',
  'public_booking', '00000000-0000-0000-0000-000000010503'),
 ('40000000-0000-0000-0000-000000010502', '10000000-0000-0000-0000-000000010501',
  null, 'Hóspede de Balcão', 'balcao-l@example.test', '(35) 98888-0002', null,
  'front_desk', '00000000-0000-0000-0000-000000010501');

-- Reserva pelo site: quem está logado é o próprio viajante.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000010503', false);
insert into bookings(id, code, pousada_id, room_id, guest_id, responsible_guest_id, guest_name, guest_email, guest_phone,
                     checkin, checkout, total, status, origin, created_by) values
 ('30000000-0000-0000-0000-000000010501', 'CTT-SITE', '10000000-0000-0000-0000-000000010501', '20000000-0000-0000-0000-000000010501',
  '00000000-0000-0000-0000-000000010503', '40000000-0000-0000-0000-000000010501', 'Viajante L', 'viajante-l@example.test', '(35) 99999-0001',
  '2099-05-10', '2099-05-12', 800, 'pending', 'rota_das_pousadas', '00000000-0000-0000-0000-000000010503');

-- Reserva de balcão criada pelo dono: mesma ficha do viajante, e uma de ficha própria.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000010501', false);
insert into bookings(id, code, pousada_id, room_id, guest_id, responsible_guest_id, guest_name, guest_email, guest_phone,
                     checkin, checkout, total, status, origin, created_by) values
 ('30000000-0000-0000-0000-000000010502', 'CTT-BALCAO-V', '10000000-0000-0000-0000-000000010501', '20000000-0000-0000-0000-000000010501',
  null, '40000000-0000-0000-0000-000000010501', 'Viajante L', 'viajante-l@example.test', '(35) 99999-0001',
  '2099-06-10', '2099-06-12', 800, 'confirmed', 'balcao', '00000000-0000-0000-0000-000000010501'),
 ('30000000-0000-0000-0000-000000010503', 'CTT-BALCAO', '10000000-0000-0000-0000-000000010501', '20000000-0000-0000-0000-000000010501',
  null, '40000000-0000-0000-0000-000000010502', 'Hóspede de Balcão', 'balcao-l@example.test', '(35) 98888-0002',
  '2099-07-10', '2099-07-12', 800, 'confirmed', 'balcao', '00000000-0000-0000-0000-000000010501'),
 -- Dono tentando marcar como "feita pelo viajante": o gatilho ignora.
 ('30000000-0000-0000-0000-000000010504', 'CTT-FORJADA', '10000000-0000-0000-0000-000000010501', '20000000-0000-0000-0000-000000010501',
  '00000000-0000-0000-0000-000000010501', '40000000-0000-0000-0000-000000010501', 'Viajante L', 'viajante-l@example.test', null,
  '2099-08-10', '2099-08-12', 800, 'confirmed', 'rota_das_pousadas', '00000000-0000-0000-0000-000000010501');

select test_assert((select booked_by_traveler and contact_released_at is null from bookings where id = '30000000-0000-0000-0000-000000010501'),
  'reserva do site: feita pelo viajante e ainda sem liberação');
select test_assert((select not booked_by_traveler and contact_released_at is null from bookings where id = '30000000-0000-0000-0000-000000010502'),
  'reserva de balcão não é do viajante');
select test_assert((select not booked_by_traveler and contact_released_at is null from bookings where id = '30000000-0000-0000-0000-000000010504'),
  'dono não forja reserva "do viajante" confirmada');

-- ---------------------------------------------------------------------------
-- Recepção: contato oculto enquanto o pagamento não é confirmado
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000010502', false);

do $$ begin
  begin
    perform guest_email from bookings where id = '30000000-0000-0000-0000-000000010501';
    raise exception 'FALHOU: recepção leu bookings.guest_email direto';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
  begin
    perform email from guests where id = '40000000-0000-0000-0000-000000010501';
    raise exception 'FALHOU: recepção leu guests.email direto';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;

select test_assert((select code from bookings where id = '30000000-0000-0000-0000-000000010501') = 'CTT-SITE',
  'recepção continua lendo as outras colunas da reserva');
select test_assert((select full_name from guests where id = '40000000-0000-0000-0000-000000010501') = 'Viajante L',
  'recepção continua lendo o nome da ficha');

select test_assert((select not released and email is null and phone is null and guest_phone is null
                    from get_booking_guest_contacts(array['30000000-0000-0000-0000-000000010501']::uuid[])),
  'reserva do site pendente: contato oculto');
select test_assert((select not released and email is null
                    from get_booking_guest_contacts(array['30000000-0000-0000-0000-000000010502']::uuid[])),
  'reserva de balcão com a ficha do viajante também fica oculta');
select test_assert((select not released and email is null
                    from get_booking_guest_contacts(array['30000000-0000-0000-0000-000000010504']::uuid[])),
  'reserva forjada pelo dono não libera');
select test_assert((select released and email = 'balcao-l@example.test' and phone = '(35) 98888-0002'
                    from get_booking_guest_contacts(array['30000000-0000-0000-0000-000000010503']::uuid[])),
  'ficha cadastrada pela pousada: contato visível');
select test_assert((select not released and email is null and phone is null and whatsapp is null
                    from get_guest_contacts(array['40000000-0000-0000-0000-000000010501']::uuid[])),
  'ficha do viajante oculta');
select test_assert((select released and email = 'balcao-l@example.test'
                    from get_guest_contacts(array['40000000-0000-0000-0000-000000010502']::uuid[])),
  'ficha de balcão visível');
select test_assert((select count(*) from search_guest_ids_by_contact('10000000-0000-0000-0000-000000010501', 'viajante-l', null)) = 0,
  'busca por e-mail não encontra ficha oculta');
select test_assert((select count(*) from search_guest_ids_by_contact('10000000-0000-0000-0000-000000010501', null, '99999')) = 0,
  'busca por telefone não encontra ficha oculta');
select test_assert((select count(*) from search_guest_ids_by_contact('10000000-0000-0000-0000-000000010501', 'balcao-l', null)) = 1,
  'busca encontra ficha de balcão');

-- Burlas por UPDATE direto: nada muda.
update bookings set contact_released_at = now(), booked_by_traveler = true
where id = '30000000-0000-0000-0000-000000010502';
update guests set source = 'front_desk', email = 'trocado@example.test', phone = null, whatsapp = null
where id = '40000000-0000-0000-0000-000000010501';
reset role;
select test_assert((select not booked_by_traveler and contact_released_at is null from bookings where id = '30000000-0000-0000-0000-000000010502'),
  'equipe não libera reserva por UPDATE');
select test_assert((select source = 'public_booking' and email = 'viajante-l@example.test' and phone = '(35) 99999-0001'
                    from guests where id = '40000000-0000-0000-0000-000000010501'),
  'equipe não troca origem nem contato da ficha oculta');

-- Outra pousada não vê nada.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000010504', false);
select test_assert((select count(*) from get_booking_guest_contacts(array['30000000-0000-0000-0000-000000010503']::uuid[])) = 0,
  'dono de outra pousada não recebe contato');
select test_assert((select count(*) from get_guest_contacts(array['40000000-0000-0000-0000-000000010502']::uuid[])) = 0,
  'dono de outra pousada não recebe ficha');
do $$ begin
  begin
    perform search_guest_ids_by_contact('10000000-0000-0000-0000-000000010501', 'balcao', null);
    raise exception 'FALHOU: dono de outra pousada buscou hóspedes';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Pagamento confirmado: libera reserva e ficha, e não volta atrás
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000010502', false);
update bookings set status = 'confirmed' where id = '30000000-0000-0000-0000-000000010501';
select test_assert((select contact_released_at is not null from bookings where id = '30000000-0000-0000-0000-000000010501'),
  'confirmação grava a liberação');

set role authenticated;
select test_assert((select released and email = 'viajante-l@example.test' and phone = '(35) 99999-0001' and guest_phone = '35999990001'
                    from get_booking_guest_contacts(array['30000000-0000-0000-0000-000000010501']::uuid[])),
  'reserva confirmada: contato liberado');
select test_assert((select released and email = 'viajante-l@example.test'
                    from get_booking_guest_contacts(array['30000000-0000-0000-0000-000000010502']::uuid[])),
  'ficha liberada vale também para a reserva de balcão');
select test_assert((select released and whatsapp = '35999990001'
                    from get_guest_contacts(array['40000000-0000-0000-0000-000000010501']::uuid[])),
  'ficha do viajante liberada');
select test_assert((select count(*) from search_guest_ids_by_contact('10000000-0000-0000-0000-000000010501', 'viajante-l', null)) = 1,
  'busca encontra a ficha liberada');
reset role;

update bookings set status = 'cancelled' where id = '30000000-0000-0000-0000-000000010501';
select test_assert((select contact_released_at is not null from bookings where id = '30000000-0000-0000-0000-000000010501'),
  'cancelar depois de confirmar não esconde de novo');

-- Viajante de volta: nova reserva pendente já mostra o contato (a pousada já tem).
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000010503', false);
insert into bookings(id, code, pousada_id, room_id, guest_id, responsible_guest_id, guest_name, guest_email,
                     checkin, checkout, total, status, origin, created_by) values
 ('30000000-0000-0000-0000-000000010505', 'CTT-VOLTA', '10000000-0000-0000-0000-000000010501', '20000000-0000-0000-0000-000000010501',
  '00000000-0000-0000-0000-000000010503', '40000000-0000-0000-0000-000000010501', 'Viajante L', 'viajante-l@example.test',
  '2099-09-10', '2099-09-12', 800, 'pending', 'link_bio', '00000000-0000-0000-0000-000000010503');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000010502', false);
set role authenticated;
select test_assert((select released from get_booking_guest_contacts(array['30000000-0000-0000-0000-000000010505']::uuid[])),
  'viajante que já teve reserva paga: contato visível na nova pendente');
reset role;

-- Ficha liberada: edição da equipe volta a valer.
set role authenticated;
update guests set phone = '(35) 97777-0003' where id = '40000000-0000-0000-0000-000000010501';
reset role;
select test_assert((select phone = '(35) 97777-0003' from guests where id = '40000000-0000-0000-0000-000000010501'),
  'ficha liberada: equipe edita o contato');

-- ---------------------------------------------------------------------------
-- Auditoria dos comprovantes no /admin
-- ---------------------------------------------------------------------------
insert into payment_proofs(id, booking_id, pousada_id, uploaded_by, file_path, mime_type, size_bytes, amount, status, approved_amount, reviewed_at, created_at) values
 ('50000000-0000-0000-0000-000000010501', '30000000-0000-0000-0000-000000010501', '10000000-0000-0000-0000-000000010501',
  '00000000-0000-0000-0000-000000010503', '30000000-0000-0000-0000-000000010501/a.png', 'image/png', 100, 800, 'approved', 800, now(), '2099-04-05 12:00-03');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000010501', false);
do $$ begin
  begin
    perform list_platform_pix_proofs(null);
    raise exception 'FALHOU: dono de pousada listou os comprovantes da plataforma';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000009', false);
select test_assert((list_platform_pix_proofs('2099-04-01')->>'month') = '2099-04-01', 'mês pedido');
select test_assert((select (i->>'cancelledAfterApproval')::boolean and i->>'pousadaName' = 'Pousada Contato L' and (i->>'amount')::numeric = 800
                    from jsonb_array_elements(list_platform_pix_proofs('2099-04-01')->'items') i
                    where i->>'proofId' = '50000000-0000-0000-0000-000000010501'),
  'comprovante aprovado com reserva cancelada aparece sinalizado');
select test_assert((select (m->>'cancelledAfterApproval')::int = 1 and (m->>'approved')::int = 1
                    from jsonb_array_elements(list_platform_pix_proofs('2099-04-01')->'months') m
                    where m->>'month' = '2099-04-01'),
  'resumo do mês conta aprovados e cancelados depois');
select test_assert((select count(*) from get_booking_guest_contacts(array['30000000-0000-0000-0000-000000010503']::uuid[])) = 0,
  'master sem concessão não lê contato pela RPC');
reset role;
