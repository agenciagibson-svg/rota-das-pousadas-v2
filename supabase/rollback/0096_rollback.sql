-- Desfaz 0096 (mover reserva pelo mapa de ocupação). As reservas já movidas
-- continuam onde estão; só a função sai. O código que chama `move_booking`
-- passa a receber erro — publique a versão sem o mapa antes de reverter.
drop function if exists public.move_booking(uuid, integer, uuid, date, date, boolean);
