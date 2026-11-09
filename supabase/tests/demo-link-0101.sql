-- 0101 — Link de demonstração. Dados exclusivamente sintéticos.
-- Roda depois de priorities.sql: pousada A (…001, publicada, dono …001),
-- master …009, comercial …083, marketing …082.
-- Cria uma pousada em análise SEM dono, com uma acomodação visível, uma oculta
-- e uma inativa, e dados sensíveis para conferir que não vazam.

insert into pousadas(id, slug, name, city, state, status, tenant_status, price_per_night, tax_id, legal_name, notification_email) values
 ('10000000-0000-0000-0000-000000010101', 'pousada-demo-captacao', 'Pousada Demo Captação', 'Gonçalves', 'MG',
  'rascunho', 'onboarding', 350, '12345678000199', 'Razão Social Secreta Ltda', 'segredo@example.test');
insert into rooms(id, pousada_id, name, capacity, capacity_max, base_price, status, public_visible, operational_status, gallery) values
 ('20000000-0000-0000-0000-000000010101', '10000000-0000-0000-0000-000000010101', 'Chalé Visível', 2, 2, 480, 'active', true, 'available', array['https://example.test/chale.jpg']),
 ('20000000-0000-0000-0000-000000010102', '10000000-0000-0000-0000-000000010101', 'Quarto Oculto', 2, 2, 300, 'active', false, 'available', '{}'),
 ('20000000-0000-0000-0000-000000010103', '10000000-0000-0000-0000-000000010101', 'Quarto Inativo', 2, 2, 300, 'inactive', true, 'available', '{}');

-- ---------------------------------------------------------------------------
-- Tabela fechada: ninguém lê nem escreve direto
-- ---------------------------------------------------------------------------
select test_assert(not has_table_privilege('anon', 'public.pousada_demo_links', 'SELECT'), 'anon sem SELECT direto');
select test_assert(not has_table_privilege('authenticated', 'public.pousada_demo_links', 'SELECT'), 'authenticated sem SELECT direto');
select test_assert(not has_table_privilege('authenticated', 'public.pousada_demo_links', 'INSERT'), 'authenticated sem INSERT direto');
select test_assert(not has_function_privilege('anon', 'public.create_pousada_demo_link(uuid, boolean)', 'EXECUTE'), 'anon não gera link');
select test_assert(not has_function_privilege('anon', 'public.list_pousada_demo_links()', 'EXECUTE'), 'anon não lista links');

-- ---------------------------------------------------------------------------
-- Quem pode gerar: comercial e master. Dono de pousada e marketing não.
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
do $$ begin
  begin
    perform create_pousada_demo_link('10000000-0000-0000-0000-000000010101');
    raise exception 'FALHOU: dono de outra pousada gerou link de demonstração';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000082', false);
do $$ begin
  begin
    perform create_pousada_demo_link('10000000-0000-0000-0000-000000010101');
    raise exception 'FALHOU: marketing gerou link de demonstração';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
  begin
    perform list_pousada_demo_links();
    raise exception 'FALHOU: marketing listou os links';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;

-- Pousada publicada não ganha link (manda o endereço normal).
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000083', false);
do $$ begin
  begin
    perform create_pousada_demo_link('10000000-0000-0000-0000-000000000001');
    raise exception 'FALHOU: pousada publicada ganhou link de demonstração';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;

-- Comercial gera; pedir de novo devolve o MESMO token; renovar troca.
create temp table demo_tokens(label text, token text);
grant all on demo_tokens to authenticated, anon;
insert into demo_tokens values ('t1', create_pousada_demo_link('10000000-0000-0000-0000-000000010101'));
insert into demo_tokens values ('t1b', create_pousada_demo_link('10000000-0000-0000-0000-000000010101'));
select test_assert((select token from demo_tokens where label = 't1') ~ '^[A-Za-z0-9_-]{43}$', 'token com 43 caracteres de URL');
select test_assert((select token from demo_tokens where label = 't1') = (select token from demo_tokens where label = 't1b'), 'pedir de novo devolve o mesmo link');

-- ---------------------------------------------------------------------------
-- A página pública (anon)
-- ---------------------------------------------------------------------------
set role anon;
select set_config('request.jwt.claim.sub', '', false);
create temp table demo_result as select get_demo_pousada((select token from demo_tokens where label = 't1')) as r;
reset role;
select test_assert((select (r->>'published')::boolean = false from demo_result), 'demo não publicada');
select test_assert((select r->'pousada'->>'name' = 'Pousada Demo Captação' from demo_result), 'traz o nome');
select test_assert((select not (r->'pousada' ? 'tax_id') and not (r->'pousada' ? 'legal_name') and not (r->'pousada' ? 'notification_email') and not (r->'pousada' ? 'owner_id') from demo_result), 'nada de documento, razão social, e-mail ou dono');
select test_assert((select r::text not like '%Razão Social Secreta%' and r::text not like '%segredo@%' and r::text not like '%12345678000199%' from demo_result), 'dados sensíveis não aparecem em lugar nenhum');
select test_assert((select jsonb_array_length(r->'rooms') = 1 from demo_result), 'só a acomodação ativa e visível');
select test_assert((select r->'rooms'->0->>'name' = 'Chalé Visível' and (r->'rooms'->0->>'base_price')::int = 480 from demo_result), 'acomodação com preço');
select test_assert((select views = 1 and first_viewed_at is not null from pousada_demo_links where pousada_id = '10000000-0000-0000-0000-000000010101'), 'abertura contada');

-- Token errado, formato inválido e nulo: nada.
set role anon;
select test_assert(get_demo_pousada('x') is null, 'formato inválido');
select test_assert(get_demo_pousada(null) is null, 'token nulo');
select test_assert(get_demo_pousada(repeat('a', 43)) is null, 'token inexistente');
-- A pousada continua fora da reserva pública.
do $$ begin
  begin
    perform 1 from list_bookable_rooms('pousada-demo-captacao', null, null, 1);
    if found then raise exception 'FALHOU: pousada da demonstração apareceu como reservável'; end if;
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;
reset role;

-- Renovar troca o token e o antigo deixa de abrir; a contagem recomeça.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000009', false);
insert into demo_tokens values ('t2', create_pousada_demo_link('10000000-0000-0000-0000-000000010101', true));
reset role;
select test_assert((select token from demo_tokens where label = 't2') <> (select token from demo_tokens where label = 't1'), 'renovar troca o link');
select test_assert((select views = 0 from pousada_demo_links where pousada_id = '10000000-0000-0000-0000-000000010101'), 'contagem recomeça no link novo');
set role anon;
select test_assert(get_demo_pousada((select token from demo_tokens where label = 't1')) is null, 'link antigo não abre mais');
select test_assert(get_demo_pousada((select token from demo_tokens where label = 't2')) is not null, 'link novo abre');
reset role;

-- Lista do /admin: master vê com aberturas.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000009', false);
select test_assert((select views = 1 and active from list_pousada_demo_links() where pousada_id = '10000000-0000-0000-0000-000000010101'), 'lista mostra aberturas do link ativo');

-- Desativar: o link para de abrir e a lista não devolve mais o token.
select revoke_pousada_demo_link('10000000-0000-0000-0000-000000010101');
select test_assert((select not active and token is null from list_pousada_demo_links() where pousada_id = '10000000-0000-0000-0000-000000010101'), 'link desativado sem token na lista');
reset role;
set role anon;
select test_assert(get_demo_pousada((select token from demo_tokens where label = 't2')) is null, 'link desativado não abre');
reset role;

-- Gerar de novo depois de desativar: link novo.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000083', false);
insert into demo_tokens values ('t3', create_pousada_demo_link('10000000-0000-0000-0000-000000010101'));
reset role;
select test_assert((select token from demo_tokens where label = 't3') not in (select token from demo_tokens where label in ('t1', 't2')), 'depois de desativar, gerar cria outro link');

-- Pousada publicada depois: o link só aponta para o endereço de verdade e não conta abertura.
update pousadas set status = 'publicada' where id = '10000000-0000-0000-0000-000000010101';
set role anon;
create temp table demo_published as select get_demo_pousada((select token from demo_tokens where label = 't3')) as r;
reset role;
select test_assert((select r = '{"published": true, "slug": "pousada-demo-captacao"}'::jsonb from demo_published), 'publicada só devolve o endereço');
select test_assert((select views = 0 from pousada_demo_links where pousada_id = '10000000-0000-0000-0000-000000010101'), 'publicada não conta abertura');

-- Arquivada: nada.
update pousadas set status = 'arquivada' where id = '10000000-0000-0000-0000-000000010101';
set role anon;
select test_assert(get_demo_pousada((select token from demo_tokens where label = 't3')) is null, 'arquivada não abre');
reset role;

-- Auditoria: criado, renovado (2x: com p_renew e ao gerar depois de desativar), desativado.
select test_assert((select count(*) = 1 from audit_log where target_id = '10000000-0000-0000-0000-000000010101' and action = 'pousada.demo_link_created'), 'uma criação');
select test_assert((select count(*) = 2 from audit_log where target_id = '10000000-0000-0000-0000-000000010101' and action = 'pousada.demo_link_renewed'), 'duas trocas de link');
select test_assert((select count(*) = 1 from audit_log where target_id = '10000000-0000-0000-0000-000000010101' and action = 'pousada.demo_link_revoked'), 'uma desativação');
