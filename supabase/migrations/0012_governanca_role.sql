-- =============================================================================
-- Ciclo 2 — Fase 1 do sistema de gestão: papel de Governança/Limpeza.
-- Aditivo — não altera nem remove dado existente.
--
-- ALTER TYPE ... ADD VALUE fica isolado nesta migration (arquivo próprio),
-- pois o Postgres não permite usar o novo valor do enum na mesma transação
-- em que ele é criado.
-- =============================================================================

alter type user_role add value if not exists 'governanca';
