-- 0085 — Hóspede não lê campos internos da pousada.
--
-- Antes, a RLS de `bookings`, `rooms` e `booking_guests` deixava o hóspede ler
-- a LINHA inteira da própria reserva pela API — inclusive o que só a equipe
-- deve ver: `bookings.internal_notes`, `no_show_reason`, `expected_commission`,
-- `external_code`, `created_by`…; `rooms.internal_notes`,
-- `operational_description`; `booking_guests.operational_notes`. Quem protegia
-- era só a lista de colunas do app.
--
-- Agora:
--   * essas três tabelas são lidas direto só pela equipe da pousada (e pela
--     plataforma com concessão, como antes);
--   * o hóspede lê a própria reserva pela RPC `list_my_bookings`, que devolve
--     só colunas de hóspede (e o nome da acomodação);
--   * as policies que dependiam de "o hóspede enxerga a reserva" (pagamentos,
--     pedidos do app, comprovantes Pix) passam a usar `auth_is_booking_guest`,
--     que confere o vínculo sem depender da RLS de `bookings`.

-- ---------------------------------------------------------------------------
-- Helper: o usuário logado é o hóspede desta reserva?
-- ---------------------------------------------------------------------------
create or replace function public.auth_is_booking_guest(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_booking_id is not null and exists (
    select 1 from bookings b
    where b.id = p_booking_id and b.guest_id = auth.uid()
  );
$$;

revoke all on function public.auth_is_booking_guest(uuid) from public, anon;
grant execute on function public.auth_is_booking_guest(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Leitura do hóspede: só colunas de hóspede
-- ---------------------------------------------------------------------------
create or replace function public.list_my_bookings(p_booking_id uuid default null)
returns table (
  id uuid,
  code text,
  pousada_id uuid,
  room_id uuid,
  room_name text,
  checkin date,
  checkout date,
  guests integer,
  subtotal integer,
  fee integer,
  discount integer,
  surcharge integer,
  total integer,
  balance_due numeric,
  status booking_status,
  origin booking_origin,
  payment_due_at timestamptz,
  cancellation_reason text,
  guest_name text,
  guest_email text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
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

-- ---------------------------------------------------------------------------
-- Tabelas com campos internos: leitura direta só da equipe
-- ---------------------------------------------------------------------------
drop policy if exists "bookings_read" on public.bookings;
create policy "bookings_read" on public.bookings for select
  using (auth_has_operational_access(pousada_id) or auth_has_active_grant(pousada_id));

drop policy if exists "rooms_read" on public.rooms;
create policy "rooms_read" on public.rooms for select
  using (auth_has_room_read_access(pousada_id) or auth_is_platform_admin());

drop policy if exists "booking_guests_read" on public.booking_guests;
create policy "booking_guests_read" on public.booking_guests for select
  using (exists (
    select 1 from bookings b
    where b.id = booking_guests.booking_id
      and (auth_has_operational_access(b.pousada_id) or auth_has_active_grant(b.pousada_id))
  ));

-- ---------------------------------------------------------------------------
-- Policies que davam acesso ao hóspede via "enxergar a reserva"
-- ---------------------------------------------------------------------------
drop policy if exists "payments_read" on public.payments;
create policy "payments_read" on public.payments for select
  using (
    auth_is_booking_guest(booking_id)
    or exists (
      select 1 from bookings b
      where b.id = payments.booking_id
        and (auth_has_operational_access(b.pousada_id) or auth_has_active_grant(b.pousada_id))
    )
  );

drop policy if exists "consumption_payments_read" on public.consumption_payments;
create policy "consumption_payments_read" on public.consumption_payments for select
  using (auth_has_operational_access(pousada_id) or auth_is_booking_guest(booking_id));

drop policy if exists "guest_orders_read" on public.guest_orders;
create policy "guest_orders_read" on public.guest_orders for select
  using (
    auth_has_pousada_role(pousada_id, array['proprietario', 'admin_pousada', 'recepcionista', 'governanca', 'financeiro_pousada'])
    or auth_is_booking_guest(booking_id)
  );

drop policy if exists "payment_proofs_read_own_or_staff" on storage.objects;
create policy "payment_proofs_read_own_or_staff" on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      auth_is_booking_guest(payment_proof_booking_id(name))
      or exists (
        select 1 from bookings b
        where b.id = payment_proof_booking_id(name)
          and auth_has_operational_access(b.pousada_id)
      )
    )
  );
