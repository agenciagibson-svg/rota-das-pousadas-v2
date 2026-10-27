-- Desfaz 0094 (calendário com preço e link da reserva para o acompanhante).
-- Os links já enviados param de abrir (a página mostra "link não encontrado").
drop function if exists public.get_shared_booking(text);
drop function if exists public.revoke_my_booking_share(uuid);
drop function if exists public.share_my_booking(uuid, boolean);
drop function if exists public.new_booking_share_token();
drop table if exists public.booking_share_links;
drop function if exists public.public_price_calendar(text, date, date, integer, uuid);
drop function if exists public.public_calendar_max_days();
