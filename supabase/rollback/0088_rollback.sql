-- Rollback da 0088 — remove o pré-check-in online.
-- Antes de rodar, volte o código (página /minhas-reservas/[id]/pre-check-in,
-- repositories/precheckin.repository.ts, list_my_bookings no repositório e os
-- badges do painel). Os dados que o hóspede já enviou ficam em `guests` e
-- `booking_guests` (são as tabelas de sempre); só a marca de "ficha enviada"
-- é perdida.

drop function if exists public.submit_precheckin(
  uuid, text, date, text, text, text, text, text, text, text, text, text, text, jsonb, text
);
drop function if exists public.get_my_precheckin(uuid);
drop function if exists public.precheckin_is_encrypted_document(text);

-- list_my_bookings como na 0085.
drop function if exists public.list_my_bookings(uuid);
create function public.list_my_bookings(p_booking_id uuid default null)
returns table (
  id uuid, code text, pousada_id uuid, room_id uuid, room_name text,
  checkin date, checkout date, guests integer, subtotal integer, fee integer,
  discount integer, surcharge integer, total integer, balance_due numeric,
  status booking_status, origin booking_origin, payment_due_at timestamptz,
  cancellation_reason text, guest_name text, guest_email text, created_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select b.id, b.code, b.pousada_id, b.room_id, r.name, b.checkin, b.checkout,
         b.guests, b.subtotal, b.fee, b.discount, b.surcharge, b.total,
         b.balance_due, b.status, b.origin, b.payment_due_at,
         b.cancellation_reason, b.guest_name, b.guest_email, b.created_at
  from bookings b
  left join rooms r on r.id = b.room_id
  where auth.uid() is not null
    and b.guest_id = auth.uid()
    and (p_booking_id is null or b.id = p_booking_id)
  order by b.created_at desc;
$$;
revoke all on function public.list_my_bookings(uuid) from public, anon;
grant execute on function public.list_my_bookings(uuid) to authenticated, service_role;

-- get_booking_notification_context / list_and_mark_checkin_reminders voltam
-- ao corpo da 0071 (mesma assinatura) ANTES de remover a coluna, porque a
-- 0088 as faz ler `precheckin_completed_at`.
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

alter table public.bookings drop column if exists precheckin_completed_at;
