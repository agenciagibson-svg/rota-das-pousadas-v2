-- 0095 — Mapa da pousada (latitude/longitude). Dados exclusivamente sintéticos.
-- Roda depois de priorities.sql: pousada A (dono …001, publicada), pousada B
-- (dono …002). Cria uma pousada em análise (dono …001) e uma recepcionista em A.

insert into auth.users(id, email) values
 ('00000000-0000-0000-0000-000000009501', 'recepcao-mapa@example.test');
insert into memberships(user_id, pousada_id, role, status) values
 ('00000000-0000-0000-0000-000000009501', '10000000-0000-0000-0000-000000000001', 'recepcionista', 'active');
insert into pousadas(id, slug, name, city, state, status, tenant_status, owner_id, latitude, longitude) values
 ('10000000-0000-0000-0000-000000009500', 'pousada-mapa-analise', 'Pousada Em Análise', 'Cidade', 'MG',
  'em_analise', 'onboarding', '00000000-0000-0000-0000-000000000001', -21.5, -44.5);

-- ---------------------------------------------------------------------------
-- Checagens do banco (valem para quem chamar a API direto)
-- ---------------------------------------------------------------------------
do $$ begin
  begin
    update pousadas set latitude = -21.7 where id = '10000000-0000-0000-0000-000000000001';
    raise exception 'FALHOU: latitude sem longitude foi aceita';
  exception when check_violation then null;
  end;
  begin
    update pousadas set latitude = 38.72, longitude = -9.14 where id = '10000000-0000-0000-0000-000000000001';
    raise exception 'FALHOU: ponto fora do Brasil foi aceito';
  exception when check_violation then null;
  end;
  begin
    update pousadas set latitude = 'NaN', longitude = -44 where id = '10000000-0000-0000-0000-000000000001';
    raise exception 'FALHOU: NaN foi aceito';
  exception when check_violation then null;
  end;
  begin
    update pousadas set latitude = -44.1, longitude = -21.1 where id = '10000000-0000-0000-0000-000000000001';
    raise exception 'FALHOU: lat/lng trocados foram aceitos';
  exception when check_violation then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Escrita: dono grava; recepção, outro dono e anônimo não
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
update pousadas set latitude = -21.723456, longitude = -44.987654
 where id = '10000000-0000-0000-0000-000000000001';
-- A guarda de colunas continua barrando o resto (ex.: publicar).
do $$ begin
  begin
    update pousadas set latitude = -21.7, longitude = -44.9, rating = 5
     where id = '10000000-0000-0000-0000-000000000001';
    raise exception 'FALHOU: dono mudou a nota da pousada junto com o ponto';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000009501', false);
do $$ declare changed integer; begin
  update pousadas set latitude = -20, longitude = -40 where id = '10000000-0000-0000-0000-000000000001';
  get diagnostics changed = row_count;
  perform test_assert(changed = 0, 'recepção não move o ponto da pousada');
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
do $$ declare changed integer; begin
  update pousadas set latitude = -20, longitude = -40 where id = '10000000-0000-0000-0000-000000000001';
  get diagnostics changed = row_count;
  perform test_assert(changed = 0, 'dono de outra pousada não move o ponto');
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

set role anon;
do $$ declare changed integer; begin
  update pousadas set latitude = -20, longitude = -40 where id = '10000000-0000-0000-0000-000000000001';
  get diagnostics changed = row_count;
  perform test_assert(changed = 0, 'anônimo não move o ponto');
exception when insufficient_privilege then null;
end $$;
reset role;

select test_assert(
  (select latitude = -21.723456 and longitude = -44.987654 from pousadas
    where id = '10000000-0000-0000-0000-000000000001'),
  'ponto gravado pelo dono, sem mudanças de terceiros');

-- ---------------------------------------------------------------------------
-- Leitura pública: só pousadas publicadas
-- ---------------------------------------------------------------------------
set role anon;
select test_assert(
  (select latitude from pousadas where slug = 'pousada-a') = -21.723456,
  'anônimo lê as coordenadas da pousada publicada');
select test_assert(
  not exists(select 1 from pousadas where slug = 'pousada-mapa-analise'),
  'anônimo não vê o ponto de pousada em análise');
select test_assert(
  (select (i->>'latitude')::numeric = -21.723456 and (i->>'longitude')::numeric = -44.987654
     from jsonb_array_elements(search_public_pousadas('', 1, 100)->'items') i
    where i->>'slug' = 'pousada-a'),
  'busca pública devolve as coordenadas');
select test_assert(
  (select count(*) from jsonb_array_elements(search_public_pousadas('', 1, 100)->'items') i
    where i->>'slug' = 'pousada-mapa-analise') = 0,
  'busca pública não inclui a pousada em análise');
select test_assert(
  (select i->'latitude' = 'null'::jsonb
     from jsonb_array_elements(search_public_pousadas('', 1, 100)->'items') i
    where i->>'slug' = 'pousada-b'),
  'pousada sem ponto vem com latitude nula (sem mapa)');
reset role;

-- Colunas privadas continuam privadas (0084) — o grant novo é só das duas colunas.
select test_assert(has_column_privilege('anon', 'public.pousadas', 'latitude', 'SELECT'), 'anon lê latitude');
select test_assert(not has_column_privilege('anon', 'public.pousadas', 'tax_id', 'SELECT'), 'anon segue sem ler tax_id');
