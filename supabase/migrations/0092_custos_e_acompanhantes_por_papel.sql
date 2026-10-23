-- 0092 — Custo do estoque e dados dos acompanhantes só para quem precisa
--
-- Decisão do Gibson (23/10/2026), a partir da simulação dos papéis:
--
-- 1. Custo de compra do estoque (`inventory_items.unit_cost`,
--    `inventory_movements.unit_cost`) é margem do dono: só proprietário,
--    gestor e financeiro veem. Recepção e governança continuam vendo e
--    movimentando o estoque (nome, quantidade, mínimo, preço de venda — que o
--    hóspede já vê no app da estadia), mas sem o custo. Antes as telas
--    escondiam o custo e a API REST entregava.
--      - Leitura direta das duas tabelas: só os três papéis de custo.
--      - Todos os papéis com acesso ao estoque leem por `list_inventory_items`,
--        `get_inventory_item` e `list_inventory_movements`, que devolvem
--        `unit_cost` nulo para quem não é desses papéis.
--
-- 2. Acompanhantes (`booking_guests`: nome, nascimento, documento cifrado) são
--    dado pessoal da ficha de hospedagem. Leem: proprietário, gestor e
--    recepção (`auth_has_guest_access`) e plataforma com concessão. O
--    financeiro e a governança deixam de ler (não usam).
--
-- Rollback: supabase/rollback/0092_rollback.sql

create or replace function auth_sees_inventory_cost(p_pousada_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select auth_has_pousada_role(p_pousada_id,
    array['proprietario', 'admin_pousada', 'financeiro_pousada']);
$$;
revoke all on function auth_sees_inventory_cost(uuid) from public, anon;
grant execute on function auth_sees_inventory_cost(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 1. Estoque
-- ---------------------------------------------------------------------------
drop policy if exists "inventory_items_read" on inventory_items;
create policy "inventory_items_read" on inventory_items for select
  using (auth_sees_inventory_cost(pousada_id));

drop policy if exists "inventory_movements_read" on inventory_movements;
create policy "inventory_movements_read" on inventory_movements for select
  using (auth_sees_inventory_cost(pousada_id));

create or replace function list_inventory_items(p_pousada_id uuid)
returns table(
  id uuid, pousada_id uuid, name text, category text, unit text, track_stock boolean,
  quantity numeric, min_quantity numeric, unit_cost numeric, sale_price numeric,
  show_in_app boolean, description text, photo_url text, active boolean, sort_order integer
)
language plpgsql stable security definer set search_path = public as $$
declare v_cost boolean;
begin
  if auth.uid() is null or not auth_is_member_of(p_pousada_id) then
    raise exception 'Sem acesso ao estoque desta pousada.';
  end if;
  v_cost := auth_sees_inventory_cost(p_pousada_id);
  return query
  select i.id, i.pousada_id, i.name, i.category, i.unit, i.track_stock,
         i.quantity, i.min_quantity,
         case when v_cost then i.unit_cost end,
         i.sale_price, i.show_in_app, i.description, i.photo_url, i.active, i.sort_order
  from inventory_items i
  where i.pousada_id = p_pousada_id
  order by i.sort_order, i.name;
end;
$$;
revoke all on function list_inventory_items(uuid) from public, anon;
grant execute on function list_inventory_items(uuid) to authenticated;

create or replace function get_inventory_item(p_item_id uuid)
returns table(
  id uuid, pousada_id uuid, name text, category text, unit text, track_stock boolean,
  quantity numeric, min_quantity numeric, unit_cost numeric, sale_price numeric,
  show_in_app boolean, description text, photo_url text, active boolean, sort_order integer
)
language plpgsql stable security definer set search_path = public as $$
declare v_pousada uuid;
begin
  select i.pousada_id into v_pousada from inventory_items i where i.id = p_item_id;
  -- Item de outra pousada responde igual a item inexistente (sem oráculo).
  if v_pousada is null or auth.uid() is null or not auth_is_member_of(v_pousada) then
    return;
  end if;
  return query select * from list_inventory_items(v_pousada) l where l.id = p_item_id;
end;
$$;
revoke all on function get_inventory_item(uuid) from public, anon;
grant execute on function get_inventory_item(uuid) to authenticated;

create or replace function list_inventory_movements(
  p_pousada_id uuid, p_item_id uuid default null, p_limit integer default 100
)
returns table(
  id uuid, item_id uuid, item_name text, kind text, quantity numeric, balance_after numeric,
  unit_cost numeric, note text, order_id uuid, expense_id uuid, created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
declare v_cost boolean;
begin
  if auth.uid() is null or not auth_is_member_of(p_pousada_id) then
    raise exception 'Sem acesso ao estoque desta pousada.';
  end if;
  v_cost := auth_sees_inventory_cost(p_pousada_id);
  return query
  select m.id, m.item_id, coalesce(i.name, 'Item'), m.kind::text, m.quantity, m.balance_after,
         case when v_cost then m.unit_cost end,
         m.note, m.order_id,
         case when v_cost then m.expense_id end,
         m.created_at
  from inventory_movements m
  left join inventory_items i on i.id = m.item_id
  where m.pousada_id = p_pousada_id
    and (p_item_id is null or m.item_id = p_item_id)
  order by m.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;
revoke all on function list_inventory_movements(uuid, uuid, integer) from public, anon;
grant execute on function list_inventory_movements(uuid, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Acompanhantes
-- ---------------------------------------------------------------------------
drop policy if exists "booking_guests_read" on booking_guests;
create policy "booking_guests_read" on booking_guests for select
  using (exists (
    select 1 from bookings b
    where b.id = booking_guests.booking_id
      and (auth_has_guest_access(b.pousada_id) or auth_has_active_grant(b.pousada_id))
  ));
