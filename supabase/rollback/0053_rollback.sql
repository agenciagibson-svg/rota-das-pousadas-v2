-- =============================================================================
-- Rollback da 0053 (segunda rodada de correções de segurança).
--
-- Cada bloco abaixo REABRE conscientemente um furo de segurança — leia antes
-- de rodar, e prefira reverter só o bloco necessário. Sem perda de dado em
-- nenhuma direção (a 0053 não removeu tabela, coluna nem linha).
-- =============================================================================

-- (D) Volta ao state OAuth reutilizável dentro da janela de 10 minutos.
drop function if exists consume_oauth_state_nonce(text);
drop table if exists used_oauth_states;

-- (C) Remove o rate limiting de login. `features/auth/actions.ts` precisa
--     parar de chamar assert_login_not_locked/record_login_attempt ANTES de
--     rodar este bloco, ou as Server Actions vão lançar erro de função
--     inexistente.
drop function if exists record_login_attempt(text, text, boolean);
drop function if exists assert_login_not_locked(text);
drop table if exists login_attempts;

-- (B) Volta audit_log a legível por qualquer platform_role.
drop policy if exists "audit_read" on audit_log;
create policy "audit_read" on audit_log for select using (auth_is_platform_admin());

-- (A) Volta pousada_payment_accounts a legível por admin_pousada e por
--     qualquer platform_role (não só proprietario/master).
drop policy if exists "payment_accounts_read" on pousada_payment_accounts;
create policy "payment_accounts_read" on pousada_payment_accounts for select
  using (auth_can_manage_pousada(pousada_id) or auth_is_platform_admin());
