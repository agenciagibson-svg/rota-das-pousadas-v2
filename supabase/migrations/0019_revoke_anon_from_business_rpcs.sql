-- =============================================================================
-- Ciclo 2B — correção pós-verificação: remove EXECUTE de `anon` em RPCs de
-- negócio que devem ser exclusivas de usuário autenticado.
--
-- Achado ao validar 0016/0017/0018 contra o banco real: o Supabase configura
-- `ALTER DEFAULT PRIVILEGES` no schema `public` de cada projeto, concedendo
-- EXECUTE automaticamente a `anon, authenticated, service_role` em TODA
-- função nova — independente do `grant ... to authenticated` explícito
-- escrito nas migrations anteriores. `revoke ... from public` (already
-- aplicado) não alcança esse grant, porque ele não veio de PUBLIC — veio do
-- default de privilégios do próprio Supabase, concedido diretamente a `anon`.
--
-- Risco prático já era baixo (as 4 funções abaixo rejeitam `auth.uid() is
-- null` internamente, ou sua condição interna nunca casa para chamador
-- anônimo), mas o grant não batia com a intenção documentada nas migrations
-- de origem. Corrigido aqui, explicitamente, para `anon`.
--
-- Não repete a correção nos helpers de RLS (auth_is_member_of,
-- auth_can_manage_pousada, auth_is_active_owner_of, auth_is_platform_admin)
-- — esses PRECISAM continuar com `anon`, são avaliados na navegação pública.
-- =============================================================================

revoke execute on function accept_membership_invite(uuid) from anon;
revoke execute on function invite_membership(uuid, text, user_role) from anon;
revoke execute on function list_membership_emails(uuid) from anon;
revoke execute on function create_pousada(text, text, text, text, integer, text) from anon;
