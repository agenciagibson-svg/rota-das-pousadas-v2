-- =============================================================================
-- Rota das Pousadas — Migration inicial (schema conceitual → físico)
-- Multi-tenant: a "pousada" é a fronteira de tenant; tabelas de oferta levam
-- pousada_id. RLS é definida em 0002_rls.sql.
-- =============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type user_role as enum (
  'proprietario', 'admin_pousada', 'recepcionista', 'financeiro_pousada'
);

create type platform_role as enum (
  'suporte', 'comercial', 'marketing', 'financeiro_plataforma', 'master'
);

create type pousada_status as enum (
  'rascunho', 'em_analise', 'aprovada', 'publicada', 'suspensa', 'arquivada'
);

create type booking_status as enum (
  'iniciada', 'aguardando_pagamento', 'confirmada', 'em_estadia',
  'concluida', 'cancelada', 'no_show', 'expirada'
);

create type payment_status as enum (
  'pendente', 'aprovado', 'recusado', 'estornado'
);

-- ----------------------------------------------------------------------------
-- Identidade
-- ----------------------------------------------------------------------------
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null default '',
  avatar_url    text,
  platform_role platform_role,           -- null = usuário comum (viajante)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Geografia / catálogo de referência
-- ----------------------------------------------------------------------------
create table states (
  id    uuid primary key default gen_random_uuid(),
  code  char(2) not null unique,
  name  text not null
);

create table cities (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  state_id  uuid not null references states(id),
  unique (name, state_id)
);

create table destinations (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  state          char(2) not null,
  image          text not null,
  pousadas_count integer not null default 0,
  rating         numeric(2,1) not null default 0,
  price_from     integer not null default 0,
  season         text[] not null default '{}',
  created_at     timestamptz not null default now()
);

create table experiences (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  icon        text not null,
  description text not null default ''
);

create table amenities (
  id       uuid primary key default gen_random_uuid(),
  name     text not null unique,
  category text
);

-- ----------------------------------------------------------------------------
-- Catálogo — Pousadas (tenant) e acomodações
-- ----------------------------------------------------------------------------
create table pousadas (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  city            text not null,
  state           char(2) not null,
  destination_id  uuid references destinations(id),
  owner_id        uuid references profiles(id),
  image           text not null default '',
  gallery         text[] not null default '{}',
  rating          numeric(2,1) not null default 0,
  reviews         integer not null default 0,
  price_per_night integer not null default 0,
  tags            text[] not null default '{}',
  description     text not null default '',
  status          pousada_status not null default 'rascunho',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_pousadas_status on pousadas(status);
create index idx_pousadas_destination on pousadas(destination_id);

-- Acesso de equipe à pousada (multi-tenant): quem pode operar cada pousada.
create table memberships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  pousada_id uuid not null references pousadas(id) on delete cascade,
  role       user_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, pousada_id)
);
create index idx_memberships_pousada on memberships(pousada_id);
create index idx_memberships_user on memberships(user_id);

create table rooms (
  id          uuid primary key default gen_random_uuid(),
  pousada_id  uuid not null references pousadas(id) on delete cascade,
  name        text not null,
  capacity    integer not null default 2,
  size        text,
  base_price  integer not null default 0,
  description text not null default ''
);
create index idx_rooms_pousada on rooms(pousada_id);

create table media (
  id         uuid primary key default gen_random_uuid(),
  pousada_id uuid not null references pousadas(id) on delete cascade,
  room_id    uuid references rooms(id) on delete cascade,
  url        text not null,
  alt        text not null default '',
  position   integer not null default 0,
  kind       text not null default 'image'
);
create index idx_media_pousada on media(pousada_id);

create table pousada_experiences (
  pousada_id    uuid not null references pousadas(id) on delete cascade,
  experience_id uuid not null references experiences(id) on delete cascade,
  primary key (pousada_id, experience_id)
);

create table pousada_amenities (
  pousada_id  uuid not null references pousadas(id) on delete cascade,
  amenity_id  uuid not null references amenities(id) on delete cascade,
  primary key (pousada_id, amenity_id)
);

-- ----------------------------------------------------------------------------
-- Inventário — disponibilidade por acomodação e data
-- ----------------------------------------------------------------------------
create table availability (
  id      uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  date    date not null,
  status  text not null default 'disponivel',   -- disponivel | bloqueado | reservado
  price   integer,
  unique (room_id, date)
);
create index idx_availability_room_date on availability(room_id, date);

-- ----------------------------------------------------------------------------
-- Transação — reservas e pagamentos (particionáveis por período em escala)
-- ----------------------------------------------------------------------------
create table bookings (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  pousada_id uuid not null references pousadas(id),
  room_id    uuid not null references rooms(id),
  guest_id   uuid not null references profiles(id),
  checkin    date not null,
  checkout   date not null,
  guests     integer not null default 1,
  subtotal   integer not null default 0,
  fee        integer not null default 0,
  total      integer not null default 0,
  status     booking_status not null default 'iniciada',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (checkout > checkin)
);
create index idx_bookings_pousada on bookings(pousada_id);
create index idx_bookings_guest on bookings(guest_id);
create index idx_bookings_created on bookings(created_at);

create table payments (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  amount     integer not null,
  method     text not null,                 -- stripe | mercadopago | pix
  status     payment_status not null default 'pendente',
  provider_ref text,
  created_at timestamptz not null default now()
);
create index idx_payments_booking on payments(booking_id);

-- ----------------------------------------------------------------------------
-- Social
-- ----------------------------------------------------------------------------
create table reviews (
  id         uuid primary key default gen_random_uuid(),
  pousada_id uuid not null references pousadas(id) on delete cascade,
  booking_id uuid not null references bookings(id) on delete cascade,
  author_id  uuid not null references profiles(id),
  rating     integer not null check (rating between 1 and 5),
  text       text not null default '',
  response   text,
  created_at timestamptz not null default now(),
  unique (booking_id)
);
create index idx_reviews_pousada on reviews(pousada_id);

create table favorites (
  user_id    uuid not null references profiles(id) on delete cascade,
  pousada_id uuid not null references pousadas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, pousada_id)
);

-- ----------------------------------------------------------------------------
-- Governança — auditoria de ações sensíveis
-- ----------------------------------------------------------------------------
create table audit_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references profiles(id),
  action       text not null,
  target_table text,
  target_id    uuid,
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index idx_audit_actor on audit_log(actor_id);
create index idx_audit_created on audit_log(created_at);
