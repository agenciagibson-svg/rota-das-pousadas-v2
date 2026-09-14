-- =============================================================================
-- Rollback da 0047 (correção dos bloqueadores da auditoria de 14/09/2026).
--
-- Use SÓ se a 0047 quebrar produção e não houver tempo de corrigir para a
-- frente. Cada bloco abaixo REABRE conscientemente um furo de segurança — leia
-- o que está reabrindo antes de rodar, e prefira reverter apenas o bloco
-- necessário em vez do arquivo inteiro.
--
-- Não há perda de dado em nenhuma direção: a 0047 não removeu tabela, coluna
-- nem linha.
-- =============================================================================

-- (D) Reabre a adulteração de preço no fluxo público. Depois deste bloco,
--     qualquer viajante logado pode criar reserva de R$ 0,01 pela API REST.
--     Só rode junto com o bloco (C) — sem ele a reserva pública nem conclui.
-- >>> Reaplique o corpo de create_booking da migration 0034 (seção 3).

-- (C) Remove a porta pública de ficha de hóspede. A reserva pública volta a
--     falhar com "Você não tem permissão para gerenciar hóspedes nesta pousada".
drop function if exists ensure_traveler_guest(uuid, text, text);

-- (B) Devolve leitura/escrita de PII de todos os tenants a qualquer papel de
--     plataforma, sem concessão e sem registro.
drop policy if exists "guests_read" on guests;
create policy "guests_read" on guests for select
  using (auth_has_guest_access(pousada_id) or auth_is_platform_admin());
drop policy if exists "guests_write" on guests;
create policy "guests_write" on guests for all
  using (auth_has_guest_access(pousada_id) or auth_is_platform_admin())
  with check (auth_has_guest_access(pousada_id) or auth_is_platform_admin());

drop policy if exists "quote_requests_read" on quote_requests;
create policy "quote_requests_read" on quote_requests for select
  using (auth_has_guest_access(pousada_id) or auth_is_platform_admin());
drop policy if exists "quote_requests_update" on quote_requests;
create policy "quote_requests_update" on quote_requests for update
  using (auth_has_guest_access(pousada_id) or auth_is_platform_admin())
  with check (auth_has_guest_access(pousada_id) or auth_is_platform_admin());

drop policy if exists "channel_calendars_read" on channel_calendars;
create policy "channel_calendars_read" on channel_calendars for select
  using (auth_can_read_channels(pousada_id) or auth_is_platform_admin());
drop policy if exists "channel_calendars_write" on channel_calendars;
create policy "channel_calendars_write" on channel_calendars for all
  using (auth_can_manage_channels(pousada_id) or auth_is_platform_admin())
  with check (auth_can_manage_channels(pousada_id) or auth_is_platform_admin());

-- >>> Reaplique também upsert_guest e set_quote_request_status das migrations
--     0043 e 0046 (as versões que aceitam auth_is_platform_admin()).

-- (A) Reabre a autoconcessão de acesso institucional por qualquer platform_role.
drop policy if exists "grants_read" on platform_access_grants;
create policy "grants_platform_manage" on platform_access_grants for all
  using (auth_is_platform_admin())
  with check (auth_is_platform_admin());
grant insert, update, delete on table platform_access_grants to authenticated;
drop function if exists grant_platform_access(uuid, uuid, text, timestamptz);
drop function if exists revoke_platform_access(uuid);
-- `auth_is_platform_master()` pode ficar: é aditivo e não altera nada sozinho.

-- >>> No app, reverta também:
--     repositories/platform-access.repository.ts (volta a insert/update direto)
--     features/admin/services/admin.service.ts   (volta o logAudit local)
--     features/reservas/services/bookings.service.ts (volta a upsertGuestRpc)
--     proxy.ts + lib/supabase/middleware.ts      (volta a CSP Report-Only)
