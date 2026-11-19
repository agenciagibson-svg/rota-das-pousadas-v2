-- Rollback da 0103 (contrato com aceite eletrônico e pousadas fundadoras).
--
-- ATENÇÃO: apaga os aceites guardados (a prova de que cada pousada aceitou o
-- contrato) e a marcação das fundadoras com as datas de isenção. Antes de
-- rodar em produção, exporte `pousada_contract_acceptances` e as colunas
-- `founder_rank`, `commission_exempt_until` e `commission_rate_locked_until`
-- de `pousadas`. A auditoria (audit_log) fica.
drop trigger if exists trg_pousada_first_publication on pousadas;
drop function if exists pousada_first_publication();
drop function if exists publish_contract_version(text);
drop function if exists save_contract_version_draft(text, text, text, boolean);
drop function if exists list_contract_versions();
drop function if exists get_pousada_contract_acceptance(uuid);
drop function if exists accept_pousada_contract(uuid, uuid, text, text, text);
drop function if exists get_pousada_contract_state(uuid);
drop function if exists render_pousada_contract(uuid, uuid, uuid);
drop function if exists current_contract_version_id();
drop trigger if exists trg_contract_acceptance_immutable on pousada_contract_acceptances;
drop table if exists pousada_contract_acceptances;
drop function if exists guard_contract_acceptance_immutable();
drop table if exists contract_versions;
drop index if exists pousadas_founder_rank_unico;
alter table pousadas
  drop column if exists commission_rate_locked_until,
  drop column if exists commission_exempt_until,
  drop column if exists founder_rank,
  drop column if exists first_published_at;
