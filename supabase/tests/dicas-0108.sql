-- 0108 — Dicas dos leitores. Dados sintéticos.
-- Master …009, marketing …082 e comercial …083 vêm de priorities.sql.

select test_assert(not has_table_privilege('anon', 'public.blog_tips', 'INSERT'), 'anon não grava direto');
select test_assert(not has_table_privilege('authenticated', 'public.blog_tips', 'UPDATE'), 'API não muda dica direto');
select test_assert(not has_table_privilege('authenticated', 'public.blog_tips', 'DELETE'), 'API não apaga dica');
select test_assert(not has_column_privilege('anon', 'public.blog_tips', 'reviewed_by', 'SELECT'), 'anon não vê quem moderou');
select test_assert(not has_function_privilege('anon', 'public.moderate_blog_tip(uuid, text)', 'EXECUTE'), 'anon não modera');

-- Visitante envia: valida e reserva o caminho da foto.
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$
declare r jsonb;
begin
  r := submit_blog_tip('guia-teste', 'Ana', 'Uberlândia', 'Chegue cedo na cachoeira, antes das 9h fica vazia.', true, true);
  perform set_config('test.tip_id', r->>'id', false);
  perform set_config('test.tip_path', r->>'photo_path', false);
  if r->>'photo_path' is distinct from 'dicas/' || (r->>'id') || '.jpg' then
    raise exception 'FALHOU: caminho da foto %', r->>'photo_path';
  end if;
  begin
    perform submit_blog_tip('guia-teste', 'Ana', null, 'Curta demais', false, true);
    raise exception 'FALHOU: aceitou dica curta';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
  begin
    perform submit_blog_tip('guia-teste', 'Ana', null, 'Dica sem autorização para publicar aqui.', false, false);
    raise exception 'FALHOU: aceitou sem consentimento';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
  begin
    perform submit_blog_tip('Guia Teste!', 'Ana', null, 'Dica com guia inválido aqui no texto.', false, true);
    raise exception 'FALHOU: aceitou guia inválido';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;
-- Pendente não aparece para o público.
select test_assert((select count(*) from blog_tips) = 0, 'pendente invisível para o público');
-- Upload só no caminho reservado.
insert into storage.objects(bucket_id, name) values ('blog-tips', current_setting('test.tip_path'));
do $$ begin
  begin
    insert into storage.objects(bucket_id, name) values ('blog-tips', 'dicas/00000000-0000-0000-0000-000000000000.jpg');
    raise exception 'FALHOU: upload fora do caminho reservado';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;
select test_assert((select count(*) from storage.objects where bucket_id = 'blog-tips') = 0, 'foto pendente invisível');
reset role;

-- Caminho velho (mais de 15 minutos) não aceita upload.
update blog_tips set created_at = now() - interval '20 minutes' where id = current_setting('test.tip_id')::uuid;
select test_assert(not blog_tip_photo_upload_allowed(current_setting('test.tip_path')), 'upload expira em 15 minutos');
update blog_tips set created_at = now() where id = current_setting('test.tip_id')::uuid;

-- Comercial não modera; marketing modera.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000083', false);
set role authenticated;
select test_assert((select count(*) from blog_tips) = 0, 'comercial não vê a fila');
do $$ begin
  begin
    perform moderate_blog_tip(current_setting('test.tip_id')::uuid, 'aprovada');
    raise exception 'FALHOU: comercial moderou';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000082', false);
set role authenticated;
select test_assert((select count(*) from blog_tips where status = 'pendente') = 1, 'marketing vê a fila');
select moderate_blog_tip(current_setting('test.tip_id')::uuid, 'aprovada');
do $$ begin
  begin
    perform moderate_blog_tip(current_setting('test.tip_id')::uuid, 'pendente');
    raise exception 'FALHOU: status inválido';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;
reset role;
select test_assert((select reviewed_by from blog_tips where id = current_setting('test.tip_id')::uuid)
  = '00000000-0000-0000-0000-000000000082', 'registra quem aprovou');

-- Aprovada: público lê a dica e a foto; não sobe outra foto no mesmo caminho.
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select test_assert((select count(*) from blog_tips where post_slug = 'guia-teste') = 1, 'aprovada aparece');
select test_assert((select count(*) from storage.objects where bucket_id = 'blog-tips') = 1, 'foto aprovada aparece');
select test_assert(not blog_tip_photo_upload_allowed(current_setting('test.tip_path')), 'aprovada não aceita novo upload');
do $$ begin
  begin
    delete from storage.objects where bucket_id = 'blog-tips';
    if found then raise exception 'FALHOU: anon apagou foto'; end if;
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;
reset role;

-- Limite: 20 por guia por hora.
do $$ begin
  for i in 1..19 loop
    perform submit_blog_tip('guia-limite', 'Leitor', null, 'Dica de teste número ' || i || ' para o limite.', false, true);
  end loop;
end $$;
do $$ begin
  perform submit_blog_tip('guia-limite', 'Leitor', null, 'Vigésima dica de teste para o limite.', false, true);
  begin
    perform submit_blog_tip('guia-limite', 'Leitor', null, 'Vigésima primeira dica de teste aqui.', false, true);
    raise exception 'FALHOU: passou do limite por guia';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;
