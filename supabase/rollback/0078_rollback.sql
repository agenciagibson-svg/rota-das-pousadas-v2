-- Rollback de 0078_estoque_pedidos.sql (apaga estoque, pedidos e consumo!)
drop trigger if exists trg_refresh_pousada_rating on reviews;
drop function if exists refresh_pousada_rating();
-- guarda volta à versão de 0077 (reaplique 0077_owner_gallery_guard.sql).
drop function if exists get_booking_consumption(uuid);
drop function if exists get_guest_stay(uuid);
drop function if exists register_consumption_payment(uuid, numeric, text, text);
drop function if exists booking_consumption_summary(uuid);
drop function if exists cancel_guest_order(uuid);
drop function if exists staff_create_order(uuid, jsonb, text);
drop function if exists set_guest_order_status(uuid, text, text);
drop function if exists place_guest_order(uuid, jsonb, text);
drop function if exists create_order_lines(uuid, uuid, jsonb, boolean);
drop function if exists register_inventory_movement(uuid, text, numeric, numeric, text, boolean);
drop function if exists set_inventory_item_active(uuid, boolean);
drop function if exists save_inventory_item(uuid, uuid, jsonb);
drop table if exists pousada_guest_settings;
drop table if exists consumption_payments;
drop table if exists inventory_movements;
drop table if exists guest_order_items;
drop table if exists guest_orders;
drop table if exists inventory_items;
drop function if exists pousada_today(uuid);
drop function if exists auth_has_pousada_role(uuid, text[]);
