-- Rollback da 0092 — volta a leitura do estoque para qualquer membro (com custo)
-- e dos acompanhantes para auth_has_operational_access (inclui financeiro e
-- governança). O app (repositories/inventory.repository.ts) usa as RPCs da 0092:
-- volte o código junto.
begin;
drop policy if exists "inventory_items_read" on inventory_items;
create policy "inventory_items_read" on inventory_items for select
  using (auth_is_member_of(pousada_id));
drop policy if exists "inventory_movements_read" on inventory_movements;
create policy "inventory_movements_read" on inventory_movements for select
  using (auth_is_member_of(pousada_id));
drop policy if exists "booking_guests_read" on booking_guests;
create policy "booking_guests_read" on booking_guests for select
  using (exists (
    select 1 from bookings b
    where b.id = booking_guests.booking_id
      and (auth_has_operational_access(b.pousada_id) or auth_has_active_grant(b.pousada_id))
  ));
drop function if exists list_inventory_movements(uuid, uuid, integer);
drop function if exists get_inventory_item(uuid);
drop function if exists list_inventory_items(uuid);
drop function if exists auth_sees_inventory_cost(uuid);
commit;
