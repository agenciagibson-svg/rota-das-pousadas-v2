-- =============================================================================
-- Runbook de rollback — Ciclo 2 / 2B (migrations 0013-revisada, 0014-0017)
--
-- NÃO EXECUTAR AUTOMATICAMENTE. Este arquivo é um procedimento revisável,
-- para rodar manualmente (por partes, conferindo cada passo) só se algo dar
-- errado depois de aplicar 0013(revisada)-0017 num ambiente real.
--
-- Alvo do rollback: estado do banco ANTES do Ciclo 2 (equivalente ao fim do
-- Ciclo 1 / migration 0012). Não existe um estado intermediário seguro
-- "antes só da 2B" — a 2B fecha uma vulnerabilidade real (audit_log
-- forjável); reverter só até ali reabriria esse buraco. Por isso o rollback
-- é tudo-ou-nada até o fim do Ciclo 1.
--
-- ORDEM: execute os PASSOS na ordem abaixo. Pare e avalie entre cada um.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PASSO 1 — Restaurar as funções para a versão de antes do Ciclo 2
-- (comportamento idêntico ao final de 0013 original / 0002_rls.sql).
-- Baixo risco: funções não guardam estado, só mudam comportamento de leitura.
-- -----------------------------------------------------------------------------
create or replace function auth_is_member_of(target_pousada uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.pousada_id = target_pousada
  );
$$;

create or replace function auth_can_manage_pousada(target_pousada uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.user_id = auth.uid()
      and m.pousada_id = target_pousada
      and m.role in ('proprietario', 'admin_pousada')
  );
$$;

-- -----------------------------------------------------------------------------
-- PASSO 2 — Remover funções/policies criadas no Ciclo 2/2B que não existiam
-- antes. DROP FUNCTION só depois de nenhuma policy mais referenciar.
-- -----------------------------------------------------------------------------
drop policy if exists "memberships_manage" on memberships;
create policy "memberships_manage" on memberships for all
  using (auth_can_manage_pousada(pousada_id) or auth_is_platform_admin())
  with check (auth_can_manage_pousada(pousada_id) or auth_is_platform_admin());

drop function if exists auth_is_active_owner_of(uuid);
drop function if exists accept_membership_invite(uuid);
drop function if exists invite_membership(uuid, text, user_role);
drop function if exists list_membership_emails(uuid);
drop function if exists find_profile_id_by_email(text); -- caso ainda exista de uma aplicação parcial

-- -----------------------------------------------------------------------------
-- PASSO 3 — Restaurar policies de bookings/payments/expenses para a versão
-- pré-Ciclo-1-fix (platform_role irrestrito) OU manter a versão com
-- auth_has_active_grant (recomendado — reverter isso reabre o Conflito A da
-- auditoria original). Por padrão este runbook MANTÉM auth_has_active_grant;
-- só remova platform_access_grants no PASSO 6 se tiver certeza.
-- -----------------------------------------------------------------------------
-- (nenhuma ação necessária aqui se optar por manter — ver nota acima)

-- -----------------------------------------------------------------------------
-- PASSO 4 — Reverter grants explícitos para o estado implícito anterior
-- (Postgres concede EXECUTE a PUBLIC por padrão na criação — não é preciso
-- comando extra para "desfazer" um REVOKE se a função for dropada no Passo 2;
-- para as funções mantidas — auth_is_member_of, auth_can_manage_pousada,
-- auth_has_active_grant — os grants explícitos a anon/authenticated são
-- estritamente mais corretos que o implícito e NÃO precisam ser revertidos).

-- -----------------------------------------------------------------------------
-- PASSO 5 — Colunas novas: NÃO REMOVER COMO PRIMEIRA OPÇÃO. Remover colunas
-- destrói dados criados depois da implantação (ex.: um `suspended_reason`
-- real gravado por um proprietário). Prefira deixar as colunas paradas
-- (elas não afetam nada se as funções/policies do Passo 1-2 já foram
-- revertidas — nenhum código volta a ler `status`/`tenant_status` etc.).
--
-- Só remova colunas se tiver certeza de que NENHUM dado pós-implantação
-- precisa ser preservado, e mesmo assim faça backup antes:
--
--   -- create table _backup_memberships_ciclo2 as table memberships;
--   -- create table _backup_pousadas_ciclo2 as table pousadas;
--   --
--   -- alter table memberships drop column if exists status;
--   -- alter table memberships drop column if exists invited_at;
--   -- alter table memberships drop column if exists accepted_at;
--   -- alter table memberships drop column if exists updated_at;
--   -- alter table memberships drop column if exists created_by;
--   -- alter table memberships drop column if exists suspended_by;
--   -- alter table memberships drop column if exists suspended_reason;
--   -- alter table memberships add constraint memberships_user_id_pousada_id_key unique (user_id, pousada_id);
--   -- drop index if exists idx_memberships_active_unique;
--   --
--   -- alter table pousadas drop column if exists tenant_status;
--   -- alter table pousadas drop column if exists legal_name;
--   -- alter table pousadas drop column if exists tax_id;
--   -- alter table pousadas drop column if exists whatsapp;
--   -- alter table pousadas drop column if exists address;
--   -- alter table pousadas drop column if exists country;
--   -- alter table pousadas drop column if exists timezone;
--   -- alter table pousadas drop column if exists currency;
--   -- alter table pousadas drop column if exists language;
--
-- Enums (membership_status, tenant_status) não podem ter valores removidos
-- no Postgres — se quiser removê-los de verdade, é preciso recriar o tipo
-- inteiro, o que exige recriar as colunas que o usam. Deixe os enums como
-- estão; eles não causam nenhum efeito colateral sozinhos.

-- -----------------------------------------------------------------------------
-- PASSO 6 (opcional, raramente necessário) — Remover platform_access_grants
-- por completo, voltando ao Conflito A original (admin de plataforma com
-- acesso irrestrito). NÃO RECOMENDADO — reabre um problema de segurança já
-- corrigido no Ciclo 1. Só faça isso se o Ciclo 1 inteiro também for
-- revertido por outro motivo.
--   -- drop table if exists platform_access_grants;
--   -- drop function if exists auth_has_active_grant(uuid);
--   -- (e restaurar bookings_read/payments_read/expenses_read/write para a
--   --  versão com auth_is_platform_admin() em vez de auth_has_active_grant())

-- -----------------------------------------------------------------------------
-- VALIDAÇÃO PÓS-ROLLBACK
-- -----------------------------------------------------------------------------
-- select auth_is_member_of('<id-de-pousada-de-teste>'); -- deve voltar a
--   ignorar status (já que a coluna, se mantida, simplesmente não é mais lida).
-- select * from pg_policies where tablename = 'memberships';
-- Confirmar que a aplicação (código TypeScript) também foi revertida junto —
-- este runbook só cobre o banco. Reverter só o banco com o código novo
-- ainda no ar quebra features/membros inteiro (RPCs removidas).
