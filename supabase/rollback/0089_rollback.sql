-- Rollback da 0089 — remove o pedido de avaliação por e-mail.
-- Avaliações já gravadas continuam em `reviews`; só as marcas de envio somem.
drop function if exists public.mark_review_reminder_sent(uuid);
drop function if exists public.list_review_reminders_due(integer);
drop function if exists public.mark_review_request_sent(uuid);
drop function if exists public.list_review_requests_due(integer);
drop function if exists public.booking_review_request_eligible(uuid);
drop index if exists public.idx_bookings_review_reminder_pending;
drop index if exists public.idx_bookings_review_request_pending;
alter table public.bookings
  drop column if exists review_reminded_at,
  drop column if exists review_requested_at;
