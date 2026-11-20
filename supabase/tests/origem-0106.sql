-- 0106 — Origem das reservas feitas pelo site. Dados sintéticos.
-- Pousada O (…010601) com dono e recepção; viajante V; pousada P de outro dono.
-- Master …009 vem de priorities.sql.

-- Regra do canal
select test_assert(booking_channel('google', 'cpc', null, null) = 'google_ads', 'google/cpc = anúncio');
select test_assert(booking_channel(null, null, 'www.google.com', 'gclid') = 'google_ads', 'gclid = anúncio');
select test_assert(booking_channel('Google', 'Perfil', null, null) = 'perfil_google', 'perfil da pousada no Google');
select test_assert(booking_channel(null, null, 'www.google.com.br', null) = 'google', 'busca do Google sem UTM');
select test_assert(booking_channel('instagram', 'bio', null, null) = 'instagram', 'instagram com UTM');
select test_assert(booking_channel(null, null, 'l.instagram.com', null) = 'instagram', 'instagram pelo site de origem');
select test_assert(booking_channel(null, null, 'm.facebook.com', null) = 'facebook', 'facebook');
select test_assert(booking_channel(null, null, null, 'fbclid') = 'facebook', 'clique de anúncio da Meta');
select test_assert(booking_channel('whatsapp', 'mensagem', null, null) = 'whatsapp', 'whatsapp');
select test_assert(booking_channel(null, null, null, null) = 'direto', 'sem origem = direto');
select test_assert(booking_channel(null, null, 'blog.example.test', null) = 'outro', 'outro site');
select test_assert(booking_channel('newsletter', 'email', null, null) = 'outro', 'UTM desconhecido');
select test_assert(booking_channel(null, null, 'notgoogle.example.test', null) = 'outro', 'domínio parecido não conta como Google');

select test_assert(not has_function_privilege('anon', 'public.record_booking_attribution(uuid, text, text, text, text, text, text, text, text, timestamptz)', 'EXECUTE'), 'anon não grava origem');
select test_assert(not has_table_privilege('authenticated', 'public.booking_attribution', 'INSERT'), 'API não insere direto');
select test_assert(not has_table_privilege('authenticated', 'public.booking_attribution', 'UPDATE'), 'API não altera');

insert into auth.users(id, email) values
 ('00000000-0000-0000-0000-000000010601', 'dono-o@example.test'),
 ('00000000-0000-0000-0000-000000010602', 'recepcao-o@example.test'),
 ('00000000-0000-0000-0000-000000010603', 'viajante-o@example.test'),
 ('00000000-0000-0000-0000-000000010604', 'dono-p@example.test');
insert into pousadas(id, slug, name, city, state, status, tenant_status, owner_id, price_per_night) values
 ('10000000-0000-0000-0000-000000010601', 'pousada-origem-o', 'Pousada Origem O', 'Tiradentes', 'MG',
  'em_analise', 'onboarding', '00000000-0000-0000-0000-000000010601', 300),
 ('10000000-0000-0000-0000-000000010602', 'pousada-origem-p', 'Pousada Origem P', 'Tiradentes', 'MG',
  'em_analise', 'onboarding', '00000000-0000-0000-0000-000000010604', 300);
insert into memberships(user_id, pousada_id, role, status) values
 ('00000000-0000-0000-0000-000000010601', '10000000-0000-0000-0000-000000010601', 'proprietario', 'active'),
 ('00000000-0000-0000-0000-000000010602', '10000000-0000-0000-0000-000000010601', 'recepcionista', 'active'),
 ('00000000-0000-0000-0000-000000010604', '10000000-0000-0000-0000-000000010602', 'proprietario', 'active');
insert into rooms(id, pousada_id, name, capacity, capacity_max, base_price, status, public_visible, operational_status) values
 ('20000000-0000-0000-0000-000000010601', '10000000-0000-0000-0000-000000010601', 'Quarto O', 2, 2, 300, 'active', true, 'available');
insert into guests(id, pousada_id, user_id, full_name, email, source, created_by) values
 ('40000000-0000-0000-0000-000000010601', '10000000-0000-0000-0000-000000010601',
  '00000000-0000-0000-0000-000000010603', 'Viajante O', 'viajante-o@example.test', 'public_booking', '00000000-0000-0000-0000-000000010603');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000010603', false);
insert into bookings(id, code, pousada_id, room_id, guest_id, responsible_guest_id, guest_name, guest_email,
                     checkin, checkout, total, status, origin, created_by, created_at) values
 ('30000000-0000-0000-0000-000000010601', 'ORG-1', '10000000-0000-0000-0000-000000010601', '20000000-0000-0000-0000-000000010601',
  '00000000-0000-0000-0000-000000010603', '40000000-0000-0000-0000-000000010601', 'Viajante O', 'viajante-o@example.test',
  '2099-03-10', '2099-03-12', 600, 'pending', 'rota_das_pousadas', '00000000-0000-0000-0000-000000010603', now()),
 ('30000000-0000-0000-0000-000000010602', 'ORG-2', '10000000-0000-0000-0000-000000010601', '20000000-0000-0000-0000-000000010601',
  '00000000-0000-0000-0000-000000010603', '40000000-0000-0000-0000-000000010601', 'Viajante O', 'viajante-o@example.test',
  '2099-04-10', '2099-04-12', 900, 'pending', 'link_bio', '00000000-0000-0000-0000-000000010603', now()),
 ('30000000-0000-0000-0000-000000010603', 'ORG-3', '10000000-0000-0000-0000-000000010601', '20000000-0000-0000-0000-000000010601',
  '00000000-0000-0000-0000-000000010603', '40000000-0000-0000-0000-000000010601', 'Viajante O', 'viajante-o@example.test',
  '2099-05-10', '2099-05-12', 500, 'pending', 'rota_das_pousadas', '00000000-0000-0000-0000-000000010603', now() - interval '3 hours');

-- Viajante grava a origem das próprias reservas.
set role authenticated;
select test_assert(record_booking_attribution('30000000-0000-0000-0000-000000010601', 'google', 'perfil', 'pousada-origem-o',
  null, null, 'www.google.com', '/pousada/pousada-origem-o', null, now() - interval '1 day') = 'perfil_google',
  'grava e devolve o canal');
select test_assert(record_booking_attribution('30000000-0000-0000-0000-000000010602', null, null, null,
  null, null, 'l.instagram.com', '/pousada-origem-o', 'xyz', null) = 'instagram',
  'click_id desconhecido é descartado; canal pelo site de origem');
-- Segunda gravação não muda a primeira.
select test_assert(record_booking_attribution('30000000-0000-0000-0000-000000010601', 'facebook', 'cpc', null,
  null, null, null, null, 'fbclid', null) = 'perfil_google', 'origem gravada não muda');
do $$ begin
  begin
    perform record_booking_attribution('30000000-0000-0000-0000-000000010603', 'google', null, null, null, null, null, null, null, null);
    raise exception 'FALHOU: gravou origem de reserva antiga';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;
reset role;

-- Outra pessoa não grava a origem da reserva do viajante.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000010601', false);
set role authenticated;
do $$ begin
  begin
    perform record_booking_attribution('30000000-0000-0000-0000-000000010603', 'google', null, null, null, null, null, null, null, null);
    raise exception 'FALHOU: dono gravou origem da reserva do viajante';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;

-- A pousada lê a origem das próprias reservas; outra pousada, não.
select test_assert((select count(*) from booking_attribution where pousada_id = '10000000-0000-0000-0000-000000010601') = 2,
  'dono lê a origem das reservas da pousada');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000010602', false);
select test_assert((select utm_campaign from booking_attribution where booking_id = '30000000-0000-0000-0000-000000010601') = 'pousada-origem-o',
  'recepção lê a origem');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000010604', false);
select test_assert((select count(*) from booking_attribution) = 0, 'outra pousada não lê');
do $$ begin
  begin
    perform list_platform_booking_channels(null);
    raise exception 'FALHOU: dono de pousada leu o relatório da plataforma';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;
reset role;

-- Pagamento confirmado conta como paga no relatório.
update bookings set status = 'confirmed' where id = '30000000-0000-0000-0000-000000010601';

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000009', false);
set role authenticated;
select test_assert((select (c->>'created')::int = 1 and (c->>'paid')::int = 1 and (c->>'paidTotal')::numeric = 600
                    from jsonb_array_elements(list_platform_booking_channels(null)->'channels') c
                    where c->>'channel' = 'perfil_google'), 'perfil do Google: 1 criada, 1 paga, R$ 600');
select test_assert((select (c->>'created')::int = 1 and (c->>'paid')::int = 0
                    from jsonb_array_elements(list_platform_booking_channels(null)->'channels') c
                    where c->>'channel' = 'instagram'), 'instagram: 1 criada, nenhuma paga');
select test_assert((select (c->>'created')::int >= 1
                    from jsonb_array_elements(list_platform_booking_channels(null)->'channels') c
                    where c->>'channel' = 'sem_registro'), 'reserva sem origem gravada aparece como sem registro');
reset role;
