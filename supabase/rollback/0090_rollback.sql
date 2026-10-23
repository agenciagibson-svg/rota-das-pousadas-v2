-- Rollback da 0090 — remove a exclusão de conta pelo titular.
-- Contas já excluídas continuam anonimizadas (não há como "desexcluir": os
-- dados pessoais foram apagados e o Auth ofuscou e-mail e senha).
drop function if exists public.delete_my_account();
alter table public.profiles drop column if exists deleted_at;
