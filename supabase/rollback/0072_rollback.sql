-- Rollback da 0072 — remove o limite de pedidos de nova senha.
drop function if exists claim_password_reset_slot(text, text);
drop table if exists password_reset_requests;
