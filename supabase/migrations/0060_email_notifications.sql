-- =============================================================================
-- 0060 — Notificações por e-mail (piloto): pedido recebido, confirmação/ticket
-- e lembrete de check-in.
--
-- Nenhum provedor de e-mail existia até agora (mensagens saíam só por
-- `mailto:`). Esta migration não envia e-mail nenhum — só dá ao código
-- (server-only, service_role) o dado que falta pra montar as 3 mensagens,
-- seguindo o mesmo padrão de `expire_overdue_pending_bookings` (0050) e
-- `list_channel_feeds_to_import` (0044): RPC estreita, security definer,
-- concedida só a service_role, nunca leitura de tabela direto por quem chama.
--
-- `checkin_reminder_sent_at`: sem isso o cron reenviaria o lembrete todo dia
-- até o check-in. `list_and_mark_checkin_reminders` marca e seleciona no
-- MESMO `update ... returning` (sem select separado antes) — mesma proteção
-- contra corrida entre duas execuções concorrentes que a 0050 já documentou.
-- =============================================================================

alter table bookings
  add column if not exists checkin_reminder_sent_at timestamptz;

-- ----------------------------------------------------------------------------
-- get_booking_notification_context — dado de UMA reserva + pousada pra montar
-- o e-mail de confirmação (enviado pelo webhook do Mercado Pago, sem sessão
-- de usuário). Sem checagem de RLS de propósito (service_role já ignora RLS);
-- por isso a função em si não é exposta a anon/authenticated.
-- ----------------------------------------------------------------------------
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
    'pousada', jsonb_build_object(
      'name', p.name,
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
revoke all on function get_booking_notification_context(uuid) from public, anon, authenticated;
grant execute on function get_booking_notification_context(uuid) to service_role;

comment on function get_booking_notification_context(uuid) is
  '0060: service_role só, sem sessão — reserva+pousada pro e-mail de confirmação enviado pelo webhook do Mercado Pago.';

-- ----------------------------------------------------------------------------
-- list_and_mark_checkin_reminders — cron diário: reservas confirmadas cujo
-- check-in é daqui a `p_days_ahead` dias (2 por padrão) e que ainda não
-- receberam lembrete. Marca `checkin_reminder_sent_at` no mesmo UPDATE que
-- seleciona, então o e-mail conta como "enviado" mesmo que o processo caia
-- logo depois — aceitável (falha de envio isolada), pior que reenviar todo
-- dia pro mesmo hóspede.
-- ----------------------------------------------------------------------------
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
    returning id, code, guest_name, guest_email, checkin, checkout, total, currency, room_id, pousada_id
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
      'pousada', jsonb_build_object(
        'name', p.name,
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
revoke all on function list_and_mark_checkin_reminders(int) from public, anon, authenticated;
grant execute on function list_and_mark_checkin_reminders(int) to service_role;

comment on function list_and_mark_checkin_reminders(int) is
  '0060: cron diário, service_role só — seleciona e marca (mesmo UPDATE) reservas confirmadas com check-in em N dias sem lembrete enviado.'