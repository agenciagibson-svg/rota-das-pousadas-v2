-- Rollback da 0087 — tarifas por temporada e fotos por acomodação.
-- Volta list_bookable_rooms e create_booking às versões da 0070/0084.
-- ATENÇÃO: apaga as regras de tarifa e as fotos das acomodações gravadas.
begin;

drop function if exists quote_room_stay(uuid, date, date);
drop function if exists list_bookable_rooms(text, date, date, integer);
create or replace function list_bookable_rooms(
  p_slug text, p_checkin date default null, p_checkout date default null,
  p_guests integer default 1
) returns table(id uuid, name text, description text, base_price integer, capacity integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_guests is null or p_guests < 1 or p_guests > 100
    or (p_checkin is null) <> (p_checkout is null)
    or p_checkout <= p_checkin then
    raise exception 'Filtros de disponibilidade inválidos.';
  end if;
  return query
  select r.id, r.name, r.description,
    coalesce(nullif(r.base_price, 0), p.price_per_night), coalesce(r.capacity_max, r.capacity)
  from rooms r join pousadas p on p.id = r.pousada_id
  left join accommodation_categories c on c.id = r.category_id
  where p.slug = p_slug and p.status = 'publicada'
    and p.tenant_status in ('onboarding', 'active')
    and r.status = 'active' and r.public_visible
    and (r.category_id is null or c.status = 'active')
    and r.operational_status not in ('maintenance', 'blocked')
    and coalesce(r.capacity_max, r.capacity) >= p_guests
    and (p_checkin is null or (
      not exists (select 1 from bookings b where b.room_id = r.id
        and b.status in ('pending', 'confirmed', 'checked_in')
        -- 0070: pendência com prazo vencido não segura mais o quarto.
        and (b.status <> 'pending' or b.payment_due_at is null or b.payment_due_at > now())
        and b.checkin < p_checkout and b.checkout > p_checkin)
      and not exists (select 1 from room_blocks rb where rb.room_id = r.id
        and rb.status = 'active'
        and rb.starts_at < (p_checkout::timestamp at time zone 'UTC')
        and rb.ends_at > (p_checkin::timestamp at time zone 'UTC'))
      and not exists (select 1 from channel_events ce where ce.room_id = r.id
        and ce.starts_on < p_checkout and ce.ends_on > p_checkin)
    ))
  order by 4, r.id;
end;
$$;
revoke all on function list_bookable_rooms(text, date, date, integer) from public;
grant execute on function list_bookable_rooms(text, date, date, integer) to anon, authenticated;

-- create_booking da 0084 (preço = diária-base × noites)
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

  v_is_staff := auth_has_guest_access(p_pousada_id) or auth_has_active_grant(p_pousada_id);

  -- 0084: no fluxo da equipe (balcão/painel) a reserva nunca é vinculada à
  -- conta de outra pessoa. Antes, qualquer membro de pousada podia "plantar"
  -- uma reserva pendente na conta de um hóspede qualquer, que passava a ver
  -- as instruções de Pix dessa pousada (vetor de golpe).
  if v_is_staff and p_traveler_user_id is not null and p_traveler_user_id <> auth.uid() then
    raise exception 'A reserva da equipe não pode ser vinculada à conta de outro usuário.';
  end if;

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

drop function if exists room_stay_quote(uuid, date, date);
drop function if exists room_night_price(uuid, date);
drop table if exists rate_rules;
drop function if exists guard_rate_rule_room();
drop function if exists audit_rate_rule();
alter table rooms drop constraint if exists rooms_gallery_max;
alter table rooms drop column if exists gallery;

commit;
