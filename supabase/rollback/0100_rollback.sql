-- Desfaz 0100 (cupons para quem reserva direto).
--
-- ATENÇÃO: os descontos já gravados em bookings.discount/total ficam como
-- estão (são o valor combinado com o hóspede). Some apenas o registro de qual
-- cupom foi usado, os cupons e o histórico de tentativas.

drop trigger if exists trg_release_coupon_on_booking_cancel on bookings;
drop function if exists release_coupon_on_booking_cancel();

drop function if exists create_booking_with_coupon(uuid, uuid, uuid, date, date, integer, integer, text, booking_origin, text, integer, integer, integer, boolean);
drop function if exists preview_booking_coupon(uuid, date, date, text);
drop function if exists get_featured_coupon(text);
drop function if exists set_pousada_coupon_featured(uuid, boolean);
drop function if exists set_pousada_coupon_active(uuid, boolean);
drop function if exists create_pousada_coupon(uuid, text, text, integer, date, date, date, date, integer, integer);
drop function if exists list_pousada_coupons(uuid);
drop function if exists coupon_evaluate(uuid, text, date, date, integer, uuid, boolean);
drop function if exists coupon_record_failure(uuid, uuid);
drop function if exists coupon_rate_limited(uuid);
drop function if exists coupon_public_room_pousada(uuid);
drop function if exists coupon_discount(text, integer, integer);

drop table if exists coupon_attempts;
drop table if exists booking_coupon_redemptions;
drop table if exists pousada_coupons;
