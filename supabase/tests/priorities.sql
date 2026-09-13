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
