-- =============================================================================
-- Ciclo 3 (parte 2/4) — comodidades por acomodação.
--
-- Reutiliza o catálogo `amenities` já existente (0001) — não duplicado. A
-- junção `pousada_amenities` (0001) já existente descreve comodidades no
-- nível da pousada (usada pela área pública); `room_amenities` é NOVA e
-- descreve comodidades no nível da acomodação individual (ex.: só a suíte
-- tem banheira) — granularidade que não existia antes.
-- =============================================================================

create table room_amenities (
  room_id    uuid not null references rooms(id) on delete cascade,
  amenity_id uuid not null references amenities(id) on delete cascade,
  primary key (room_id, amenity_id)
);
create index idx_room_amenities_room on room_amenities(room_id);
