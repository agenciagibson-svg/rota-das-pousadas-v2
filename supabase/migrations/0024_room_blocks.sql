-- =============================================================================
-- Ciclo 3 (parte 3/4) — bloqueios de acomodação (room_blocks).
--
-- Entidade NOVA e dedicada — ver decisão/conflito registrado em 0022 sobre a
-- coexistência com `availability` (mecanismo antigo, intocado, do Ciclo 4).
-- =============================================================================

create type room_block_type as enum (
  'maintenance', 'internal_use', 'owner_reservation', 'interdiction',
  'renovation', 'operational_unavailability', 'other'
);

create type room_block_status as enum ('active', 'cancelled', 'expired');

create table room_blocks (
  id                  uuid primary key default gen_random_uuid(),
  pousada_id          uuid not null references pousadas(id) on delete cascade,
  room_id             uuid not null references rooms(id) on delete cascade,
  block_type          room_block_type not null,
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  reason              text not null,
  notes               text not null default '',
  status              room_block_status not null default 'active',
  created_by          uuid references profiles(id),
  cancelled_by        uuid references profiles(id),
  created_at          timestamptz not null default now(),
  cancelled_at        timestamptz,
  cancellation_reason text,
  check (ends_at > starts_at),
  check (length(trim(reason)) > 0)
);
create index idx_room_blocks_room_period on room_blocks(room_id, starts_at, ends_at);
create index idx_room_blocks_pousada on room_blocks(pousada_id);
create index idx_room_blocks_status on room_blocks(status);

-- Acomodação do bloqueio precisa pertencer à mesma pousada informada.
create or replace function enforce_room_block_same_pousada()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from rooms r where r.id = new.room_id and r.pousada_id = new.pousada_id) then
    raise exception 'A acomodação informada não pertence a esta pousada.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_room_block_same_pousada on room_blocks;
create trigger trg_room_block_same_pousada
  before insert or update of room_id, pousada_id on room_blocks
  for each row execute function enforce_room_block_same_pousada();
