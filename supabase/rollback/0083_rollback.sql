-- Rollback da 0083 (segurança, rodada 4).
-- ATENÇÃO: reabre os furos descritos no cabeçalho da 0083 (papel de plataforma
-- escrevendo em qualquer pousada, trava de login e orçamento abertos a `anon`,
-- exclusão de pousada pelo dono). Use só para destravar uma regressão e
-- reaplique a 0083 corrigida em seguida. O código publicado junto com a 0083
-- continua funcionando com este rollback aplicado: a trava de login mantém a
-- assinatura nova (com a regra antiga) e o orçamento segue executável pelo
-- servidor. Deixam de funcionar até reaplicar: estorno de consumo, o consumo no
-- resumo do Financeiro e a oferta de pagamento on-line na página da reserva.
-- O documento dos acompanhantes continua cifrado (o app lê os dois formatos).
-- Perde dados: estornos de consumo são apagados (o pagamento estornado volta a
-- contar como pago) e centavos de despesas são arredondados para o inteiro mais
-- próximo. Com a coluna de novo inteira, o app publicado junto com a 0083 recusa
-- despesa com centavos.

-- (P)
grant execute on function assert_room_available_for_booking(uuid, uuid, date, date, integer, integer, boolean, uuid) to authenticated;
grant execute on function consume_oauth_state_nonce(text) to anon;
grant execute on function accept_membership_invite(uuid) to anon;
grant execute on function decline_membership_invite(uuid) to anon;
grant execute on function save_payment_account(uuid, text, text, text, text, boolean, timestamptz) to anon;
grant execute on function upsert_guest(uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, date, text, text, text, text, text, jsonb, text[], text, text, text, boolean, guest_source, text) to anon;
grant execute on function list_platform_hosts() to anon;
grant execute on function list_platform_team() to anon;

-- (O)
drop function if exists release_payment_reviews_notification(uuid[]);

-- (N)
drop function if exists consumption_totals_by_pousada(uuid);

-- (M)
drop trigger if exists trg_revoke_grants_on_platform_role_removed on public.profiles;
drop function if exists revoke_grants_on_platform_role_removed();
CREATE OR REPLACE FUNCTION public.auth_has_active_grant(target_pousada uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from platform_access_grants g
    where g.pousada_id = target_pousada
      and g.granted_to = auth.uid()
      and g.revoked_at is null
      and g.expires_at > now()
  );
$function$;

-- (L)
drop function if exists apply_booking_guest_document_backfill(uuid, text);
drop function if exists list_booking_guests_pending_document_backfill(integer);

-- (K) índices
drop index if exists idx_login_attempts_created;
drop index if exists idx_inventory_movements_expense;
drop index if exists idx_inventory_movements_order;
drop index if exists idx_guest_order_items_item;
drop index if exists idx_pousadas_owner;
drop index if exists idx_bookings_pousada_checkin;
drop index if exists idx_channel_events_pousada;

-- (J)
drop function if exists booking_can_pay_online(uuid);

-- (I)
drop policy if exists "pousada_amen_read" on pousada_amenities;
create policy "pousada_amen_read" on pousada_amenities for select using (true);
drop policy if exists "pousada_exp_read" on pousada_experiences;
create policy "pousada_exp_read" on pousada_experiences for select using (true);

-- (G) estoque, pedidos, consumo
CREATE OR REPLACE FUNCTION public.cancel_guest_order(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

drop function if exists reverse_consumption_payment(uuid, text);
CREATE OR REPLACE FUNCTION public.register_consumption_payment(p_booking_id uuid, p_amount numeric, p_method text, p_note text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

delete from consumption_payments where reverses_id is not null;
drop index if exists uq_consumption_payments_reverses;
alter table consumption_payments drop constraint if exists consumption_payments_reversal_sign;
alter table consumption_payments drop column if exists reverses_id;
alter table consumption_payments drop constraint if exists consumption_payments_amount_check;
alter table consumption_payments add constraint consumption_payments_amount_check check (amount > 0);

CREATE OR REPLACE FUNCTION public.set_guest_order_status(p_order_id uuid, p_status text, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.register_inventory_movement(p_item_id uuid, p_kind text, p_quantity numeric, p_unit_cost numeric DEFAULT NULL::numeric, p_note text DEFAULT ''::text, p_create_expense boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- (H) despesas voltam a inteiro
alter table inventory_items drop constraint if exists inventory_items_no_nan;
alter table platform_expenses drop constraint if exists platform_expenses_amount_check;
alter table expenses drop constraint if exists expenses_amount_check;
alter table platform_expenses alter column amount type integer using round(amount)::integer;
alter table expenses alter column amount type integer using round(amount)::integer;
alter table platform_expenses add constraint platform_expenses_amount_check check (amount >= 0);
alter table expenses add constraint expenses_amount_check check (amount >= 0);

-- (F)
drop policy if exists "pousadas_delete" on pousadas;
create policy "pousadas_delete" on pousadas for delete
  using (owner_id = auth.uid() or auth_can_manage_pousadas_platform());

-- (E)
drop policy if exists "pousadas_insert" on pousadas;
create policy "pousadas_insert" on pousadas for insert
  with check (owner_id = auth.uid() or auth_can_manage_pousadas_platform());
CREATE OR REPLACE FUNCTION public.create_pousada(p_name text, p_city text, p_state text, p_description text, p_price integer, p_slug text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pousada uuid;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;

  insert into pousadas (slug, name, city, state, description, price_per_night, image, status, owner_id)
  values (p_slug, p_name, p_city, upper(p_state), p_description, p_price, '/placeholder.svg', 'em_analise', auth.uid())
  returning id into v_pousada;

  insert into rooms (pousada_id, name, capacity, size, base_price, description)
  values (v_pousada, 'Acomodação principal', 4, '—', p_price, 'Acomodação padrão da pousada.');

  insert into memberships (user_id, pousada_id, role)
  values (auth.uid(), v_pousada, 'proprietario');

  return p_slug;
end;
$function$;

-- (D)
CREATE OR REPLACE FUNCTION public.submit_payment_proof(p_booking_id uuid, p_file_path text, p_file_name text, p_mime_type text, p_size_bytes integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_b bookings%rowtype;
  v_id uuid;
  v_due timestamptz := now() + interval '24 hours';
begin
  select * into v_b from bookings where id = p_booking_id for update;
  if not found or v_b.guest_id is distinct from auth.uid() then
    raise exception 'Reserva não encontrada.';
  end if;
  if v_b.status <> 'pending' or v_b.balance_due <= 0 then
    raise exception 'Esta reserva não está aguardando pagamento.';
  end if;
  if v_b.payment_due_at is not null and v_b.payment_due_at <= now() then
    raise exception 'O prazo de pagamento desta reserva terminou. Faça uma nova reserva.';
  end if;
  if not exists (select 1 from pousada_pix_settings s where s.pousada_id = v_b.pousada_id and s.enabled) then
    raise exception 'Esta pousada não recebe Pix direto.';
  end if;
  if (select count(*) from payment_proofs
       where uploaded_by = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Você já enviou muitos comprovantes hoje. Fale com a pousada pelo WhatsApp.';
  end if;
  if p_file_path is null or split_part(p_file_path, '/', 1) <> p_booking_id::text
     or p_file_path like '%..%' then
    raise exception 'Arquivo de comprovante inválido.';
  end if;
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf') then
    raise exception 'Envie uma foto (JPG, PNG) ou PDF do comprovante.';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'payment-proofs' and o.name = p_file_path) then
    raise exception 'O arquivo do comprovante não chegou. Tente enviar de novo.';
  end if;

  update payment_proofs set status = 'rejected', reviewed_at = now(),
         rejection_reason = 'Substituído por um novo envio do hóspede.'
   where booking_id = p_booking_id and status = 'submitted';

  insert into payment_proofs (booking_id, pousada_id, uploaded_by, file_path, file_name, mime_type, size_bytes, amount)
  values (p_booking_id, v_b.pousada_id, auth.uid(), p_file_path, left(coalesce(p_file_name, ''), 150),
          p_mime_type, p_size_bytes, v_b.balance_due)
  returning id into v_id;

  -- Em análise: as datas ficam guardadas por 24h (nunca menos que o prazo atual).
  update bookings set payment_due_at = greatest(coalesce(payment_due_at, v_due), v_due),
         version = version + 1, updated_at = now()
   where id = p_booking_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'payment_proof.submitted', 'bookings', p_booking_id,
          jsonb_build_object('proofId', v_id, 'amount', v_b.balance_due, 'reviewDueAt', v_due));

  return jsonb_build_object('id', v_id, 'amount', v_b.balance_due, 'reviewDueAt', v_due);
end;
$function$;

drop policy if exists "payment_proofs_upload_own_pending" on storage.objects;
create policy "payment_proofs_upload_own_pending" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and exists (
      select 1 from bookings b
      where b.id = payment_proof_booking_id(name)
        and b.guest_id = auth.uid()
        and b.status = 'pending'
    )
  );
drop function if exists payment_proof_upload_allowed(text);

-- (C)
grant execute on function create_quote_request(uuid, text, text, text, date, date, integer, integer, boolean, text, text, boolean)
  to anon, authenticated;

-- (B) A assinatura (e-mail, endereço) fica: é a que o código publicado junto
-- com a 0083 chama. Volta a regra antiga (5 falhas por e-mail, qualquer
-- origem) e a exposição antiga a anon/authenticated.
drop function if exists assert_login_not_locked(text, text);
drop function if exists login_ip_key(text);
create or replace function assert_login_not_locked(p_email text, p_ip text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_recent_failures integer;
begin
  if p_email is null or length(trim(p_email)) = 0 then
    return;
  end if;

  select count(*) into v_recent_failures
  from login_attempts
  where lower(email) = lower(p_email)
    and success = false
    and created_at > now() - interval '15 minutes';

  if v_recent_failures >= 5 then
    raise exception 'Muitas tentativas de login para este e-mail. Tente novamente em alguns minutos.'
      using errcode = 'P0429';
  end if;
end;
$$;
revoke execute on function assert_login_not_locked(text, text) from public;
grant execute on function assert_login_not_locked(text, text) to anon, authenticated, service_role;
grant execute on function record_login_attempt(text, text, boolean) to anon, authenticated;

-- (A)
CREATE OR REPLACE FUNCTION public.assert_room_available_for_booking(p_pousada_id uuid, p_room_id uuid, p_checkin date, p_checkout date, p_adults integer, p_children integer, p_pets boolean, p_exclude_booking_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_room record;
  v_category_status accommodation_status;
  v_conflict_block uuid;
  v_conflict_booking text;
  v_old_room uuid;
  v_old_checkin date;
  v_old_checkout date;
  v_channel_provider channel_provider;
begin
  select r.id, r.pousada_id, r.status, r.operational_status,
         coalesce(r.capacity_max, r.capacity) as capacity_max, r.pets_allowed, r.category_id
    into v_room
  from rooms r where r.id = p_room_id;

  if v_room.id is null then
    raise exception 'Acomodação não encontrada.';
  end if;
  if v_room.pousada_id <> p_pousada_id then
    raise exception 'Acomodação não pertence a esta pousada.';
  end if;
  if v_room.status <> 'active' then
    raise exception 'Esta acomodação está inativa.';
  end if;
  if v_room.category_id is not null then
    select status into v_category_status from accommodation_categories where id = v_room.category_id;
    if v_category_status is distinct from 'active' then
      raise exception 'A categoria desta acomodação está inativa.';
    end if;
  end if;
  if v_room.operational_status in ('maintenance', 'blocked') then
    raise exception 'Esta acomodação está indisponível por status operacional (%).', v_room.operational_status;
  end if;
  if (p_adults + p_children) > v_room.capacity_max then
    raise exception 'Capacidade máxima de % hóspedes para esta acomodação.', v_room.capacity_max;
  end if;
  if p_pets and not v_room.pets_allowed then
    raise exception 'Esta acomodação não aceita pets.';
  end if;

  select id into v_conflict_block from room_blocks
  where room_id = p_room_id and status = 'active'
    and starts_at < p_checkout::timestamptz and ends_at > p_checkin::timestamptz
  limit 1;
  if v_conflict_block is not null then
    raise exception 'Esta acomodação está bloqueada nesse período.';
  end if;

  select code into v_conflict_booking from bookings
  where room_id = p_room_id
    and status in ('pending', 'confirmed', 'checked_in')
    and (p_exclude_booking_id is null or id <> p_exclude_booking_id)
    and checkin < p_checkout and checkout > p_checkin
  limit 1;
  if v_conflict_booking is not null then
    raise exception 'Já existe uma reserva (%) conflitando com este período.', v_conflict_booking;
  end if;

  -- Ocupação importada das OTAs (0044). `ends_on` é exclusivo, como `checkout`.
  if p_exclude_booking_id is not null then
    select room_id, checkin, checkout into v_old_room, v_old_checkin, v_old_checkout
    from bookings where id = p_exclude_booking_id;
  end if;

  select cc.provider into v_channel_provider
  from channel_events ce
  join channel_calendars cc on cc.id = ce.calendar_id
  where ce.room_id = p_room_id
    and ce.starts_on < p_checkout and ce.ends_on > p_checkin
    -- Na edição, ignora o trecho do evento contido nas noites que a reserva já
    -- ocupava neste quarto (eco do feed que a própria Rota exportou).
    and not (
      v_old_room is not null and v_old_room = p_room_id
      and greatest(ce.starts_on, p_checkin) >= v_old_checkin
      and least(ce.ends_on, p_checkout) <= v_old_checkout
    )
  limit 1;
  if found then
    raise exception 'Esta acomodação já está ocupada % nesse período (calendário sincronizado).',
      case v_channel_provider
        when 'airbnb' then 'no Airbnb'
        when 'booking' then 'no Booking.com'
        else 'em outro canal'
      end;
  end if;
end;
$function$;

drop policy if exists "booking_guests_write" on booking_guests;
create policy "booking_guests_write" on booking_guests for all
  using (exists (
    select 1 from bookings b
    where b.id = booking_guests.booking_id
      and (auth_has_guest_access(b.pousada_id) or auth_is_platform_admin())
  ))
  with check (exists (
    select 1 from bookings b
    where b.id = booking_guests.booking_id
      and (auth_has_guest_access(b.pousada_id) or auth_is_platform_admin())
  ));
drop policy if exists "booking_guests_read" on booking_guests;
create policy "booking_guests_read" on booking_guests for select
  using (exists (
    select 1 from bookings b
    where b.id = booking_guests.booking_id
      and (b.guest_id = auth.uid() or auth_has_operational_access(b.pousada_id)
           or auth_has_active_grant(b.pousada_id) or auth_is_platform_admin())
  ));

-- create_booking
CREATE OR REPLACE FUNCTION public.create_booking(p_pousada_id uuid, p_room_id uuid, p_responsible_guest_id uuid, p_code text, p_checkin date, p_checkout date, p_adults integer, p_children integer, p_infants integer, p_pets boolean, p_subtotal integer, p_fee integer, p_discount integer, p_surcharge integer, p_services_amount integer, p_total integer, p_status booking_status, p_origin booking_origin DEFAULT 'rota_das_pousadas'::booking_origin, p_traveler_user_id uuid DEFAULT NULL::uuid, p_external_channel_name text DEFAULT NULL::text, p_external_code text DEFAULT NULL::text, p_expected_commission numeric DEFAULT NULL::numeric, p_expected_arrival_time text DEFAULT NULL::text, p_special_requests text DEFAULT ''::text, p_internal_notes text DEFAULT ''::text, p_payment_due_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_is_staff boolean;
  v_guest record;
  v_id uuid;
  v_stale record;
  v_nightly integer;
  v_nights integer;
  v_subtotal integer;
  v_open_pending integer;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if p_checkout <= p_checkin then raise exception 'A data de saída deve ser posterior à de entrada.'; end if;

  v_is_staff := auth_has_guest_access(p_pousada_id) or auth_is_platform_admin();

  if not v_is_staff then
    -- Fluxo público: só o próprio viajante autenticado, só como pending,
    -- só para uma pousada realmente publicada.
    if p_traveler_user_id is distinct from auth.uid() then
      raise exception 'Você não tem permissão para criar esta reserva.';
    end if;
    if p_status <> 'pending' then
      raise exception 'Reservas públicas só podem ser criadas como pendentes de pagamento.';
    end if;
    if p_checkin < pousada_local_date(p_pousada_id) then
      raise exception 'A data de entrada não pode ser no passado.';
    end if;
    if not exists (
      select 1 from pousadas p where p.id = p_pousada_id
        and p.status = 'publicada' and p.tenant_status in ('onboarding', 'active')
    ) then
      raise exception 'Esta pousada não está disponível para reserva.';
    end if;

    -- Preço autoritativo: mesma expressão de list_bookable_rooms (0044).
    select coalesce(nullif(r.base_price, 0), p.price_per_night) into v_nightly
    from rooms r join pousadas p on p.id = r.pousada_id
    where r.id = p_room_id and r.pousada_id = p_pousada_id;
    if v_nightly is null then raise exception 'Acomodação inválida para esta pousada.'; end if;

    v_nights   := p_checkout - p_checkin;
    v_subtotal := v_nightly * v_nights;

    -- Divergência é erro explícito, não correção silenciosa: se o formulário
    -- mostrou outro valor, o hóspede precisa revê-lo antes de pagar.
    if coalesce(p_subtotal, -1) <> v_subtotal or coalesce(p_total, -1) <> v_subtotal
       or coalesce(p_fee, 0) <> 0 or coalesce(p_discount, 0) <> 0
       or coalesce(p_surcharge, 0) <> 0 or coalesce(p_services_amount, 0) <> 0 then
      raise exception 'O valor da reserva mudou. Volte à busca para revisar antes de reservar.';
    end if;

    if p_origin is null or p_origin not in ('rota_das_pousadas', 'link_bio')
       or p_external_channel_name is not null or p_external_code is not null
       or p_expected_commission is not null then
      raise exception 'Origem inválida para reserva pública.';
    end if;

    -- Teto de pendências abertas: sem isto, criar reservas pending em série é
    -- negação de serviço sobre o inventário de qualquer pousada publicada.
    select count(*) into v_open_pending from bookings
    where guest_id = auth.uid() and status = 'pending'
      and (payment_due_at is null or payment_due_at > now());
    if v_open_pending >= 3 then
      raise exception 'Você já tem reservas aguardando pagamento. Conclua ou cancele antes de criar outra.';
    end if;

    -- Campos que só o servidor decide.
    p_subtotal       := v_subtotal;
    p_total          := v_subtotal;
    p_fee            := 0;
    p_discount       := 0;
    p_surcharge      := 0;
    p_services_amount := 0;
    p_internal_notes := '';
    p_special_requests := left(trim(coalesce(p_special_requests, '')), 500);
    -- 0070: 2h quando a pousada recebe on-line (Mercado Pago conectado);
    -- 24h quando o pagamento é combinado direto com a pousada.
    p_payment_due_at := now() + case
      when exists (select 1 from pousada_payment_accounts a
                   where a.pousada_id = p_pousada_id and a.access_token is not null)
        then interval '2 hours'
      else interval '24 hours'
    end;

    -- `bookings.code` é unique (0001). Sorteia até achar um livre em vez de
    -- deixar a colisão virar unique_violation na cara do hóspede.
    loop
      p_code := 'RP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      exit when not exists (select 1 from bookings where code = p_code);
    end loop;
  end if;

  select id, pousada_id, full_name, email, phone into v_guest from guests where id = p_responsible_guest_id;
  if v_guest.id is null or v_guest.pousada_id <> p_pousada_id then
    raise exception 'Hóspede responsável inválido para esta pousada.';
  end if;
  -- No fluxo público o responsável é o próprio viajante — nunca a ficha de
  -- outro hóspede da pousada (que continuaria passando pela checagem acima).
  if not v_is_staff and not exists (
    select 1 from guests g where g.id = p_responsible_guest_id and g.user_id = auth.uid()
  ) then
    raise exception 'Hóspede responsável inválido para esta reserva.';
  end if;

  -- Expira, de forma auditável, pendências vencidas desta acomodação que
  -- sobrepõem o período pedido, antes de checar conflito (RB seção 9: nunca
  -- silencioso — cada expiração aqui gera uma linha própria em audit_log).
  for v_stale in
    select id from bookings
    where room_id = p_room_id and status = 'pending'
      and payment_due_at is not null and payment_due_at < now()
      and checkin < p_checkout and checkout > p_checkin
  loop
    update bookings set status = 'cancelled', cancellation_reason = 'Prazo de pagamento expirado',
      cancelled_at = now(), version = version + 1
    where id = v_stale.id;
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (null, 'booking.expired', 'bookings', v_stale.id, jsonb_build_object('reason', 'payment_due_at_passed'));
  end loop;

  perform assert_room_available_for_booking(p_pousada_id, p_room_id, p_checkin, p_checkout, p_adults, p_children, p_pets);

  begin
    insert into bookings (
      code, pousada_id, room_id, guest_id, responsible_guest_id, guest_name, guest_email, guest_phone,
      checkin, checkout, adults, children, infants, pets,
      subtotal, fee, discount, surcharge, services_amount, total,
      status, origin, external_channel_name, external_code, expected_commission,
      expected_arrival_time, special_requests, internal_notes, payment_due_at, created_by
    ) values (
      p_code, p_pousada_id, p_room_id, p_traveler_user_id, p_responsible_guest_id, v_guest.full_name, v_guest.email, v_guest.phone,
      p_checkin, p_checkout, p_adults, p_children, p_infants, p_pets,
      p_subtotal, p_fee, p_discount, p_surcharge, p_services_amount, p_total,
      p_status, p_origin, p_external_channel_name, p_external_code, p_expected_commission,
      p_expected_arrival_time, coalesce(p_special_requests, ''), coalesce(p_internal_notes, ''), p_payment_due_at, auth.uid()
    ) returning id into v_id;
  exception when exclusion_violation then
    raise exception 'Já existe uma reserva conflitando com este período para esta acomodação.';
  end;

  insert into booking_guests (booking_id, guest_id, full_name, guest_type)
  values (v_id, p_responsible_guest_id, v_guest.full_name, 'responsible');

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'booking.created', 'bookings', v_id,
          jsonb_build_object('pousadaId', p_pousada_id, 'roomId', p_room_id, 'status', p_status,
                             'origin', p_origin, 'staff', v_is_staff));

  return jsonb_build_object('id', v_id, 'code', p_code);
end;
$function$;

-- update_booking
CREATE OR REPLACE FUNCTION public.update_booking(p_booking_id uuid, p_version integer, p_room_id uuid, p_responsible_guest_id uuid, p_checkin date, p_checkout date, p_adults integer, p_children integer, p_infants integer, p_pets boolean, p_subtotal integer, p_fee integer, p_discount integer, p_surcharge integer, p_services_amount integer, p_total integer, p_origin booking_origin, p_expected_arrival_time text, p_special_requests text, p_internal_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_current record;
  v_availability_affected boolean;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;

  select * into v_current from bookings where id = p_booking_id;
  if v_current.id is null then raise exception 'Reserva não encontrada.'; end if;
  if not (auth_has_guest_access(v_current.pousada_id) or auth_is_platform_admin()) then
    raise exception 'Você não tem permissão para editar reservas nesta pousada.';
  end if;
  if v_current.version <> p_version then
    raise exception 'Esta reserva foi alterada por outro usuário. Recarregue e tente novamente.';
  end if;
  if v_current.status in ('cancelled', 'no_show', 'checked_out') then
    raise exception 'Uma reserva com status % não pode mais ser editada.', v_current.status;
  end if;
  if p_checkout <= p_checkin then raise exception 'A data de saída deve ser posterior à de entrada.'; end if;
  if not exists (select 1 from guests where id = p_responsible_guest_id and pousada_id = v_current.pousada_id) then
    raise exception 'Hóspede responsável inválido para esta pousada.';
  end if;

  v_availability_affected := (
    p_room_id <> v_current.room_id or p_checkin <> v_current.checkin or p_checkout <> v_current.checkout
    or p_adults <> v_current.adults or p_children <> v_current.children or p_pets <> v_current.pets
  );
  if v_availability_affected then
    perform assert_room_available_for_booking(
      v_current.pousada_id, p_room_id, p_checkin, p_checkout, p_adults, p_children, p_pets, p_booking_id
    );
  end if;

  begin
    update bookings set
      room_id = p_room_id, responsible_guest_id = p_responsible_guest_id,
      checkin = p_checkin, checkout = p_checkout, adults = p_adults, children = p_children,
      infants = p_infants, pets = p_pets, subtotal = p_subtotal, fee = p_fee, discount = p_discount,
      surcharge = p_surcharge, services_amount = p_services_amount, total = p_total, origin = p_origin,
      expected_arrival_time = p_expected_arrival_time, special_requests = coalesce(p_special_requests, ''),
      internal_notes = coalesce(p_internal_notes, ''), version = version + 1, updated_by = auth.uid(), updated_at = now()
    where id = p_booking_id;
  exception when exclusion_violation then
    raise exception 'Já existe uma reserva conflitando com este período para esta acomodação.';
  end;

  if p_checkin <> v_current.checkin or p_checkout <> v_current.checkout then
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'booking.period_changed', 'bookings', p_booking_id,
            jsonb_build_object('from', jsonb_build_object('checkin', v_current.checkin, 'checkout', v_current.checkout),
                                'to', jsonb_build_object('checkin', p_checkin, 'checkout', p_checkout)));
  end if;
  if p_room_id <> v_current.room_id then
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'booking.room_changed', 'bookings', p_booking_id,
            jsonb_build_object('from', v_current.room_id, 'to', p_room_id));
  end if;
  if p_responsible_guest_id <> v_current.responsible_guest_id then
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'booking.responsible_changed', 'bookings', p_booking_id,
            jsonb_build_object('from', v_current.responsible_guest_id, 'to', p_responsible_guest_id));
  end if;
  if p_total <> v_current.total or p_discount <> v_current.discount or p_surcharge <> v_current.surcharge then
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'booking.values_changed', 'bookings', p_booking_id,
            jsonb_build_object('from', v_current.total, 'to', p_total));
  end if;

  return jsonb_build_object('id', p_booking_id, 'version', p_version + 1);
end;
$function$;

-- set_booking_companions
CREATE OR REPLACE FUNCTION public.set_booking_companions(p_booking_id uuid, p_version integer, p_companions jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_current record;
  v_item jsonb;
  v_responsible_count integer := 0;
  v_total_count integer := 0;
  v_expected_total integer;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;

  select * into v_current from bookings where id = p_booking_id;
  if v_current.id is null then raise exception 'Reserva não encontrada.'; end if;
  if not (auth_has_guest_access(v_current.pousada_id) or auth_is_platform_admin()) then
    raise exception 'Você não tem permissão para editar acompanhantes nesta pousada.';
  end if;
  if v_current.version <> p_version then
    raise exception 'Esta reserva foi alterada por outro usuário. Recarregue e tente novamente.';
  end if;

  for v_item in select * from jsonb_array_elements(p_companions) loop
    v_total_count := v_total_count + 1;
    if (v_item->>'guestType') = 'responsible' then
      v_responsible_count := v_responsible_count + 1;
    end if;
  end loop;

  if v_responsible_count <> 1 then
    raise exception 'A reserva precisa ter exatamente um responsável.';
  end if;

  v_expected_total := v_current.adults + v_current.children + v_current.infants;
  if v_total_count <> v_expected_total then
    raise exception 'A quantidade de acompanhantes (%) não corresponde ao total da reserva (%).', v_total_count, v_expected_total;
  end if;

  delete from booking_guests where booking_id = p_booking_id;

  for v_item in select * from jsonb_array_elements(p_companions) loop
    insert into booking_guests (
      booking_id, guest_id, full_name, guest_type, has_special_needs,
      birth_date, document_type, document_number, operational_notes
    ) values (
      p_booking_id,
      nullif(v_item->>'guestId', '')::uuid,
      v_item->>'fullName',
      (v_item->>'guestType')::booking_guest_type,
      coalesce((v_item->>'hasSpecialNeeds')::boolean, false),
      nullif(v_item->>'birthDate', '')::date,
      nullif(v_item->>'documentType', ''),
      nullif(v_item->>'documentNumber', ''),
      coalesce(v_item->>'operationalNotes', '')
    );
  end loop;

  update bookings set version = version + 1, updated_by = auth.uid(), updated_at = now() where id = p_booking_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'booking.companions_updated', 'bookings', p_booking_id, jsonb_build_object('count', v_total_count));

  return jsonb_build_object('id', p_booking_id, 'version', p_version + 1);
end;
$function$;

-- expire_pending_booking
CREATE OR REPLACE FUNCTION public.expire_pending_booking(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_current record;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;

  select * into v_current from bookings where id = p_booking_id;
  if v_current.id is null then raise exception 'Reserva não encontrada.'; end if;
  if not (
    auth_has_guest_access(v_current.pousada_id) or auth_is_platform_admin()
    or v_current.guest_id = auth.uid()
  ) then
    raise exception 'Você não tem permissão sobre esta reserva.';
  end if;
  if v_current.status <> 'pending' then
    raise exception 'Só é possível expirar uma reserva pendente.';
  end if;
  if v_current.payment_due_at is null or v_current.payment_due_at >= now() then
    raise exception 'O prazo de pagamento desta reserva ainda não venceu.';
  end if;

  update bookings set
    status = 'cancelled', cancellation_reason = 'Prazo de pagamento expirado',
    cancelled_at = now(), version = version + 1
  where id = p_booking_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'booking.expired', 'bookings', p_booking_id, jsonb_build_object('reason', 'payment_due_at_passed'));

  return jsonb_build_object('id', p_booking_id, 'status', 'cancelled');
end;
$function$;

-- update_room_operational_status
CREATE OR REPLACE FUNCTION public.update_room_operational_status(p_pousada_id uuid, p_room_id uuid, p_status room_operational_status)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pousada uuid;
  v_previous room_operational_status;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not (
    exists (
      select 1 from memberships m
      where m.user_id = auth.uid() and m.pousada_id = p_pousada_id
        and m.role in ('proprietario', 'admin_pousada', 'governanca')
        and m.status = 'active'
    )
    or auth_is_platform_admin()
  ) then
    raise exception 'Você não tem permissão para alterar o status operacional nesta pousada.';
  end if;

  select pousada_id, operational_status into v_pousada, v_previous from rooms where id = p_room_id;
  if v_pousada is null then raise exception 'Acomodação não encontrada.'; end if;
  if v_pousada <> p_pousada_id then raise exception 'Acomodação não pertence a esta pousada.'; end if;

  update rooms set operational_status = p_status, updated_at = now(), updated_by = auth.uid() where id = p_room_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'room.operational_status_changed', 'rooms', p_room_id,
          jsonb_build_object('pousadaId', p_pousada_id, 'from', v_previous, 'to', p_status));

  return jsonb_build_object('status', 'ok');
end;
$function$;

-- list_rooms_for_housekeeping
CREATE OR REPLACE FUNCTION public.list_rooms_for_housekeeping(p_pousada_id uuid)
 RETURNS TABLE(id uuid, name text, code text, location text, operational_status room_operational_status, capacity integer, next_block_starts_at timestamp with time zone, operational_note text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    r.id, r.name, r.code, r.location, r.operational_status, r.capacity,
    (
      select min(b.starts_at) from room_blocks b
      where b.room_id = r.id and b.status = 'active' and b.ends_at > now()
    ),
    r.operational_description
  from rooms r
  where r.pousada_id = p_pousada_id
    and (
      exists (
        select 1 from memberships m
        where m.user_id = auth.uid()
          and m.pousada_id = p_pousada_id
          and m.role in ('proprietario', 'admin_pousada', 'governanca')
          and m.status = 'active'
      )
      or auth_is_platform_admin()
    );
$function$;

-- assert_can_manage_membership
CREATE OR REPLACE FUNCTION public.assert_can_manage_membership(p_pousada_id uuid, p_membership_id uuid)
 RETURNS TABLE(target_user_id uuid, target_role user_role, target_status membership_status)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pousada uuid;
  v_user uuid;
  v_role user_role;
  v_status membership_status;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;

  select m.pousada_id, m.user_id, m.role, m.status
    into v_pousada, v_user, v_role, v_status
  from memberships m
  where m.id = p_membership_id;

  if v_pousada is null then
    raise exception 'Vínculo não encontrado.';
  end if;
  if v_pousada <> p_pousada_id then
    raise exception 'Vínculo não pertence à pousada informada.';
  end if;

  if not (
    exists (
      select 1 from memberships m
      where m.user_id = auth.uid()
        and m.pousada_id = p_pousada_id
        and m.role = 'proprietario'
        and m.status = 'active'
    )
    or auth_is_platform_admin()
  ) then
    raise exception 'Você não tem permissão para gerenciar membros nesta pousada.';
  end if;

  return query select v_user, v_role, v_status;
end;
$function$;

-- save_payment_account
CREATE OR REPLACE FUNCTION public.save_payment_account(p_pousada_id uuid, p_mp_user_id text, p_access_token text, p_refresh_token text, p_public_key text, p_live_mode boolean, p_expires_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not (auth_is_active_owner_of(p_pousada_id) or auth_is_platform_admin()) then
    raise exception 'Somente o proprietário pode conectar a conta de pagamento desta pousada.';
  end if;

  insert into pousada_payment_accounts (
    pousada_id, provider, mp_user_id, access_token, refresh_token, public_key,
    live_mode, expires_at, connected_at, connected_by
  )
  values (
    p_pousada_id, 'mercadopago', p_mp_user_id, p_access_token, p_refresh_token, p_public_key,
    p_live_mode, p_expires_at, now(), auth.uid()
  )
  on conflict (pousada_id) do update set
    mp_user_id    = excluded.mp_user_id,
    access_token  = excluded.access_token,
    refresh_token = excluded.refresh_token,
    public_key    = excluded.public_key,
    live_mode     = excluded.live_mode,
    expires_at    = excluded.expires_at,
    connected_at  = now(),
    connected_by  = auth.uid(),
    updated_at    = now()
  returning id into v_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'payment_account.connected', 'pousada_payment_accounts', v_id,
          jsonb_build_object('pousadaId', p_pousada_id, 'liveMode', p_live_mode));

  return jsonb_build_object('status', 'ok', 'id', v_id);
end;
$function$;

-- create_pending_subscription
CREATE OR REPLACE FUNCTION public.create_pending_subscription(p_pousada_id uuid, p_plan_id uuid, p_mp_preapproval_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not (auth_is_active_owner_of(p_pousada_id) or auth_is_platform_admin()) then
    raise exception 'Somente o proprietário pode assinar o plano desta pousada.';
  end if;
  if p_mp_preapproval_id is null or length(p_mp_preapproval_id) = 0 then
    raise exception 'ID de assinatura do Mercado Pago inválido.';
  end if;

  insert into subscriptions (pousada_id, plan_id, mp_preapproval_id, status)
  values (p_pousada_id, p_plan_id, p_mp_preapproval_id, 'pending')
  on conflict (pousada_id) do update set
    plan_id           = excluded.plan_id,
    mp_preapproval_id = excluded.mp_preapproval_id,
    status            = 'pending',
    next_billing_date = null,
    updated_at        = now()
  returning id into v_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'subscription.authorization_started', 'subscriptions', v_id,
      jsonb_build_object('pousadaId', p_pousada_id, 'mpPreapprovalId', p_mp_preapproval_id));

  return v_id;
end;
$function$;
