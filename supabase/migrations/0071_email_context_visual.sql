-- =============================================================================
-- 0071 — Contexto dos e-mails transacionais com os dados do novo visual
-- (aprovado em 27/09/2026): prazo de pagamento ("Pague até 22:42"), status,
-- hóspedes (adultos/crianças) e cidade/UF/fuso da pousada.
--
-- Só acrescenta chaves ao JSON devolvido; nenhuma chave antiga muda. Corpos
-- idênticos aos da 0060 fora isso. Mesma assinatura: `create or replace`
-- mantém os grants (service_role only).
-- =============================================================================

create or replace function get_booking_notification_context(p_booking_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'bookingId', b.id,
    'code', b.code,
    'guestName', b.guest_name,
    'guestEmail', b.guest_email,
    'checkin', b.checkin,
    'checkout', b.checkout,
    'total', b.total,
    'currency', b.currency,
    'roomName', r.name,
    'status', b.status,
    'adults', b.adults,
    'children', b.children,
    'paymentDueAt', b.payment_due_at,
    'pousada', jsonb_build_object(
      'name', p.name,
      'city', p.city,
      'state', p.state,
      'timezone', p.timezone,
      'slug', p.slug,
      'address', p.address,
      'cep', p.cep,
      'checkinTime', p.checkin_time,
      'checkoutTime', p.checkout_time,
      'contactPhone', p.contact_phone,
      'whatsapp', p.whatsapp,
      'houseRules', p.house_rules,
      'cancellationPolicy', p.cancellation_policy
    )
  )
  into v_result
  from bookings b
  join rooms r on r.id = b.room_id
  join pousadas p on p.id = b.pousada_id
  where b.id = p_booking_id;

  return v_result;
end;
$$;

create or replace function list_and_mark_checkin_reminders(p_days_ahead int default 2)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_result jsonb;
begin
  with due as (
    update bookings set checkin_reminder_sent_at = now()
    where status = 'confirmed'
      and checkin_reminder_sent_at is null
      and checkin = (current_date + p_days_ahead)
      and guest_email is not null
    returning id, code, guest_name, guest_email, checkin, checkout, total, currency, room_id, pousada_id, status, adults, children, payment_due_at
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'bookingId', due.id,
      'code', due.code,
      'guestName', due.guest_name,
      'guestEmail', due.guest_email,
      'checkin', due.checkin,
      'checkout', due.checkout,
      'total', due.total,
      'currency', due.currency,
      'roomName', r.name,
      'status', due.status,
      'adults', due.adults,
      'children', due.children,
      'paymentDueAt', due.payment_due_at,
      'pousada', jsonb_build_object(
        'name', p.name,
        'city', p.city,
        'state', p.state,
        'timezone', p.timezone,
        'slug', p.slug,
        'address', p.address,
        'cep', p.cep,
        'checkinTime', p.checkin_time,
        'checkoutTime', p.checkout_time,
        'contactPhone', p.contact_phone,
        'whatsapp', p.whatsapp,
        'houseRules', p.house_rules,
        'cancellationPolicy', p.cancellation_policy
      )
    )
  ), '[]'::jsonb)
  into v_result
  from due
  join rooms r on r.id = due.room_id
  join pousadas p on p.id = due.pousada_id;

  return v_result;
end;
$$;
