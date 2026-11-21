-- Rollback da 0112 (ofertas automáticas). Volte o app para uma versão anterior
-- ao PR da 0112 antes. As ofertas automáticas já enviadas continuam (são da 0111).
drop function if exists public.run_auto_offers(text, date, date);
drop function if exists public.auto_offer_targets(uuid, text, integer, integer);
drop function if exists public.save_auto_offers(uuid, boolean, integer, boolean, integer, boolean, integer);
drop function if exists public.get_auto_offers(uuid);
drop table if exists public.pousada_auto_offers;
