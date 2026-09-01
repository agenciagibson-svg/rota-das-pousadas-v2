-- =============================================================================
-- Ciclo 4 (5/5) — RPCs transacionais de hóspedes/reservas + fechamento de RLS.
--
-- Mesma disciplina já aplicada a `memberships` (Ciclo 2C) e `room_blocks`/
-- `rooms` (Ciclo 3): mutação de dado sensível/de regra de negócio deixa de
-- ser uma policy RLS ampla e passa a exigir uma RPC SECURITY DEFINER que
-- reimplementa a regra no próprio Postgres — cliente direto pela API fica
-- sujeito às MESMAS regras da aplicação, porque a regra passa a viver no
-- banco.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- (0) Fecha a escrita direta de `bookings` — só RPC daqui em diante.
-- `bookings_read` (0020) não muda — já correta.
-- ----------------------------------------------------------------------------
drop policy if exists "bookings_insert" on bookings;
drop policy if exists "bookings_update" on bookings;

comment on function auth_has_guest_access(uuid) is
  'Reusado também como controle de escrita de reservas (booking:manage) — mesmo conjunto de papéis (proprietario/admin_pousada/recepcionista) tem as duas ações na matriz RBAC; financeiro_pousada e governanca ficam de fora dos dois.';

-- ----------------------------------------------------------------------------
-- (1) Validação de disponibilidade — cópia autoritativa, no banco, das
-- mesmas regras de features/acomodacoes/availability-engine.ts. Uso interno
-- apenas (sem grant a authenticated) — chamada de dentro de create_booking e
-- update_booking, que já rodam como SECURITY DEFINER.
-- ----------------------------------------------------------------------------
create or replace function assert_room_available_for_booking(
  p_pousada_id uuid, p_room_id uuid, p_checkin date, p_checkout date,
  p_adults integer, p_children integer, p_pets boolean,
  p_exclude_booking_id uuid default null
) returns void
language plpgsql stable security definer set search_path = public as $$
declare
  v_room record;
  v_category_status accommodation_status;
  v_conflict_block uuid;
  v_conflict_booking text;
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
end;
$$;
revoke execute on function assert_room_available_for_booking(uuid, uuid, date, date, integer, integer, boolean, uuid) from public;
revoke execute on function assert_room_available_for_booking(uuid, uuid, date, date, integer, integer, boolean, uuid) from anon;

-- ----------------------------------------------------------------------------
-- (2) upsert_guest — cria ou atualiza um hóspede escopado à pousada. Sem
-- fusão arriscada: reaproveita um cadastro existente só quando o e-mail OU
-- telefone normalizado OU documento bate EXATAMENTE com um único registro
-- já cadastrado NESSA pousada; caso contrário cria um novo.
-- ----------------------------------------------------------------------------
create or replace function upsert_guest(
  p_pousada_id uuid,
  p_guest_id uuid default null,
  p_user_id uuid default null,
  p_full_name text default '',
  p_preferred_name text default null,
  p_email text default null,
  p_phone text default null,
  p_whatsapp text default null,
  p_document_type text default null,
  p_document_number text default null,
  p_birth_date date default null,
  p_nationality text default null,
  p_country text default 'BR',
  p_city text default null,
  p_state text default null,
  p_address text default null,
  p_emergency_contact jsonb default '{}'::jsonb,
  p_preferences text[] default '{}',
  p_dietary_restrictions text default '',
  p_accessibility_needs text default '',
  p_internal_notes text default '',
  p_marketing_consent boolean default false,
  p_source guest_source default 'front_desk'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_email_norm text := nullif(lower(trim(p_email)), '');
  v_phone_norm text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
  v_action text;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not (auth_has_guest_access(p_pousada_id) or auth_is_platform_admin()) then
    raise exception 'Você não tem permissão para gerenciar hóspedes nesta pousada.';
  end if;
  if length(trim(p_full_name)) = 0 then
    raise exception 'Informe o nome completo do hóspede.';
  end if;

  if p_guest_id is not null then
    if not exists (select 1 from guests where id = p_guest_id and pousada_id = p_pousada_id) then
      raise exception 'Hóspede não encontrado nesta pousada.';
    end if;
    v_id := p_guest_id;
    v_action := 'guest.updated';
  else
    select id into v_id from guests
    where pousada_id = p_pousada_id
      and (
        (v_email_norm is not null and email_normalized = v_email_norm)
        or (v_phone_norm is not null and phone_normalized = v_phone_norm)
        or (p_document_number is not null and document_number = p_document_number)
      )
    order by created_at
    limit 1;
    v_action := case when v_id is null then 'guest.created' else 'guest.updated' end;
  end if;

  if v_id is null then
    insert into guests (
      pousada_id, user_id, full_name, preferred_name, email, phone, whatsapp,
      document_type, document_number, birth_date, nationality, country, city, state,
      address, emergency_contact, preferences, dietary_restrictions, accessibility_needs,
      internal_notes, marketing_consent, source, created_by
    ) values (
      p_pousada_id, p_user_id, trim(p_full_name), p_preferred_name, p_email, p_phone, p_whatsapp,
      p_document_type, p_document_number, p_birth_date, p_nationality, p_country, p_city, p_state,
      p_address, coalesce(p_emergency_contact, '{}'::jsonb), coalesce(p_preferences, '{}'),
      p_dietary_restrictions, p_accessibility_needs, p_internal_notes, p_marketing_consent, p_source, auth.uid()
    ) returning id into v_id;
  else
    update guests set
      user_id = coalesce(p_user_id, user_id),
      full_name = trim(p_full_name),
      preferred_name = p_preferred_name,
      email = p_email,
      phone = p_phone,
      whatsapp = p_whatsapp,
      document_type = p_document_type,
      document_number = p_document_number,
      birth_date = p_birth_date,
      nationality = p_nationality,
      country = p_country,
      city = p_city,
      state = p_state,
      address = p_address,
      emergency_contact = coalesce(p_emergency_contact, '{}'::jsonb),
      preferences = coalesce(p_preferences, '{}'),
      dietary_restrictions = p_dietary_restrictions,
      accessibility_needs = p_accessibility_needs,
      internal_notes = p_internal_notes,
      marketing_consent = p_marketing_consent,
      updated_at = now()
    where id = v_id;
  end if;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), v_action, 'guests', v_id, jsonb_build_object('pousadaId', p_pousada_id));

  return jsonb_build_object('id', v_id);
end;
$$;
revoke execute on function upsert_guest(
  uuid, uuid, uuid, text, text, text, text, text, text, text, date, text, text, text, text,
  text, jsonb, text[], text, text, text, boolean, guest_source
) from public;
grant execute on function upsert_guest(
  uuid, uuid, uuid, text, text, text, text, text, text, text, date, text, text, text, text,
  text, jsonb, text[], text, text, text, boolean, guest_source
) to authenticated;

-- ----------------------------------------------------------------------------
-- (3) create_booking — única porta de criação de reserva (pública e
-- administrativa). Preço já vem calculado pelo servidor confiável
-- (features/reservas/pricing.ts, chamado por bookings.service.ts) — a RPC
-- nunca recalcula preço, mas SEMPRE revalida disponibilidade/capacidade/
-- pets/bloqueio/conflito no banco, independentemente do que o formulário
-- enviou (RB seção 17: "não confie apenas no formulário público").
-- ----------------------------------------------------------------------------
create or replace function create_booking(
  p_pousada_id uuid,
  p_room_id uuid,
  p_responsible_guest_id uuid,
  p_code text,
  p_checkin date,
  p_checkout date,
  p_adults integer,
  p_children integer,
  p_infants integer,
  p_pets boolean,
  p_subtotal integer,
  p_fee integer,
  p_discount integer,
  p_surcharge integer,
  p_services_amount integer,
  p_total integer,
  p_status booking_status,
  p_origin booking_origin default 'rota_das_pousadas',
  p_traveler_user_id uuid default null,
  p_external_channel_name text default null,
  p_external_code text default null,
  p_expected_commission numeric default null,
  p_expected_arrival_time text default null,
  p_special_requests text default '',
  p_internal_notes text default '',
  p_payment_due_at timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_is_staff boolean;
  v_guest record;
  v_id uuid;
  v_stale record;
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
    if p_checkin < current_date then
      raise exception 'A data de entrada não pode ser no passado.';
    end if;
    if not exists (
      select 1 from pousadas p where p.id = p_pousada_id
        and p.status = 'publicada' and p.tenant_status in ('onboarding', 'active')
    ) then
      raise exception 'Esta pousada não está disponível para reserva.';
    end if;
  end if;

  select id, pousada_id, full_name, email, phone into v_guest from guests where id = p_responsible_guest_id;
  if v_guest.id is null or v_guest.pousada_id <> p_pousada_id then
    raise exception 'Hóspede responsável inválido para esta pousada.';
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
          jsonb_build_object('pousadaId', p_pousada_id, 'roomId', p_room_id, 'status', p_status, 'origin', p_origin));

  return jsonb_build_object('id', v_id, 'code', p_code);
end;
$$;
revoke execute on function create_booking(
  uuid, uuid, uuid, text, date, date, integer, integer, integer, boolean, integer, integer, integer,
  integer, integer, integer, booking_status, booking_origin, uuid, text, text, numeric, text, text, text, timestamptz
) from public;
grant execute on function create_booking(
  uuid, uuid, uuid, text, date, date, integer, integer, integer, boolean, integer, integer, integer,
  integer, integer, integer, booking_status, booking_origin, uuid, text, text, numeric, text, text, text, timestamptz
) to authenticated;

-- ----------------------------------------------------------------------------
-- (4) update_booking — só administrativo (staff). Recebe o estado completo
-- desejado + `p_version` (concorrência otimista — RB seção 12: "não permita
-- sobrescrever silenciosamente edição feita por outro usuário").
-- ----------------------------------------------------------------------------
create or replace function update_booking(
  p_booking_id uuid,
  p_version integer,
  p_room_id uuid,
  p_responsible_guest_id uuid,
  p_checkin date,
  p_checkout date,
  p_adults integer,
  p_children integer,
  p_infants integer,
  p_pets boolean,
  p_subtotal integer,
  p_fee integer,
  p_discount integer,
  p_surcharge integer,
  p_services_amount integer,
  p_total integer,
  p_origin booking_origin,
  p_expected_arrival_time text,
  p_special_requests text,
  p_internal_notes text
) returns jsonb
language plpgsql security definer set search_path = public as $$
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
$$;
revoke execute on function update_booking(
  uuid, integer, uuid, uuid, date, date, integer, integer, integer, boolean, integer, integer,
  integer, integer, integer, integer, booking_origin, text, text, text
) from public;
grant execute on function update_booking(
  uuid, integer, uuid, uuid, date, date, integer, integer, integer, boolean, integer, integer,
  integer, integer, integer, integer, booking_origin, text, text, text
) to authenticated;

-- ----------------------------------------------------------------------------
-- (5) set_booking_status — transições pré-check-in (RB seção 6). Hóspede só
-- pode se autocancelar; staff opera as demais.
-- ----------------------------------------------------------------------------
create or replace function set_booking_status(
  p_booking_id uuid, p_new_status booking_status, p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_current record;
  v_is_staff boolean;
  v_allowed boolean;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;

  select * into v_current from bookings where id = p_booking_id;
  if v_current.id is null then raise exception 'Reserva não encontrada.'; end if;

  v_is_staff := auth_has_guest_access(v_current.pousada_id) or auth_is_platform_admin();

  if not v_is_staff then
    if v_current.guest_id is distinct from auth.uid() then
      raise exception 'Você não tem permissão sobre esta reserva.';
    end if;
    if p_new_status <> 'cancelled' or v_current.status not in ('quote', 'pending') then
      raise exception 'Você só pode cancelar esta reserva enquanto ela não for confirmada.';
    end if;
  end if;

  v_allowed := (v_current.status, p_new_status) in (
    ('quote', 'pending'), ('quote', 'confirmed'), ('quote', 'cancelled'),
    ('pending', 'confirmed'), ('pending', 'cancelled'),
    ('confirmed', 'cancelled'), ('confirmed', 'no_show')
  );
  if not v_allowed then
    raise exception 'Transição de % para % não é permitida.', v_current.status, p_new_status;
  end if;
  if p_new_status in ('cancelled', 'no_show') and (p_reason is null or length(trim(p_reason)) < 3) then
    raise exception 'Descreva o motivo.';
  end if;

  update bookings set
    status = p_new_status,
    version = version + 1,
    updated_by = auth.uid(),
    updated_at = now(),
    cancelled_by = case when p_new_status = 'cancelled' then auth.uid() else cancelled_by end,
    cancelled_at = case when p_new_status = 'cancelled' then now() else cancelled_at end,
    cancellation_reason = case when p_new_status = 'cancelled' then p_reason else cancellation_reason end,
    no_show_by = case when p_new_status = 'no_show' then auth.uid() else no_show_by end,
    no_show_at = case when p_new_status = 'no_show' then now() else no_show_at end,
    no_show_reason = case when p_new_status = 'no_show' then p_reason else no_show_reason end
  where id = p_booking_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(),
          case p_new_status
            when 'confirmed' then 'booking.confirmed'
            when 'cancelled' then 'booking.cancelled'
            when 'no_show' then 'booking.no_show'
            else 'booking.status_changed'
          end,
          'bookings', p_booking_id,
          jsonb_build_object('from', v_current.status, 'to', p_new_status, 'reason', p_reason));

  return jsonb_build_object('id', p_booking_id, 'status', p_new_status);
end;
$$;
revoke execute on function set_booking_status(uuid, booking_status, text) from public;
grant execute on function set_booking_status(uuid, booking_status, text) to authenticated;

-- ----------------------------------------------------------------------------
-- (6) expire_pending_booking — expiração EXPLÍCITA e auditável (nunca
-- silenciosa) de uma pendência vencida. Substitui o antigo
-- expireOverdueBookingsBy*/`.update()` cru sem auditoria.
-- ----------------------------------------------------------------------------
create or replace function expire_pending_booking(p_booking_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
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
$$;
revoke execute on function expire_pending_booking(uuid) from public;
grant execute on function expire_pending_booking(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- (7) set_booking_companions — substitui atomicamente a lista de
-- acompanhantes. Só staff (gestão de acompanhantes é administrativa).
-- ----------------------------------------------------------------------------
create or replace function set_booking_companions(
  p_booking_id uuid, p_version integer, p_companions jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
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
$$;
revoke execute on function set_booking_companions(uuid, integer, jsonb) from public;
grant execute on function set_booking_companions(uuid, integer, jsonb) to authenticated;
