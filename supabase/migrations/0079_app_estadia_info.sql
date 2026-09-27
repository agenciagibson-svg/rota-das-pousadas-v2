-- =============================================================================
-- 0079 — App da estadia: informações da hospedagem.
--
-- O app do hóspede passa a mostrar a estadia inteira (não só o cardápio):
-- café da manhã, estacionamento, estrutura da pousada com horários, agenda do
-- dia, dicas da região e telefones de emergência. Tudo editável pelo dono em
-- Configurações. A RPC get_guest_stay também devolve o primeiro nome do
-- hóspede, as comodidades do quarto e o fuso da pousada.
-- =============================================================================

alter table pousada_guest_settings
  add column if not exists breakfast_info text not null default ''
    check (char_length(breakfast_info) <= 200),
  add column if not exists parking_info text not null default ''
    check (char_length(parking_info) <= 200),
  -- [{ "name": "Piscina aquecida", "hours": "9h às 21h" }]
  add column if not exists facilities jsonb not null default '[]'::jsonb
    check (jsonb_typeof(facilities) = 'array' and jsonb_array_length(facilities) <= 15),
  -- [{ "time": "18:00", "title": "Lareira acesa", "note": "Sala de estar" }]
  add column if not exists daily_agenda jsonb not null default '[]'::jsonb
    check (jsonb_typeof(daily_agenda) = 'array' and jsonb_array_length(daily_agenda) <= 15),
  -- [{ "name": "Pico do Selado", "kind": "Trilha", "distance": "12 km" }]
  add column if not exists local_tips jsonb not null default '[]'::jsonb
    check (jsonb_typeof(local_tips) = 'array' and jsonb_array_length(local_tips) <= 15),
  -- [{ "label": "SAMU", "phone": "192" }]
  add column if not exists emergency jsonb not null default '[]'::jsonb
    check (jsonb_typeof(emergency) = 'array' and jsonb_array_length(emergency) <= 8);

-- =============================================================================
-- get_guest_stay com as informações novas.
-- =============================================================================
create or replace function get_guest_stay(p_booking_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_b bookings%rowtype;
  v_p pousadas%rowtype;
  v_s pousada_guest_settings%rowtype;
  v_today date;
  v_room text;
  v_can_order boolean;
  v_reviewed boolean;
  v_menu jsonb;
  v_guest text;
  v_amen jsonb;
begin
  if auth.uid() is null then raise exception 'Faça login.'; end if;
  select * into v_b from bookings where id = p_booking_id;
  if v_b.id is null or v_b.guest_id is distinct from auth.uid() then
    raise exception 'Reserva não encontrada.';
  end if;
  select * into v_p from pousadas where id = v_b.pousada_id;
  select * into v_s from pousada_guest_settings where pousada_id = v_b.pousada_id;
  select name into v_room from rooms where id = v_b.room_id;
  v_today := pousada_today(v_b.pousada_id);
  v_can_order := v_b.status in ('confirmed', 'checked_in')
                 and v_today between v_b.checkin and v_b.checkout
                 and coalesce(v_s.orders_enabled, true);
  v_reviewed := exists (select 1 from reviews r where r.booking_id = v_b.id);
  select split_part(trim(coalesce(pr.full_name, '')), ' ', 1) into v_guest
    from profiles pr where pr.id = v_b.guest_id;
  select coalesce(jsonb_agg(a.name order by a.name), '[]'::jsonb) into v_amen
    from room_amenities ra join amenities a on a.id = ra.amenity_id
   where ra.room_id = v_b.room_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id, 'name', i.name, 'category', i.category, 'unit', i.unit,
           'price', i.sale_price, 'description', i.description, 'photoUrl', i.photo_url,
           'available', (not i.track_stock) or i.quantity > 0,
           'maxQuantity', case when i.track_stock then least(20, floor(i.quantity)::int) else 20 end
         ) order by i.sort_order, i.category, i.name), '[]'::jsonb)
    into v_menu
    from inventory_items i
   where i.pousada_id = v_b.pousada_id and i.active and i.show_in_app and i.sale_price is not null;

  return jsonb_build_object(
    'booking', jsonb_build_object(
      'id', v_b.id, 'code', v_b.code, 'status', v_b.status,
      'checkin', v_b.checkin, 'checkout', v_b.checkout,
      'adults', v_b.adults, 'children', v_b.children, 'roomName', coalesce(v_room, 'Acomodação'),
      'total', v_b.total, 'balanceDue', v_b.balance_due,
      'guestName', coalesce(v_guest, ''), 'roomAmenities', v_amen
    ),
    'pousada', jsonb_build_object(
      'id', v_p.id, 'name', v_p.name, 'slug', v_p.slug, 'image', v_p.image,
      'address', v_p.address, 'city', v_p.city, 'state', v_p.state, 'cep', v_p.cep,
      'whatsapp', v_p.whatsapp, 'phone', v_p.contact_phone,
      'checkinTime', v_p.checkin_time, 'checkoutTime', v_p.checkout_time,
      'houseRules', v_p.house_rules, 'cancellationPolicy', v_p.cancellation_policy,
      'timezone', coalesce(nullif(v_p.timezone, ''), 'America/Sao_Paulo')
    ),
    'info', jsonb_build_object(
      'wifiName', coalesce(v_s.wifi_name, ''),
      -- Senha do Wi-Fi só a partir do check-in.
      'wifiPassword', case when v_b.status in ('confirmed', 'checked_in') and v_today >= v_b.checkin
                           then coalesce(v_s.wifi_password, '') else '' end,
      'guestInfo', coalesce(v_s.guest_info, ''),
      'ordersHours', coalesce(v_s.orders_hours, ''),
      'breakfastInfo', coalesce(v_s.breakfast_info, ''),
      'parkingInfo', coalesce(v_s.parking_info, ''),
      'facilities', coalesce(v_s.facilities, '[]'::jsonb),
      'dailyAgenda', coalesce(v_s.daily_agenda, '[]'::jsonb),
      'localTips', coalesce(v_s.local_tips, '[]'::jsonb),
      'emergency', coalesce(v_s.emergency, '[]'::jsonb)
    ),
    'today', v_today,
    'canOrder', v_can_order,
    'ordersEnabled', coalesce(v_s.orders_enabled, true),
    'canReview', auth_can_review_booking(v_b.id, v_b.pousada_id) and not v_reviewed,
    'reviewed', v_reviewed,
    'consumption', booking_consumption_summary(v_b.id),
    'menu', v_menu
  );
end;
$$;
revoke all on function get_guest_stay(uuid) from public, anon;
grant execute on function get_guest_stay(uuid) to authenticated;
