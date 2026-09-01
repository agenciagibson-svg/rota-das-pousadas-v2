-- =============================================================================
-- Ciclo 3 — Acomodações e Disponibilidade (parte 1/4)
--
-- DECISÃO (regra 1.10 do escopo): `rooms` (0001) já representa a acomodação
-- operacional — evoluída aditivamente aqui, sem entidade nova. Nenhuma coluna
-- removida, nenhum dado apagado. As 4 pousadas publicadas e suas rooms (hoje
-- 0 linhas — 0004 nunca rodou, por decisão já registrada no Ciclo 2C)
-- continuam intactas.
--
-- CONFLITO REGISTRADO (não resolvido aqui, por instrução explícita de não
-- redesenhar reservas neste ciclo): a tabela `availability` (0001) já existe
-- e já é usada HOJE por `repositories/management.repository.ts`
-- (blockDate/unblockDate/listBlockedDates — o calendário do proprietário em
-- features/gestao). É um mecanismo diferente (bloqueio por DIA, sem tipo,
-- sem motivo, sem auditoria própria) do `room_blocks` pedido neste ciclo
-- (por PERÍODO com hora, tipado, auditado). Os dois mecanismos passam a
-- coexistir: `availability` continua servindo exclusivamente o calendário
-- de reservas já existente (Ciclo 4 vai unificar isso); `room_blocks` é o
-- novo mecanismo operacional deste ciclo, para a tela de inventário. O motor
-- de disponibilidade novo (features/acomodacoes) só lê `room_blocks` +
-- `bookings` — nunca `availability` — para não misturar as duas fontes.
-- =============================================================================

create type accommodation_status as enum ('active', 'inactive');

create type room_operational_status as enum (
  'available', 'occupied', 'awaiting_cleaning', 'cleaning',
  'inspection_pending', 'maintenance', 'blocked'
);

-- ----------------------------------------------------------------------------
-- Categorias de acomodação
-- ----------------------------------------------------------------------------
create table accommodation_categories (
  id                   uuid primary key default gen_random_uuid(),
  pousada_id           uuid not null references pousadas(id) on delete cascade,
  name                 text not null,
  code                 text,
  description          text not null default '',
  default_capacity     integer not null default 2,
  max_capacity         integer,
  default_bed_count    integer not null default 1,
  base_price_suggestion integer,
  display_order        integer not null default 0,
  status               accommodation_status not null default 'active',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid references profiles(id),
  check (max_capacity is null or max_capacity >= default_capacity),
  check (base_price_suggestion is null or base_price_suggestion >= 0)
);
create index idx_categories_pousada on accommodation_categories(pousada_id);
create unique index idx_categories_name_unique on accommodation_categories(pousada_id, lower(name));
create unique index idx_categories_code_unique on accommodation_categories(pousada_id, code) where code is not null;

-- ----------------------------------------------------------------------------
-- rooms: extensão aditiva (acomodação operacional real)
-- ----------------------------------------------------------------------------
alter table rooms
  add column if not exists category_id uuid references accommodation_categories(id),
  add column if not exists code text,
  add column if not exists operational_description text not null default '',
  add column if not exists location text not null default '',
  add column if not exists capacity_max integer,
  add column if not exists adults_max integer,
  add column if not exists children_max integer not null default 0,
  add column if not exists infants_allowed boolean not null default true,
  add column if not exists pets_allowed boolean not null default false,
  -- Configuração de camas: JSONB tipado no app (Zod), não texto livre —
  -- ver features/acomodacoes/schemas.ts. Evita uma junção bed_types+room_beds
  -- que seria peso extra sem necessidade real neste ciclo.
  add column if not exists bed_config jsonb not null default '[]'::jsonb,
  add column if not exists accessible boolean not null default false,
  add column if not exists status accommodation_status not null default 'active',
  add column if not exists operational_status room_operational_status not null default 'available',
  add column if not exists public_visible boolean not null default true,
  add column if not exists display_order integer not null default 0,
  add column if not exists internal_notes text not null default '',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists created_by uuid references profiles(id),
  add column if not exists updated_by uuid references profiles(id);

-- "description" (0001) já é a descrição curta/pública — mantida como está,
-- sem renomear (evita quebrar contrato existente da área pública).

alter table rooms add constraint rooms_capacity_max_check
  check (capacity_max is null or capacity_max >= capacity);
alter table rooms add constraint rooms_base_price_nonneg
  check (base_price >= 0);

create unique index idx_rooms_code_unique on rooms(pousada_id, code) where code is not null;
create index idx_rooms_category on rooms(category_id);
create index idx_rooms_status on rooms(pousada_id, status, operational_status);

-- Categoria precisa pertencer à mesma pousada da acomodação — não expressável
-- por CHECK simples (referencia outra tabela); reforçado por trigger.
create or replace function enforce_room_category_same_pousada()
returns trigger language plpgsql as $$
begin
  if new.category_id is not null then
    if not exists (
      select 1 from accommodation_categories c
      where c.id = new.category_id and c.pousada_id = new.pousada_id
    ) then
      raise exception 'A categoria informada não pertence a esta pousada.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_room_category_same_pousada on rooms;
create trigger trg_room_category_same_pousada
  before insert or update of category_id, pousada_id on rooms
  for each row execute function enforce_room_category_same_pousada();
