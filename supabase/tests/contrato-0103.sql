-- 0103 — Contrato com aceite eletrônico e pousadas fundadoras.
-- Dados exclusivamente sintéticos. Roda depois de priorities.sql: pousada A
-- (…001, publicada, dono …001), pousada B (dono …002), master …009.

-- ---------------------------------------------------------------------------
-- Tabelas fechadas e funções sem acesso anônimo
-- ---------------------------------------------------------------------------
select test_assert(not has_table_privilege('anon', 'public.contract_versions', 'SELECT'), 'anon não lê versões');
select test_assert(not has_table_privilege('authenticated', 'public.contract_versions', 'SELECT'), 'authenticated não lê versões direto');
select test_assert(not has_table_privilege('authenticated', 'public.pousada_contract_acceptances', 'SELECT'), 'authenticated não lê aceites direto');
select test_assert(not has_table_privilege('authenticated', 'public.pousada_contract_acceptances', 'INSERT'), 'authenticated não grava aceite direto');
select test_assert(not has_function_privilege('anon', 'public.get_pousada_contract_state(uuid)', 'EXECUTE'), 'anon não vê a situação do contrato');
select test_assert(not has_function_privilege('anon', 'public.accept_pousada_contract(uuid, uuid, text, text, text)', 'EXECUTE'), 'anon não aceita contrato');
select test_assert(not has_function_privilege('anon', 'public.publish_contract_version(text)', 'EXECUTE'), 'anon não publica versão');
select test_assert(not has_function_privilege('authenticated', 'public.render_pousada_contract(uuid, uuid, uuid)', 'EXECUTE'), 'montagem do texto não é chamada pela API');
select test_assert(not has_function_privilege('authenticated', 'public.current_contract_version_id()', 'EXECUTE'), 'versão vigente não é chamada pela API');

-- Quem já estava no ar ficou com a primeira publicação gravada.
select test_assert((select first_published_at is not null from pousadas where id = '10000000-0000-0000-0000-000000000001'),
  'pousada já publicada ganha first_published_at');

-- ---------------------------------------------------------------------------
-- Atores e pousadas deste teste
-- ---------------------------------------------------------------------------
insert into auth.users(id, email) values
 ('00000000-0000-0000-0000-000000010301', 'dona-c@example.test'),
 ('00000000-0000-0000-0000-000000010302', 'gestor-c@example.test');
update profiles set full_name = 'Dona Clara Exemplo' where id = '00000000-0000-0000-0000-000000010301';
update profiles set full_name = 'Gestor Caio Exemplo' where id = '00000000-0000-0000-0000-000000010302';

insert into pousadas(id, slug, name, city, state, status, tenant_status, owner_id, price_per_night, legal_name, tax_id, address, cep) values
 ('10000000-0000-0000-0000-000000010301', 'pousada-contrato-c', 'Pousada Contrato C', 'Gonçalves', 'MG',
  'em_analise', 'onboarding', '00000000-0000-0000-0000-000000010301', 400,
  'Hospedagem Exemplo Ltda', '11.222.333/0001-44', 'Rua das Araucárias, 10', '37680-000'),
 ('10000000-0000-0000-0000-000000010302', 'pousada-sem-contrato', 'Pousada Sem Contrato', 'Gonçalves', 'MG',
  'em_analise', 'onboarding', null, 300, '', '', '', '');
insert into memberships(user_id, pousada_id, role, status) values
 ('00000000-0000-0000-0000-000000010301', '10000000-0000-0000-0000-000000010301', 'proprietario', 'active'),
 ('00000000-0000-0000-0000-000000010302', '10000000-0000-0000-0000-000000010301', 'admin_pousada', 'active');

-- ---------------------------------------------------------------------------
-- Sem versão publicada: publicar funciona sem aceite e (0114) já marca a
-- fundadora — a condição de lançamento não espera o contrato.
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000009', false);
update pousadas set status = 'publicada' where id = '10000000-0000-0000-0000-000000010302';
reset role;
-- (Testes anteriores publicam pousadas, que também viram fundadoras: a posição
-- é relativa.)
select test_assert((select first_published_at is not null and founder_rank is not null
                           and commission_exempt_until between now() + interval '59 days' and now() + interval '61 days'
                    from pousadas where id = '10000000-0000-0000-0000-000000010302'),
  'sem contrato vigente: publica sem aceite e já é fundadora (0114)');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000010301', false);
select test_assert((get_pousada_contract_state('10000000-0000-0000-0000-000000010301')->>'active')::boolean = false,
  'sem versão publicada o contrato fica inativo');
do $$ begin
  begin
    perform accept_pousada_contract('10000000-0000-0000-0000-000000010301', gen_random_uuid(), repeat('a', 64));
    raise exception 'FALHOU: aceitou contrato sem versão publicada';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Versões: só master grava e publica
-- ---------------------------------------------------------------------------
do $$ begin
  begin
    perform save_contract_version_draft('teste-v1', 'Contrato de teste', repeat('texto ', 60));
    raise exception 'FALHOU: dono de pousada gravou versão do contrato';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
  begin
    perform list_contract_versions();
    raise exception 'FALHOU: dono de pousada listou versões do contrato';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000009', false);
select save_contract_version_draft('teste-v1', 'Contrato de teste',
  'CONTRATO. POUSADA: {{razao_social}}, {{documento}}, {{endereco}}, meio de hospedagem {{nome_fantasia}}, '
  || 'representada por {{representante_nome}} ({{representante_email}}). Suporte: [canal de suporte]. '
  || repeat('Cláusula de exemplo sem valor jurídico. ', 6));
do $$ begin
  begin
    perform publish_contract_version('teste-v1');
    raise exception 'FALHOU: publicou texto com colchetes por definir';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;
select save_contract_version_draft('teste-v1', 'Contrato de teste',
  'CONTRATO. POUSADA: {{razao_social}}, {{documento}}, {{endereco}}, meio de hospedagem {{nome_fantasia}}, '
  || 'representada por {{representante_nome}} ({{representante_email}}). Campo errado: {{cnpj}}. '
  || repeat('Cláusula de exemplo sem valor jurídico. ', 6));
do $$ begin
  begin
    perform publish_contract_version('teste-v1');
    raise exception 'FALHOU: publicou texto com campo desconhecido';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;
select save_contract_version_draft('teste-v1', 'Contrato de teste',
  'CONTRATO. POUSADA: {{razao_social}}, {{documento}}, {{endereco}}, meio de hospedagem {{nome_fantasia}}, '
  || 'representada por {{representante_nome}} ({{representante_email}}). '
  || repeat('Cláusula de exemplo sem valor jurídico. ', 6));
select publish_contract_version('teste-v1');
do $$ begin
  begin
    perform save_contract_version_draft('teste-v1', 'Outro título', repeat('texto trocado ', 30));
    raise exception 'FALHOU: versão publicada foi alterada';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;
select test_assert(jsonb_array_length(list_contract_versions()) = 1, 'master lista as versões');

-- ---------------------------------------------------------------------------
-- Com contrato vigente: primeira publicação exige o aceite
-- ---------------------------------------------------------------------------
do $$ begin
  begin
    update pousadas set status = 'publicada' where id = '10000000-0000-0000-0000-000000010301';
    raise exception 'FALHOU: pousada publicada sem aceitar o contrato';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform test_assert(sqlerrm like 'Esta pousada ainda não aceitou o contrato%', 'mensagem do bloqueio de publicação');
  end;
end $$;

-- Quem já esteve no ar não é barrada: suspender e reativar a pousada A.
update pousadas set status = 'suspensa' where id = '10000000-0000-0000-0000-000000000001';
update pousadas set status = 'publicada' where id = '10000000-0000-0000-0000-000000000001';
reset role;
select test_assert((select status = 'publicada' and founder_rank is null from pousadas where id = '10000000-0000-0000-0000-000000000001'),
  'reativar pousada antiga não exige aceite nem marca fundadora');
-- As colunas novas são privadas: a API não lê direto.
select test_assert(not has_column_privilege('authenticated', 'public.pousadas', 'founder_rank', 'SELECT')
                   and not has_column_privilege('anon', 'public.pousadas', 'commission_exempt_until', 'SELECT'),
  'colunas de fundadora fora da leitura direta');
set role authenticated;

-- ---------------------------------------------------------------------------
-- Situação do contrato: dono vê o texto; gestor vê só a situação; estranho nada
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
do $$ begin
  begin
    perform get_pousada_contract_state('10000000-0000-0000-0000-000000010301');
    raise exception 'FALHOU: dono de outra pousada viu a situação do contrato';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
  begin
    perform get_pousada_contract_acceptance('10000000-0000-0000-0000-000000010301');
    raise exception 'FALHOU: dono de outra pousada leu o contrato aceito';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000010302', false);
do $$ declare s jsonb; begin
  s := get_pousada_contract_state('10000000-0000-0000-0000-000000010301');
  perform test_assert((s->>'active')::boolean and not (s->>'canAccept')::boolean, 'gestor vê a situação mas não aceita');
  perform test_assert(s->>'body' is null, 'gestor não recebe o texto para aceitar');
  begin
    perform accept_pousada_contract('10000000-0000-0000-0000-000000010301', (s->'version'->>'id')::uuid, repeat('a', 64));
    raise exception 'FALHOU: gestor aceitou o contrato';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000010301', false);
do $$ declare s jsonb; r jsonb; begin
  s := get_pousada_contract_state('10000000-0000-0000-0000-000000010301');
  perform test_assert((s->>'canAccept')::boolean and not (s->>'acceptedCurrent')::boolean, 'dono pode aceitar');
  perform test_assert(s->>'body' like '%Hospedagem Exemplo Ltda, 11.222.333/0001-44, Rua das Araucárias, 10, Gonçalves/MG, CEP 37680-000%',
    'texto sai com os dados da pousada');
  perform test_assert(s->>'body' like '%Dona Clara Exemplo (dona-c@example.test)%', 'texto sai com quem representa');
  perform test_assert(position('{{' in s->>'body') = 0, 'nenhum campo sobra sem preencher');
  perform test_assert(jsonb_array_length(s->'missing') = 0, 'nada faltando');

  -- Hash diferente do texto montado: recusa.
  begin
    perform accept_pousada_contract('10000000-0000-0000-0000-000000010301', (s->'version'->>'id')::uuid, repeat('a', 64));
    raise exception 'FALHOU: aceitou com hash que não bate';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
  -- Versão que não é a vigente: recusa.
  begin
    perform accept_pousada_contract('10000000-0000-0000-0000-000000010301', gen_random_uuid(), s->>'bodySha256');
    raise exception 'FALHOU: aceitou versão que não é a vigente';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;

-- Dado faltando: a tela avisa e o aceite é recusado.
update pousadas set legal_name = '' where id = '10000000-0000-0000-0000-000000010301';
do $$ declare s jsonb; begin
  s := get_pousada_contract_state('10000000-0000-0000-0000-000000010301');
  perform test_assert(s->'missing' ? 'Razão social ou nome completo', 'lista o dado que falta');
  begin
    perform accept_pousada_contract('10000000-0000-0000-0000-000000010301', (s->'version'->>'id')::uuid, s->>'bodySha256');
    raise exception 'FALHOU: aceitou com razão social em branco';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform test_assert(sqlerrm like 'Preencha antes de aceitar:%', 'mensagem dos dados faltando');
  end;
end $$;
update pousadas set legal_name = 'Hospedagem Exemplo Ltda' where id = '10000000-0000-0000-0000-000000010301';

-- Aceite de verdade, e de novo (não duplica).
do $$ declare s jsonb; r jsonb; begin
  s := get_pousada_contract_state('10000000-0000-0000-0000-000000010301');
  r := accept_pousada_contract('10000000-0000-0000-0000-000000010301', (s->'version'->>'id')::uuid,
                               s->>'bodySha256', '203.0.113.7', 'Navegador de teste');
  perform test_assert((r->>'already')::boolean = false and r->>'versionCode' = 'teste-v1', 'aceite gravado');
  r := accept_pousada_contract('10000000-0000-0000-0000-000000010301', (s->'version'->>'id')::uuid, s->>'bodySha256');
  perform test_assert((r->>'already')::boolean, 'segundo aceite devolve o primeiro');
  s := get_pousada_contract_state('10000000-0000-0000-0000-000000010301');
  perform test_assert((s->>'acceptedCurrent')::boolean and s->>'body' is null, 'depois do aceite não há mais texto pendente');
  perform test_assert(s->'latestAcceptance'->>'acceptedByName' = 'Dona Clara Exemplo', 'situação mostra quem aceitou');
  r := get_pousada_contract_acceptance('10000000-0000-0000-0000-000000010301');
  perform test_assert(r->>'body' like '%Hospedagem Exemplo Ltda%' and r->>'acceptedByEmail' = 'dona-c@example.test',
    'dono lê a cópia guardada');
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

select test_assert((select count(*) from pousada_contract_acceptances where pousada_id = '10000000-0000-0000-0000-000000010301') = 1,
  'um aceite só por pousada e versão');
select test_assert((select ip = '203.0.113.7' and user_agent = 'Navegador de teste'
                           and body_sha256 = encode(sha256(convert_to(rendered_body, 'UTF8')), 'hex')
                    from pousada_contract_acceptances where pousada_id = '10000000-0000-0000-0000-000000010301'),
  'prova guardada: IP, navegador e hash do texto');
select test_assert(exists(select 1 from audit_log where action = 'pousada.contract_accepted'
                          and target_id = '10000000-0000-0000-0000-000000010301'), 'aceite auditado');

-- A prova não muda nem some (nem com acesso total ao banco).
do $$ begin
  begin
    update pousada_contract_acceptances set rendered_body = 'outro texto'
     where pousada_id = '10000000-0000-0000-0000-000000010301';
    raise exception 'FALHOU: texto aceito foi alterado';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
  begin
    delete from pousada_contract_acceptances where pousada_id = '10000000-0000-0000-0000-000000010301';
    raise exception 'FALHOU: aceite foi apagado';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;

-- Dados da pousada mudam depois: a cópia aceita continua a mesma.
update pousadas set legal_name = 'Nova Razão Social Ltda' where id = '10000000-0000-0000-0000-000000010301';
select test_assert((select rendered_body like '%Hospedagem Exemplo Ltda%' from pousada_contract_acceptances
                    where pousada_id = '10000000-0000-0000-0000-000000010301'), 'texto aceito fica congelado');

-- ---------------------------------------------------------------------------
-- Publicação depois do aceite: vira a próxima fundadora
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000009', false);
update pousadas set status = 'publicada' where id = '10000000-0000-0000-0000-000000010301';
reset role;
select set_config('request.jwt.claim.sub', '', false);
select test_assert((select founder_rank = (select founder_rank + 1 from pousadas
                                                  where id = '10000000-0000-0000-0000-000000010302')
                           and commission_exempt_until between now() + interval '59 days' and now() + interval '61 days'
                           and commission_rate_locked_until between now() + interval '13 months' and now() + interval '15 months'
                           and first_published_at is not null
                    from pousadas where id = '10000000-0000-0000-0000-000000010301'),
  'primeira publicação com aceite: próxima fundadora, 60 dias de isenção e 3% nos 12 meses seguintes');
select test_assert(exists(select 1 from audit_log where action = 'pousada.founder_assigned'
                          and target_id = '10000000-0000-0000-0000-000000010301'), 'fundadora auditada');

-- Suspender e reativar não reinicia a contagem.
do $$ declare v_until timestamptz; v_rank smallint; begin
  select commission_exempt_until, founder_rank into v_until, v_rank from pousadas where id = '10000000-0000-0000-0000-000000010301';
  update pousadas set status = 'suspensa' where id = '10000000-0000-0000-0000-000000010301';
  update pousadas set status = 'publicada' where id = '10000000-0000-0000-0000-000000010301';
  perform test_assert((select founder_rank = v_rank and commission_exempt_until = v_until
                       from pousadas where id = '10000000-0000-0000-0000-000000010301'),
    'reativar não muda a posição nem as datas');
end $$;

-- O dono não mexe nas colunas de fundadora (guarda de colunas, 0065).
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000010301', false);
do $$ begin
  begin
    update pousadas set commission_exempt_until = now() + interval '10 years'
     where id = '10000000-0000-0000-0000-000000010301';
    raise exception 'FALHOU: dono esticou a própria isenção';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select test_assert((select commission_exempt_until < now() + interval '61 days' from pousadas
                    where id = '10000000-0000-0000-0000-000000010301'), 'isenção continua de 60 dias');

-- ---------------------------------------------------------------------------
-- Versão nova: o aceite antigo continua guardado e a tela pede o novo
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000009', false);
select save_contract_version_draft('teste-v2', 'Contrato de teste, segunda versão',
  'CONTRATO V2. POUSADA: {{razao_social}}, {{documento}}, representada por {{representante_nome}}. '
  || repeat('Cláusula nova de exemplo sem valor jurídico. ', 6));
select publish_contract_version('teste-v2');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000010301', false);
do $$ declare s jsonb; begin
  s := get_pousada_contract_state('10000000-0000-0000-0000-000000010301');
  perform test_assert(s->'version'->>'code' = 'teste-v2' and not (s->>'acceptedCurrent')::boolean,
    'versão nova pede novo aceite');
  perform test_assert(s->'latestAcceptance'->>'versionCode' = 'teste-v1', 'aceite antigo continua visível');
  perform test_assert(s->>'body' like 'CONTRATO V2.%Nova Razão Social Ltda%', 'texto novo com os dados atuais');
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- Conta de quem aceitou é excluída: a linha fica, com nome e e-mail gravados.
update pousada_contract_acceptances set accepted_by = null
 where pousada_id = '10000000-0000-0000-0000-000000010301';
select test_assert((select accepted_by is null and accepted_by_name = 'Dona Clara Exemplo'
                    from pousada_contract_acceptances where pousada_id = '10000000-0000-0000-0000-000000010301'),
  'exclusão da conta preserva a prova');

-- ---------------------------------------------------------------------------
-- Preparo do teste de concorrência (scripts/test-database.mjs): 29 fundadoras
-- já marcadas (as de cima e as daqui, até a 29ª) e duas pousadas com aceite, prontas para publicar ao mesmo tempo.
-- Só uma pode ficar com a 30ª posição.
-- ---------------------------------------------------------------------------
insert into pousadas(id, slug, name, city, state, status, tenant_status, price_per_night, first_published_at, founder_rank)
select ('10000000-0000-0000-0000-0000001039' || lpad(g::text, 2, '0'))::uuid, 'fundadora-' || g, 'Fundadora ' || g,
       'Gonçalves', 'MG', 'suspensa', 'active', 300, now(), g
from generate_series((select max(founder_rank) + 1 from pousadas), 29) g;

insert into pousadas(id, slug, name, city, state, status, tenant_status, price_per_night) values
 ('10000000-0000-0000-0000-0000001030f1', 'corrida-fundadora-1', 'Corrida Fundadora 1', 'Gonçalves', 'MG', 'em_analise', 'onboarding', 300),
 ('10000000-0000-0000-0000-0000001030f2', 'corrida-fundadora-2', 'Corrida Fundadora 2', 'Gonçalves', 'MG', 'em_analise', 'onboarding', 300);
insert into pousada_contract_acceptances(pousada_id, contract_version_id, accepted_by_name, accepted_by_email, rendered_body, body_sha256)
select p.id, c.id, 'Pessoa de Teste', 'teste@example.test', 'texto de teste', encode(sha256(convert_to('texto de teste', 'UTF8')), 'hex')
from pousadas p cross join contract_versions c
where p.id in ('10000000-0000-0000-0000-0000001030f1', '10000000-0000-0000-0000-0000001030f2')
  and c.code = 'teste-v2';
