-- Rollback da 0105 (contato do hóspede liberado só depois do pagamento).
-- Devolve a leitura das colunas de contato para a API (como antes) e remove as
-- RPCs, os gatilhos e as colunas novas de `bookings`. Nenhum contato é apagado.
-- Antes de rodar, volte o app para uma versão anterior ao PR da 0105: a versão
-- nova chama as RPCs removidas aqui.

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

drop function if exists public.list_platform_pix_proofs(date);
drop function if exists public.search_guest_ids_by_contact(uuid, text, text);
drop function if exists public.get_guest_contacts(uuid[]);
drop function if exists public.get_booking_guest_contacts(uuid[]);

drop trigger if exists trg_guests_hidden_contact on public.guests;
drop function if exists public.guests_guard_hidden_contact();
drop trigger if exists trg_bookings_contact_release on public.bookings;
drop function if exists public.bookings_guard_contact_release();
drop function if exists public.booking_contact_released(uuid);
drop function if exists public.guest_contact_released(uuid);

drop index if exists public.idx_bookings_responsible_released;
alter table public.bookings
  drop column if exists contact_released_at,
  drop column if exists booked_by_traveler;

grant select on public.bookings to anon, authenticated;
grant select on public.guests to anon, authenticated;
