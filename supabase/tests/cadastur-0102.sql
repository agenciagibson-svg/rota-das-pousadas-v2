-- 0102 — Cadastur da pousada. Dados exclusivamente sintéticos.
-- Roda depois de priorities.sql: pousada A (dono …001, publicada), pousada B
-- (dono …002).

-- ---------------------------------------------------------------------------
-- Checagens do banco (valem para quem chamar a API direto)
-- ---------------------------------------------------------------------------
do $$ begin
  begin
    update pousadas set cadastur = 'abc12345678' where id = '10000000-0000-0000-0000-000000000001';
    raise exception 'FALHOU: Cadastur com letras foi aceito';
  exception when check_violation then null;
  end;
  begin
    update pousadas set cadastur = '1234-567' where id = '10000000-0000-0000-0000-000000000001';
    raise exception 'FALHOU: Cadastur com poucos dígitos foi aceito';
  exception when check_violation then null;
  end;
  begin
    update pousadas set cadastur = '', cadastur_valid_until = '2027-01-01'
     where id = '10000000-0000-0000-0000-000000000001';
    raise exception 'FALHOU: validade sem número foi aceita';
  exception when check_violation then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Escrita: dono grava; outro dono não; a guarda segue barrando o resto
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
update pousadas set cadastur = '26.012345.10.0001-6', cadastur_valid_until = '2027-06-30'
 where id = '10000000-0000-0000-0000-000000000001';
do $$ begin
  begin
    update pousadas set cadastur = '26.012345.10.0001-7', status = 'arquivada'
     where id = '10000000-0000-0000-0000-000000000001';
    raise exception 'FALHOU: dono mudou a situação da pousada junto com o Cadastur';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
do $$ declare changed integer; begin
  update pousadas set cadastur = '99.999999.99.9999-9' where id = '10000000-0000-0000-0000-000000000001';
  get diagnostics changed = row_count;
  perform test_assert(changed = 0, 'dono de outra pousada não troca o Cadastur');
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ---------------------------------------------------------------------------
-- Leitura pública: anônimo vê o número (é a vitrine)
-- ---------------------------------------------------------------------------
set role anon;
do $$ declare v text; begin
  select cadastur into v from pousadas where id = '10000000-0000-0000-0000-000000000001';
  perform test_assert(v = '26.012345.10.0001-6', 'anônimo lê o Cadastur da vitrine');
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Página de demonstração devolve o Cadastur
-- ---------------------------------------------------------------------------
update pousadas set cadastur = '31.000001.10.0001-0' where id = '10000000-0000-0000-0000-000000000002';
update pousadas set status = 'rascunho' where id = '10000000-0000-0000-0000-000000000002';
insert into pousada_demo_links(pousada_id, token)
values ('10000000-0000-0000-0000-000000000002', 'tokenCadastur0102tokenCadastur0102tokenAB');
set role anon;
do $$ declare v jsonb; begin
  v := get_demo_pousada('tokenCadastur0102tokenCadastur0102tokenAB');
  perform test_assert(v -> 'pousada' ->> 'cadastur' = '31.000001.10.0001-0',
    'demonstração mostra o Cadastur');
end $$;
reset role;
