-- =============================================================================
-- Ciclo 4 (4/5) — Proteção atômica contra overbooking.
--
-- A validação de disponibilidade na aplicação (queryAvailability, Ciclo 3B)
-- não é suficiente sozinha: duas requisições simultâneas podem ambas passar
-- pela validação antes de qualquer uma gravar. A defesa real é uma EXCLUDE
-- CONSTRAINT no Postgres — atômica, não depende de lock explícito na
-- aplicação, e é a solução padrão para "duas reservas não podem sobrepor o
-- mesmo recurso" (range types + GiST).
--
-- Intervalo semiaberto [checkin, checkout) — checkout em 10/09 e novo checkin
-- em 10/09 não conflitam, exatamente como pedido.
--
-- Só bloqueiam inventário: pending e confirmed. `quote` é só um orçamento,
-- não reserva a acomodação. `cancelled`/`no_show` liberam. `checked_in`
-- entra na cláusula por preparação (nenhuma transição chega lá neste ciclo,
-- mas quando chegar em ciclo futuro já estará protegida sem nova migration).
-- =============================================================================

create extension if not exists btree_gist;

alter table bookings
  add column stay_range daterange generated always as (daterange(checkin, checkout, '[)')) stored;

alter table bookings
  add constraint bookings_no_overlap
  exclude using gist (room_id with =, stay_range with &&)
  where (status in ('pending', 'confirmed', 'checked_in'));
