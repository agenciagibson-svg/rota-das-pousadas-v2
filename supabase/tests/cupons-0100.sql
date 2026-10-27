-- 0100: cupom e vantagem para quem reserva direto.
--
-- Dados próprios (ids c0100000-...), sem depender de outros testes além das
-- funções test_assert/test_invisible de priorities.sql. Datas em 2096 (nenhuma
-- regra de tarifa de outros testes cai nelas).
-- Contas: ...001 dono  ...002 gestor  ...003 recepção  ...009 financeiro
--         ...004/005/006/008 viajantes  ...007 dono de OUTRA pousada
-- Pousadas: ...100 (Pousada Cupom)  ...200 (outra)
-- Acomodações: ...101 Chalé (R$ 500)  ...102 Suíte (R$ 300)  ...103 Quarto (R$ 200)  ...201 (outra)

\set P  'c0100000-0000-0000-0000-000000000100'
\set P2 'c0100000-0000-0000-0000-000000000200'
\set R1 'c0100000-0000-0000-0000-000000000101'
\set R2 'c0100000-0000-0000-0000-000000000102'
\set R3 'c0100000-0000-0000-0000-000000000103'
\set R4 'c0100000-0000-0000-0000-000000000201'
\set GA 'c0100000-0000-0000-0000-000000000404'
\set GB 'c0100000-0000-0000-0000-000000000405'
\set GC 'c0100000-0000-0000-0000-000000000406'
\set GD 'c0100000-0000-0000-0000-000000000408'
\set COMO_POSTGRES 'reset role; set request.jwt.claim.sub = '''';'
\set COMO_DONO 'set role authenticated; set request.jwt.claim.sub = ''c0100000-0000-0000-0000-000000000001'';'
\set COMO_GESTOR 'set role authenticated; set request.jwt.claim.sub = ''c0100000-0000-0000-0000-000000000002'';'
\set COMO_RECEPCAO 'set role authenticated; set request.jwt.claim.sub = ''c0100000-0000-0000-0000-000000000003'';'
\set COMO_FINANCEIRO 'set role authenticated; set request.jwt.claim.sub = ''c0100000-0000-0000-0000-000000000009'';'
\set COMO_A 'set role authenticated; set request.jwt.claim.sub = ''c0100000-0000-0000-0000-000000000004'';'
\set COMO_B 'set role authenticated; set request.jwt.claim.sub = ''c0100000-0000-0000-0000-000000000005'';'
\set COMO_C 'set role authenticated; set request.jwt.claim.sub = ''c0100000-0000-0000-0000-000000000006'';'
\set COMO_D 'set role authenticated; set request.jwt.claim.sub = ''c0100000-0000-0000-0000-000000000008'';'
\set COMO_OUTRO_DONO 'set role authenticated; set request.jwt.claim.sub = ''c0100000-0000-0000-0000-000000000007'';'
\set COMO_ANON 'set role anon; set request.jwt.claim.sub = '''';'

-- Executa `q` com os privilégios de quem chamou e DESFAZ tudo: 'ok' ou a
-- mensagem do erro (com SQLSTATE quando não é `raise exception`).
create function c100_try(q text) returns text language plpgsql as $$
begin
  execute q;
  raise exception 'C100_PROBE_OK';
exception when others then
  if sqlerrm = 'C100_PROBE_OK' then return 'ok'; end if;
  if sqlstate = 'P0001' then return sqlerrm; end if;
  return sqlstate || ' ' || sqlerrm;
end $$;
create function c100_rows(q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute q;
  get diagnostics n = row_count;
  raise exception 'C100_ROWS:%', n;
exception when others then
  if sqlerrm like 'C100_ROWS:%' then return split_part(sqlerrm, ':', 2)::bigint; end if;
  if sqlstate = '42501' then return 0; end if;
  raise;
end $$;
-- Cotação do banco (a RPC interna não é da API; o app recebe o valor pronto
-- por list_bookable_rooms).
create function c100_quote(p_room uuid, p_in date, p_out date) returns integer
language sql security definer set search_path = public as $$
  select total from room_stay_quote(p_room, p_in, p_out);
$$;
-- Reserva pelo site com cupom, como o app chama (subtotal = cotação do banco).
create function c100_book(p_room uuid, p_guest uuid, p_in date, p_out date, p_code text,
                          p_expected integer default null)
returns jsonb language sql as $$
  select create_booking_with_coupon(
    p_pousada_id => 'c0100000-0000-0000-0000-000000000100',
    p_room_id => p_room, p_responsible_guest_id => p_guest,
    p_checkin => p_in, p_checkout => p_out, p_adults => 1,
    p_subtotal => c100_quote(p_room, p_in, p_out),
    p_coupon_code => p_code, p_origin => 'link_bio', p_expected_discount => p_expected);
$$;
grant execute on function c100_try(text), c100_rows(text) to anon, authenticated;
grant execute on function c100_book(uuid, uuid, date, date, text, integer), c100_quote(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Cadastro
-- ---------------------------------------------------------------------------
insert into auth.users(id, email) values
 ('c0100000-0000-0000-0000-000000000001', 'dono-c100@example.test'),
 ('c0100000-0000-0000-0000-000000000002', 'gestor-c100@example.test'),
 ('c0100000-0000-0000-0000-000000000003', 'recepcao-c100@example.test'),
 ('c0100000-0000-0000-0000-000000000004', 'viajante-a-c100@example.test'),
 ('c0100000-0000-0000-0000-000000000005', 'viajante-b-c100@example.test'),
 ('c0100000-0000-0000-0000-000000000006', 'viajante-c-c100@example.test'),
 ('c0100000-0000-0000-0000-000000000007', 'outro-dono-c100@example.test'),
 ('c0100000-0000-0000-0000-000000000008', 'viajante-d-c100@example.test'),
 ('c0100000-0000-0000-0000-000000000009', 'financeiro-c100@example.test');
insert into pousadas(id, slug, name, city, state, status, tenant_status, owner_id, price_per_night, timezone) values
 (:'P',  'pousada-cupom', 'Pousada Cupom', 'Tiradentes', 'MG', 'publicada', 'active', 'c0100000-0000-0000-0000-000000000001', 500, 'America/Sao_Paulo'),
 (:'P2', 'pousada-outra-cupom', 'Outra Cupom', 'Ouro Preto', 'MG', 'publicada', 'active', 'c0100000-0000-0000-0000-000000000007', 400, 'America/Sao_Paulo');
insert into memberships(user_id, pousada_id, role, status) values
 ('c0100000-0000-0000-0000-000000000001', :'P', 'proprietario', 'active'),
 ('c0100000-0000-0000-0000-000000000002', :'P', 'admin_pousada', 'active'),
 ('c0100000-0000-0000-0000-000000000003', :'P', 'recepcionista', 'active'),
 ('c0100000-0000-0000-0000-000000000009', :'P', 'financeiro_pousada', 'active'),
 ('c0100000-0000-0000-0000-000000000007', :'P2', 'proprietario', 'active');
insert into rooms(id, pousada_id, name, capacity, capacity_max, base_price, status, public_visible, operational_status) values
 (:'R1', :'P', 'Chalé', 4, 4, 500, 'active', true, 'available'),
 (:'R2', :'P', 'Suíte', 2, 2, 300, 'active', true, 'available'),
 (:'R3', :'P', 'Quarto', 2, 2, 200, 'active', true, 'available'),
 (:'R4', :'P2', 'Outra', 2, 2, 400, 'active', true, 'available');
-- Fichas dos viajantes nesta pousada (o app cria com ensure_traveler_guest).
insert into guests(id, pousada_id, full_name, user_id) values
 (:'GA', :'P', 'Viajante A', 'c0100000-0000-0000-0000-000000000004'),
 (:'GB', :'P', 'Viajante B', 'c0100000-0000-0000-0000-000000000005'),
 (:'GC', :'P', 'Viajante C', 'c0100000-0000-0000-0000-000000000006'),
 (:'GD', :'P', 'Viajante D', 'c0100000-0000-0000-0000-000000000008');

-- ---------------------------------------------------------------------------
-- Cálculo puro (mesma conta de features/cupons/discount.ts)
-- ---------------------------------------------------------------------------
select test_assert(coupon_discount('percent', 10, 1000) = 100, '10% de 1000');
select test_assert(coupon_discount('percent', 15, 333) = 50, '15% de 333 = 49,95 → 50 (meio real sobe)');
select test_assert(coupon_discount('percent', 10, 5) = 1, '10% de 5 = 0,5 → 1');
select test_assert(coupon_discount('percent', 10, 4) = 0, '10% de 4 = 0,4 → 0');
select test_assert(coupon_discount('fixed', 1000, 300) = 300, 'valor fixo nunca passa do subtotal');
select test_assert(coupon_discount('percent', 90, 0) = 0, 'subtotal zero → desconto zero');

-- ---------------------------------------------------------------------------
-- Permissões de quem não deveria
-- ---------------------------------------------------------------------------
:COMO_ANON
select test_invisible('select count(*) from pousada_coupons');
select test_invisible('select count(*) from booking_coupon_redemptions');
select test_invisible('select count(*) from coupon_attempts');
select test_assert(not has_function_privilege('anon', 'create_pousada_coupon(uuid,text,text,integer,date,date,date,date,integer,integer)', 'EXECUTE'), 'anon não cria cupom');
select test_assert(not has_function_privilege('anon', 'preview_booking_coupon(uuid,date,date,text)', 'EXECUTE'), 'anon não testa cupom');
select test_assert(not has_function_privilege('anon', 'create_booking_with_coupon(uuid,uuid,uuid,date,date,integer,integer,text,booking_origin,text,integer,integer,integer,boolean)', 'EXECUTE'), 'anon não reserva com cupom');
select test_assert(has_function_privilege('anon', 'get_featured_coupon(text)', 'EXECUTE'), 'anon lê o cupom divulgado');
:COMO_POSTGRES
select test_assert(not has_function_privilege('authenticated', 'coupon_evaluate(uuid,text,date,date,integer,uuid,boolean)', 'EXECUTE'), 'API não chama a avaliação interna');
select test_assert(not has_function_privilege('authenticated', 'coupon_take_attempt(uuid,uuid)', 'EXECUTE'), 'API não mexe nas tentativas');
select test_assert(not has_function_privilege('authenticated', 'coupon_discount(text,integer,integer)', 'EXECUTE'), 'API não chama o cálculo interno');
select test_assert(not has_function_privilege('authenticated', 'coupon_public_room_pousada(uuid)', 'EXECUTE'), 'API não chama o filtro interno');
select test_assert(not has_table_privilege('authenticated', 'pousada_coupons', 'INSERT'), 'sem INSERT direto em cupons');
select test_assert(not has_table_privilege('authenticated', 'booking_coupon_redemptions', 'INSERT'), 'sem INSERT direto em usos');

-- ---------------------------------------------------------------------------
-- Dono e gestor criam; recepção, financeiro e outra pousada não
-- ---------------------------------------------------------------------------
:COMO_DONO
select set_config('c100.direto', create_pousada_coupon(:'P', ' direto10 ', 'percent', 10)::text, false);
select set_config('c100.fixo', create_pousada_coupon(:'P', 'FIXO50', 'fixed', 50, p_max_uses => 1)::text, false);
select set_config('c100.min3', create_pousada_coupon(:'P', 'MIN3', 'percent', 20, p_min_nights => 3)::text, false);
select set_config('c100.verao', create_pousada_coupon(:'P', 'VERAO', 'percent', 15, p_stay_from => '2096-01-01', p_stay_until => '2096-02-01')::text, false);
select set_config('c100.futuro', create_pousada_coupon(:'P', 'FUTURO', 'percent', 5, p_valid_from => current_date + 10)::text, false);
select set_config('c100.pausado', create_pousada_coupon(:'P', 'PAUSADO', 'percent', 5)::text, false);
select set_config('c100.grande', create_pousada_coupon(:'P', 'GRANDE', 'fixed', 900)::text, false);
select set_config('c100.vence', create_pousada_coupon(:'P', 'VENCE', 'percent', 5, p_valid_until => current_date + 1)::text, false);
select set_pousada_coupon_active(current_setting('c100.pausado')::uuid, false);
select test_assert((select code from list_pousada_coupons(:'P') where id = current_setting('c100.direto')::uuid) = 'DIRETO10',
  'código guardado em maiúsculas e sem espaços');
select test_assert(c100_try($q$select create_pousada_coupon('c0100000-0000-0000-0000-000000000100', 'Direto10', 'percent', 5)$q$)
  = 'Já existe um cupom com este código nesta pousada.', 'código repetido sem diferenciar maiúsc./minúsc.');
select test_assert(c100_try($q$select create_pousada_coupon('c0100000-0000-0000-0000-000000000100', 'AB', 'percent', 5)$q$)
  like 'Use de 3 a 20 letras%', 'código curto recusado');
select test_assert(c100_try($q$select create_pousada_coupon('c0100000-0000-0000-0000-000000000100', 'COM ESPACO', 'percent', 5)$q$)
  like 'Use de 3 a 20 letras%', 'código com espaço recusado');
select test_assert(c100_try($q$select create_pousada_coupon('c0100000-0000-0000-0000-000000000100', 'NOVENTA5', 'percent', 95)$q$)
  = 'O desconto percentual vai de 1% a 90%.', 'percentual acima de 90 recusado');
select test_assert(c100_try($q$select create_pousada_coupon('c0100000-0000-0000-0000-000000000100', 'ZERO', 'fixed', 0)$q$)
  like 'Informe um desconto em reais%', 'valor fixo zero recusado');
select test_assert(c100_try($q$select create_pousada_coupon('c0100000-0000-0000-0000-000000000100', 'VENCIDO', 'percent', 5, p_valid_until => current_date - 1)$q$)
  = 'O fim da validade já passou.', 'validade no passado recusada');
-- Escrita direta pela API, ignorando a Server Action.
select test_assert(c100_try($q$insert into pousada_coupons(pousada_id, code, kind, value) values ('c0100000-0000-0000-0000-000000000100', 'DIRETO', 'percent', 90)$q$)
  like '42501 %', 'dono não insere cupom direto na tabela');

:COMO_GESTOR
select test_assert(create_pousada_coupon(:'P', 'GESTOR5', 'percent', 5) is not null, 'gestor cria cupom');
select test_assert((select count(*) from list_pousada_coupons('c0100000-0000-0000-0000-000000000100')) = 9, 'gestor lista os cupons');

:COMO_RECEPCAO
select test_assert(c100_try($q$select create_pousada_coupon('c0100000-0000-0000-0000-000000000100', 'RECEPCAO', 'percent', 5)$q$)
  = 'Você não tem permissão para gerenciar os cupons desta pousada.', 'recepção não cria cupom');
select test_assert(c100_try($q$select * from list_pousada_coupons('c0100000-0000-0000-0000-000000000100')$q$)
  = 'Você não tem permissão para ver os cupons desta pousada.', 'recepção não lista cupons');
select test_assert(c100_try(format('select set_pousada_coupon_active(%L, false)', current_setting('c100.direto')))
  = 'Cupom não encontrado.', 'recepção não pausa cupom');

:COMO_FINANCEIRO
select test_assert(c100_try($q$select create_pousada_coupon('c0100000-0000-0000-0000-000000000100', 'FINANCEIRO', 'percent', 5)$q$)
  = 'Você não tem permissão para gerenciar os cupons desta pousada.', 'financeiro não cria cupom');

:COMO_OUTRO_DONO
select test_assert(c100_try($q$select * from list_pousada_coupons('c0100000-0000-0000-0000-000000000100')$q$)
  = 'Você não tem permissão para ver os cupons desta pousada.', 'outra pousada não lista');
select test_assert(c100_try(format('select set_pousada_coupon_featured(%L, true)', current_setting('c100.direto')))
  = 'Cupom não encontrado.', 'outra pousada não divulga cupom alheio');
select test_assert(c100_try($q$select create_pousada_coupon('c0100000-0000-0000-0000-000000000100', 'INTRUSO', 'percent', 50)$q$)
  = 'Você não tem permissão para gerenciar os cupons desta pousada.', 'outra pousada não cria cupom aqui');

:COMO_A
select test_assert(c100_try($q$select create_pousada_coupon('c0100000-0000-0000-0000-000000000100', 'VIAJANTE', 'percent', 90)$q$)
  = 'Você não tem permissão para gerenciar os cupons desta pousada.', 'viajante não cria cupom');
select test_invisible('select count(*) from pousada_coupons');
:COMO_POSTGRES

select test_assert(exists(select 1 from audit_log where action = 'coupon.created'
  and target_id = current_setting('c100.direto')::uuid), 'criação vai para a auditoria');
select test_assert(exists(select 1 from audit_log where action = 'coupon.paused'
  and target_id = current_setting('c100.pausado')::uuid), 'pausa vai para a auditoria');

-- ---------------------------------------------------------------------------
-- Divulgação: um por pousada, só valendo hoje
-- ---------------------------------------------------------------------------
:COMO_DONO
select set_pousada_coupon_featured(current_setting('c100.direto')::uuid, true);
:COMO_ANON
select test_assert((select code from get_featured_coupon('pousada-cupom')) = 'DIRETO10', 'bio mostra o cupom divulgado');
select test_assert((select count(*) from get_featured_coupon('pousada-outra-cupom')) = 0, 'sem cupom divulgado, nada aparece');
:COMO_DONO
select set_pousada_coupon_featured(current_setting('c100.min3')::uuid, true);
select test_assert((select count(*) from list_pousada_coupons(:'P') where featured) = 1, 'divulgar outro desmarca o anterior');
select set_pousada_coupon_active(current_setting('c100.min3')::uuid, false);
select test_assert((select count(*) from list_pousada_coupons(:'P') where featured) = 0, 'pausar tira da divulgação');
select test_assert(c100_try(format('select set_pousada_coupon_featured(%L, true)', current_setting('c100.min3')))
  = 'Reative o cupom antes de divulgar.', 'cupom pausado não é divulgado');
select set_pousada_coupon_active(current_setting('c100.min3')::uuid, true);
select set_pousada_coupon_featured(current_setting('c100.futuro')::uuid, true);
:COMO_ANON
select test_assert((select count(*) from get_featured_coupon('pousada-cupom')) = 0, 'cupom fora do período de uso não aparece');
:COMO_DONO
select set_pousada_coupon_featured(current_setting('c100.direto')::uuid, true);
:COMO_POSTGRES

-- ---------------------------------------------------------------------------
-- Prévia do desconto (viajante logado)
-- ---------------------------------------------------------------------------
:COMO_A
-- Chalé R$ 500 × 2 noites = 1000.
select test_assert(preview_booking_coupon(:'R1', '2096-03-10', '2096-03-12', 'direto10')
  = '{"ok": true, "code": "DIRETO10", "kind": "percent", "value": 10, "subtotal": 1000, "discount": 100, "total": 900}'::jsonb,
  'prévia: 10% de 1000 = 100, total 900');
select test_assert(preview_booking_coupon(:'R1', '2096-03-10', '2096-03-12', 'NAOEXISTE') = '{"ok": false, "reason": "invalid"}'::jsonb, 'código inexistente: genérico');
select test_assert(preview_booking_coupon(:'R1', '2096-03-10', '2096-03-12', 'PAUSADO') = '{"ok": false, "reason": "invalid"}'::jsonb, 'pausado: mesma resposta');
select test_assert(preview_booking_coupon(:'R1', '2096-03-10', '2096-03-12', 'FUTURO') = '{"ok": false, "reason": "invalid"}'::jsonb, 'antes do período de uso: mesma resposta');
select test_assert(preview_booking_coupon(:'R1', '2096-03-10', '2096-03-12', 'MIN3')->>'reason' = 'min_nights', 'estadia mínima do cupom');
select test_assert((preview_booking_coupon(:'R1', '2096-03-10', '2096-03-13', 'MIN3')->>'discount')::int = 300, '3 noites: 20% de 1500');
select test_assert(preview_booking_coupon(:'R1', '2096-03-10', '2096-03-12', 'VERAO')->>'reason' = 'stay_period', 'só para estadias no período');
select test_assert((preview_booking_coupon(:'R1', '2096-01-10', '2096-01-12', 'VERAO')->>'discount')::int = 150, 'dentro do período vale');
select test_assert(preview_booking_coupon(:'R1', '2096-01-31', '2096-02-02', 'VERAO')->>'reason' = 'stay_period', 'saída depois do fim do período não vale');
select test_assert(preview_booking_coupon(:'R2', '2096-03-10', '2096-03-11', 'GRANDE')->>'reason' = 'min_value', 'valor fixo maior que a estadia não zera o total');
select test_assert(preview_booking_coupon(:'R4', '2096-03-10', '2096-03-12', 'DIRETO10') = '{"ok": false, "reason": "invalid"}'::jsonb, 'cupom de uma pousada não vale na outra');
select test_assert(c100_try($q$select preview_booking_coupon('c0100000-0000-0000-0000-000000000101', '2096-03-12', '2096-03-10', 'DIRETO10')$q$)
  = 'Escolha um período válido antes de aplicar o cupom.', 'datas invertidas');
:COMO_RECEPCAO
select test_assert(preview_booking_coupon(:'R1', '2096-03-10', '2096-03-12', 'DIRETO10') = '{"ok": false, "reason": "staff"}'::jsonb, 'equipe não usa cupom');
:COMO_POSTGRES
select test_assert((select count(*) from coupon_attempts where user_id = 'c0100000-0000-0000-0000-000000000004') = 4,
  'só código que não vale conta como tentativa errada (inexistente, pausado, futuro, outra pousada)');

-- ---------------------------------------------------------------------------
-- Reserva com cupom: desconto calculado no banco
-- ---------------------------------------------------------------------------
:COMO_A
select set_config('c100.a1', (c100_book(:'R1', :'GA', '2096-03-10', '2096-03-12', 'DIRETO10', 100)->>'id'), false);
:COMO_POSTGRES
select test_assert((select (subtotal, discount, total, balance_due, status::text)
  = (1000, 100, 900, 900::integer, 'pending') from bookings where id = current_setting('c100.a1')::uuid),
  'reserva grava desconto e total com desconto; saldo do Pix/Mercado Pago já vem com desconto');
select test_assert((select code from booking_coupon_redemptions where booking_id = current_setting('c100.a1')::uuid) = 'DIRETO10', 'uso registrado na reserva');
select test_assert(exists(select 1 from audit_log where action = 'coupon.redeemed' and target_id = current_setting('c100.a1')::uuid), 'uso vai para a auditoria');

:COMO_A
-- Uma vez por hóspede: outra acomodação e outras datas, mesmo cupom.
select test_assert(c100_book(:'R2', :'GA', '2096-05-10', '2096-05-12', 'DIRETO10') = '{"ok": false, "reason": "already_used"}'::jsonb,
  'mesmo hóspede não usa o cupom duas vezes');
select test_assert(preview_booking_coupon(:'R2', '2096-05-10', '2096-05-12', 'DIRETO10')->>'reason' = 'already_used', 'prévia avisa que já usou');
:COMO_POSTGRES
select test_assert((select count(*) from bookings where guest_id = 'c0100000-0000-0000-0000-000000000004') = 1,
  'cupom recusado não cria reserva');

-- O cliente não manda desconto: nem pela RPC antiga, nem pela tabela, nem pelo "esperado".
:COMO_B
select test_assert(c100_try($q$select create_booking('c0100000-0000-0000-0000-000000000100', 'c0100000-0000-0000-0000-000000000102',
  'c0100000-0000-0000-0000-000000000405', 'X', '2096-06-01', '2096-06-03', 1, 0, 0, false, 600, 0, 500, 0, 0, 100, 'pending',
  'rota_das_pousadas', 'c0100000-0000-0000-0000-000000000005')$q$)
  = 'O valor da reserva mudou. Volte à busca para revisar antes de reservar.', 'create_booking recusa desconto vindo do cliente');
select test_assert(c100_book(:'R1', :'GB', '2096-06-01', '2096-06-03', 'DIRETO10', 999)
  = '{"ok": false, "reason": "changed", "discount": 100}'::jsonb, 'desconto esperado diferente: não cria e avisa o valor certo');
select test_assert(c100_try($q$select create_booking_with_coupon('c0100000-0000-0000-0000-000000000100', 'c0100000-0000-0000-0000-000000000101',
  'c0100000-0000-0000-0000-000000000405', '2096-06-01', '2096-06-03', 1, 1, 'DIRETO10')$q$)
  = 'O valor da reserva mudou. Volte à busca para revisar antes de reservar.', 'subtotal falso do cliente é recusado');
select test_assert(c100_rows(format('update bookings set discount = 900, total = 100 where id = %L', current_setting('c100.a1'))) = 0,
  'viajante não altera desconto da reserva');
select test_assert(c100_try($q$insert into booking_coupon_redemptions(coupon_id, pousada_id, booking_id, user_id, code, discount)
  select id, pousada_id, gen_random_uuid(), 'c0100000-0000-0000-0000-000000000005', code, 1 from pousada_coupons limit 1$q$)
  like '42501 %', 'viajante não grava uso direto');
select test_assert(c100_try(format('select create_booking_with_coupon(%L, %L, %L, %L, %L, 1, 600, %L)',
  'c0100000-0000-0000-0000-000000000100', 'c0100000-0000-0000-0000-000000000102', 'c0100000-0000-0000-0000-000000000404',
  '2096-06-01', '2096-06-03', 'GESTOR5')) = 'Hóspede responsável inválido para esta reserva.', 'não reserva com a ficha de outro hóspede');
:COMO_DONO
select test_assert(c100_try($q$select create_booking_with_coupon('c0100000-0000-0000-0000-000000000100', 'c0100000-0000-0000-0000-000000000101',
  'c0100000-0000-0000-0000-000000000405', '2096-06-01', '2096-06-03', 1, 1000, 'DIRETO10')$q$)
  like 'Cupom vale só para reserva feita pelo hóspede no site.%', 'equipe não reserva com cupom');
:COMO_POSTGRES

-- ---------------------------------------------------------------------------
-- Limite total + expiração/cancelamento liberam o uso
-- ---------------------------------------------------------------------------
:COMO_B
-- Suíte R$ 300 × 1 noite; FIXO50 tem limite de 1 uso.
select set_config('c100.b1', (c100_book(:'R2', :'GB', '2096-04-01', '2096-04-02', 'FIXO50')->>'id'), false);
:COMO_POSTGRES
select test_assert((select (discount, total) = (50, 250) from bookings where id = current_setting('c100.b1')::uuid), 'valor fixo: 300 − 50');
:COMO_C
select test_assert(c100_book(:'R3', :'GC', '2096-04-01', '2096-04-02', 'FIXO50') = '{"ok": false, "reason": "invalid"}'::jsonb,
  'cupom esgotado: resposta genérica');
:COMO_DONO
select set_pousada_coupon_featured(current_setting('c100.fixo')::uuid, true);
:COMO_ANON
select test_assert((select count(*) from get_featured_coupon('pousada-cupom')) = 0, 'cupom esgotado some da bio');
:COMO_DONO
select test_assert((select uses from list_pousada_coupons(:'P') where id = current_setting('c100.fixo')::uuid) = 1, 'painel mostra quantas vezes foi usado');
select set_pousada_coupon_featured(current_setting('c100.direto')::uuid, true);
-- O prazo de pagamento da reserva de B vence e ela expira.
:COMO_POSTGRES
update bookings set payment_due_at = now() - interval '1 minute' where id = current_setting('c100.b1')::uuid;
:COMO_B
select expire_pending_booking(current_setting('c100.b1')::uuid);
:COMO_POSTGRES
select test_assert((select released_at is not null from booking_coupon_redemptions where booking_id = current_setting('c100.b1')::uuid),
  'reserva expirada devolve o uso');
select test_assert(exists(select 1 from audit_log where action = 'coupon.released' and target_id = current_setting('c100.b1')::uuid), 'devolução auditada');
:COMO_C
select test_assert((c100_book(:'R3', :'GC', '2096-04-01', '2096-04-02', 'FIXO50')->>'ok')::boolean, 'uso devolvido pode ser usado por outro hóspede');
-- A cancela a própria reserva pendente e pode usar o DIRETO10 de novo.
:COMO_A
select set_booking_status(current_setting('c100.a1')::uuid, 'cancelled', 'Mudança de planos');
select test_assert((c100_book(:'R2', :'GA', '2096-05-10', '2096-05-12', 'DIRETO10')->>'discount')::int = 60,
  'cancelada libera: hóspede usa de novo (10% de 600)');
:COMO_POSTGRES
select test_assert((select count(*) from booking_coupon_redemptions r join pousada_coupons c on c.id = r.coupon_id
  where c.code = 'DIRETO10' and r.user_id = 'c0100000-0000-0000-0000-000000000004' and r.released_at is null) = 1,
  'só um uso ativo por hóspede');

-- ---------------------------------------------------------------------------
-- Validade: cupom que venceu ontem deixa de valer
-- ---------------------------------------------------------------------------
:COMO_C
select test_assert((preview_booking_coupon(:'R1', '2096-07-01', '2096-07-03', 'VENCE')->>'ok')::boolean, 'dentro da validade vale');
:COMO_POSTGRES
update pousada_coupons set valid_until = current_date - 1 where id = current_setting('c100.vence')::uuid;
:COMO_C
select test_assert(preview_booking_coupon(:'R1', '2096-07-01', '2096-07-03', 'VENCE') = '{"ok": false, "reason": "invalid"}'::jsonb, 'vencido: genérico');
select test_assert(c100_book(:'R1', :'GC', '2096-07-01', '2096-07-03', 'VENCE') = '{"ok": false, "reason": "invalid"}'::jsonb, 'vencido não reserva');
-- Pausado na hora da reserva também não passa.
select test_assert(c100_book(:'R1', :'GC', '2096-07-01', '2096-07-03', 'PAUSADO') = '{"ok": false, "reason": "invalid"}'::jsonb, 'pausado não reserva');
:COMO_POSTGRES

-- ---------------------------------------------------------------------------
-- Freio contra tentativa em massa
-- ---------------------------------------------------------------------------
:COMO_D
select preview_booking_coupon(:'R1', '2096-08-01', '2096-08-03', 'CHUTE' || n) from generate_series(1, 10) n;
select test_assert(preview_booking_coupon(:'R1', '2096-08-01', '2096-08-03', 'DIRETO10') = '{"ok": false, "reason": "too_many_attempts"}'::jsonb,
  '10 códigos errados na hora bloqueiam até o código certo');
select test_assert(c100_book(:'R1', :'GD', '2096-08-01', '2096-08-03', 'DIRETO10') = '{"ok": false, "reason": "too_many_attempts"}'::jsonb,
  'bloqueio vale também na reserva');
:COMO_POSTGRES
update coupon_attempts set created_at = now() - interval '2 hours' where user_id = 'c0100000-0000-0000-0000-000000000008';
:COMO_D
select test_assert((preview_booking_coupon(:'R1', '2096-08-01', '2096-08-03', 'DIRETO10')->>'ok')::boolean, 'depois de 1 hora libera');
:COMO_POSTGRES

-- ---------------------------------------------------------------------------
-- Quem vê qual cupom a reserva usou (detalhe da reserva no painel)
-- ---------------------------------------------------------------------------
:COMO_RECEPCAO
select test_assert((select count(*) from booking_coupon_redemptions) >= 3, 'recepção vê o cupom no detalhe da reserva');
:COMO_FINANCEIRO
select test_assert((select count(*) from booking_coupon_redemptions) >= 3, 'financeiro vê o cupom no detalhe da reserva');
:COMO_OUTRO_DONO
select test_invisible('select count(*) from booking_coupon_redemptions');
:COMO_A
select test_invisible('select count(*) from booking_coupon_redemptions');
:COMO_POSTGRES

-- Total nunca negativo em nenhuma reserva com cupom.
select test_assert(not exists(select 1 from bookings b join booking_coupon_redemptions r on r.booking_id = b.id
  where b.total < 0 or b.discount > b.subtotal), 'total nunca negativo');

-- ---------------------------------------------------------------------------
-- Revisão de segurança de 26/10
-- ---------------------------------------------------------------------------
insert into auth.users(id, email) values
 ('c0100000-0000-0000-0000-00000000000a', 'viajante-g-c100@example.test'),
 ('c0100000-0000-0000-0000-00000000000b', 'viajante-h-c100@example.test');
insert into guests(id, pousada_id, full_name, user_id) values
 ('c0100000-0000-0000-0000-00000000040a', :'P', 'Viajante G', 'c0100000-0000-0000-0000-00000000000a'),
 ('c0100000-0000-0000-0000-00000000040b', :'P', 'Viajante H', 'c0100000-0000-0000-0000-00000000000b');
\set COMO_G 'set role authenticated; set request.jwt.claim.sub = ''c0100000-0000-0000-0000-00000000000a'';'
\set COMO_H 'set role authenticated; set request.jwt.claim.sub = ''c0100000-0000-0000-0000-00000000000b'';'

-- (1) Chamada em transação só de leitura (o PostgREST roda RPC por GET assim)
-- falha antes de dizer qualquer coisa sobre o código — nem o válido responde.
:COMO_G
begin;
set transaction read only;
do $$ begin
  begin
    perform preview_booking_coupon('c0100000-0000-0000-0000-000000000103', '2098-06-01', '2098-06-03', 'QUALQUERUM');
    raise exception 'TEST: prévia respondeu em transação só de leitura';
  exception when others then
    if sqlerrm like 'TEST:%' then raise; end if;
  end;
end $$;
rollback;
:COMO_POSTGRES
select test_assert(not exists(select 1 from coupon_attempts where user_id = 'c0100000-0000-0000-0000-00000000000a'),
  'nada gravado pela tentativa de leitura');

-- (4) Percentual deixa pelo menos R$ 1 de total.
select test_assert(coupon_discount('percent', 90, 5) = 4, '90% de 5 deixa R$ 1');
select test_assert(coupon_discount('percent', 90, 1) = 0, '90% de 1 não zera o total');

-- (3) Pendência vencida não segura o cupom.
:COMO_DONO
select set_config('c100.lim1', create_pousada_coupon(:'P', 'LIMITE1', 'percent', 10, p_max_uses => 1)::text, false);
:COMO_G
select test_assert((c100_book(:'R2', 'c0100000-0000-0000-0000-00000000040a', '2098-07-01', '2098-07-03', 'LIMITE1')->>'ok')::boolean,
  'G usa o cupom de 1 uso');
:COMO_H
select test_assert(preview_booking_coupon(:'R2', '2098-08-01', '2098-08-03', 'LIMITE1')->>'reason' = 'invalid',
  'esgotado enquanto a reserva de G está no prazo');
:COMO_POSTGRES
update bookings set payment_due_at = now() - interval '1 hour'
 where id = (select booking_id from booking_coupon_redemptions where coupon_id = current_setting('c100.lim1')::uuid);
:COMO_H
select test_assert((preview_booking_coupon(:'R2', '2098-08-01', '2098-08-03', 'LIMITE1')->>'ok')::boolean,
  'pendência vencida de G não segura o cupom');
select test_assert((c100_book(:'R2', 'c0100000-0000-0000-0000-00000000040b', '2098-08-01', '2098-08-03', 'LIMITE1')->>'ok')::boolean,
  'H consegue usar');
:COMO_POSTGRES
select test_assert((select b.status = 'cancelled' and r.released_at is not null
                    from booking_coupon_redemptions r join bookings b on b.id = r.booking_id
                    where r.coupon_id = current_setting('c100.lim1')::uuid
                      and r.user_id = 'c0100000-0000-0000-0000-00000000000a'),
  'a pendência vencida de G expirou e devolveu o uso');
select test_assert((select count(*) from booking_coupon_redemptions
                    where coupon_id = current_setting('c100.lim1')::uuid and released_at is null) = 1,
  'continua um uso só');

-- (8) Conta excluída (0090 zera guest_id): o uso perde o vínculo com a conta.
insert into coupon_attempts(user_id, pousada_id) values ('c0100000-0000-0000-0000-00000000000b', :'P');
update bookings set guest_id = null
 where id = (select booking_id from booking_coupon_redemptions
             where coupon_id = current_setting('c100.lim1')::uuid and released_at is null);
select test_assert((select user_id is null from booking_coupon_redemptions
                    where coupon_id = current_setting('c100.lim1')::uuid and released_at is null),
  'uso sem a conta depois da exclusão');
select test_assert(not exists(select 1 from coupon_attempts where user_id = 'c0100000-0000-0000-0000-00000000000b'),
  'tentativas da conta excluída somem');

-- (5) Tipo nulo recusado com mensagem.
:COMO_DONO
do $$ begin
  begin
    perform create_pousada_coupon('c0100000-0000-0000-0000-000000000100', 'SEMTIPO', null, 10);
    raise exception 'TEST: aceitou tipo nulo';
  exception when raise_exception then
    if sqlerrm <> 'Tipo de desconto inválido.' then raise; end if;
  end;
end $$;
:COMO_POSTGRES

-- ---------------------------------------------------------------------------
-- Preparação do teste de concorrência (supabase/tests/concurrent-coupon.sql,
-- rodado em duas sessões ao mesmo tempo pelo scripts/test-database.mjs).
-- ---------------------------------------------------------------------------
insert into auth.users(id, email) values
 ('c0100000-0000-0000-0000-00000000000e', 'viajante-e-c100@example.test'),
 ('c0100000-0000-0000-0000-00000000000f', 'viajante-f-c100@example.test');
insert into guests(id, pousada_id, full_name, user_id) values
 ('c0100000-0000-0000-0000-00000000040e', :'P', 'Viajante E', 'c0100000-0000-0000-0000-00000000000e'),
 ('c0100000-0000-0000-0000-00000000040f', :'P', 'Viajante F', 'c0100000-0000-0000-0000-00000000000f');
:COMO_DONO
select create_pousada_coupon(:'P', 'CORRIDA', 'percent', 10, p_max_uses => 1);
select create_pousada_coupon(:'P', 'UNICA', 'percent', 10);
:COMO_POSTGRES

drop function c100_book(uuid, uuid, date, date, text, integer);
drop function c100_quote(uuid, date, date);
drop function c100_rows(text);
drop function c100_try(text);
