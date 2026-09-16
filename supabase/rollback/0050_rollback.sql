-- Rollback da 0050 — remove a RPC de expiração automática em lote. Não afeta
-- `expire_pending_booking` (0034, botão manual) nem nenhuma coluna de
-- `bookings` — a 0050 não cria coluna nenhuma.
drop function if exists expire_overdue_pending_bookings();
