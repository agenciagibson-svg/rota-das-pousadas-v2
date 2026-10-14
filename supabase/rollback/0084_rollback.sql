-- Rollback da 0084 — volta leitura total de pousadas/reviews e as versões
-- anteriores de create_booking, upsert_guest e auth_can_review_booking.
-- ATENÇÃO: reabre a exposição de CPF/CNPJ e e-mail das pousadas. Antes de
-- rodar, volte também o código (repositories/*) para a versão anterior.

grant select on public.pousadas to anon, authenticated;
grant select on public.reviews to anon, authenticated;

drop function if exists public.get_pousada_private_settings(uuid);
drop function if exists public.list_pousada_reviews(uuid);

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


CREATE OR REPLACE FUNCTION public.upsert_guest(p_pousada_id uuid, p_guest_id uuid DEFAULT NULL::uuid, p_user_id uuid DEFAULT NULL::uuid, p_full_name text DEFAULT ''::text, p_preferred_name text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_whatsapp text DEFAULT NULL::text, p_document_type text DEFAULT NULL::text, p_document_number text DEFAULT NULL::text, p_document_number_hash text DEFAULT NULL::text, p_document_last4 text DEFAULT NULL::text, p_birth_date date DEFAULT NULL::date, p_nationality text DEFAULT NULL::text, p_country text DEFAULT 'BR'::text, p_city text DEFAULT NULL::text, p_state text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_emergency_contact jsonb DEFAULT '{}'::jsonb, p_preferences text[] DEFAULT '{}'::text[], p_dietary_restrictions text DEFAULT ''::text, p_accessibility_needs text DEFAULT ''::text, p_internal_notes text DEFAULT ''::text, p_marketing_consent boolean DEFAULT false, p_source guest_source DEFAULT 'front_desk'::guest_source, p_cep text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_email_norm text := nullif(lower(trim(p_email)), '');
  v_phone_norm text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
  v_action text;
  v_reused boolean := false;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not (auth_has_guest_access(p_pousada_id) or auth_has_active_grant(p_pousada_id)) then
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
        or (p_document_number_hash is not null and document_number_hash = p_document_number_hash)
      )
    order by created_at
    limit 1;
    v_reused := v_id is not null;
    v_action := case when v_id is null then 'guest.created' else 'guest.updated' end;
  end if;

  if v_id is null then
    insert into guests (
      pousada_id, user_id, full_name, preferred_name, email, phone, whatsapp,
      document_type, document_number, document_number_hash, document_last4, birth_date, nationality, country, city, state,
      address, cep, emergency_contact, preferences, dietary_restrictions, accessibility_needs,
      internal_notes, marketing_consent, source, created_by
    ) values (
      p_pousada_id, p_user_id, trim(p_full_name), p_preferred_name, p_email, p_phone, p_whatsapp,
      p_document_type, p_document_number, p_document_number_hash, p_document_last4, p_birth_date, p_nationality, p_country, p_city, p_state,
      p_address, p_cep, coalesce(p_emergency_contact, '{}'::jsonb), coalesce(p_preferences, '{}'),
      p_dietary_restrictions, p_accessibility_needs, p_internal_notes, p_marketing_consent, p_source, auth.uid()
    ) returning id into v_id;
  elsif v_reused then
    -- Reaproveitamento (sem p_guest_id): quem chama só conhece nome e contato.
    -- Nada é apagado — contato informado e diferente atualiza a ficha, o resto
    -- só preenche campo vazio e o consentimento nunca é revogado aqui.
    update guests set
      user_id = coalesce(user_id, p_user_id),
      preferred_name = coalesce(nullif(preferred_name, ''), p_preferred_name),
      email = case when v_email_norm is not null and v_email_norm is distinct from email_normalized
                   then trim(p_email) else email end,
      phone = case when v_phone_norm is not null and v_phone_norm is distinct from phone_normalized
                   then trim(p_phone) else phone end,
      whatsapp = coalesce(nullif(trim(p_whatsapp), ''), whatsapp),
      document_type = case when document_number is null then p_document_type else document_type end,
      document_number = coalesce(document_number, p_document_number),
      document_number_hash = case when document_number is null then p_document_number_hash else document_number_hash end,
      document_last4 = case when document_number is null then p_document_last4 else document_last4 end,
      birth_date = coalesce(birth_date, p_birth_date),
      nationality = coalesce(nullif(nationality, ''), p_nationality),
      country = coalesce(nullif(country, ''), p_country),
      city = coalesce(nullif(city, ''), p_city),
      state = coalesce(nullif(state, ''), p_state),
      address = coalesce(nullif(address, ''), p_address),
      cep = coalesce(nullif(cep, ''), p_cep),
      emergency_contact = case when emergency_contact = '{}'::jsonb
                               then coalesce(p_emergency_contact, '{}'::jsonb) else emergency_contact end,
      preferences = case when cardinality(preferences) = 0 then coalesce(p_preferences, '{}') else preferences end,
      dietary_restrictions = coalesce(nullif(dietary_restrictions, ''), p_dietary_restrictions, ''),
      accessibility_needs = coalesce(nullif(accessibility_needs, ''), p_accessibility_needs, ''),
      internal_notes = coalesce(nullif(internal_notes, ''), p_internal_notes, ''),
      marketing_consent = marketing_consent or coalesce(p_marketing_consent, false),
      updated_at = now()
    where id = v_id;
  else
    -- Edição pelo perfil (com p_guest_id): o formulário envia a ficha inteira
    -- e pode esvaziar campos de propósito — grava exatamente o que veio.
    update guests set
      user_id = coalesce(p_user_id, user_id),
      full_name = trim(p_full_name),
      preferred_name = p_preferred_name,
      email = p_email,
      phone = p_phone,
      whatsapp = p_whatsapp,
      document_type = p_document_type,
      document_number = p_document_number,
      document_number_hash = p_document_number_hash,
      document_last4 = p_document_last4,
      birth_date = p_birth_date,
      nationality = p_nationality,
      country = p_country,
      city = p_city,
      state = p_state,
      address = p_address,
      cep = p_cep,
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
$function$;


create or replace function public.auth_can_review_booking(p_booking_id uuid, p_pousada_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from bookings b
    where b.id = p_booking_id
      and b.pousada_id = p_pousada_id
      and b.guest_id = auth.uid()
      and (
        b.status = 'checked_out'
        or (b.status in ('confirmed', 'checked_in') and b.checkout <= current_date)
      )
  );
$$;
