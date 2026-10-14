-- =============================================================================
-- 0083 — Segurança, rodada 4: fecha o que a revisão de 01/10/2026 deixou em
-- aberto no banco e o que a reconferência de 04/10/2026 achou da mesma classe.
--
-- (A) Papel de plataforma ≠ acesso a qualquer pousada (mesma classe da 0047,
--     0051 e 0081, agora nas RPCs). `auth_is_platform_admin()` é verdadeiro
--     para QUALQUER platform_role (marketing, suporte, financeiro...). Ainda
--     abria, pela API REST, com a anon key + o próprio JWT:
--       * create_booking / update_booking / set_booking_companions /
--         expire_pending_booking — reserva em qualquer pousada pelo ramo
--         "equipe", que aceita preço e status enviados pelo cliente;
--       * update_room_operational_status / list_rooms_for_housekeeping;
--       * assert_can_manage_membership (update_member_role, suspend_member,
--         reactivate_member, revoke_member) — mexer na equipe de qualquer
--         pousada;
--       * save_payment_account — trocar a conta Mercado Pago que RECEBE os
--         pagamentos de qualquer pousada;
--       * create_pending_subscription — assinar plano em nome de qualquer uma;
--       * booking_guests (leitura e escrita direta do documento dos
--         acompanhantes).
--     Reservas, governança e acompanhantes passam a exigir concessão ativa e
--     justificada (`auth_has_active_grant`, 0047). Equipe, conta de pagamento
--     e assinatura: só o proprietário ou master.
--     As leituras de catálogo/assinatura por papel de plataforma não mudam.
-- (B) Trava de login: as duas RPCs eram executáveis por `anon`, então qualquer
--     pessoa gravava 5 falhas para o e-mail de um dono e travava o login dele
--     (e poluía o relatório do /admin). Passam a ser só do servidor
--     (service_role). A trava conta por e-mail + rede de origem (5 falhas em
--     15 min; IPv6 agrupado por /64) e por rede somando contas (30 falhas).
-- (C) Orçamento público: `create_quote_request` era executável por `anon`
--     direto na API, pulando o CAPTCHA da Server Action. Só o servidor chama.
-- (D) Comprovante Pix: teto de arquivos por reserva no bucket e tipo/tamanho
--     lidos do arquivo guardado, não do que o navegador declarou.
-- (E) create_pousada: no máximo 2 cadastros aguardando análise por conta, e
--     INSERT direto em `pousadas` só pela equipe da Rota.
-- (F) Excluir pousada: só a equipe da Rota (comercial/master). O dono apagava
--     a própria pousada mesmo suspensa, levando junto assinatura e faturas.
-- (G) Estoque, pedidos e conta de consumo: permissão conferida ANTES de travar
--     a linha (um usuário de outra pousada segurava o lock e descobria se o
--     item existe), trilha em `audit_log` e estorno de pagamento de consumo.
-- (H) Despesas com centavos: `expenses.amount` e `platform_expenses.amount`
--     eram inteiros; a compra de estoque arredondava (10 × R$ 5,55 virava
--     R$ 56; R$ 0,30 virava R$ 1).
-- (I) pousada_experiences / pousada_amenities: leitura segue a visibilidade da
--     pousada (rascunho não aparece para anônimo).
-- (J) `booking_can_pay_online`: tira o service_role do caminho de render.
-- (K) Índices usados pela RLS e pelas listas do painel.
-- (L) RPCs do script que cifra o documento dos acompanhantes já gravados.
-- (M) Concessão de acesso deixa de valer quando a pessoa perde o papel.
-- (N) Totais de consumo por reserva somados no banco.
-- (O) Aviso de pagamento para revisar volta para a fila se o e-mail falhar.
-- (P) Funções internas que estavam executáveis pela API.
--
-- Publicação: publicar o código PRIMEIRO e aplicar esta migration assim que o
-- deploy terminar. O código novo funciona com o banco antigo (a trava de login
-- fica desligada e estorno/despesa com centavos falham até a migration entrar);
-- o código antigo NÃO funciona com o banco novo (login e orçamento chamam RPCs
-- que deixam de aceitar `anon`).
-- Reversão: supabase/rollback/0083_rollback.sql (reabre os furos).
-- =============================================================================

-- Não espera para sempre por uma transação aberta: sem os bloqueios em 10 s,
-- aborta sem aplicar nada e pode ser rodada de novo.
set local lock_timeout = '10s';

-- ----------------------------------------------------------------------------
-- (A) Papel de plataforma nas RPCs de escrita. Corpos idênticos aos vigentes;
--     muda só o helper de autorização.
-- ----------------------------------------------------------------------------
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
  if not (auth_has_guest_access(v_current.pousada_id) or auth_has_active_grant(v_current.pousada_id)) then
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
  if not (auth_has_guest_access(v_current.pousada_id) or auth_has_active_grant(v_current.pousada_id)) then
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
    auth_has_guest_access(v_current.pousada_id) or auth_has_active_grant(v_current.pousada_id)
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
    or auth_has_active_grant(p_pousada_id)
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
      or auth_has_active_grant(p_pousada_id)
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
    or auth_is_platform_master()
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
  if not (auth_is_active_owner_of(p_pousada_id) or auth_is_platform_master()) then
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
  if not (auth_is_active_owner_of(p_pousada_id) or auth_is_platform_master()) then
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

-- assert_room_available_for_booking: a mensagem de conflito levava o código da
-- reserva de outra pessoa para qualquer viajante logado (pelo fluxo público de
-- `create_booking`). Corpo idêntico ao vigente; muda só essa mensagem.
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
    -- O código da reserva conflitante é de outra pessoa: só a equipe da pousada vê.
    if auth_has_guest_access(p_pousada_id) or auth_has_active_grant(p_pousada_id) then
      raise exception 'Já existe uma reserva (%) conflitando com este período.', v_conflict_booking;
    end if;
    raise exception 'Este período não está mais disponível para esta acomodação.';
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

-- Documento dos acompanhantes: equipe da pousada, o próprio hóspede ou
-- plataforma com concessão ativa. Não mais qualquer papel de plataforma.
drop policy if exists "booking_guests_read" on booking_guests;
create policy "booking_guests_read" on booking_guests for select
  using (exists (
    select 1 from bookings b
    where b.id = booking_guests.booking_id
      and (b.guest_id = auth.uid() or auth_has_operational_access(b.pousada_id)
           or auth_has_active_grant(b.pousada_id))
  ));

drop policy if exists "booking_guests_write" on booking_guests;
create policy "booking_guests_write" on booking_guests for all
  using (exists (
    select 1 from bookings b
    where b.id = booking_guests.booking_id
      and (auth_has_guest_access(b.pousada_id) or auth_has_active_grant(b.pousada_id))
  ))
  with check (exists (
    select 1 from bookings b
    where b.id = booking_guests.booking_id
      and (auth_has_guest_access(b.pousada_id) or auth_has_active_grant(b.pousada_id))
  ));

-- ----------------------------------------------------------------------------
-- (B) Trava de login — só o servidor grava e consulta.
-- ----------------------------------------------------------------------------
drop function if exists assert_login_not_locked(text);

-- Chave de rede de um endereço: o próprio IPv4, ou o /64 no IPv6 (cada cliente
-- IPv6 tem um /64 inteiro; contar por endereço exato não segura ninguém).
create or replace function login_ip_key(p_ip text)
returns text
language plpgsql immutable set search_path = public as $$
declare v inet;
begin
  if p_ip is null or length(trim(p_ip)) = 0 then return null; end if;
  begin
    v := trim(p_ip)::inet;
  exception when others then
    return left(trim(p_ip), 64);
  end;
  if family(v) = 6 then
    -- IPv4 mapeado em IPv6 (`::ffff:a.b.c.d`) é um IPv4: sem isto, todos os
    -- clientes cairiam na mesma chave `::/64` e travariam juntos.
    if host(v) ~* '^::ffff:[0-9]+[.][0-9]+[.][0-9]+[.][0-9]+$' then
      return substr(host(v), 8);
    end if;
    return host(network(set_masklen(v, 64))) || '/64';
  end if;
  return host(v);
end;
$$;
revoke all on function login_ip_key(text) from public, anon, authenticated;

create or replace function assert_login_not_locked(p_email text, p_ip text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_key text := login_ip_key(p_ip);
  v_same_origin integer;
  v_from_network integer;
begin
  if v_email = '' then return; end if;

  -- 5 falhas para o e-mail vindas da MESMA rede travam aquela rede. Não existe
  -- teto por e-mail somando redes diferentes: ele deixava qualquer pessoa
  -- travar o dono de uma pousada errando a senha dele de vários endereços, e
  -- não segurava o atacante de verdade, que fala direto com o Supabase Auth
  -- (ali valem os limites e o CAPTCHA do painel do Supabase).
  select count(*) into v_same_origin
  from login_attempts
  where lower(email) = v_email
    and success = false
    and created_at > now() - interval '15 minutes'
    and login_ip_key(ip) is not distinct from v_key;

  -- Uma rede testando senhas de muitas contas (credential stuffing).
  if v_key is not null then
    select count(*) into v_from_network
    from login_attempts
    where success = false
      and created_at > now() - interval '15 minutes'
      and login_ip_key(ip) = v_key;
  end if;

  if v_same_origin >= 5 or coalesce(v_from_network, 0) >= 30 then
    -- P0429: o app reconhece a trava pelo código, não pelo texto.
    raise exception 'Muitas tentativas de login. Tente novamente em alguns minutos.'
      using errcode = 'P0429';
  end if;
end;
$$;

revoke all on function assert_login_not_locked(text, text) from public, anon, authenticated;
grant execute on function assert_login_not_locked(text, text) to service_role;
revoke all on function record_login_attempt(text, text, boolean) from public, anon, authenticated;
grant execute on function record_login_attempt(text, text, boolean) to service_role;

-- ----------------------------------------------------------------------------
-- (C) Orçamento público — a RPC só roda depois do CAPTCHA, no servidor.
-- ----------------------------------------------------------------------------
revoke all on function create_quote_request(uuid, text, text, text, date, date, integer, integer, boolean, text, text, boolean)
  from public, anon, authenticated;
grant execute on function create_quote_request(uuid, text, text, text, date, date, integer, integer, boolean, text, text, boolean)
  to service_role;

-- ----------------------------------------------------------------------------
-- (D) Comprovante Pix — teto de arquivos e metadados do próprio arquivo
-- ----------------------------------------------------------------------------
create or replace function payment_proof_upload_allowed(object_name text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
           select 1 from bookings b
           where b.id = payment_proof_booking_id(object_name)
             and b.guest_id = auth.uid()
             and b.status = 'pending'
         )
     -- A pasta tem de ser o id da reserva na forma canônica: `{id}`, id sem
     -- hífens ou em maiúsculas apontam para a mesma reserva e contariam como
     -- pastas diferentes, furando o teto abaixo.
     and split_part(object_name, '/', 1) = payment_proof_booking_id(object_name)::text
     and length(object_name) > 37  -- `<id>/<arquivo>`: sempre dentro da pasta da reserva
     and substr(object_name, 37, 1) = '/'
     -- Teto por reserva. Cada reenvio usa um arquivo novo (inclusive os que
     -- falham depois do upload), então fica folgado para o uso real — o hóspede
     -- manda no máximo 5 comprovantes por dia — e fecha o depósito ilimitado
     -- de arquivos de 10 MB.
     and (select count(*) from storage.objects o
           where o.bucket_id = 'payment-proofs'
             and payment_proof_booking_id(o.name) = payment_proof_booking_id(object_name)) < 20;
$$;
revoke all on function payment_proof_upload_allowed(text) from public, anon;
grant execute on function payment_proof_upload_allowed(text) to authenticated;

drop policy if exists "payment_proofs_upload_own_pending" on storage.objects;
create policy "payment_proofs_upload_own_pending" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and payment_proof_upload_allowed(name));

create or replace function submit_payment_proof(
  p_booking_id uuid,
  p_file_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes integer
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_b bookings%rowtype;
  v_id uuid;
  v_due timestamptz := now() + interval '24 hours';
  v_meta jsonb;
  v_found boolean;
  v_mime text;
  v_size bigint;
begin
  -- Dono conferido antes de travar a linha (ver register_inventory_movement).
  if not exists (select 1 from bookings b where b.id = p_booking_id and b.guest_id = auth.uid()) then
    raise exception 'Reserva não encontrada.';
  end if;
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

  select true, o.metadata into v_found, v_meta
    from storage.objects o
   where o.bucket_id = 'payment-proofs' and o.name = p_file_path;
  if not coalesce(v_found, false) then
    raise exception 'O arquivo do comprovante não chegou. Tente enviar de novo.';
  end if;
  -- Tipo e tamanho valem os do arquivo guardado (o Storage grava em
  -- `metadata`); o que o navegador declarou só serve de reserva.
  v_mime := coalesce(nullif(v_meta->>'mimetype', ''), p_mime_type);
  v_size := coalesce(nullif(v_meta->>'size', '')::bigint, p_size_bytes::bigint);
  if v_mime is null or v_mime not in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf') then
    raise exception 'Envie uma foto (JPG, PNG) ou PDF do comprovante.';
  end if;
  if v_size is null or v_size <= 0 or v_size > 10485760 then
    raise exception 'O comprovante precisa ter até 10 MB.';
  end if;

  update payment_proofs set status = 'rejected', reviewed_at = now(),
         rejection_reason = 'Substituído por um novo envio do hóspede.'
   where booking_id = p_booking_id and status = 'submitted';

  insert into payment_proofs (booking_id, pousada_id, uploaded_by, file_path, file_name, mime_type, size_bytes, amount)
  values (p_booking_id, v_b.pousada_id, auth.uid(), p_file_path, left(coalesce(p_file_name, ''), 150),
          v_mime, v_size::integer, v_b.balance_due)
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
$$;
revoke all on function submit_payment_proof(uuid, text, text, text, integer) from public, anon;
grant execute on function submit_payment_proof(uuid, text, text, text, integer) to authenticated;

-- ----------------------------------------------------------------------------
-- (E) create_pousada — teto de cadastros em análise por conta
-- ----------------------------------------------------------------------------
create or replace function create_pousada(
  p_name text,
  p_city text,
  p_state text,
  p_description text,
  p_price integer,
  p_slug text
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_pousada uuid;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;
  -- Duas chamadas simultâneas da mesma conta não passam juntas pela contagem.
  perform pg_advisory_xact_lock(hashtext('create_pousada:' || auth.uid()::text));
  if (select count(*) from pousadas p
       where p.owner_id = auth.uid() and p.status = 'em_analise') >= 2 then
    raise exception 'Você já tem cadastros aguardando análise. Assim que forem aprovados, dá para cadastrar outra pousada.';
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
$$;

-- O teto acima só vale se a RPC for o único caminho do dono. A policy aceitava
-- INSERT direto de qualquer conta com `owner_id = auth.uid()` (e com o
-- `tenant_status` que a pessoa quisesse). Insert direto fica só para a equipe
-- (cadastro pelo /admin); o dono cadastra pela RPC, que é security definer.
drop policy if exists "pousadas_insert" on pousadas;
create policy "pousadas_insert" on pousadas for insert
  with check (auth_can_manage_pousadas_platform());

-- ----------------------------------------------------------------------------
-- (F) Excluir pousada — só a equipe da Rota
-- ----------------------------------------------------------------------------
drop policy if exists "pousadas_delete" on pousadas;
create policy "pousadas_delete" on pousadas for delete
  using (auth_can_manage_pousadas_platform());

-- ----------------------------------------------------------------------------
-- (H) Despesas com centavos (antes de recriar a RPC de estoque, que grava aqui)
-- ----------------------------------------------------------------------------
alter table expenses alter column amount type numeric(14,2);
alter table platform_expenses alter column amount type numeric(14,2);
-- `numeric` aceita NaN, que passa em `>= 0` e contamina toda soma. O inteiro
-- antigo barrava de graça; agora é explícito.
alter table expenses drop constraint if exists expenses_amount_check;
alter table expenses add constraint expenses_amount_check check (amount >= 0 and amount <> 'NaN');
alter table platform_expenses drop constraint if exists platform_expenses_amount_check;
alter table platform_expenses add constraint platform_expenses_amount_check check (amount >= 0 and amount <> 'NaN');
-- Até aqui `save_inventory_item` aceitava NaN vindo direto da API. Uma linha
-- assim faria o `add constraint` abaixo abortar a migration inteira.
update inventory_items set quantity = 0 where quantity = 'NaN';
update inventory_items set min_quantity = 0 where min_quantity = 'NaN';
update inventory_items set unit_cost = null where unit_cost = 'NaN';
update inventory_items set sale_price = null, show_in_app = false where sale_price = 'NaN';
alter table inventory_items drop constraint if exists inventory_items_no_nan;
alter table inventory_items add constraint inventory_items_no_nan check (
  quantity <> 'NaN' and min_quantity <> 'NaN'
  and (unit_cost is null or unit_cost <> 'NaN') and (sale_price is null or sale_price <> 'NaN'));

-- ----------------------------------------------------------------------------
-- (G) Estoque, pedidos e conta de consumo
-- ----------------------------------------------------------------------------
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
  v_pousada uuid;
  v_item inventory_items%rowtype;
  v_delta numeric;
  v_new numeric;
  v_expense uuid;
  v_amount numeric(14,2);
begin
  if p_kind is null or p_kind not in ('entrada', 'saida', 'perda', 'ajuste') then
    raise exception 'Tipo de movimento inválido.';
  end if;

  -- Permissão ANTES do lock, lendo só a pousada do item. Quem não é da equipe
  -- recebe a mesma resposta de "item inexistente" e não segura a linha.
  select pousada_id into v_pousada from inventory_items where id = p_item_id;
  if v_pousada is null
     or not auth_has_pousada_role(v_pousada, array['proprietario', 'admin_pousada', 'recepcionista', 'governanca']) then
    raise exception 'Item não encontrado.';
  end if;
  if p_kind = 'ajuste'
     and not auth_has_pousada_role(v_pousada, array['proprietario', 'admin_pousada', 'governanca']) then
    raise exception 'Seu perfil não pode ajustar o estoque.';
  end if;
  if p_kind = 'entrada' and p_create_expense
     and not auth_has_pousada_role(v_pousada, array['proprietario', 'admin_pousada']) then
    raise exception 'Só proprietário ou gestor lançam a compra no Financeiro.';
  end if;

  select * into v_item from inventory_items where id = p_item_id for update;
  if v_item.id is null then raise exception 'Item não encontrado.'; end if;
  if not v_item.track_stock then
    raise exception 'Este item não controla estoque.';
  end if;
  if p_quantity is null or p_quantity = 'NaN' or p_quantity < 0 or (p_kind <> 'ajuste' and p_quantity = 0) then
    raise exception 'Informe a quantidade.';
  end if;
  if p_quantity > 1000000 then raise exception 'Quantidade muito alta.'; end if;
  if p_unit_cost is not null and (p_unit_cost = 'NaN' or p_unit_cost < 0 or p_unit_cost > 10000000) then
    raise exception 'Custo unitário inválido.';
  end if;

  if p_kind = 'entrada' then
    v_delta := p_quantity;
  elsif p_kind in ('saida', 'perda') then
    v_delta := -p_quantity;
  else
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
    if p_unit_cost is null or p_unit_cost <= 0 then
      raise exception 'Informe o custo unitário para lançar a despesa.';
    end if;
    -- Valor exato em centavos (a coluna deixou de ser inteira nesta migration).
    v_amount := round(p_quantity * p_unit_cost, 2);
    if v_amount <= 0 then
      raise exception 'O valor da compra ficou abaixo de 1 centavo. Confira a quantidade e o custo.';
    end if;
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

  -- Trilha do que mexe em dinheiro ou some com mercadoria: ajuste, perda e
  -- compra lançada no Financeiro. Entrada/saída comum fica no histórico do item.
  if p_kind in ('ajuste', 'perda') or v_expense is not null then
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'inventory.' || p_kind, 'inventory_items', v_item.id,
            jsonb_build_object('pousadaId', v_item.pousada_id, 'item', v_item.name, 'delta', v_delta,
                               'from', v_item.quantity, 'to', v_new,
                               'note', left(coalesce(p_note, ''), 200),
                               'expenseId', v_expense, 'expenseAmount', v_amount));
  end if;

  return jsonb_build_object('balance', v_new, 'expenseId', v_expense);
end;
$$;
revoke all on function register_inventory_movement(uuid, text, numeric, numeric, text, boolean) from public, anon;
grant execute on function register_inventory_movement(uuid, text, numeric, numeric, text, boolean) to authenticated;

create or replace function set_guest_order_status(p_order_id uuid, p_status text, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_pousada uuid;
  v_o guest_orders%rowtype;
  v_line record;
  v_item inventory_items%rowtype;
begin
  -- Permissão antes do lock (ver register_inventory_movement).
  select pousada_id into v_pousada from guest_orders where id = p_order_id;
  if v_pousada is null
     or not auth_has_pousada_role(v_pousada, array['proprietario', 'admin_pousada', 'recepcionista', 'governanca']) then
    raise exception 'Pedido não encontrado.';
  end if;

  select * into v_o from guest_orders where id = p_order_id for update;
  if v_o.id is null then raise exception 'Pedido não encontrado.'; end if;

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
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'guest_order.cancelled', 'guest_orders', v_o.id,
            jsonb_build_object('pousadaId', v_o.pousada_id, 'bookingId', v_o.booking_id, 'total', v_o.total,
                               'from', v_o.status, 'reason', left(trim(p_reason), 200)));
  elsif p_status = 'entregue' then
    -- Baixa o estoque dos itens controlados, travando cada item.
    for v_line in
      select li.item_id, li.name, sum(li.quantity) as qty
        from guest_order_items li where li.order_id = v_o.id and li.item_id is not null
       group by li.item_id, li.name
       order by li.item_id  -- ordem fixa de locks: dois pedidos com os mesmos itens não se travam
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
    -- Entregue = entra na conta de consumo do hóspede.
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'guest_order.delivered', 'guest_orders', v_o.id,
            jsonb_build_object('pousadaId', v_o.pousada_id, 'bookingId', v_o.booking_id, 'total', v_o.total,
                               'source', v_o.source));
  else
    raise exception 'Status inválido.';
  end if;
end;
$$;
revoke all on function set_guest_order_status(uuid, text, text) from public, anon;
grant execute on function set_guest_order_status(uuid, text, text) to authenticated;

-- Estorno de pagamento de consumo: um lançamento negativo ligado ao original
-- (`reverses_id`). O histórico fica inteiro e as somas se corrigem sozinhas.
alter table consumption_payments drop constraint if exists consumption_payments_amount_check;
alter table consumption_payments add constraint consumption_payments_amount_check check (amount <> 0);
alter table consumption_payments
  add column if not exists reverses_id uuid references consumption_payments(id) on delete restrict;
alter table consumption_payments drop constraint if exists consumption_payments_reversal_sign;
alter table consumption_payments add constraint consumption_payments_reversal_sign
  check ((reverses_id is null and amount > 0) or (reverses_id is not null and amount < 0));
-- Um pagamento só é estornado uma vez.
create unique index if not exists uq_consumption_payments_reverses
  on consumption_payments(reverses_id) where reverses_id is not null;

create or replace function register_consumption_payment(
  p_booking_id uuid,
  p_amount numeric,
  p_method text,
  p_note text default ''
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_pousada uuid;
  v_b bookings%rowtype;
  v_sum jsonb;
  v_balance numeric;
  v_id uuid;
begin
  -- Permissão antes do lock (ver register_inventory_movement).
  select pousada_id into v_pousada from bookings where id = p_booking_id;
  if v_pousada is null or not auth_has_operational_access(v_pousada) then
    raise exception 'Reserva não encontrada.';
  end if;

  select * into v_b from bookings where id = p_booking_id for update;
  if v_b.id is null then raise exception 'Reserva não encontrada.'; end if;
  if p_method is null or p_method not in ('pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'outro') then
    raise exception 'Forma de pagamento inválida.';
  end if;
  v_sum := booking_consumption_summary(p_booking_id);
  v_balance := (v_sum->>'delivered')::numeric - (v_sum->>'paid')::numeric;
  if p_amount is null or p_amount <= 0 then raise exception 'Informe o valor.'; end if;
  if p_amount > v_balance + 0.009 then
    raise exception 'O valor passa do que falta pagar do consumo (R$ %).', to_char(v_balance, 'FM999999990.00');
  end if;
  insert into consumption_payments (pousada_id, booking_id, amount, method, note)
  values (v_b.pousada_id, v_b.id, round(p_amount, 2), p_method, left(coalesce(p_note, ''), 200))
  returning id into v_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'consumption_payment.registered', 'bookings', v_b.id,
          jsonb_build_object('pousadaId', v_b.pousada_id, 'paymentId', v_id,
                             'amount', round(p_amount, 2), 'method', p_method));

  return jsonb_build_object('balance', v_balance - round(p_amount, 2), 'paymentId', v_id);
end;
$$;
revoke all on function register_consumption_payment(uuid, numeric, text, text) from public, anon;
grant execute on function register_consumption_payment(uuid, numeric, text, text) to authenticated;

create or replace function reverse_consumption_payment(p_payment_id uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_pousada uuid;
  v_p consumption_payments%rowtype;
  v_id uuid;
begin
  -- Mesmos papéis de `payment:refund` em lib/auth/rbac.ts: proprietário,
  -- gestor e financeiro. A recepção registra pagamento, mas não estorna.
  select pousada_id into v_pousada from consumption_payments where id = p_payment_id;
  if v_pousada is null
     or not auth_has_pousada_role(v_pousada, array['proprietario', 'admin_pousada', 'financeiro_pousada']) then
    raise exception 'Pagamento não encontrado.';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Informe o motivo do estorno.';
  end if;

  select * into v_p from consumption_payments where id = p_payment_id for update;
  if v_p.id is null then raise exception 'Pagamento não encontrado.'; end if;
  if v_p.reverses_id is not null then
    raise exception 'Este lançamento já é um estorno.';
  end if;
  if exists (select 1 from consumption_payments r where r.reverses_id = v_p.id) then
    raise exception 'Este pagamento já foi estornado.';
  end if;

  insert into consumption_payments (pousada_id, booking_id, amount, method, note, reverses_id)
  values (v_p.pousada_id, v_p.booking_id, -v_p.amount, v_p.method,
          left('Estorno: ' || trim(p_reason), 200), v_p.id)
  returning id into v_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'consumption_payment.reversed', 'bookings', v_p.booking_id,
          jsonb_build_object('pousadaId', v_p.pousada_id, 'paymentId', v_p.id, 'reversalId', v_id,
                             'amount', v_p.amount, 'method', v_p.method,
                             'reason', left(trim(p_reason), 200)));

  return jsonb_build_object('reversalId', v_id, 'amount', v_p.amount);
end;
$$;
revoke all on function reverse_consumption_payment(uuid, text) from public, anon;
grant execute on function reverse_consumption_payment(uuid, text) to authenticated;

-- Hóspede desiste do pedido: mesmo corpo, com trilha.
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
  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'guest_order.cancelled', 'guest_orders', v_o.id,
          jsonb_build_object('pousadaId', v_o.pousada_id, 'bookingId', v_o.booking_id, 'total', v_o.total,
                             'from', v_o.status, 'reason', 'Cancelado pelo hóspede'));
end;
$$;
revoke all on function cancel_guest_order(uuid) from public, anon;
grant execute on function cancel_guest_order(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- (I) Vínculos de experiências/comodidades seguem a visibilidade da pousada.
--     O `exists` herda a RLS de `pousadas` (publicada, ou equipe/plataforma).
-- ----------------------------------------------------------------------------
drop policy if exists "pousada_exp_read" on pousada_experiences;
create policy "pousada_exp_read" on pousada_experiences for select
  using (exists (select 1 from pousadas p where p.id = pousada_experiences.pousada_id));

drop policy if exists "pousada_amen_read" on pousada_amenities;
create policy "pousada_amen_read" on pousada_amenities for select
  using (exists (select 1 from pousadas p where p.id = pousada_amenities.pousada_id));

-- ----------------------------------------------------------------------------
-- (J) A pousada desta reserva recebe on-line? Só para o dono da reserva —
--     substitui a leitura por service_role durante o render da página.
-- ----------------------------------------------------------------------------
create or replace function booking_can_pay_online(p_booking_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from bookings b
      join pousada_payment_accounts a on a.pousada_id = b.pousada_id
     where b.id = p_booking_id
       and b.guest_id = auth.uid()
       and a.access_token is not null
       and a.access_token <> ''
  );
$$;
revoke all on function booking_can_pay_online(uuid) from public, anon;
grant execute on function booking_can_pay_online(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- (K) Índices
-- ----------------------------------------------------------------------------
create index if not exists idx_channel_events_pousada on channel_events(pousada_id);
create index if not exists idx_bookings_pousada_checkin on bookings(pousada_id, checkin);
create index if not exists idx_pousadas_owner on pousadas(owner_id);
create index if not exists idx_guest_order_items_item on guest_order_items(item_id);
create index if not exists idx_inventory_movements_order on inventory_movements(order_id) where order_id is not null;
create index if not exists idx_inventory_movements_expense on inventory_movements(expense_id) where expense_id is not null;
create index if not exists idx_login_attempts_created on login_attempts(created_at);

-- ----------------------------------------------------------------------------
-- (L) Documento de acompanhante (LGPD). A partir desta versão o app grava
--     `booking_guests.document_number` cifrado (mesma cifra de `guests`, 0058).
--     Estas duas RPCs servem só ao script que cifra as linhas antigas
--     (scripts/backfill-document-encryption.mjs) — service_role nunca lê nem
--     escreve tabela direto. Valor cifrado tem a forma `iv:tag:texto` em base64.
-- ----------------------------------------------------------------------------
create or replace function list_booking_guests_pending_document_backfill(p_limit integer default 500)
returns table (id uuid, document_number text)
language sql stable security definer set search_path = public as $$
  select g.id, g.document_number
  from booking_guests g
  where g.document_number is not null
    and length(trim(g.document_number)) > 0
    and g.document_number !~ '^[A-Za-z0-9+/]{16}:[A-Za-z0-9+/]{22}==:[A-Za-z0-9+/]+={0,2}$'
  order by g.created_at
  limit greatest(1, least(p_limit, 2000));
$$;
revoke all on function list_booking_guests_pending_document_backfill(integer) from public, anon, authenticated;
grant execute on function list_booking_guests_pending_document_backfill(integer) to service_role;

create or replace function apply_booking_guest_document_backfill(
  p_booking_guest_id uuid,
  p_document_number_encrypted text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_document_number_encrypted !~ '^[A-Za-z0-9+/]{16}:[A-Za-z0-9+/]{22}==:[A-Za-z0-9+/]+={0,2}$' then
    raise exception 'Valor não está cifrado.';
  end if;
  -- Só toca linha ainda em texto puro: rodar o script de novo é seguro.
  update booking_guests
     set document_number = p_document_number_encrypted
   where id = p_booking_guest_id
     and document_number !~ '^[A-Za-z0-9+/]{16}:[A-Za-z0-9+/]{22}==:[A-Za-z0-9+/]+={0,2}$';
end;
$$;
revoke all on function apply_booking_guest_document_backfill(uuid, text) from public, anon, authenticated;
grant execute on function apply_booking_guest_document_backfill(uuid, text) to service_role;

-- ----------------------------------------------------------------------------
-- (M) Concessão de acesso não sobrevive ao papel. `auth_has_active_grant` só
--     olhava a linha da concessão: quem perdia o papel de plataforma (pessoa
--     desligada) seguia lendo e escrevendo na pousada até a concessão vencer.
-- ----------------------------------------------------------------------------
create or replace function auth_has_active_grant(target_pousada uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from platform_access_grants g
    join profiles p on p.id = g.granted_to
    where g.pousada_id = target_pousada
      and g.granted_to = auth.uid()
      and g.revoked_at is null
      and g.expires_at > now()
      and p.platform_role is not null
  );
$$;

-- E a concessão é encerrada na hora em que o papel sai, para não voltar a
-- valer se a pessoa receber um papel de novo.
create or replace function revoke_grants_on_platform_role_removed()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.platform_role is null and old.platform_role is not null then
    with closed as (
      update platform_access_grants
         set revoked_at = now()
       where granted_to = new.id and revoked_at is null
      returning id, pousada_id
    )
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    select auth.uid(), 'platform_access.revoked', 'platform_access_grants', c.id,
           jsonb_build_object('pousadaId', c.pousada_id, 'grantedTo', new.id,
                              'reason', 'papel de plataforma removido')
      from closed c;
  end if;
  return new;
end;
$$;
revoke execute on function revoke_grants_on_platform_role_removed() from public, anon, authenticated;

drop trigger if exists trg_revoke_grants_on_platform_role_removed on public.profiles;
create trigger trg_revoke_grants_on_platform_role_removed
  after update of platform_role on public.profiles
  for each row execute function revoke_grants_on_platform_role_removed();

-- ----------------------------------------------------------------------------
-- (N) Totais de consumo por reserva calculados no banco. O app lia todas as
--     linhas e somava; passando do limite de linhas da API (1000), o Financeiro
--     começava a errar sem avisar.
-- ----------------------------------------------------------------------------
create or replace function consumption_totals_by_pousada(p_pousada_id uuid)
returns table (booking_id uuid, delivered numeric, paid numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (auth_has_finance_access(p_pousada_id) or auth_has_operational_access(p_pousada_id)
          or auth_has_active_grant(p_pousada_id)) then
    raise exception 'Sem acesso ao consumo desta pousada.';
  end if;
  return query
    select t.booking_id, sum(t.delivered), sum(t.paid)
    from (
      select o.booking_id, o.total as delivered, 0::numeric as paid
        from guest_orders o
       where o.pousada_id = p_pousada_id and o.status = 'entregue'
      union all
      select c.booking_id, 0::numeric, c.amount
        from consumption_payments c
       where c.pousada_id = p_pousada_id
    ) t
    group by t.booking_id;
end;
$$;
revoke all on function consumption_totals_by_pousada(uuid) from public, anon;
grant execute on function consumption_totals_by_pousada(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- (O) Aviso de "pagamento para revisar" que não saiu volta para a fila.
--     `claim_payment_reviews_to_notify` (0082) marca o caso como avisado ANTES
--     do envio; se o e-mail falhava, a pousada nunca era avisada.
-- ----------------------------------------------------------------------------
create or replace function release_payment_reviews_notification(p_review_ids uuid[])
returns integer
language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  update payment_reviews
     set notified_at = null
   where id = any (p_review_ids) and status = 'aberta';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function release_payment_reviews_notification(uuid[]) from public, anon, authenticated;
grant execute on function release_payment_reviews_notification(uuid[]) to service_role;

-- ----------------------------------------------------------------------------
-- (P) Funções internas que ficaram executáveis pela API. No Supabase toda
--     função nova nasce com EXECUTE para anon/authenticated/service_role;
--     revogar só de `public` não tira nada.
-- ----------------------------------------------------------------------------
-- Checagem interna de disponibilidade: devolvia o código da reserva conflitante
-- de qualquer pousada para qualquer usuário logado.
revoke execute on function assert_room_available_for_booking(uuid, uuid, date, date, integer, integer, boolean, uuid)
  from public, anon, authenticated;
-- Só o callback do OAuth (usuário logado) consome o nonce.
revoke execute on function consume_oauth_state_nonce(text) from public, anon;
-- RPCs que exigem login já barram `auth.uid()` nulo por dentro; tirar o EXECUTE
-- do anônimo fecha a porta antes de a função rodar.
revoke execute on function accept_membership_invite(uuid) from public, anon;
revoke execute on function decline_membership_invite(uuid) from public, anon;
revoke execute on function save_payment_account(uuid, text, text, text, text, boolean, timestamptz) from public, anon;
revoke execute on function upsert_guest(uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, date, text, text, text, text, text, jsonb, text[], text, text, text, boolean, guest_source, text) from public, anon;
revoke execute on function list_platform_hosts() from public, anon;
revoke execute on function list_platform_team() from public, anon;
