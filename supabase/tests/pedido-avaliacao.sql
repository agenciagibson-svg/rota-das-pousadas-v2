-- Testes da 0089 (pedido de avaliação por e-mail). Roda DEPOIS de priorities.sql
-- e security-0083.sql (test_assert, pousada A, hóspede de ficha …0001, owner A …001).
-- Dados exclusivamente sintéticos.

insert into auth.users(id, email) values
 ('00000000-0000-0000-0000-000000000891', 'avaliador@example.test'),
 ('00000000-0000-0000-0000-000000000892', 'outro-avaliador@example.test');

-- Um quarto por reserva ativa: a proteção de sobreposição (0033) não interfere.
insert into rooms(id, pousada_id, name, capacity, capacity_max, base_price, status, public_visible, operational_status)
select ('20000000-0000-0000-0000-0000000089' || lpad(n::text, 2, '0'))::uuid,
       '10000000-0000-0000-0000-000000000001', 'Quarto 0089-' || n, 2, 2, 200, 'active', true, 'available'
from generate_series(1, 20) n;

update pousadas set timezone = 'America/Sao_Paulo' where id = '10000000-0000-0000-0000-000000000001';

-- d(n) = hoje no fuso da pousada + n dias.
create function t89_d(n integer) returns date language sql as $$
  select pousada_local_date('10000000-0000-0000-0000-000000000001') + n;
$$;
create function t89_room(n integer) returns uuid language sql as $$
  select ('20000000-0000-0000-0000-0000000089' || lpad(n::text, 2, '0'))::uuid;
$$;
create function t89_booking(n integer) returns uuid language sql as $$
  select ('30000000-0000-0000-0000-0000000089' || lpad(n::text, 2, '0'))::uuid;
$$;

-- guest_id/created_by: …891 é o viajante; …001 é o dono da pousada A.
insert into bookings(id, code, pousada_id, room_id, responsible_guest_id, guest_id, created_by,
                     guest_name, guest_email, checkin, checkout, total, status, origin)
values
 -- Elegíveis
 (t89_booking(1), 'T89-SITE', '10000000-0000-0000-0000-000000000001', t89_room(1), '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000891', '00000000-0000-0000-0000-000000000891', 'Ana Viajante', 'avaliador@example.test',
  t89_d(-3), t89_d(-1), 400, 'checked_out', 'rota_das_pousadas'),
 (t89_booking(2), 'T89-BIO', '10000000-0000-0000-0000-000000000001', t89_room(2), '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000891', '00000000-0000-0000-0000-000000000891', 'Ana Viajante', ' avaliador@example.test ',
  t89_d(-5), t89_d(-3), 400, 'confirmed', 'link_bio'),
 -- Não elegíveis
 (t89_booking(3), 'T89-BALCAO', '10000000-0000-0000-0000-000000000001', t89_room(3), '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000891', '00000000-0000-0000-0000-000000000001', 'Ana Viajante', 'avaliador@example.test',
  t89_d(-3), t89_d(-1), 400, 'checked_out', 'balcao'),
 (t89_booking(4), 'T89-EQUIPE', '10000000-0000-0000-0000-000000000001', t89_room(4), '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000891', '00000000-0000-0000-0000-000000000001', 'Ana Viajante', 'avaliador@example.test',
  t89_d(-3), t89_d(-1), 400, 'checked_out', 'rota_das_pousadas'),
 (t89_booking(5), 'T89-AVALIADA', '10000000-0000-0000-0000-000000000001', t89_room(5), '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000891', '00000000-0000-0000-0000-000000000891', 'Ana Viajante', 'avaliador@example.test',
  t89_d(-3), t89_d(-1), 400, 'checked_out', 'rota_das_pousadas'),
 (t89_booking(6), 'T89-PEDIDA', '10000000-0000-0000-0000-000000000001', t89_room(6), '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000891', '00000000-0000-0000-0000-000000000891', 'Ana Viajante', 'avaliador@example.test',
  t89_d(-3), t89_d(-1), 400, 'checked_out', 'rota_das_pousadas'),
 (t89_booking(7), 'T89-FUTURA', '10000000-0000-0000-0000-000000000001', t89_room(7), '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000891', '00000000-0000-0000-0000-000000000891', 'Ana Viajante', 'avaliador@example.test',
  t89_d(1), t89_d(3), 400, 'confirmed', 'rota_das_pousadas'),
 (t89_booking(8), 'T89-CANCELADA', '10000000-0000-0000-0000-000000000001', t89_room(8), '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000891', '00000000-0000-0000-0000-000000000891', 'Ana Viajante', 'avaliador@example.test',
  t89_d(-3), t89_d(-1), 400, 'cancelled', 'rota_das_pousadas'),
 (t89_booking(9), 'T89-ANTIGA', '10000000-0000-0000-0000-000000000001', t89_room(9), '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000891', '00000000-0000-0000-0000-000000000891', 'Ana Viajante', 'avaliador@example.test',
  t89_d(-12), t89_d(-10), 400, 'checked_out', 'rota_das_pousadas'),
 (t89_booking(10), 'T89-SEM-EMAIL', '10000000-0000-0000-0000-000000000001', t89_room(10), '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000891', '00000000-0000-0000-0000-000000000891', 'Ana Viajante', null,
  t89_d(-3), t89_d(-1), 400, 'checked_out', 'rota_das_pousadas'),
 (t89_booking(11), 'T89-DONO', '10000000-0000-0000-0000-000000000001', t89_room(11), '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Dono A', 'owner-a@example.test',
  t89_d(-3), t89_d(-1), 400, 'checked_out', 'rota_das_pousadas'),
 (t89_booking(12), 'T89-HOJE', '10000000-0000-0000-0000-000000000001', t89_room(12), '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000891', '00000000-0000-0000-0000-000000000891', 'Ana Viajante', 'avaliador@example.test',
  t89_d(-2), t89_d(0), 400, 'checked_in', 'rota_das_pousadas'),
 (t89_booking(13), 'T89-OTA', '10000000-0000-0000-0000-000000000001', t89_room(13), '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000891', '00000000-0000-0000-0000-000000000891', 'Ana Viajante', 'avaliador@example.test',
  t89_d(-3), t89_d(-1), 400, 'checked_out', 'airbnb'),
 -- Lembretes (estadias mais antigas, pedido já enviado)
 (t89_booking(14), 'T89-LEMBRAR', '10000000-0000-0000-0000-000000000001', t89_room(14), '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000892', '00000000-0000-0000-0000-000000000892', 'Bruno', 'outro-avaliador@example.test',
  t89_d(-7), t89_d(-5), 400, 'checked_out', 'rota_das_pousadas'),
 (t89_booking(15), 'T89-CEDO', '10000000-0000-0000-0000-000000000001', t89_room(15), '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000892', '00000000-0000-0000-0000-000000000892', 'Bruno', 'outro-avaliador@example.test',
  t89_d(-4), t89_d(-2), 400, 'checked_out', 'rota_das_pousadas'),
 (t89_booking(16), 'T89-LEMBRADA', '10000000-0000-0000-0000-000000000001', t89_room(16), '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000892', '00000000-0000-0000-0000-000000000892', 'Bruno', 'outro-avaliador@example.test',
  t89_d(-7), t89_d(-5), 400, 'checked_out', 'rota_das_pousadas'),
 (t89_booking(17), 'T89-LEMBRAR-AVALIADA', '10000000-0000-0000-0000-000000000001', t89_room(17), '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000892', '00000000-0000-0000-0000-000000000892', 'Bruno', 'outro-avaliador@example.test',
  t89_d(-7), t89_d(-5), 400, 'checked_out', 'rota_das_pousadas');

update bookings set review_requested_at = now() - interval '1 day' where id = t89_booking(6);
update bookings set review_requested_at = now() - interval '4 days' where id in (t89_booking(14), t89_booking(16), t89_booking(17));
update bookings set review_requested_at = now() - interval '1 day' where id = t89_booking(15);
update bookings set review_reminded_at = now() - interval '1 hour' where id = t89_booking(16);
insert into reviews(pousada_id, booking_id, author_id, rating, text) values
 ('10000000-0000-0000-0000-000000000001', t89_booking(5), '00000000-0000-0000-0000-000000000891', 4, 'já avaliada'),
 ('10000000-0000-0000-0000-000000000001', t89_booking(17), '00000000-0000-0000-0000-000000000892', 5, 'avaliou antes do lembrete');

-- ---------------------------------------------------------------------------
-- Permissões: só service_role executa as RPCs do cron.
-- ---------------------------------------------------------------------------
select test_assert(not has_function_privilege(r, f, 'EXECUTE'), format('%s não executa %s', r, f))
from unnest(array['anon', 'authenticated']) r,
     unnest(array['list_review_requests_due(integer)', 'mark_review_request_sent(uuid)',
                  'list_review_reminders_due(integer)', 'mark_review_reminder_sent(uuid)',
                  'booking_review_request_eligible(uuid)']) f;
select test_assert(has_function_privilege('service_role', f, 'EXECUTE'), format('service_role executa %s', f))
from unnest(array['list_review_requests_due(integer)', 'mark_review_request_sent(uuid)',
                  'list_review_reminders_due(integer)', 'mark_review_reminder_sent(uuid)']) f;
select test_assert(not has_function_privilege('service_role', 'booking_review_request_eligible(uuid)', 'EXECUTE'),
  'helper de elegibilidade não é RPC');

set role anon;
do $$ begin
  begin
    perform * from list_review_requests_due(50);
    raise exception 'TEST: anônimo listou pedidos de avaliação';
  exception when insufficient_privilege then null;
  end;
  begin
    perform mark_review_request_sent('30000000-0000-0000-0000-000000008901');
    raise exception 'TEST: anônimo marcou pedido de avaliação';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000891', false);
do $$ begin
  begin
    perform * from list_review_reminders_due(50);
    raise exception 'TEST: usuário logado listou lembretes de avaliação';
  exception when insufficient_privilege then null;
  end;
  begin
    perform mark_review_reminder_sent('30000000-0000-0000-0000-000000008914');
    raise exception 'TEST: usuário logado silenciou o lembrete';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ---------------------------------------------------------------------------
-- Listagem do pedido: só as reservas elegíveis, com o mínimo para o e-mail.
-- ---------------------------------------------------------------------------
set role service_role;
create temp table t89_due as select * from list_review_requests_due(50);
select test_assert((select array_agg(code order by code) from t89_due) = array['T89-BIO', 'T89-SITE'],
  'pedido só para reservas pelo site/bio, encerradas há 1-3 dias, sem avaliação, sem pedido e com e-mail: '
  || coalesce((select string_agg(code, ',' order by code) from t89_due), '(nenhuma)'));
select test_assert((select guest_email from t89_due where code = 'T89-BIO') = 'avaliador@example.test',
  'e-mail sai sem espaços');
select test_assert((select guest_name = 'Ana Viajante' and pousada_name = 'Pousada A' and booking_id = t89_booking(1)
                    from t89_due where code = 'T89-SITE'), 'devolve nome, pousada e id');
select test_assert((select count(*) from list_review_requests_due(1)) = 1, 'respeita o limite por rodada');

-- Marcar: funciona e é idempotente.
select test_assert(mark_review_request_sent(t89_booking(1)), 'marca o pedido enviado');
select test_assert(not mark_review_request_sent(t89_booking(1)), 'marcar de novo não muda nada');
select test_assert(not mark_review_request_sent('30000000-0000-0000-0000-0000000089ff'), 'reserva inexistente não quebra');
reset role;
select test_assert((select review_requested_at is not null from bookings where id = t89_booking(1)), 'review_requested_at gravado');
select test_assert((select count(*) from audit_log where target_id = t89_booking(1) and action = 'review.requested') = 1,
  'auditoria gravada uma vez, sem dado pessoal');
select test_assert((select metadata from audit_log where target_id = t89_booking(1) and action = 'review.requested') = '{"kind": "pedido"}'::jsonb,
  'metadata da auditoria sem dado pessoal');
set role service_role;
select test_assert(not exists (select 1 from list_review_requests_due(50) where code = 'T89-SITE'),
  'reserva marcada sai da lista');

-- ---------------------------------------------------------------------------
-- Lembrete: 3 dias depois do pedido, sem avaliação, uma vez só.
-- ---------------------------------------------------------------------------
create temp table t89_rem as select * from list_review_reminders_due(50);
select test_assert((select array_agg(code order by code) from t89_rem) = array['T89-LEMBRAR'],
  'lembrete só para pedido de 3+ dias sem avaliação nem lembrete: '
  || coalesce((select string_agg(code, ',' order by code) from t89_rem), '(nenhuma)'));
select test_assert(not mark_review_reminder_sent(t89_booking(2)), 'sem pedido enviado não marca lembrete');
select test_assert(mark_review_reminder_sent(t89_booking(14)), 'marca o lembrete');
select test_assert(not mark_review_reminder_sent(t89_booking(14)), 'lembrete marcado de novo não muda nada');
select test_assert(not exists (select 1 from list_review_reminders_due(50)), 'lembrete marcado sai da lista');
reset role;

-- ---------------------------------------------------------------------------
-- A avaliação feita pelo link do e-mail recalcula a nota da pousada (0078).
-- ---------------------------------------------------------------------------
create temp table t89_before as select rating, reviews from pousadas where id = '10000000-0000-0000-0000-000000000001';
grant select on t89_before to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000891', false);
select test_assert(auth_can_review_booking(t89_booking(2), '10000000-0000-0000-0000-000000000001'),
  'quem recebeu o pedido consegue avaliar (mesma regra da 0084)');
select test_assert(not auth_can_review_booking(t89_booking(3), '10000000-0000-0000-0000-000000000001'),
  'reserva de balcão continua sem avaliação');
insert into reviews(pousada_id, booking_id, author_id, rating, text) values
 ('10000000-0000-0000-0000-000000000001', t89_booking(2), '00000000-0000-0000-0000-000000000891', 5, '');
reset role;
select set_config('request.jwt.claim.sub', '', false);
select test_assert((select p.reviews = b.reviews + 1 from pousadas p, t89_before b
                    where p.id = '10000000-0000-0000-0000-000000000001'), 'contagem de avaliações sobe');
select test_assert((select p.rating = (select round(avg(rating)::numeric, 1) from reviews where pousada_id = p.id)
                    from pousadas p where p.id = '10000000-0000-0000-0000-000000000001'), 'nota recalculada');
set role anon;
select test_assert(exists (select 1 from reviews where pousada_id = '10000000-0000-0000-0000-000000000001' and rating = 5 and text = ''),
  'avaliação nova aparece na leitura pública da vitrine');
reset role;
set role service_role;
select test_assert(not exists (select 1 from list_review_requests_due(50) where code = 'T89-BIO'),
  'quem já avaliou não recebe pedido');
reset role;

drop function t89_d(integer);
drop function t89_room(integer);
drop function t89_booking(integer);
