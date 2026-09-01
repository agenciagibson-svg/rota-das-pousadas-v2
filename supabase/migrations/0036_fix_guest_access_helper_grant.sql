-- =============================================================================
-- Ciclo 4 — endurecimento de grant (não é vazamento de dado: a função só
-- retorna boolean e, para `anon` — sem auth.uid() — sempre resolve `false`,
-- mesmo padrão já aceito no projeto para helpers booleanos). Ajuste por
-- consistência: `auth_has_guest_access` nunca é avaliada por nenhuma policy
-- alcançável por anônimo (diferente de auth_is_member_of/auth_can_manage_pousada,
-- que precisam de anon por aparecerem em rooms_read/pousadas_public_read).
-- Conceder o mínimo necessário: só authenticated.
-- =============================================================================

revoke execute on function auth_has_guest_access(uuid) from anon;
