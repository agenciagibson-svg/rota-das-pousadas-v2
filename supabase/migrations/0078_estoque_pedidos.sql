-- =============================================================================
-- 0078 — Estoque, pedidos do hóspede e conta de consumo.
--
-- (A) Estoque: itens da pousada (bebidas, frigobar, enxoval, amenities...) e
--     o histórico de movimentos. A quantidade só muda por movimento, sempre
--     numa RPC que trava a linha do item — nunca por UPDATE direto.
-- (B) Pedidos do hóspede pelo app (/estadia): preço congelado no pedido;
--     status novo → preparando → entregue | cancelado. "Entregue" baixa o
--     estoque na mesma transação.
-- (C) Conta de consumo: SEPARADA da diária. Somar ao `bookings.total` mexeria
--     no pagamento do Mercado Pago e na regra que confirma a reserva quando
--     `amount_received >= total`. Consumo = pedidos entregues; o que foi pago
--     fica em `consumption_payments`.
-- (D) Informações para o hóspede (Wi-Fi, recados) em tabela própria: a linha
--     de `pousadas` é pública (vitrine) e a senha do Wi-Fi não pode vazar.
--
-- Escrita só por RPC (security definer). As tabelas têm RLS de leitura.
-- Papéis:
--   estoque — ver: qualquer membro ativo; cadastrar item e dar entrada com
--             custo: proprietario/admin_pousada; saída, perda e ajuste:
--             + recepcionista e governanca.
--   pedidos — ver e operar: proprietario/admin_pousada/recepcionista/governanca
--             (+ financeiro_pousada só vê).
--   consumo — registrar pagamento: quem registra pagamento de reserva
--             (auth_has_operational_access).
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Helper: papel ativo numa pousada ativa.
-- ----------------------------------------------------------------------------
create or replace function auth_has_pousada_role(target_pousada uuid, roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    join pousadas p on p.id = m.pousada_id
    where m.user_id = auth.uid()
      and m.pousada_id = target_pousada
      and m.role::text = any (roles)
      and m.status = 'active'
      and p.tenant_status in ('onboarding', 'active')
  );
$$;
revoke execute on function auth_has_pousada_role(uuid, text[]) from public;
grant execute on function auth_has_pousada_role(uuid, text[]) to authenticated;

-- "Hoje" no fuso da pousada.
create or replace function pousada_today(p_pousada_id uuid)
returns date language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce(nullif(p.timezone, ''), 'America/Sao_Paulo'))::date
  from pousadas p where p.id = p_pousada_id;
$$;
revoke execute on function pousada_today(uuid) from public;
grant execute on function pousada_today(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- (A) Estoque
-- ----------------------------------------------------------------------------
create table if not exists inventory_items (
  id           uuid primary key default gen_random_uuid(),
  pousada_id   uuid not null references pousadas(id) on delete cascade,
  name         text not null check (char_length(trim(name)) between 2 and 80),
  category     text not null default 'outros' check (category in (
                 'bebidas', 'alimentos', 'frigobar', 'cafe_da_manha', 'enxoval',
                 'amenities', 'limpeza', 'manutencao', 'servicos', 'outros')),
  unit         text not null default 'un' check (unit in (
                 'un', 'kg', 'g', 'l', 'ml', 'pacote', 'caixa', 'garrafa', 'lata', 'par', 'jogo')),
  track_stock  boolean not null default true,
  quantity     numeric(12,3) not null default 0 check (quantity >= 0),
  min_quantity numeric(12,3) not null default 0 check (min_quantity >= 0),
  unit_cost    numeric(12,2) check (unit_cost >= 0),
  sale_price   numeric(12,2) check (sale_price >= 0),
  show_in_app  boolean not null default false,
  description  text not null default '' check (char_length(description) <= 300),
  photo_url    text check (photo_url is null or char_length(photo_url) <= 2048),
  active       boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Item do app precisa de preço (0 = cortesia, ex.: toalha extra).
  constraint inventory_items_app_needs_price check (not show_in_app or sale_price is not null)
);
create index if not exists idx_inventory_items_pousada on inventory_items(pousada_id, active);
create unique index if not exists uq_inventory_items_name
  on inventory_items(pousada_id, lower(trim(name)));

create table if not exists inventory_movements (
  id            uuid primary key default gen_random_uuid(),
  pousada_id    uuid not null references pousadas(id) on delete cascade,
  item_id       uuid not null references inventory_items(id) on delete cascade,
  kind          text not null check (kind in ('entrada', 'saida', 'perda', 'ajuste', 'pedido')),
  quantity      numeric(12,3) not null check (quantity <> 0),  -- variação (+/-)
  balance_after numeric(12,3) not null,
  unit_cost     numeric(12,2),
  note          text not null default '' check (char_length(note) <= 200),
  order_id      uuid,
  expense_id    uuid references expenses(id) on delete set null,
  created_by    uuid references profiles(id) default auth.uid(),
  created_at    timestamptz not null default now()
);
create index if not exists idx_inventory_movements_item on inventory_movements(item_id, created_at desc);
create index if not exists idx_inventory_movements_pousada on inventory_movements(pousada_id, created_at desc);

alter table inventory_items enable row level security;
alter table inventory_movements enable row level security;

drop policy if exists "inventory_items_read" on inventory_items;
create policy "inventory_items_read" on inventory_items for select
  using (auth_is_member_of(pousada_id));
drop policy if exists "inventory_movements_read" on inventory_movements;
create policy "inventory_movements_read" on inventory_movements for select
  using (auth_is_member_of(pousada_id));

-- ----------------------------------------------------------------------------
-- (B) Pedidos do hóspede
-- ----------------------------------------------------------------------------
create table if not exists guest_orders (
  id            uuid primary key default gen_random_uuid(),
  pousada_id    uuid not null references pousadas(id) on delete cascade,
  booking_id    uuid not null references bookings(id) on delete cascade,
  status        text not null default 'novo'
                  check (status in ('novo', 'preparando', 'entregue', 'cancelado')),
  source        text not null default 'hospede' check (source in ('hospede', 'equipe')),
  note          text not null default '' check (char_length(note) <= 300),
  total         numeric(12,2) not null default 0 check (total >= 0),
  requested_by  uuid references profiles(id),
  accepted_at   timestamptz,
  delivered_at  timestamptz,
  delivered_by  uuid references profiles(id),
  cancelled_at  timestamptz,
  cancelled_by  uuid references profiles(id),
  cancel_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_guest_orders_pousada on guest_orders(pousada_id, status, created_at desc);
create index if not exists idx_guest_orders_booking on guest_orders(booking_id, created_at desc);

create table if not exists guest_order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references guest_orders(id) on delete cascade,
  item_id    uuid references inventory_items(id) on delete set null,
  name       text not null,
  unit       text not null default 'un',
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity   integer not null check (quantity between 1 and 50),
  line_total numeric(12,2) generated always as (unit_price * quantity) stored
);
create index if not exists idx_guest_order_items_order on guest_order_items(order_id);

alter table inventory_movements
  drop constraint if exists inventory_movements_order_fk,
  add constraint inventory_movements_order_fk
    foreign key (order_id) references guest_orders(id) on delete set null;

alter table guest_orders enable row level security;
alter table guest_order_items enable row level security;

-- Equipe (menos quem não opera pedido) ou o próprio hóspede da reserva.
drop policy if exists "guest_orders_read" on guest_orders;
create policy "guest_orders_read" on guest_orders for select
  using (
    auth_has_pousada_role(pousada_id, array['proprietario', 'admin_pousada', 'recepcionista', 'governanca', 'financeiro_pousada'])
    or exists (select 1 from bookings b where b.id = booking_id and b.guest_id = auth.uid())
  );
drop policy if exists "guest_order_items_read" on guest_order_items;
create policy "guest_order_items_read" on guest_order_items for select
  using (exists (select 1 from guest_orders o where o.id = order_id));  -- herda a RLS do pedido

-- ----------------------------------------------------------------------------
-- (C) Pagamentos da conta de consumo
-- ----------------------------------------------------------------------------
create table if not exists consumption_payments (
  id         uuid primary key default gen_random_uuid(),
  pousada_id uuid not null references pousadas(id) on delete cascade,
  booking_id uuid not null references bookings(id) on delete cascade,
  amount     numeric(12,2) not null check (amount > 0),
  method     text not null check (method in ('pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'outro')),
  note       text not null default '' check (char_length(note) <= 200),
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists idx_consumption_payments_booking on consumption_payments(booking_id);
create index if not exists idx_consumption_payments_pousada on consumption_payments(pousada_id, created_at desc);

alter table consumption_payments enable row level security;
drop policy if exists "consumption_payments_read" on consumption_payments;
create policy "consumption_payments_read" on consumption_payments for select
  using (
    auth_has_operational_access(pousada_id)
    or exists (select 1 from bookings b where b.id = booking_id and b.guest_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- (D) Informações para o hóspede
-- ----------------------------------------------------------------------------
create table if not exists pousada_guest_settings (
  pousada_id     uuid primary key references pousadas(id) on delete cascade,
  wifi_name      text not null default '' check (char_length(wifi_name) <= 80),
  wifi_password  text not null default '' check (char_length(wifi_password) <= 80),
  guest_info     text not null default '' check (char_length(guest_info) <= 2000),
  orders_enabled boolean not null default true,
  orders_hours   text not null default '' check (char_length(orders_hours) <= 120),
  updated_at     timestamptz not null default now()
);
alter table pousada_guest_settings enable row level security;
drop policy if exists "pousada_guest_settings_read" on pousada_guest_settings;
create policy "pousada_guest_settings_read" on pousada_guest_settings for select
  using (auth_is_member_of(pousada_id));
drop policy if exists "pousada_guest_settings_write" on pousada_guest_settings;
create policy "pousada_guest_settings_write" on pousada_guest_settings for all
  using (auth_can_manage_pousada(pousada_id))
  with check (auth_can_manage_pousada(pousada_id));

-- =============================================================================
-- RPCs — estoque
-- =============================================================================
create or replace function save_inventory_item(
  p_pousada_id uuid,
  p_item_id uuid,
  p_data jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := p_item_id;
  v_name text := left(trim(coalesce(p_data->>'name', '')), 80);
  v_initial numeric := coalesce(nullif(p_data->>'initialQuantity', '')::numeric, 0);
  v_track boolean := coalesce((p_data->>'trackStock')::boolean, true);
  v_show boolean := coalesce((p_data->>'showInApp')::boolean, false);
  v_price numeric := nullif(p_data->>'salePrice', '')::numeric;
  v_cost numeric := nullif(p_data->>'unitCost', '')::numeric;
begin
  if not auth_has_pousada_role(p_pousada_id, array['proprietario', 'admin_pousada']) then
    raise exception 'Seu perfil não pode cadastrar itens do estoque.';
  end if;
  if char_length(v_name) < 2 then raise exception 'Informe o nome do item.'; end if;
  if v_show and v_price is null then
    raise exception 'Para aparecer no app do hóspede, informe o preço (0 para cortesia).';
  end if;
  if v_initial < 0 then raise exception 'Quantidade inicial inválida.'; end if;
  if exists (
    select 1 from inventory_items i
    where i.pousada_id = p_pousada_id and lower(trim(i.name)) = lower(v_name)
      and i.id is distinct from p_item_id
  ) then
    raise exception 'Já existe um item com o nome "%".', v_name;
  end if;

  if v_id is null then
    insert into inventory_items (
      pousada_id, name, category, unit, track_stock, min_quantity, unit_cost, sale_price,
      show_in_app, description, photo_url, sort_order
    ) values (
      p_pousada_id, v_name,
      coalesce(nullif(p_data->>'category', ''), 'outros'),
      coalesce(nullif(p_data->>'unit', ''), 'un'),
      v_track,
      coalesce(nullif(p_data->>'minQuantity', '')::numeric, 0),
      v_cost, v_price, v_show,
      left(coalesce(p_data->>'description', ''), 300),
      nullif(p_data->>'photoUrl', ''),
      coalesce(nullif(p_data->>'sortOrder', '')::integer, 0)
    ) returning id into v_id;

    if v_track and v_initial > 0 then
      update inventory_items set quantity = v_initial where id = v_id;
      insert into inventory_movements (pousada_id, item_id, kind, quantity, balance_after, unit_cost, note)
      values (p_pousada_id, v_id, 'entrada', v_initial, v_initial, v_cost, 'Estoque inicial');
    end if;
  else
    update inventory_items set
      name = v_name,
      category = coalesce(nullif(p_data->>'category', ''), category),
      unit = coalesce(nullif(p_data->>'unit', ''), unit),
      track_stock = v_track,
      min_quantity = coalesce(nullif(p_data->>'minQuantity', '')::numeric, 0),
      unit_cost = v_cost,
      sale_price = v_price,
      show_in_app = v_show,
      description = left(coalesce(p_data->>'description', ''), 300),
      photo_url = nullif(p_data->>'photoUrl', ''),
      sort_order = coalesce(nullif(p_data->>'sortOrder', '')::integer, sort_order),
      updated_at = now()
    where id = v_id and pousada_id = p_pousada_id;
    if not found then raise exception 'Item não encontrado nesta pousada.'; end if;
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;
revoke all on function save_inventory_item(uuid, uuid, jsonb) from public, anon;
grant execute on function save_inventory_item(uuid, uuid, jsonb) to authenticated;

create or replace function set_inventory_item_active(p_item_id uuid, p_active boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare v_pousada uuid;
begin
  select pousada_id into v_pousada from inventory_items where id = p_item_id;
  if v_pousada is null then raise exception 'Item não encontrado.'; end if;
  if not auth_has_pousada_role(v_pousada, array['proprietario', 'admin_pousada']) then
    raise exception 'Seu perfil não pode alterar itens do estoque.';
  end if;
  update inventory_items
     set active = p_active, show_in_app = case when p_active then show_in_app else false end,
         updated_at = now()
   where id = p_item_id;
end;
$$;
revoke all on function set_inventory_item_active(uuid, boolean) from public, anon;
grant execute on function set_inventory_item_active(uuid, boolean) to authenticated;

/**
 * Movimento manual. `p_quantity`: quanto entra/sai (positivo); no ajuste, a
 * contagem real (o sistema calcula a diferença). Entrada com custo pode
 * lançar a compra como despesa paga (categoria Insumos) no Financeiro.
 */
create or replace function register_inventory_movement(
  p_item_id uuid,
  p_kind text,
  p_quantity numeric,
  p_unit_cost numeric default null,
  p_note text default '',
  p_create_expense boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_item inventory_items%rowtype;
  v_delta numeric;
  v_new numeric;
  v_expense uuid;
  v_amount integer;
begin
  select * into v_item from inventory_items where id = p_item_id for update;
  if v_item.id is null then raise exception 'Item não encontrado.'; end if;
  if not v_item.track_stock then
    raise exception 'Este item não controla estoque.';
  end if;
  if p_kind not in ('entrada', 'saida', 'perda', 'ajuste') then
    raise exception 'Tipo de movimento inválido.';
  end if;
  if p_quantity is null or p_quantity < 0 or (p_kind <> 'ajuste' and p_quantity = 0) then
    raise exception 'Informe a quantidade.';
  end if;
  if p_quantity > 1000000 then raise exception 'Quantidade muito alta.'; end if;

  if p_kind = 'entrada' then
    if not auth_has_pousada_role(v_item.pousada_id, array['proprietario', 'admin_pousada', 'recepcionista', 'governanca']) then
      raise exception 'Seu perfil não pode dar entrada no estoque.';
    end if;
    v_delta := p_quantity;
  elsif p_kind in ('saida', 'perda') then
    if not auth_has_pousada_role(v_item.pousada_id, array['proprietario', 'admin_pousada', 'recepcionista', 'governanca']) then
      raise exception 'Seu perfil não pode dar baixa no estoque.';
    end if;
    v_delta := -p_quantity;
  else
    if not auth_has_pousada_role(v_item.pousada_id, array['proprietario', 'admin_pousada', 'governanca']) then
      raise exception 'Seu perfil não pode ajustar o estoque.';
    end if;
    v_delta := p_quantity - v_item.quantity;
    if v_delta = 0 then
      return jsonb_build_object('balance', v_item.quantity, 'expenseId', null);
    end if;
  end if;

  v_new := v_item.quantity + v_delta;
  if v_new < 0 then
    raise exception 'Estoque insuficiente de "%": tem %.', v_item.name, trim(to_char(v_item.quantity, 'FM999999990.###'));
  end if;

  if p_kind = 'entrada' and p_create_expense then
    if not auth_has_pousada_role(v_item.pousada_id, array['proprietario', 'admin_pousada']) then
      raise exception 'Só proprietário ou gestor lançam a compra no Financeiro.';
    end if;
    if p_unit_cost is null or p_unit_cost <= 0 then
      raise exception 'Informe o custo unitário para lançar a despesa.';
    end if;
    v_amount := greatest(1, round(p_quantity * p_unit_cost)::integer);
    insert into expenses (pousada_id, description, amount, category, due_date, paid)
    values (
      v_item.pousada_id,
      left(format('Compra: %s (%s %s)', v_item.name, trim(to_char(p_quantity, 'FM999999990.###')), v_item.unit), 120),
      v_amount, 'insumos', pousada_today(v_item.pousada_id), true
    ) returning id into v_expense;
  end if;

  update inventory_items
     set quantity = v_new,
         unit_cost = case when p_kind = 'entrada' and p_unit_cost is not null then p_unit_cost else unit_cost end,
         updated_at = now()
   where id = v_item.id;

  insert into inventory_movements (pousada_id, item_id, kind, quantity, balance_after, unit_cost, note, expense_id)
  values (v_item.pousada_id, v_item.id, p_kind, v_delta, v_new, p_unit_cost, left(coalesce(p_note, ''), 200), v_expense);

  return jsonb_build_object('balance', v_new, 'expenseId', v_expense);
end;
$$;
revoke all on function register_inventory_movement(uuid, text, numeric, numeric, text, boolean) from public, anon;
grant execute on function register_inventory_movement(uuid, text, numeric, numeric, text, boolean) to authenticated;

-- =============================================================================
-- RPCs — pedidos
-- =============================================================================

-- Monta o pedido (itens validados, preço congelado). Usada pelo hóspede e pela
-- equipe. Não baixa estoque: isso acontece ao entregar.
create or replace function create_order_lines(
  p_order_id uuid,
  p_pousada_id uuid,
  p_items jsonb,
  p_only_app_items boolean
) returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_line jsonb;
  v_item inventory_items%rowtype;
  v_qty integer;
  v_total numeric := 0;
  v_count integer := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Escolha pelo menos um item.';
  end if;
  if jsonb_array_length(p_items) > 20 then raise exception 'Máximo de 20 itens por pedido.'; end if;

  for v_line in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_line->>'quantity')::integer, 0);
    if v_qty < 1 or v_qty > 20 then raise exception 'Quantidade inválida.'; end if;

    select * into v_item from inventory_items
     where id = (v_line->>'itemId')::uuid and pousada_id = p_pousada_id and active;
    if v_item.id is null then raise exception 'Item indisponível.'; end if;
    if p_only_app_items and not v_item.show_in_app then raise exception 'Item indisponível.'; end if;
    if v_item.sale_price is null then
      raise exception '"%" está sem preço de venda.', v_item.name;
    end if;
    if v_item.track_stock and v_item.quantity < v_qty then
      raise exception 'Acabou "%" (restam %).', v_item.name, trim(to_char(v_item.quantity, 'FM999999990'));
    end if;

    insert into guest_order_items (order_id, item_id, name, unit, unit_price, quantity)
    values (p_order_id, v_item.id, v_item.name, v_item.unit, v_item.sale_price, v_qty);
    v_total := v_total + v_item.sale_price * v_qty;
    v_count := v_count + 1;
  end loop;

  return v_total;
end;
$$;
revoke all on function create_order_lines(uuid, uuid, jsonb, boolean) from public, anon, authenticated;

-- Pedido do hóspede pelo app.
create or replace function place_guest_order(p_booking_id uuid, p_items jsonb, p_note text default '')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_b bookings%rowtype;
  v_today date;
  v_enabled boolean;
  v_order uuid;
  v_total numeric;
begin
  if auth.uid() is null then raise exception 'Faça login para pedir.'; end if;
  select * into v_b from bookings where id = p_booking_id;
  if v_b.id is null or v_b.guest_id is distinct from auth.uid() then
    raise exception 'Reserva não encontrada.';
  end if;
  if v_b.status not in ('confirmed', 'checked_in') then
    raise exception 'Os pedidos ficam liberados durante a sua estadia.';
  end if;
  v_today := pousada_today(v_b.pousada_id);
  if v_today < v_b.checkin or v_today > v_b.checkout then
    raise exception 'Os pedidos ficam liberados do dia do check-in ao dia do check-out.';
  end if;
  select coalesce(s.orders_enabled, true) into v_enabled
    from pousadas p left join pousada_guest_settings s on s.pousada_id = p.id
   where p.id = v_b.pousada_id;
  if not coalesce(v_enabled, true) then
    raise exception 'A pousada não está recebendo pedidos pelo app agora. Fale com a recepção.';
  end if;
  if (select count(*) from guest_orders o
       where o.booking_id = p_booking_id and o.status in ('novo', 'preparando')) >= 5 then
    raise exception 'Você já tem 5 pedidos em andamento. Aguarde a entrega ou fale com a recepção.';
  end if;

  insert into guest_orders (pousada_id, booking_id, source, note, requested_by)
  values (v_b.pousada_id, v_b.id, 'hospede', left(coalesce(trim(p_note), ''), 300), auth.uid())
  returning id into v_order;

  v_total := create_order_lines(v_order, v_b.pousada_id, p_items, true);
  update guest_orders set total = v_total where id = v_order;

  return jsonb_build_object('orderId', v_order, 'total', v_total);
end;
$$;
revoke all on function place_guest_order(uuid, jsonb, text) from public, anon;
grant execute on function place_guest_order(uuid, jsonb, text) to authenticated;

-- Consumo lançado pela equipe (ex.: conferência do frigobar no check-out).
-- Já nasce entregue e baixa o estoque.
create or replace function staff_create_order(p_booking_id uuid, p_items jsonb, p_note text default '')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_b bookings%rowtype;
  v_order uuid;
  v_total numeric;
begin
  select * into v_b from bookings where id = p_booking_id;
  if v_b.id is null then raise exception 'Reserva não encontrada.'; end if;
  if not auth_has_pousada_role(v_b.pousada_id, array['proprietario', 'admin_pousada', 'recepcionista']) then
    raise exception 'Seu perfil não pode lançar consumo.';
  end if;
  if v_b.status in ('cancelled', 'no_show', 'quote') then
    raise exception 'Não dá para lançar consumo nesta reserva.';
  end if;

  insert into guest_orders (pousada_id, booking_id, source, note, requested_by, status)
  values (v_b.pousada_id, v_b.id, 'equipe', left(coalesce(trim(p_note), ''), 300), auth.uid(), 'novo')
  returning id into v_order;
  v_total := create_order_lines(v_order, v_b.pousada_id, p_items, false);
  update guest_orders set total = v_total where id = v_order;

  perform set_guest_order_status(v_order, 'entregue', null);
  return jsonb_build_object('orderId', v_order, 'total', v_total);
end;
$$;
revoke all on function staff_create_order(uuid, jsonb, text) from public, anon;
grant execute on function staff_create_order(uuid, jsonb, text) to authenticated;

create or replace function set_guest_order_status(p_order_id uuid, p_status text, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_o guest_orders%rowtype;
  v_line record;
  v_item inventory_items%rowtype;
begin
  select * into v_o from guest_orders where id = p_order_id for update;
  if v_o.id is null then raise exception 'Pedido não encontrado.'; end if;
  if not auth_has_pousada_role(v_o.pousada_id, array['proprietario', 'admin_pousada', 'recepcionista', 'governanca']) then
    raise exception 'Seu perfil não pode atualizar pedidos.';
  end if;

  if v_o.status in ('entregue', 'cancelado') then
    raise exception 'Este pedido já foi %.', case v_o.status when 'entregue' then 'entregue' else 'cancelado' end;
  end if;
  if p_status = 'preparando' then
    if v_o.status <> 'novo' then raise exception 'O pedido já está em preparo.'; end if;
    update guest_orders set status = 'preparando', accepted_at = now(), updated_at = now() where id = v_o.id;
  elsif p_status = 'cancelado' then
    if char_length(trim(coalesce(p_reason, ''))) < 3 then
      raise exception 'Informe o motivo do cancelamento.';
    end if;
    update guest_orders
       set status = 'cancelado', cancelled_at = now(), cancelled_by = auth.uid(),
           cancel_reason = left(trim(p_reason), 200), updated_at = now()
     where id = v_o.id;
  elsif p_status = 'entregue' then
    -- Baixa o estoque dos itens controlados, travando cada item.
    for v_line in
      select li.item_id, li.name, sum(li.quantity) as qty
        from guest_order_items li where li.order_id = v_o.id and li.item_id is not null
       group by li.item_id, li.name
    loop
      select * into v_item from inventory_items where id = v_line.item_id for update;
      if v_item.id is not null and v_item.track_stock then
        if v_item.quantity < v_line.qty then
          raise exception 'Estoque insuficiente de "%": tem %, o pedido pede %. Dê entrada ou ajuste o estoque antes.',
            v_item.name, trim(to_char(v_item.quantity, 'FM999999990.###')), v_line.qty;
        end if;
        update inventory_items set quantity = quantity - v_line.qty, updated_at = now() where id = v_item.id;
        insert into inventory_movements (pousada_id, item_id, kind, quantity, balance_after, note, order_id)
        values (v_o.pousada_id, v_item.id, 'pedido', -v_line.qty, v_item.quantity - v_line.qty,
                'Pedido do hóspede', v_o.id);
      end if;
    end loop;
    update guest_orders
       set status = 'entregue', delivered_at = now(), delivered_by = auth.uid(),
           accepted_at = coalesce(accepted_at, now()), updated_at = now()
     where id = v_o.id;
  else
    raise exception 'Status inválido.';
  end if;
end;
$$;
revoke all on function set_guest_order_status(uuid, text, text) from public, anon;
grant execute on function set_guest_order_status(uuid, text, text) to authenticated;

-- Hóspede desiste enquanto o pedido não começou a ser preparado.
create or replace function cancel_guest_order(p_order_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_o guest_orders%rowtype;
begin
  select o.* into v_o from guest_orders o join bookings b on b.id = o.booking_id
   where o.id = p_order_id and b.guest_id = auth.uid()
   for update of o;
  if v_o.id is null then raise exception 'Pedido não encontrado.'; end if;
  if v_o.status <> 'novo' then
    raise exception 'A pousada já começou a preparar. Fale com a recepção para cancelar.';
  end if;
  update guest_orders
     set status = 'cancelado', cancelled_at = now(), cancelled_by = auth.uid(),
         cancel_reason = 'Cancelado pelo hóspede', updated_at = now()
   where id = v_o.id;
end;
$$;
revoke all on function cancel_guest_order(uuid) from public, anon;
grant execute on function cancel_guest_order(uuid) to authenticated;

-- =============================================================================
-- Conta de consumo
-- =============================================================================
create or replace function booking_consumption_summary(p_booking_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'delivered', coalesce((select sum(total) from guest_orders where booking_id = p_booking_id and status = 'entregue'), 0),
    'open',      coalesce((select sum(total) from guest_orders where booking_id = p_booking_id and status in ('novo', 'preparando')), 0),
    'paid',      coalesce((select sum(amount) from consumption_payments where booking_id = p_booking_id), 0)
  );
$$;
revoke all on function booking_consumption_summary(uuid) from public, anon, authenticated;

create or replace function register_consumption_payment(
  p_booking_id uuid,
  p_amount numeric,
  p_method text,
  p_note text default ''
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_b bookings%rowtype;
  v_sum jsonb;
  v_balance numeric;
begin
  select * into v_b from bookings where id = p_booking_id for update;
  if v_b.id is null then raise exception 'Reserva não encontrada.'; end if;
  if not auth_has_operational_access(v_b.pousada_id) then
    raise exception 'Seu perfil não pode registrar pagamentos.';
  end if;
  if p_method not in ('pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'outro') then
    raise exception 'Forma de pagamento inválida.';
  end if;
  v_sum := booking_consumption_summary(p_booking_id);
  v_balance := (v_sum->>'delivered')::numeric - (v_sum->>'paid')::numeric;
  if p_amount is null or p_amount <= 0 then raise exception 'Informe o valor.'; end if;
  if p_amount > v_balance + 0.009 then
    raise exception 'O valor passa do que falta pagar do consumo (R$ %).', to_char(v_balance, 'FM999999990.00');
  end if;
  insert into consumption_payments (pousada_id, booking_id, amount, method, note)
  values (v_b.pousada_id, v_b.id, round(p_amount, 2), p_method, left(coalesce(p_note, ''), 200));
  return jsonb_build_object('balance', v_balance - round(p_amount, 2));
end;
$$;
revoke all on function register_consumption_payment(uuid, numeric, text, text) from public, anon;
grant execute on function register_consumption_payment(uuid, numeric, text, text) to authenticated;

-- =============================================================================
-- App do hóspede: tudo que a tela da estadia precisa, só para o dono da reserva.
-- =============================================================================
create or replace function get_guest_stay(p_booking_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_b bookings%rowtype;
  v_p pousadas%rowtype;
  v_s pousada_guest_settings%rowtype;
  v_today date;
  v_room text;
  v_can_order boolean;
  v_reviewed boolean;
  v_menu jsonb;
begin
  if auth.uid() is null then raise exception 'Faça login.'; end if;
  select * into v_b from bookings where id = p_booking_id;
  if v_b.id is null or v_b.guest_id is distinct from auth.uid() then
    raise exception 'Reserva não encontrada.';
  end if;
  select * into v_p from pousadas where id = v_b.pousada_id;
  select * into v_s from pousada_guest_settings where pousada_id = v_b.pousada_id;
  select name into v_room from rooms where id = v_b.room_id;
  v_today := pousada_today(v_b.pousada_id);
  v_can_order := v_b.status in ('confirmed', 'checked_in')
                 and v_today between v_b.checkin and v_b.checkout
                 and coalesce(v_s.orders_enabled, true);
  v_reviewed := exists (select 1 from reviews r where r.booking_id = v_b.id);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id, 'name', i.name, 'category', i.category, 'unit', i.unit,
           'price', i.sale_price, 'description', i.description, 'photoUrl', i.photo_url,
           'available', (not i.track_stock) or i.quantity > 0,
           'maxQuantity', case when i.track_stock then least(20, floor(i.quantity)::int) else 20 end
         ) order by i.sort_order, i.category, i.name), '[]'::jsonb)
    into v_menu
    from inventory_items i
   where i.pousada_id = v_b.pousada_id and i.active and i.show_in_app and i.sale_price is not null;

  return jsonb_build_object(
    'booking', jsonb_build_object(
      'id', v_b.id, 'code', v_b.code, 'status', v_b.status,
      'checkin', v_b.checkin, 'checkout', v_b.checkout,
      'adults', v_b.adults, 'children', v_b.children, 'roomName', coalesce(v_room, 'Acomodação'),
      'total', v_b.total, 'balanceDue', v_b.balance_due
    ),
    'pousada', jsonb_build_object(
      'id', v_p.id, 'name', v_p.name, 'slug', v_p.slug, 'image', v_p.image,
      'address', v_p.address, 'city', v_p.city, 'state', v_p.state, 'cep', v_p.cep,
      'whatsapp', v_p.whatsapp, 'phone', v_p.contact_phone,
      'checkinTime', v_p.checkin_time, 'checkoutTime', v_p.checkout_time,
      'houseRules', v_p.house_rules, 'cancellationPolicy', v_p.cancellation_policy
    ),
    'info', jsonb_build_object(
      'wifiName', coalesce(v_s.wifi_name, ''),
      -- Senha do Wi-Fi só a partir do check-in.
      'wifiPassword', case when v_b.status in ('confirmed', 'checked_in') and v_today >= v_b.checkin
                           then coalesce(v_s.wifi_password, '') else '' end,
      'guestInfo', coalesce(v_s.guest_info, ''),
      'ordersHours', coalesce(v_s.orders_hours, '')
    ),
    'today', v_today,
    'canOrder', v_can_order,
    'ordersEnabled', coalesce(v_s.orders_enabled, true),
    'canReview', auth_can_review_booking(v_b.id, v_b.pousada_id) and not v_reviewed,
    'reviewed', v_reviewed,
    'consumption', booking_consumption_summary(v_b.id),
    'menu', v_menu
  );
end;
$$;
revoke all on function get_guest_stay(uuid) from public, anon;
grant execute on function get_guest_stay(uuid) to authenticated;

-- Resumo do consumo para a equipe (detalhe da reserva / tela de pedidos).
create or replace function get_booking_consumption(p_booking_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_pousada uuid; v_guest uuid;
begin
  select pousada_id, guest_id into v_pousada, v_guest from bookings where id = p_booking_id;
  if v_pousada is null then raise exception 'Reserva não encontrada.'; end if;
  if not (auth_has_pousada_role(v_pousada, array['proprietario', 'admin_pousada', 'recepcionista', 'financeiro_pousada'])
          or v_guest = auth.uid()) then
    raise exception 'Sem acesso a esta conta.';
  end if;
  return booking_consumption_summary(p_booking_id);
end;
$$;
revoke all on function get_booking_consumption(uuid) from public, anon;
grant execute on function get_booking_consumption(uuid) to authenticated;

-- =============================================================================
-- (E) Nota e número de avaliações da pousada acompanham as avaliações reais.
-- Até aqui `pousadas.rating/reviews` nunca mudavam. A guarda de 0065/0077
-- barra o hóspede de mexer nessas colunas — a atualização automática passa
-- por uma marca de transação (`app.rating_refresh`) que só este gatilho liga.
-- =============================================================================
create or replace function guard_pousada_owner_changes()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c_owner_editable constant text[] := array[
    'name', 'legal_name', 'tax_id', 'city', 'state', 'country', 'address', 'cep', 'image',
    'gallery',
    'description', 'tags', 'timezone', 'currency', 'language', 'checkin_time', 'checkout_time',
    'contact_phone', 'whatsapp', 'notification_email', 'house_rules', 'cancellation_policy',
    'updated_at'
  ];
begin
  if auth.uid() is null or auth_can_manage_pousadas_platform() then
    return new;
  end if;

  -- Recalculo da nota pelo gatilho de avaliações: só rating/reviews mudam.
  -- pg_trigger_depth() > 1: só vale dentro de outro gatilho, nunca num UPDATE direto.
  if tg_op = 'UPDATE' and current_setting('app.rating_refresh', true) = '1'
     and pg_trigger_depth() > 1
     and (to_jsonb(new) - array['rating', 'reviews']) = (to_jsonb(old) - array['rating', 'reviews']) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('rascunho', 'em_analise')
       or new.rating <> 0 or new.reviews <> 0 or new.destination_id is not null then
      raise exception 'Pousada nova começa em análise, sem avaliações; a publicação é feita pela equipe da Rota.';
    end if;
    return new;
  end if;

  if (to_jsonb(new) - c_owner_editable) is distinct from (to_jsonb(old) - c_owner_editable) then
    raise exception 'Só a equipe da Rota pode alterar publicação, situação da conta, dono ou avaliações da pousada.';
  end if;
  return new;
end;
$$;

create or replace function refresh_pousada_rating()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pousada uuid := coalesce(new.pousada_id, old.pousada_id);
begin
  perform set_config('app.rating_refresh', '1', true);
  update pousadas p
     set rating = coalesce((select round(avg(r.rating)::numeric, 1) from reviews r where r.pousada_id = v_pousada), 0),
         reviews = (select count(*) from reviews r where r.pousada_id = v_pousada)
   where p.id = v_pousada;
  perform set_config('app.rating_refresh', '0', true);
  return null;
end;
$$;

drop trigger if exists trg_refresh_pousada_rating on reviews;
create trigger trg_refresh_pousada_rating
  after insert or delete or update of rating on reviews
  for each row execute function refresh_pousada_rating();

-- Acerta as pousadas que já têm avaliação (sem usuário: a guarda libera).
update pousadas p
   set rating = coalesce(s.avg_rating, 0), reviews = coalesce(s.total, 0)
  from (select pousada_id, round(avg(rating)::numeric, 1) as avg_rating, count(*) as total
          from reviews group by pousada_id) s
 where s.pousada_id = p.id;
