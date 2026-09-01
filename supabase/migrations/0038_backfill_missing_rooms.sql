-- =============================================================================
-- Corrige pousadas publicadas sem nenhuma acomodação (rooms). A migration
-- 0004_rooms_seed.sql rodou antes de as 4 pousadas de vitrine (seed.sql)
-- existirem na tabela `pousadas`, então elas nunca ganharam a acomodação
-- padrão — hoje ficam sem quarto reservável ("Indisponível" na página
-- pública, reserva impossível). Mesmo padrão idempotente de 0004, reaplicado
-- porque migrations não voltam a rodar sozinhas.
-- =============================================================================

insert into rooms (pousada_id, name, capacity, base_price, description, public_visible)
select p.id, 'Acomodação principal', 4, p.price_per_night,
       'Acomodação padrão da pousada.', true
from pousadas p
where p.status = 'publicada'
  and not exists (select 1 from rooms r where r.pousada_id = p.id);
