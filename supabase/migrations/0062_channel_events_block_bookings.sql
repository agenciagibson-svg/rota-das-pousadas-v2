-- =============================================================================
-- 0062 — Noite já vendida no Airbnb/Booking (iCal importado) passa a barrar
-- reserva criada ou editada na Rota.
--
-- Até aqui `channel_events` (0044) só era lido por `list_bookable_rooms`, a
-- busca pública. `assert_room_available_for_booking` — a checagem que
-- `create_booking` e `update_booking` usam, ou seja, o balcão, o painel e o
-- checkout do site — olhava bloqueios e outras reservas, mas não o que já foi
-- vendido nas OTAs. A recepção conseguia vender uma noite que o Airbnb já
-- tinha vendido (overbooking), e o banco aceitava.
--
-- Eco do iCal: a Rota exporta as próprias reservas para a OTA, e o feed da OTA
-- pode devolvê-las como "indisponível" (às vezes emendadas a outros dias
-- fechados lá). Por isso, ao EDITAR uma reserva, a parte do evento que cai nas
-- noites que ela já ocupava no mesmo quarto não conta — só noites novas
-- precisam estar livres no canal. Na criação não há eco possível: a reserva
-- ainda não existe. `update_booking` chama esta função antes do UPDATE, então
-- a linha de `p_exclude_booking_id` ainda tem as datas antigas.
--
-- Mesma assinatura da 0034: `create or replace` mantém grants e chamadas.
-- Corpo idêntico ao da 0034 até a checagem de reservas; o bloco de canal é novo.
-- =============================================================================

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
  v_old_room uuid;
  v_old_checkin date;
  v_old_checkout date;
  v_channel_provider channel_provider;
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

  -- Ocupação importada das OTAs (0044). `ends_on` é exclusivo, como `checkout`.
  if p_exclude_booking_id is not null then
    select room_id, checkin, checkout into v_old_room, v_old_checkin, v_old_checkout
    from bookings where id = p_exclude_booking_id;
  end if;

  select cc.provider into v_channel_provider
  from channel_events ce
  join channel_calendars cc on cc.id = ce.calendar_id
  where ce.room_id = p_room_id
    and ce.starts_on < p_checkout and ce.ends_on > p_checkin
    -- Na edição, ignora o trecho do evento contido nas noites que a reserva já
    -- ocupava neste quarto (eco do feed que a própria Rota exportou).
    and not (
      v_old_room is not null and v_old_room = p_room_id
      and greatest(ce.starts_on, p_checkin) >= v_old_checkin
      and least(ce.ends_on, p_checkout) <= v_old_checkout
    )
  limit 1;
  if found then
    raise exception 'Esta acomodação já está ocupada % nesse período (calendário sincronizado).',
      case v_channel_provider
        when 'airbnb' then 'no Airbnb'
        when 'booking' then 'no Booking.com'
        else 'em outro canal'
      end;
  end if;
end;
$$;
