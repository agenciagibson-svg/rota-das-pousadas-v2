-- Rollback da 0086 — remove o registro manual de pagamento da diária.
-- Pagamentos já registrados continuam em `payments` (provider_ref 'manual:%').
drop function if exists public.register_booking_payment(uuid, numeric, text, text);
drop function if exists public.reverse_booking_payment(uuid, text);
