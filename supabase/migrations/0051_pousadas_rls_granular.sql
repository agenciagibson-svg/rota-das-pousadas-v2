-- =============================================================================
-- Auditoria de código de 16/09/2026 — RLS de `pousadas` granular demais.
--
-- `pousadas_insert`/`pousadas_update`/`pousadas_delete` (0002) usam
-- `auth_is_platform_admin()`, que só pergunta "tem algum platform_role?" —
-- isso inclui `suporte`, `marketing` e `financeiro_plataforma`, que a matriz
-- RBAC da aplicação (lib/auth/rbac.ts) NUNCA autoriza a criar, editar,
-- aprovar ou excluir pousada. Como a `anon key` é pública (vai no bundle do
-- navegador), qualquer usuário autenticado com um desses papéis poderia
-- chamar a API REST do Supabase direto, pulando a Server Action e a
-- primeira barreira — mesma classe de bug que a 0047 já corrigiu para
-- `platform_access_grants`, `guests`, `quote_requests` e `channel_calendars`.
--
-- Quem de fato muta `pousadas` hoje (features/admin/services/admin.service.ts):
--   - `createPousadaAsAdmin`  → `pousada:create` → comercial, master
--   - `approvePousada`/`rejectPousada`/`changePousadaStatus`
--                             → `pousada:approve` → comercial, master
--   - rollback de `createPousadaAsAdmin` quando a acomodação falha
--     (`deletePousada` logo após o insert, pousada ainda sem `owner_id`)
--                             → mesma chamada de comercial/master
-- Ou seja: na prática, insert/update/delete pelo lado da plataforma são
-- sempre comercial ou master — nunca os outros três papéis. Por isso o
-- helper novo cobre os dois nas três policies, em vez de tentar reproduzir
-- a assimetria exata da matriz (`pousada:edit` sozinho seria só `master` do
-- lado da plataforma, mas isso quebraria o rollback de `comercial`, que
-- limpa a própria pousada malsucedida — não é uma ação de "editar/excluir
-- pousada de terceiro", é desfazer a própria operação).
--
-- Nada aqui remove tabela, coluna ou linha. Reversão: ver
-- `supabase/rollback/0051_rollback.sql`.
-- =============================================================================

create or replace function auth_can_manage_pousadas_platform()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.platform_role in ('comercial', 'master')
  );
$$;
revoke execute on function auth_can_manage_pousadas_platform() from public;
grant execute on function auth_can_manage_pousadas_platform() to anon, authenticated;

comment on function auth_can_manage_pousadas_platform() is
  'Espelha quem de fato muta `pousadas` pelo lado da plataforma hoje (pousada:create/pousada:approve, lib/auth/rbac.ts): comercial e master. auth_is_platform_admin() é mais largo (qualquer platform_role) e não devia ser usado em policy de pousadas.';

drop policy if exists "pousadas_insert" on pousadas;
create policy "pousadas_insert" on pousadas for insert
  with check (owner_id = auth.uid() or auth_can_manage_pousadas_platform());

drop policy if exists "pousadas_update" on pousadas;
create policy "pousadas_update" on pousadas for update
  using (auth_can_manage_pousada(id) or auth_can_manage_pousadas_platform())
  with check (auth_can_manage_pousada(id) or auth_can_manage_pousadas_platform());

drop policy if exists "pousadas_delete" on pousadas;
create policy "pousadas_delete" on pousadas for delete
  using (owner_id = auth.uid() or auth_can_manage_pousadas_platform());
