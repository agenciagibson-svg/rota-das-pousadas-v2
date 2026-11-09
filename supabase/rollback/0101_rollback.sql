-- Rollback da 0101 (link de demonstração). Apaga os links e a contagem de
-- aberturas; a auditoria (audit_log) fica.
drop function if exists get_demo_pousada(text);
drop function if exists list_pousada_demo_links();
drop function if exists revoke_pousada_demo_link(uuid);
drop function if exists create_pousada_demo_link(uuid, boolean);
drop table if exists pousada_demo_links;
