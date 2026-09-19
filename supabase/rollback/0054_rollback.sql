-- =============================================================================
-- Rollback da 0054 (correção de autopromoção a platform_role + gestão de
-- papéis + CRUD de destinos).
--
-- Use SÓ se a 0054 quebrar produção e não houver tempo de corrigir para a
-- frente. O bloco (A) REABRE conscientemente a falha crítica de
-- autopromoção a platform_role='master' via API REST direta -- leia antes
-- de rodar, e prefira reverter apenas o bloco necessário em vez do arquivo
-- inteiro.
--
-- Não há perda de dado em nenhuma direção: a 0054 não removeu tabela, coluna
-- nem linha.
-- =============================================================================

-- (C) Remove gestão de papéis de plataforma e o catálogo de destinos pela UI.
drop function if exists list_platform_team();
drop function if exists revoke_platform_role_by_email(text);
drop function if exists set_platform_role_by_email(text, platform_role);
drop function if exists delete_destination(uuid);
drop function if exists update_destination(uuid, text, text, text, text, text[], numeric, integer);
drop function if exists create_destination(text, text, text, text, text[], numeric, integer);
drop function if exists auth_can_manage_destinations();

-- (A) Reabre a autopromoção: qualquer usuário autenticado volta a poder
--     gravar platform_role na própria linha via PATCH direto na API REST.
comment on column public.profiles.platform_role is null;
grant update (platform_role) on public.profiles to authenticated, anon;
grant insert (platform_role) on public.profiles to authenticated, anon;
