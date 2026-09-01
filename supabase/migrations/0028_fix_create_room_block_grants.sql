-- =============================================================================
-- Ciclo 3B — correção de grants: a função `create_room_block(...,p_source)`
-- criada em 0026 (na prática, uma função NOVA — ver 0027) nunca teve
-- REVOKE/GRANT explícitos. O default de privilégios do Supabase concede
-- EXECUTE a `anon`/PUBLIC em toda função nova — mesmo achado já corrigido
-- no Ciclo 2B para outras RPCs, reincidente aqui porque a função é
-- tecnicamente nova, não uma substituição.
-- =============================================================================

revoke execute on function create_room_block(
  uuid, uuid, room_block_type, timestamptz, timestamptz, text, text, text
) from public;
revoke execute on function create_room_block(
  uuid, uuid, room_block_type, timestamptz, timestamptz, text, text, text
) from anon;
grant execute on function create_room_block(
  uuid, uuid, room_block_type, timestamptz, timestamptz, text, text, text
) to authenticated;
