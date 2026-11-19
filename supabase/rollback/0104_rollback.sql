-- Rollback da 0104 (registro da comissão por reserva).
-- Apaga o histórico de comissões registradas. Antes de rodar em produção,
-- exporte `booking_commissions`. As reservas não são tocadas.
drop trigger if exists trg_booking_commission on bookings;
drop function if exists trg_booking_commission();
drop function if exists list_platform_commissions(date);
drop function if exists get_pousada_commission_statement(uuid, date);
drop function if exists record_booking_commission(uuid);
drop table if exists booking_commissions;
drop function if exists platform_commission_rate();
