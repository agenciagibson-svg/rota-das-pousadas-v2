-- =============================================================================
-- 0089 — Pedido de avaliação por e-mail depois do check-out.
--
-- Até aqui a avaliação só acontecia se o hóspede abrisse o app da estadia. A
-- nota exibida na vitrine (`pousadas.rating/reviews`, recalculada pelo gatilho
-- `trg_refresh_pousada_rating` da 0078) precisa vir de avaliações reais.
--
-- O cron diário (`/api/cron/expiracao`, service_role, sem sessão) passa a:
--   1. listar reservas encerradas há 1 a 3 dias (no fuso da pousada) que
--      ainda não receberam o pedido e enviar o e-mail com as 5 estrelas;
--   2. 3 dias depois do pedido, sem avaliação, enviar um único lembrete.
-- Cada envio só é marcado DEPOIS de o e-mail sair (RPC separada de marcação,
-- idempotente): falha de SMTP não perde o pedido, ele volta no dia seguinte
-- enquanto a reserva estiver na janela.
--
-- Elegibilidade = a mesma regra de `auth_can_review_booking` (0084), reescrita
-- sem `auth.uid()` (o cron não tem sessão): quem avalia é `bookings.guest_id`,
-- que precisa ter criado a própria reserva pelo site ou pelo link da bio e não
-- ser da equipe da pousada. Reserva de balcão, de OTA ou criada pela equipe
-- nunca recebe o pedido (o hóspede não conseguiria avaliar).
--
-- Todas as funções são só de service_role: o cliente não lista reservas de
-- outras pessoas nem silencia pedidos chamando a API REST com a anon key.
-- =============================================================================

alter table bookings
  add column if not exists review_requested_at timestamptz,
  add column if not exists review_reminded_at timestamptz;

comment on column bookings.review_requested_at is
  '0089: quando o e-mail pedindo avaliação foi enviado (marcado só depois do envio).';
comment on column bookings.review_reminded_at is
  '0089: quando o lembrete único de avaliação foi enviado.';

-- Índice parcial para o cron: só reservas ainda sem pedido/lembrete.
create index if not exists idx_bookings_review_request_pending
  on bookings(checkout) where review_requested_at is null;
create index if not exists idx_bookings_review_reminder_pending
  on bookings(review_requested_at) where review_requested_at is not null and review_reminded_at is null;

-- ----------------------------------------------------------------------------
-- Regra interna: o hóspede desta reserva pode avaliá-la? Espelho de
-- `auth_can_review_booking` (0084) com `guest_id` no lugar de `auth.uid()`,
-- mais "ainda não avaliou", "tem e-mail" e "pousada no ar" (o agradecimento
-- leva para a página pública da pousada). Não é RPC: sem grant para ninguém.
-- ----------------------------------------------------------------------------
create or replace function booking_review_request_eligible(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from bookings b
    join pousadas p on p.id = b.pousada_id
    where b.id = p_booking_id
      and b.guest_id is not null
      and b.created_by = b.guest_id
      and b.origin in ('rota_das_pousadas', 'link_bio')
      and not exists (
        select 1 from memberships m
        where m.user_id = b.guest_id and m.pousada_id = b.pousada_id
      )
      and (
        b.status = 'checked_out'
        or (b.status in ('confirmed', 'checked_in') and b.checkout <= current_date)
      )
      and not exists (select 1 from reviews r where r.booking_id = b.id)
      and nullif(trim(coalesce(b.guest_email, '')), '') is not null
      and p.status = 'publicada'
      and p.tenant_status in ('onboarding', 'active')
  );
$$;
revoke all on function booking_review_request_eligible(uuid) from public, anon, authenticated, service_role;

comment on function booking_review_request_eligible(uuid) is
  '0089: uso interno das RPCs de pedido de avaliação — mesma regra de auth_can_review_booking (0084) sem auth.uid().';

-- ----------------------------------------------------------------------------
-- 1. Pedido: check-out entre ontem e 3 dias atrás no fuso da pousada.
-- A janela de 3 dias cobre um dia de cron que falhou sem mandar e-mail para
-- estadias antigas (nada de pedido para quem saiu há meses).
-- ----------------------------------------------------------------------------
create or replace function list_review_requests_due(p_limit integer default 50)
returns table (
  booking_id uuid,
  code text,
  guest_name text,
  guest_email text,
  pousada_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.code, b.guest_name, trim(b.guest_email), p.name
  from bookings b
  join pousadas p on p.id = b.pousada_id
  where b.review_requested_at is null
    and b.checkout between pousada_local_date(b.pousada_id) - 3
                       and pousada_local_date(b.pousada_id) - 1
    and booking_review_request_eligible(b.id)
  order by b.checkout, b.id
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;
revoke all on function list_review_requests_due(integer) from public, anon, authenticated;
grant execute on function list_review_requests_due(integer) to service_role;

comment on function list_review_requests_due(integer) is
  '0089: cron diário, service_role só — reservas encerradas há 1 a 3 dias (fuso da pousada), elegíveis e sem pedido de avaliação.';

create or replace function mark_review_request_sent(p_booking_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_marked boolean;
begin
  update bookings set review_requested_at = now()
   where id = p_booking_id and review_requested_at is null;
  v_marked := found;
  if v_marked then
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (null, 'review.requested', 'bookings', p_booking_id, jsonb_build_object('kind', 'pedido'));
  end if;
  return v_marked;
end;
$$;
revoke all on function mark_review_request_sent(uuid) from public, anon, authenticated;
grant execute on function mark_review_request_sent(uuid) to service_role;

comment on function mark_review_request_sent(uuid) is
  '0089: cron, service_role só — marca o pedido de avaliação como enviado. Idempotente (devolve false se já estava marcado).';

-- ----------------------------------------------------------------------------
-- 2. Lembrete único: 3 dias depois do pedido, ainda sem avaliação. Pedidos com
-- mais de 7 dias não recebem lembrete atrasado (cron parado por dias).
-- ----------------------------------------------------------------------------
create or replace function list_review_reminders_due(p_limit integer default 50)
returns table (
  booking_id uuid,
  code text,
  guest_name text,
  guest_email text,
  pousada_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.code, b.guest_name, trim(b.guest_email), p.name
  from bookings b
  join pousadas p on p.id = b.pousada_id
  where b.review_requested_at is not null
    and b.review_reminded_at is null
    and b.review_requested_at <= now() - interval '3 days'
    and b.review_requested_at > now() - interval '7 days'
    and booking_review_request_eligible(b.id)
  order by b.review_requested_at, b.id
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;
revoke all on function list_review_reminders_due(integer) from public, anon, authenticated;
grant execute on function list_review_reminders_due(integer) to service_role;

comment on function list_review_reminders_due(integer) is
  '0089: cron diário, service_role só — pedidos de avaliação de 3 a 7 dias atrás, ainda sem avaliação nem lembrete.';

create or replace function mark_review_reminder_sent(p_booking_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_marked boolean;
begin
  update bookings set review_reminded_at = now()
   where id = p_booking_id and review_requested_at is not null and review_reminded_at is null;
  v_marked := found;
  if v_marked then
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (null, 'review.requested', 'bookings', p_booking_id, jsonb_build_object('kind', 'lembrete'));
  end if;
  return v_marked;
end;
$$;
revoke all on function mark_review_reminder_sent(uuid) from public, anon, authenticated;
grant execute on function mark_review_reminder_sent(uuid) to service_role;

comment on function mark_review_reminder_sent(uuid) is
  '0089: cron, service_role só — marca o lembrete de avaliação como enviado. Idempotente.';
