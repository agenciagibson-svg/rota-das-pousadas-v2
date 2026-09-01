-- =============================================================================
-- Ciclo 3C — remove a última exposição de coluna administrativa via RLS de
-- linha: `rooms_read` liberava a linha INTEIRA (internal_notes,
-- operational_description, created_by, updated_by, status operacional
-- detalhado...) para qualquer visitante anônimo quando a pousada estava
-- `publicada`. RLS controla LINHA, não coluna — a única forma correta de
-- expor só um subconjunto de campos é uma projeção dedicada.
--
-- Auditoria (Ciclo 3C, item 1): `/pousadas` e `/pousada/[slug]` NÃO
-- consultam `rooms` hoje — usam só colunas de `pousadas`. O único consumidor
-- público real é `getBookableRoomBySlug()` (fluxo de reserva, página
-- `/pousada/[slug]/reservar`, alcançável por anônimo). Também identificado:
-- `/minhas-reservas` (hóspede AUTENTICADO) lê `rooms.name` para reservas
-- que ele mesmo fez — esse caso não é "público" (exige login), mas também
-- não é "membro da pousada", então precisa de uma regra própria, estreita,
-- para não quebrar ao remover o branch de pousada publicada.
--
-- Classificação de campos:
--   Públicos/comerciais: name, description, categoria (nome), capacity,
--     capacity_max, bed_config, accessible, pets_allowed, base_price,
--     display_order, comodidades (nomes).
--   Nunca públicos: internal_notes, operational_description,
--     operational_status, location, code, created_by, updated_by,
--     created_at, updated_at, qualquer bloqueio.
-- `code` fica de fora por padrão (a instrução exige "decisão expressa" para
-- expor — não foi dada, então fica de fora).
-- =============================================================================

-- ----------------------------------------------------------------------------
-- (1) Remove o branch público de `rooms_read`; adiciona o branch estreito
-- "hóspede lê o quarto da própria reserva" no lugar (não reabre exposição
-- geral — só funciona para uma reserva que realmente existe e pertence a
-- quem está consultando).
-- ----------------------------------------------------------------------------
drop policy "rooms_read" on rooms;
create policy "rooms_read" on rooms for select
  using (
    exists (select 1 from bookings b where b.room_id = rooms.id and b.guest_id = auth.uid())
    or auth_has_room_read_access(pousada_id)
    or auth_is_platform_admin()
  );
-- Governança não muda: já não estava neste branch desde 0026, continua
-- exclusivamente em list_rooms_for_housekeeping (não tocada aqui).

-- ----------------------------------------------------------------------------
-- (2) Projeção pública segura — única forma de um visitante anônimo (ou
-- autenticado sem vínculo) conhecer acomodações de uma pousada publicada.
-- Valida status público e tenant DENTRO da função — nunca aceita o
-- resultado como pré-autorizado pelo chamador.
-- ----------------------------------------------------------------------------
create or replace function list_public_rooms(p_slug text)
returns table(
  id uuid,
  name text,
  description text,
  category_name text,
  capacity integer,
  capacity_max integer,
  bed_config jsonb,
  accessible boolean,
  pets_allowed boolean,
  base_price integer,
  display_order integer,
  amenity_names text[]
)
language sql stable security definer set search_path = public as $$
  select
    r.id,
    r.name,
    r.description,
    c.name as category_name,
    r.capacity,
    r.capacity_max,
    r.bed_config,
    r.accessible,
    r.pets_allowed,
    r.base_price,
    r.display_order,
    coalesce(
      (select array_agg(a.name order by a.name)
       from room_amenities ra join amenities a on a.id = ra.amenity_id
       where ra.room_id = r.id),
      '{}'::text[]
    ) as amenity_names
  from rooms r
  join pousadas p on p.id = r.pousada_id
  left join accommodation_categories c on c.id = r.category_id and c.status = 'active'
  where p.slug = p_slug
    and p.status = 'publicada'
    and p.tenant_status in ('onboarding', 'active')
    and r.status = 'active'
    and r.public_visible = true
  order by r.display_order, r.name;
$$;
revoke execute on function list_public_rooms(text) from public;
grant execute on function list_public_rooms(text) to anon, authenticated;
