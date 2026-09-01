-- =============================================================================
-- Ciclo 4 (2/5) — Acompanhantes da reserva (booking_guests).
--
-- `bookings` referenciará esta tabela indiretamente (via booking_id) só a
-- partir de 0032 (a coluna responsible_guest_id de bookings é criada lá) —
-- ordem não importa aqui porque booking_guests referencia bookings.id, que já
-- existe desde 0001.
-- =============================================================================

create type booking_guest_type as enum ('responsible', 'adult', 'child', 'infant');

create table booking_guests (
  id                 uuid primary key default gen_random_uuid(),
  booking_id         uuid not null references bookings(id) on delete cascade,
  guest_id           uuid references guests(id),
  full_name          text not null,
  guest_type         booking_guest_type not null,
  has_special_needs  boolean not null default false,
  birth_date         date,
  document_type      text,
  document_number    text,
  operational_notes  text not null default '',
  created_at         timestamptz not null default now(),
  check (length(trim(full_name)) > 0)
);

create index idx_booking_guests_booking on booking_guests(booking_id);
create index idx_booking_guests_guest on booking_guests(guest_id);

-- Exatamente um responsável por reserva.
create unique index idx_booking_guests_one_responsible
  on booking_guests(booking_id)
  where guest_type = 'responsible';

-- ----------------------------------------------------------------------------
-- RLS — mesmo escopo de leitura de `bookings_read` (hóspede da própria
-- reserva ou equipe operacional da pousada dona da reserva). Escrita só por
-- RPC (set_booking_companions, 0034); a policy de escrita aqui é a segunda
-- camada de defesa, igual ao padrão de `guests`.
-- ----------------------------------------------------------------------------
alter table booking_guests enable row level security;

create policy "booking_guests_read" on booking_guests for select
  using (exists (
    select 1 from bookings b
    where b.id = booking_guests.booking_id
      and (b.guest_id = auth.uid() or auth_has_operational_access(b.pousada_id)
           or auth_has_active_grant(b.pousada_id) or auth_is_platform_admin())
  ));

create policy "booking_guests_write" on booking_guests for all
  using (exists (
    select 1 from bookings b
    where b.id = booking_guests.booking_id
      and (auth_has_guest_access(b.pousada_id) or auth_is_platform_admin())
  ))
  with check (exists (
    select 1 from bookings b
    where b.id = booking_guests.booking_id
      and (auth_has_guest_access(b.pousada_id) or auth_is_platform_admin())
  ));
