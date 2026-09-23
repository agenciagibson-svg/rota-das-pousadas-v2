-- Rollback da 0069_booking_folio.sql — remove a conta do hóspede.
-- Atenção: apaga os lançamentos de consumo (o saldo volta a ser total −
-- recebido). Os pagamentos manuais continuam como pagamentos aprovados — é
-- dinheiro recebido de verdade —, mas perdem a origem, quem registrou, a
-- observação e os dados de estorno. `balance_due` volta com a expressão da
-- 0042, mas no fim da tabela (a posição da coluna muda; o valor não).

drop function if exists reverse_manual_payment(uuid, text);
drop function if exists register_manual_payment(uuid, text, numeric, text);
drop function if exists cancel_booking_charge(uuid, text);
drop function if exists add_booking_charge(uuid, text, integer, numeric);

alter table bookings drop column if exists balance_due;
alter table bookings drop constraint if exists bookings_charges_amount_nonneg;
alter table bookings drop column if exists charges_amount;
alter table bookings add column balance_due numeric(14,2)
  generated always as (total - amount_received) stored;

drop table if exists booking_charges;

alter table payments drop constraint if exists payments_manual_method_check;
alter table payments drop constraint if exists payments_source_check;
alter table payments
  drop column if exists reversal_reason,
  drop column if exists reversed_by,
  drop column if exists reversed_at,
  drop column if exists notes,
  drop column if exists recorded_by,
  drop column if exists source;
