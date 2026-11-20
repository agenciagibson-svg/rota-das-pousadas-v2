-- Rollback da 0106 (origem das reservas). Apaga a origem gravada das reservas.
-- Antes de rodar, volte o app para uma versão anterior ao PR da 0106: a versão
-- nova chama as RPCs removidas aqui (a criação da reserva segue funcionando,
-- só a gravação da origem falha em silêncio).
drop function if exists public.list_platform_booking_channels(date);
drop function if exists public.record_booking_attribution(uuid, text, text, text, text, text, text, text, text, timestamptz);
drop function if exists public.booking_channel(text, text, text, text);
drop table if exists public.booking_attribution;
