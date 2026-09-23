-- Rollback da 0062_channel_events_block_bookings.sql — volta à versão da 0034
-- (sem a checagem de channel_events).

create or replace function assert_room_available_for_booking(
  p_pousada_id uuid, p_room_id uuid, p_checkin date, p_checkout date,
  p_adults integer, p_children integer, p_pets boolean,
  p_exclude_booking_id uuid default null
) returns void
language plpgsql stable security definer set search_path = public as $$
declare
  v_room record;
  v_category_status accommodation_status;
  v_conflict_block uuid;
  v_conflict_booking text;
begin
  select r.id, r.pousada_id, r.status, r.operational_status,
         coalesce(r.capacity_max, r.capacity) as capacity_max, r.pets_allowed, r.category_id
    into v_room
  from rooms r where r.id = p_room_id;

  if v_room.id is null then
    raise exception 'Acomodação não encontrada.';
  end if;
  if v_room.pousada_id <> p_pousada_id then
    raise exception 'Acomodação não pertence a esta pousada.';
  end if;
  if v_room.status <> 'active' then
    raise exception 'Esta acomodação está inativa.';
  end if;
  if v_room.category_id is not null then
    select status into v_category_status from accommodation_categories where id = v_room.category_id;
    if v_category_status is distinct from 'active' then
      raise exception 'A categoria desta acomodação está inativa.';
    end if;
  end if;
  if v_room.operational_status in ('maintenance', 'blocked') then
    raise exception 'Esta acomodação está indisponível por status operacional (%).', v_room.operational_status;
  end if;
  if (p_adults + p_children) > v_room.capacity_max then
    raise exception 'Capacidade máxima de % hóspedes para esta acomodação.', v_room.capacity_max;
  end if;
  if p_pets and not v_room.pets_allowed then
    raise exception 'Esta acomodação não aceita pets.';
  end if;

  select id into v_conflict_block from room_blocks
  where room_id = p_room_id and status = 'active'
    and starts_at < p_checkout::timestamptz and ends_at > p_checkin::timestamptz
  limit 1;
  if v_conflict_block is not null then
    raise exception 'Esta acomodação está bloqueada nesse período.';
  end if;

  select code into v_conflict_booking from bookings
  where room_id = p_room_id
    and status in ('pending', 'confirmed', 'checked_in')
    and (p_exclude_booking_id is null or id <> p_exclude_booking_id)
    and checkin < p_checkout and checkout > p_checkin
  limit 1;
  if v_conflict_booking is not null then
    raise exception 'Já existe uma reserva (%) conflitando com este período.', v_conflict_booking;
  end if;
end;
$$;
