-- =============================================================================
-- Ciclo 2B — correção aditiva de grants implícitos em funções pré-existentes.
--
-- Achado na auditoria remota do Ciclo 2B: `auth_is_platform_admin()` e
-- `create_pousada()` (definidas em 0002_rls.sql e 0005_create_pousada_fn.sql,
-- ambas já potencialmente aplicadas em bancos reais) têm EXECUTE concedido a
-- PUBLIC pelo comportamento padrão do Postgres, nunca revogado
-- explicitamente. Ambas já têm guarda interna (`auth.uid()`), então o risco
-- prático já era baixo — mas por defesa em profundidade, e para fechar o
-- mesmo padrão já corrigido nas funções do Ciclo 2/2B, fechamos aqui também.
--
-- Não editamos 0002/0005 diretamente porque, ao contrário de 0013-0017,
-- essas migrations já podem fazer parte do histórico aplicado em ambientes
-- reais — a correção entra como migration nova e aditiva, nunca alterando
-- o arquivo original.
--
-- - `auth_is_platform_admin()` é avaliada dentro de expressões de RLS
--   alcançáveis por `anon` (ex.: pousadas_public_read, rooms_read) — precisa
--   continuar concedida a `anon, authenticated`, igual ao padrão já usado
--   para os outros helpers de RLS (auth_is_member_of, auth_can_manage_pousada,
--   auth_has_active_grant, auth_is_active_owner_of).
-- - `create_pousada()` é uma RPC de negócio chamada só por usuário
--   autenticado (já rejeita `auth.uid() is null` internamente) — grant
--   apenas para `authenticated`, sem caso de uso anônimo.
-- =============================================================================

revoke execute on function auth_is_platform_admin() from public;
grant execute on function auth_is_platform_admin() to anon, authenticated;

revoke execute on function create_pousada(text, text, text, text, integer, text) from public;
grant execute on function create_pousada(text, text, text, text, integer, text) to authenticated;
