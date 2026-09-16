-- =============================================================================
-- Rollback da 0051 (RLS granular de `pousadas`).
--
-- Use só se a 0051 quebrar produção (ex.: algum papel de plataforma que
-- devia mutar pousada e ficou de fora). Isso REABRE conscientemente o furo:
-- suporte/marketing/financeiro_plataforma voltam a poder criar/editar/
-- excluir qualquer pousada via API REST direta. Não há perda de dado.
-- =============================================================================

drop policy if exists "pousadas_insert" on pousadas;
create policy "pousadas_insert" on pousadas for insert
  with check (owner_id = auth.uid() or auth_is_platform_admin());

drop policy if exists "pousadas_update" on pousadas;
create policy "pousadas_update" on pousadas for update
  using (auth_can_manage_pousada(id) or auth_is_platform_admin())
  with check (auth_can_manage_pousada(id) or auth_is_platform_admin());

drop policy if exists "pousadas_delete" on pousadas;
create policy "pousadas_delete" on pousadas for delete
  using (owner_id = auth.uid() or auth_is_platform_admin());

drop function if exists auth_can_manage_pousadas_platform();
