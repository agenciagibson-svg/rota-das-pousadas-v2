-- 0100: duas reservas com cupom ao mesmo tempo (dados de cupons-0100.sql).
-- O scripts/test-database.mjs troca USER_ID, GUEST_ID, ROOM_ID, CHECKIN,
-- CHECKOUT, SUBTOTAL e COUPON e roda duas cópias em paralelo. A primeira trava a linha
-- do cupom e segura a transação; a segunda espera e, ao seguir, já enxerga o
-- uso da primeira.
begin;
set role authenticated;
set request.jwt.claim.sub = 'USER_ID';
select create_booking_with_coupon(
  p_pousada_id => 'c0100000-0000-0000-0000-000000000100',
  p_room_id => 'ROOM_ID',
  p_responsible_guest_id => 'GUEST_ID',
  p_checkin => 'CHECKIN', p_checkout => 'CHECKOUT', p_adults => 1,
  p_subtotal => SUBTOTAL,
  p_coupon_code => 'COUPON');
select pg_sleep(0.7);
commit;
