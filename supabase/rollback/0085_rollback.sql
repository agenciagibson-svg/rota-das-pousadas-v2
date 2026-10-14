-- Rollback da 0085 — devolve ao hóspede a leitura direta da própria reserva
-- (linha inteira, com campos internos). Antes de rodar, volte o código
-- (repositories/bookings.repository.ts e features/estadia/services/stay.service.ts).

drop policy if exists "bookings_read" on public.bookings;
create policy "bookings_read" on public.bookings for select
  using ((guest_id = auth.uid()) or auth_has_operational_access(pousada_id) or auth_has_active_grant(pousada_id));

drop policy if exists "rooms_read" on public.rooms;
create policy "rooms_read" on public.rooms for select
  using (
    exists (select 1 from bookings b where b.room_id = rooms.id and b.guest_id = auth.uid())
    or auth_has_room_read_access(pousada_id)
    or auth_is_platform_admin()
  );

drop policy if exists "booking_guests_read" on public.booking_guests;
create policy "booking_guests_read" on public.booking_guests for select
  using (exists (
    select 1 from bookings b
    where b.id = booking_guests.booking_id
      and (b.guest_id = auth.uid() or auth_has_operational_access(b.pousada_id) or auth_has_active_grant(b.pousada_id))
  ));

drop policy if exists "payments_read" on public.payments;
create policy "payments_read" on public.payments for select
  using (exists (
    select 1 from bookings b
    where b.id = payments.booking_id
      and (b.guest_id = auth.uid() or auth_has_operational_access(b.pousada_id) or auth_has_active_grant(b.pousada_id))
  ));

drop policy if exists "consumption_payments_read" on public.consumption_payments;
create policy "consumption_payments_read" on public.consumption_payments for select
  using (
    auth_has_operational_access(pousada_id)
    or exists (select 1 from bookings b where b.id = consumption_payments.booking_id and b.guest_id = auth.uid())
  );

drop policy if exists "guest_orders_read" on public.guest_orders;
create policy "guest_orders_read" on public.guest_orders for select
  using (
    auth_has_pousada_role(pousada_id, array['proprietario', 'admin_pousada', 'recepcionista', 'governanca', 'financeiro_pousada'])
    or exists (select 1 from bookings b where b.id = guest_orders.booking_id and b.guest_id = auth.uid())
  );

drop policy if exists "payment_proofs_read_own_or_staff" on storage.objects;
create policy "payment_proofs_read_own_or_staff" on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and exists (
      select 1 from bookings b
      where b.id = payment_proof_booking_id(name)
        and (b.guest_id = auth.uid() or auth_has_operational_access(b.pousada_id))
    )
  );

drop function if exists public.list_my_bookings(uuid);
drop function if exists public.auth_is_booking_guest(uuid);
