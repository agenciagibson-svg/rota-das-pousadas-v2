-- Rollback da 0090 — remove a exclusão de conta pelo titular.
-- Contas já excluídas continuam anonimizadas (não há como "desexcluir": os
-- dados pessoais foram apagados e o Auth ofuscou e-mail e senha).
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'bookings', 'guests', 'booking_guests', 'reviews', 'favorites',
    'favorite_alerts', 'traveler_profiles', 'payment_proofs', 'guest_orders',
    'guest_order_items', 'quote_requests', 'pousadas', 'memberships'
  ] loop
    execute format('drop trigger if exists trg_block_deleted_account on public.%I', t);
  end loop;
end $$;
drop function if exists public.block_writes_from_deleted_account();
drop function if exists public.delete_my_account();
alter table public.profiles drop column if exists deleted_at;
