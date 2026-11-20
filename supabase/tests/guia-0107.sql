-- 0107 — Guia de boas-vindas. Dados sintéticos.
-- Master …009 e comercial …083 vêm de priorities.sql.

select test_assert(not has_table_privilege('anon', 'public.platform_settings', 'SELECT'), 'anon não lê ajustes');
select test_assert(not has_table_privilege('authenticated', 'public.platform_settings', 'DELETE'), 'API não apaga ajustes');
select test_assert(not has_table_privilege('authenticated', 'public.pousada_welcome_guide_sends', 'UPDATE'), 'histórico não muda');
select test_assert(not has_table_privilege('authenticated', 'public.pousada_welcome_guide_sends', 'DELETE'), 'histórico não some');
select test_assert((select value from platform_settings where key = 'welcome_guide_auto') = 'true'::jsonb, 'envio automático começa ligado');

insert into auth.users(id, email) values
 ('00000000-0000-0000-0000-000000010701', 'dono-g@example.test');
insert into pousadas(id, slug, name, city, state, status, tenant_status, owner_id, price_per_night) values
 ('10000000-0000-0000-0000-000000010701', 'pousada-guia-g', 'Pousada Guia G', 'Tiradentes', 'MG',
  'publicada', 'active', '00000000-0000-0000-0000-000000010701', 300);
insert into memberships(user_id, pousada_id, role, status) values
 ('00000000-0000-0000-0000-000000010701', '10000000-0000-0000-0000-000000010701', 'proprietario', 'active');

-- Dono da pousada: não vê ajustes nem histórico, não registra envio.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000010701', false);
set role authenticated;
select test_assert((select count(*) from platform_settings) = 0, 'dono não lê ajustes');
do $$ begin
  begin
    update platform_settings set value = 'false'::jsonb where key = 'welcome_guide_auto';
    if found then raise exception 'FALHOU: dono mudou o ajuste'; end if;
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
  begin
    insert into pousada_welcome_guide_sends(pousada_id, channel, trigger, sent_by)
    values ('10000000-0000-0000-0000-000000010701', 'email', 'manual', '00000000-0000-0000-0000-000000010701');
    raise exception 'FALHOU: dono registrou envio';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;
reset role;

-- Comercial: lê o ajuste, registra envio em nome próprio, não muda o ajuste.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000083', false);
set role authenticated;
select test_assert((select count(*) from platform_settings where key = 'welcome_guide_auto') = 1, 'comercial lê o ajuste');
insert into pousada_welcome_guide_sends(pousada_id, channel, trigger, recipient_domain, sent_by)
values ('10000000-0000-0000-0000-000000010701', 'email', 'manual', 'example.test', '00000000-0000-0000-0000-000000000083');
select test_assert((select count(*) from pousada_welcome_guide_sends where pousada_id = '10000000-0000-0000-0000-000000010701') = 1, 'comercial registra e lê o envio');
do $$ begin
  begin
    insert into pousada_welcome_guide_sends(pousada_id, channel, trigger, sent_by)
    values ('10000000-0000-0000-0000-000000010701', 'email', 'manual', '00000000-0000-0000-0000-000000000009');
    raise exception 'FALHOU: registrou em nome de outro';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;
update platform_settings set value = 'false'::jsonb where key = 'welcome_guide_auto';
reset role;
select test_assert((select value from platform_settings where key = 'welcome_guide_auto') = 'true'::jsonb, 'comercial não muda o ajuste');

-- Master muda o ajuste.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000009', false);
set role authenticated;
update platform_settings set value = 'false'::jsonb, updated_by = auth.uid(), updated_at = now() where key = 'welcome_guide_auto';
reset role;
select test_assert((select value from platform_settings where key = 'welcome_guide_auto') = 'false'::jsonb, 'master desliga o envio automático');
