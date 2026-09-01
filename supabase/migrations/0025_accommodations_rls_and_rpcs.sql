-- =============================================================================
-- Ciclo 3 (parte 4/4) — RLS das tabelas novas + RPCs de escrita sensível.
--
-- Padrão idêntico ao já estabelecido nos Ciclos 2/2B/2C: escrita crítica
-- (bloqueio, status operacional) só por RPC SECURITY DEFINER com
-- REVOKE FROM PUBLIC/anon + GRANT authenticated; leitura por policy comum.
--
-- Valor-base (base_price) escondido de Governança: RLS é por LINHA, não por
-- coluna (Postgres). Como Governança precisa ver a maior parte da linha de
-- `rooms` (status, capacidade, categoria) — só não o preço — a solução é
-- projeção no servidor (mesma decisão já tomada no Ciclo 1 para o mesmo tipo
-- de problema, "Conflito B": o service nunca inclui o campo na resposta para
-- esse papel). Não criei uma view dedicada para não multiplicar superfície de
-- manutenção — ver services/rooms no código e a nota no relatório do ciclo.
-- =============================================================================

alter table accommodation_categories enable row level security;
create policy "categories_read" on accommodation_categories for select
  using (auth_is_member_of(pousada_id) or auth_is_platform_admin());
create policy "categories_write" on accommodation_categories for all
  using (auth_can_manage_pousada(pousada_id))
  with check (auth_can_manage_pousada(pousada_id));

alter table room_amenities enable row level security;
create policy "room_amenities_read" on room_amenities for select
  using (exists (
    select 1 from rooms r join pousadas p on p.id = r.pousada_id
    where r.id = room_amenities.room_id
      and (p.status = 'publicada' or auth_is_member_of(p.id) or auth_is_platform_admin())
  ));
create policy "room_amenities_write" on room_amenities for all
  using (exists (select 1 from rooms r where r.id = room_amenities.room_id and auth_can_manage_pousada(r.pousada_id)))
  with check (exists (select 1 from rooms r where r.id = room_amenities.room_id and auth_can_manage_pousada(r.pousada_id)));

-- room_blocks: só leitura por policy — toda escrita passa por RPC.
alter table room_blocks enable row level security;
create policy "room_blocks_read" on room_blocks for select
  using (auth_is_member_of(pousada_id) or auth_is_platform_admin());

-- ----------------------------------------------------------------------------
-- create_room_block
-- ----------------------------------------------------------------------------
create or replace function create_room_block(
  p_pousada_id uuid, p_room_id uuid, p_block_type room_block_type,
  p_starts_at timestamptz, p_ends_at timestamptz, p_reason text, p_notes text default ''
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
    and status in ('iniciada', 'aguardando_pagamento', 'confirmada', 'em_estadia')
    and checkin < p_ends_at::date and checkout > p_starts_at::date
  limit 1;
  if v_conflict_booking is not null then
    raise exception 'Existe uma reserva (%) conflitando com este período.', v_conflict_booking;
  end if;

  insert into room_blocks (pousada_id, room_id, block_type, starts_at, ends_at, reason, notes, created_by)
  values (p_pousada_id, p_room_id, p_block_type, p_starts_at, p_ends_at, p_reason, coalesce(p_notes, ''), auth.uid())
  returning id into v_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'room_block.created', 'room_blocks', v_id,
          jsonb_build_object('pousadaId', p_pousada_id, 'roomId', p_room_id, 'type', p_block_type));

  return jsonb_build_object('status', 'ok', 'id', v_id);
end;
$$;
revoke execute on function create_room_block(uuid, uuid, room_block_type, timestamptz, timestamptz, text, text) from public;
revoke execute on function create_room_block(uuid, uuid, room_block_type, timestamptz, timestamptz, text, text) from anon;
grant execute on function create_room_block(uuid, uuid, room_block_type, timestamptz, timestamptz, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- cancel_room_block
-- ----------------------------------------------------------------------------
create or replace function cancel_room_block(p_pousada_id uuid, p_block_id uuid, p_cancellation_reason text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_pousada uuid;
  v_status room_block_status;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not auth_can_manage_pousada(p_pousada_id) then
    raise exception 'Você não tem permissão para gerenciar bloqueios nesta pousada.';
  end if;

  select pousada_id, status into v_pousada, v_status from room_blocks where id = p_block_id;
  if v_pousada is null then raise exception 'Bloqueio não encontrado.'; end if;
  if v_pousada <> p_pousada_id then raise exception 'Bloqueio não pertence a esta pousada.'; end if;
  if v_status <> 'active' then raise exception 'Este bloqueio já não está ativo.'; end if;

  update room_blocks
  set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), cancellation_reason = p_cancellation_reason
  where id = p_block_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'room_block.cancelled', 'room_blocks', p_block_id,
          jsonb_build_object('pousadaId', p_pousada_id, 'reason', p_cancellation_reason));

  return jsonb_build_object('status', 'ok');
end;
$$;
revoke execute on function cancel_room_block(uuid, uuid, text) from public;
revoke execute on function cancel_room_block(uuid, uuid, text) from anon;
grant execute on function cancel_room_block(uuid, uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- update_room_operational_status — único caminho de escrita aberto a
-- Governança (além de proprietário/admin), e só para esta coluna.
-- ----------------------------------------------------------------------------
create or replace function update_room_operational_status(p_pousada_id uuid, p_room_id uuid, p_status room_operational_status)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_pousada uuid;
  v_previous room_operational_status;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not (
    exists (
      select 1 from memberships m
      where m.user_id = auth.uid() and m.pousada_id = p_pousada_id
        and m.role in ('proprietario', 'admin_pousada', 'governanca')
        and m.status = 'active'
    )
    or auth_is_platform_admin()
  ) then
    raise exception 'Você não tem permissão para alterar o status operacional nesta pousada.';
  end if;

  select pousada_id, operational_status into v_pousada, v_previous from rooms where id = p_room_id;
  if v_pousada is null then raise exception 'Acomodação não encontrada.'; end if;
  if v_pousada <> p_pousada_id then raise exception 'Acomodação não pertence a esta pousada.'; end if;

  update rooms set operational_status = p_status, updated_at = now(), updated_by = auth.uid() where id = p_room_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'room.operational_status_changed', 'rooms', p_room_id,
          jsonb_build_object('pousadaId', p_pousada_id, 'from', v_previous, 'to', p_status));

  return jsonb_build_object('status', 'ok');
end;
$$;
revoke execute on function update_room_operational_status(uuid, uuid, room_operational_status) from public;
revoke execute on function update_room_operational_status(uuid, uuid, room_operational_status) from anon;
grant execute on function update_room_operational_status(uuid, uuid, room_operational_status) to authenticated;
