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

-- get_booking_notification_context / list_and_mark_checkin_reminders: as
-- chaves novas (precheckinDone, hasTravelerAccount) são só acréscimo e o código
-- antigo as ignora. Para voltar exatamente à 0071, reaplique o corpo das duas
-- funções de supabase/migrations/0071_email_context_visual.sql ANTES de remover
-- a coluna abaixo (a 0088 as faz ler `precheckin_completed_at`).

alter table public.bookings drop column if exists precheckin_completed_at;
