-- =============================================================================
-- Ciclo 4 (3/5) — Evolução de `bookings` para domínio hoteleiro real.
--
-- DECISÃO (aprovada explicitamente antes desta migration, ver Entrega do
-- Ciclo 4 item 2): `booking_status` (0001) usa vocabulário em português
-- (iniciada/aguardando_pagamento/concluida/...) diferente do pedido
-- (quote/pending/confirmed/...). Auditoria ao vivo confirmou 0 linhas reais
-- em `bookings` neste momento (nenhuma reserva de produção, nenhum dado de
-- demonstração) — não há backfill de risco. Em vez de acumular 8 valores de
-- enum mortos e permanentes (Postgres não permite remover valor de enum), o
-- tipo é recriado do zero com exatamente o vocabulário-alvo.
--
-- DECISÃO DE NOMES (bookings.guest_id vs. hóspede responsável): `guest_id`
-- (FK→profiles, já existente, já usada por TODA a RLS de bookings/payments
-- via `guest_id = auth.uid()`) É PRESERVADA com o mesmo sentido de sempre —
-- o USUÁRIO VIAJANTE da plataforma, quando existir. Passa a ser nullable
-- (reserva de balcão para alguém sem conta não tem usuário nenhum). A nova
-- coluna `responsible_guest_id` (FK→guests, not null) é o "hóspede
-- responsável" pedido pela especificação — sempre presente, ligado ou não a
-- uma conta de plataforma. As duas colunas coexistem por design; nenhuma
-- substitui a outra.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- (1) Recriação do enum de status — só possível sem risco porque a tabela
-- está vazia (confirmado ao vivo antes desta migration).
-- ----------------------------------------------------------------------------
drop index if exists idx_bookings_payment_due;

alter table bookings alter column status drop default;
alter table bookings alter column status type text using status::text;
drop type booking_status;
create type booking_status as enum (
  'quote', 'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'
);
alter table bookings alter column status type booking_status using status::booking_status;
alter table bookings alter column status set default 'quote';

create index idx_bookings_payment_due on bookings(payment_due_at) where status = 'pending';

-- create_room_block (0026) checava conflito contra os status antigos —
-- atualizado para os novos (pending/confirmed bloqueiam; quote não).
create or replace function create_room_block(
  p_pousada_id uuid, p_room_id uuid, p_block_type room_block_type,
  p_starts_at timestamptz, p_ends_at timestamptz, p_reason text, p_notes text default '',
  p_source text default 'dashboard'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_room_status accommodation_status;
  v_room_pousada uuid;
  v_conflict_block uuid;
  v_conflict_booking text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not auth_can_manage_pousada(p_pousada_id) then
    raise exception 'Você não tem permissão para bloquear acomodações nesta pousada.';
  end if;
  if p_ends_at <= p_starts_at then
    raise exception 'A data final deve ser posterior à inicial.';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Informe o motivo do bloqueio.';
  end if;

  select status, pousada_id into v_room_status, v_room_pousada from rooms where id = p_room_id;
  if v_room_pousada is null then raise exception 'Acomodação não encontrada.'; end if;
  if v_room_pousada <> p_pousada_id then raise exception 'Acomodação não pertence a esta pousada.'; end if;
  if v_room_status <> 'active' then raise exception 'Não é possível bloquear uma acomodação inativa.'; end if;

  select id into v_conflict_block from room_blocks
  where room_id = p_room_id and status = 'active'
    and starts_at < p_ends_at and ends_at > p_starts_at
  limit 1;
  if v_conflict_block is not null then
    raise exception 'Já existe um bloqueio ativo para esta acomodação nesse período.';
  end if;

  select code into v_conflict_booking from bookings
  where room_id = p_room_id
    and status in ('pending', 'confirmed')
    and checkin < p_ends_at::date and checkout > p_starts_at::date
  limit 1;
  if v_conflict_booking is not null then
    raise exception 'Existe uma reserva (%) conflitando com este período.', v_conflict_booking;
  end if;

  insert into room_blocks (pousada_id, room_id, block_type, starts_at, ends_at, reason, notes, created_by, source)
  values (p_pousada_id, p_room_id, p_block_type, p_starts_at, p_ends_at, p_reason, coalesce(p_notes, ''), auth.uid(), p_source)
  returning id into v_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'room_block.created', 'room_blocks', v_id,
          jsonb_build_object('pousadaId', p_pousada_id, 'roomId', p_room_id, 'type', p_block_type, 'source', p_source));

  return jsonb_build_object('status', 'ok', 'id', v_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- (2) Origem da reserva.
-- ----------------------------------------------------------------------------
create type booking_origin as enum (
  'rota_das_pousadas', 'site_proprio', 'whatsapp', 'telefone', 'balcao',
  'booking_com', 'airbnb', 'expedia', 'agencia', 'outro'
);

-- ----------------------------------------------------------------------------
-- (3) Colunas novas — todas aditivas. `guest_id` vira nullable (ver decisão
-- acima). `guests` (total de pessoas) passa a ser CALCULADO a partir de
-- adults+children — nunca escrito direto, nunca diverge (tabela com 0 linhas
-- neste momento: recriar a coluna como generated não perde nenhum dado).
-- ----------------------------------------------------------------------------
alter table bookings alter column guest_id drop not null;

alter table bookings
  add column if not exists guest_phone text,
  add column if not exists origin booking_origin not null default 'rota_das_pousadas',
  add column if not exists external_channel_name text,
  add column if not exists external_code text,
  add column if not exists expected_commission numeric(10,2),
  add column if not exists adults integer not null default 1,
  add column if not exists children integer not null default 0,
  add column if not exists infants integer not null default 0,
  add column if not exists pets boolean not null default false,
  add column if not exists discount integer not null default 0,
  add column if not exists surcharge integer not null default 0,
  add column if not exists services_amount integer not null default 0,
  add column if not exists amount_received integer not null default 0,
  add column if not exists currency text not null default 'BRL',
  add column if not exists expected_arrival_time text,
  add column if not exists special_requests text not null default '',
  add column if not exists internal_notes text not null default '',
  add column if not exists cancellation_policy_snapshot text,
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_by uuid references profiles(id),
  add column if not exists cancelled_at timestamptz,
  add column if not exists no_show_reason text,
  add column if not exists no_show_by uuid references profiles(id),
  add column if not exists no_show_at timestamptz,
  add column if not exists created_by uuid references profiles(id),
  add column if not exists updated_by uuid references profiles(id),
  add column if not exists version integer not null default 1;

alter table bookings drop column guests;
alter table bookings add column guests integer generated always as (adults + children) stored;

-- Hóspede responsável (FK→guests): not null direto — a tabela está vazia
-- neste momento (confirmado ao vivo), então não há linha existente para
-- violar a obrigatoriedade.
alter table bookings add column responsible_guest_id uuid not null references guests(id);

alter table bookings add constraint bookings_people_nonneg
  check (adults >= 1 and children >= 0 and infants >= 0);
alter table bookings add constraint bookings_amounts_nonneg
  check (discount >= 0 and surcharge >= 0 and services_amount >= 0 and amount_received >= 0);

-- Saldo previsto: puramente calculável (total - recebido) — não é valor
-- comercial independente, então não recebe snapshot próprio (RB seção 5).
alter table bookings add column balance_due integer generated always as (total - amount_received) stored;

create index idx_bookings_status on bookings(status);
create index idx_bookings_origin on bookings(origin);
create index idx_bookings_responsible_guest on bookings(responsible_guest_id);

-- Hóspede responsável precisa pertencer à mesma pousada da reserva — mesmo
-- padrão já usado para rooms/category (0022) e room_blocks/room (0024).
create or replace function enforce_booking_guest_same_pousada()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from guests g where g.id = new.responsible_guest_id and g.pousada_id = new.pousada_id
  ) then
    raise exception 'O hóspede responsável não pertence a esta pousada.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_booking_guest_same_pousada on bookings;
create trigger trg_booking_guest_same_pousada
  before insert or update of responsible_guest_id, pousada_id on bookings
  for each row execute function enforce_booking_guest_same_pousada();
