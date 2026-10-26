-- Rollback da 0097 — remove o relatório mensal por e-mail e as RPCs que
-- completam fichas antigas. Fichas já completadas continuam como estão (os
-- dados vieram do perfil do próprio viajante); só o controle de envio some.
drop function if exists public.apply_guest_profile_backfill(uuid, text, text, text);
drop function if exists public.list_guests_pending_profile_backfill(uuid, integer);
drop function if exists public.guest_profile_backfill_fields(uuid);

drop function if exists public.release_monthly_report(uuid, date);
drop function if exists public.mark_monthly_report_sent(uuid, date, integer);
drop function if exists public.claim_monthly_report(uuid, date);
drop function if exists public.list_monthly_report_recipients(uuid);
drop function if exists public.list_monthly_report_bookings(uuid, date, date);
drop function if exists public.get_monthly_report_pousada(uuid);
drop function if exists public.list_monthly_report_pousadas(date, integer);
drop function if exists public.monthly_report_active_rooms(uuid);
drop table if exists public.monthly_reports_sent;
