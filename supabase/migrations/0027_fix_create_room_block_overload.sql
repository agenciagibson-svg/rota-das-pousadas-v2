-- =============================================================================
-- Ciclo 3B — correção: `create or replace function` só substitui quando a
-- lista de tipos de parâmetro é IDÊNTICA. Adicionar `p_source` no final em
-- 0026 não substituiu a função de 7 parâmetros — criou uma SEGUNDA função
-- sobrecarregada com o mesmo nome. Com as duas no ar, qualquer chamada com
-- os 7 parâmetros originais passa a ser ambígua ("Could not choose the best
-- candidate function"), quebrando a tela de Bloqueios existente.
--
-- Corrigido removendo explicitamente a versão de 7 parâmetros — só a de 8
-- (com p_source opcional) permanece.
-- =============================================================================

drop function if exists create_room_block(
  uuid, uuid, room_block_type, timestamptz, timestamptz, text, text
);
