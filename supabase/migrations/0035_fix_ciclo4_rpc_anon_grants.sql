-- =============================================================================
-- Ciclo 4 — correção de grants: as 6 RPCs criadas em 0034 tiveram
-- `revoke ... from public` mas NÃO `revoke ... from anon` explícito. O
-- default de privilégios do Supabase concede EXECUTE a `anon` DIRETAMENTE
-- (não via PUBLIC) em toda função nova — mesmo achado já corrigido nos
-- Ciclos 2B (0019) e 3B (0028), reincidente aqui por falha de checklist ao
-- escrever 0034. Verificado ao vivo (information_schema.routine_privileges)
-- antes desta correção: create_booking, upsert_guest, update_booking,
-- set_booking_status, expire_pending_booking e set_booking_companions
-- estavam todas com anon:EXECUTE — qualquer requisição anônima direta à API
-- REST poderia CHAMAR essas funções (a checagem `auth.uid() is null` interna
-- ainda bloquearia o efeito, mas o grant em si já é a primeira barreira
-- exigida pela disciplina de segurança do projeto — nunca depender só da
-- checagem em runtime).
-- =============================================================================

revoke execute on function upsert_guest(
  uuid, uuid, uuid, text, text, text, text, text, text, text, date, text, text, text, text,
  text, jsonb, text[], text, text, text, boolean, guest_source
) from anon;

revoke execute on function create_booking(
  uuid, uuid, uuid, text, date, date, integer, integer, integer, boolean, integer, integer, integer,
  integer, integer, integer, booking_status, booking_origin, uuid, text, text, numeric, text, text, text, timestamptz
) from anon;

revoke execute on function update_booking(
  uuid, integer, uuid, uuid, date, date, integer, integer, integer, boolean, integer, integer,
  integer, integer, integer, integer, booking_origin, text, text, text
) from anon;

revoke execute on function set_booking_status(uuid, booking_status, text) from anon;

revoke execute on function expire_pending_booking(uuid) from anon;

revoke execute on function set_booking_companions(uuid, integer, jsonb) from anon;
