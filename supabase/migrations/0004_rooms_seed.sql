-- =============================================================================
-- Reservas — quarto padrão por pousada publicada
-- Cria uma acomodação base para cada pousada (idempotente), para que reservas
-- possam referenciar um room_id. Acomodações detalhadas virão do dashboard do
-- proprietário numa etapa futura.
-- =============================================================================

insert into rooms (pousada_id, name, capacity, size, base_price, description)
select p.id, 'Acomodação principal', 4, '—', p.price_per_night,
       'Acomodação padrão da pousada.'
from pousadas p
where p.status = 'publicada'
  and not exists (select 1 from rooms r where r.pousada_id = p.id);
