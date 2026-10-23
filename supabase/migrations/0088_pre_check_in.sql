-- =============================================================================
-- 0088 — Pré-check-in online.
--
-- Antes: a ficha (FNRH) existia e era imprimível, mas era preenchida no
-- balcão. O hóspede não tinha como completar os próprios dados nem informar
-- os acompanhantes (só a equipe edita `booking_guests`, via
-- `set_booking_companions`).
--
-- Agora o hóspede, logado, completa a ficha antes de chegar:
--   * `bookings.precheckin_completed_at` — nulo = ficha pendente.
--   * `submit_precheckin` — grava, numa transação, os dados da ficha do
--     responsável (`guests`), substitui os acompanhantes da reserva (nunca o
--     responsável) e o horário previsto de chegada.
--   * `get_my_precheckin` — leitura para preencher o formulário. Documento só
--     como tipo + 4 últimos caracteres; o valor cifrado nunca sai do banco
--     por esta porta.
--   * `list_my_bookings` passa a devolver `precheckin_completed_at`.
--   * Contexto dos e-mails (confirmação e lembrete) ganha `precheckinDone` e
--     `hasTravelerAccount`, para o botão "Preencher ficha de hospedagem".
--
-- Quem pode: só o próprio hóspede da reserva — `bookings.guest_id =
-- auth.uid()` E a ficha responsável ligada à mesma conta (`guests.user_id =
-- auth.uid()`). Reserva de balcão sem conta de hóspede não tem dono no site e
-- continua com a ficha preenchida na recepção.
--
-- Documento: a aplicação cifra (lib/crypto/document-cipher.ts) e manda o valor
-- cifrado + hash + 4 últimos. O banco recusa qualquer documento que não esteja
-- no formato cifrado — nunca grava documento em claro.
-- =============================================================================

alter table public.bookings
  add column if not exists precheckin_completed_at timestamptz;

comment on column public.bookings.precheckin_completed_at is
  '0088: quando o hóspede enviou o pré-check-in pelo site. Nulo = ficha pendente.';

-- Formato que encryptDocumentNumber grava: iv:authTag:ciphertext em base64
-- (mesma expressão da 0083).
create or replace function public.precheckin_is_encrypted_document(p_value text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_value ~ '^[A-Za-z0-9+/]{16}:[A-Za-z0-9+/]{22}==:[A-Za-z0-9+/]+={0,2}$';
$$;
revoke all on function public.precheckin_is_encrypted_document(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Leitura do formulário
-- ---------------------------------------------------------------------------
create or replace function public.get_my_precheckin(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or p_booking_id is null then return null; end if;

  select jsonb_build_object(
    'bookingId', b.id,
    'code', b.code,
    'status', b.status,
    'checkin', b.checkin,
    'checkout', b.checkout,
    'adults', b.adults,
    'children', b.children,
    'infants', b.infants,
    'expectedArrivalTime', b.expected_arrival_time,
    'precheckinCompletedAt', b.precheckin_completed_at,
    'pousadaName', p.name,
    'checkinTime', p.checkin_time,
    -- Mesmas regras de submit_precheckin, para a tela não repetir a conta.
    'canSubmit', b.status in ('pending', 'confirmed')
                 and b.checkout >= (now() at time zone coalesce(nullif(p.timezone, ''), 'America/Sao_Paulo'))::date,
    'maxCompanions', greatest(0, least(b.adults + b.children, coalesce(r.capacity_max, r.capacity, 20)) - 1),
    'maxInfants', greatest(b.infants, 2),
    'responsible', jsonb_build_object(
      'fullName', g.full_name,
      'phone', g.phone,
      'birthDate', g.birth_date,
      'nationality', g.nationality,
      'country', g.country,
      'city', g.city,
      'state', g.state,
      'address', g.address,
      'cep', g.cep,
      'documentType', g.document_type,
      'documentLast4', g.document_last4,
      'hasDocument', g.document_number is not null and length(trim(g.document_number)) > 0
    ),
    'companions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', bg.id,
        'fullName', bg.full_name,
        'guestType', bg.guest_type,
        'birthDate', bg.birth_date,
        'documentType', bg.document_type,
        'hasDocument', bg.document_number is not null and length(trim(bg.document_number)) > 0
      ) order by bg.created_at, bg.id)
      from booking_guests bg
      where bg.booking_id = b.id and bg.guest_type <> 'responsible'
    ), '[]'::jsonb)
  )
  into v_result
  from bookings b
  join guests g on g.id = b.responsible_guest_id
  join pousadas p on p.id = b.pousada_id
  left join rooms r on r.id = b.room_id
  where b.id = p_booking_id
    and b.guest_id = auth.uid()
    and g.user_id = auth.uid();

  return v_result;
end;
$$;

revoke all on function public.get_my_precheckin(uuid) from public, anon;
grant execute on function public.get_my_precheckin(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Envio
-- ---------------------------------------------------------------------------
create or replace function public.submit_precheckin(
  p_booking_id uuid,
  p_phone text,
  p_birth_date date,
  p_nationality text,
  p_country text,
  p_city text,
  p_state text,
  p_address text,
  p_cep text,
  p_document_type text,
  p_document_number text,
  p_document_number_hash text,
  p_document_last4 text,
  p_companions jsonb,
  p_expected_arrival_time text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking record;
  v_guest_user uuid;
  v_guest_has_doc boolean;
  v_item jsonb;
  v_type text;
  v_name text;
  v_birth date;
  v_doc_type text;
  v_doc text;
  v_keep uuid;
  v_kept record;
  v_people integer := 0;
  v_infants integer := 0;
  v_max_people integer;
  v_capacity integer;
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_nat text := nullif(trim(coalesce(p_nationality, '')), '');
  v_country text := nullif(trim(coalesce(p_country, '')), '');
  v_city text := nullif(trim(coalesce(p_city, '')), '');
  v_state text := nullif(upper(trim(coalesce(p_state, ''))), '');
  v_address text := nullif(trim(coalesce(p_address, '')), '');
  v_cep text := nullif(trim(coalesce(p_cep, '')), '');
  v_arrival text := nullif(trim(coalesce(p_expected_arrival_time, '')), '');
  v_new_doc boolean;
  v_old_docs jsonb;
begin
  if auth.uid() is null then raise exception 'Faça login para enviar a ficha.'; end if;

  -- Dono da reserva: conta da reserva E ficha responsável ligada à mesma conta.
  -- Mesma mensagem para "não existe" e "não é sua": não revela reserva alheia.
  select b.id, b.pousada_id, b.room_id, b.status, b.guest_id, b.responsible_guest_id,
         b.adults, b.children, b.infants, b.checkout
    into v_booking
    from bookings b
   where b.id = p_booking_id
   for update;
  if v_booking.id is null or v_booking.guest_id is distinct from auth.uid() then
    raise exception 'Reserva não encontrada.';
  end if;
  -- "Tem documento" = tem documento do tipo certo para a nacionalidade
  -- informada (CPF para brasileiro, passaporte para estrangeiro), igual ao
  -- cadastro do viajante (0073). Conferido abaixo, depois de ler p_nationality.
  select g.user_id,
         (g.document_number is not null and length(trim(g.document_number)) > 0
          and (upper(coalesce(g.document_type, '')) = 'CPF') = (trim(coalesce(p_nationality, '')) = 'Brasileira'))
    into v_guest_user, v_guest_has_doc
    from guests g
   where g.id = v_booking.responsible_guest_id and g.pousada_id = v_booking.pousada_id;
  if v_guest_user is distinct from auth.uid() then
    raise exception 'Reserva não encontrada.';
  end if;

  if v_booking.status = 'cancelled' then
    raise exception 'Esta reserva foi cancelada.';
  end if;
  if v_booking.status not in ('pending', 'confirmed') then
    raise exception 'A ficha só pode ser enviada antes do check-in.';
  end if;
  -- Estadia que já terminou no calendário da pousada (sem check-in marcado).
  if v_booking.checkout < (
    select (now() at time zone coalesce(nullif(p.timezone, ''), 'America/Sao_Paulo'))::date
      from pousadas p where p.id = v_booking.pousada_id
  ) then
    raise exception 'A ficha só pode ser enviada antes do check-in.';
  end if;

  -- ---- Responsável -------------------------------------------------------
  if v_phone is null or length(v_phone) > 25 or v_phone !~ '^[0-9+() .-]+$'
     or length(regexp_replace(v_phone, '\D', '', 'g')) < 8 then
    raise exception 'Informe um celular válido com DDD.';
  end if;
  if p_birth_date is null or p_birth_date < date '1900-01-01' then
    raise exception 'Informe a data de nascimento.';
  end if;
  if p_birth_date > (current_date - interval '18 years')::date then
    raise exception 'O responsável pela reserva precisa ter 18 anos ou mais.';
  end if;
  if v_nat is null or v_nat not in ('Brasileira', 'Estrangeira') then
    raise exception 'Informe a nacionalidade.';
  end if;
  if v_city is null or length(v_city) < 2 or length(v_city) > 100 then
    raise exception 'Informe sua cidade.';
  end if;
  if v_address is null or length(v_address) < 5 or length(v_address) > 300 then
    raise exception 'Informe seu endereço.';
  end if;
  if v_cep is not null and v_cep !~ '^\d{5}-?\d{3}$' then
    raise exception 'CEP inválido.';
  end if;
  if v_nat = 'Brasileira' then
    v_country := 'BR';
    if v_state is null or v_state not in (
      'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR',
      'PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
    ) then
      raise exception 'Informe a UF.';
    end if;
  else
    if v_country is null or length(v_country) < 2 or length(v_country) > 60 or v_country = 'BR' then
      raise exception 'Informe o país onde você mora.';
    end if;
    if v_state is not null and length(v_state) > 2 then
      raise exception 'UF inválida.';
    end if;
    v_cep := null;
  end if;

  -- Documento: os quatro campos juntos (troca) ou os quatro nulos (mantém).
  v_new_doc := p_document_number is not null;
  if v_new_doc then
    if p_document_type is null or p_document_type not in ('CPF', 'Passaporte')
       or (v_nat = 'Brasileira') <> (p_document_type = 'CPF') then
      raise exception 'Tipo de documento inválido.';
    end if;
    if not precheckin_is_encrypted_document(p_document_number) then
      raise exception 'Documento precisa chegar cifrado.';
    end if;
    if p_document_number_hash is null or p_document_number_hash !~ '^[0-9a-f]{64}$' then
      raise exception 'Documento inválido.';
    end if;
    if p_document_last4 is null or p_document_last4 !~ '^[A-Z0-9]{1,4}$' then
      raise exception 'Documento inválido.';
    end if;
  else
    if p_document_type is not null or p_document_number_hash is not null or p_document_last4 is not null then
      raise exception 'Documento inválido.';
    end if;
    if not v_guest_has_doc then
      raise exception '%', case when v_nat = 'Brasileira' then 'Informe seu CPF.'
                                else 'Informe o número do passaporte.' end;
    end if;
  end if;

  if v_arrival is not null and v_arrival !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'Horário de chegada inválido (use HH:MM).';
  end if;

  -- ---- Acompanhantes: validação antes de qualquer escrita -----------------
  if p_companions is null or jsonb_typeof(p_companions) <> 'array' then
    raise exception 'Lista de acompanhantes inválida.';
  end if;
  if jsonb_array_length(p_companions) > 20 then
    raise exception 'Acompanhantes demais para uma reserva.';
  end if;

  select coalesce(r.capacity_max, r.capacity) into v_capacity from rooms r where r.id = v_booking.room_id;
  -- Pessoas pagas na reserva (adultos + crianças), sem contar o responsável e
  -- sem passar da capacidade da acomodação. Bebê não conta na capacidade
  -- (mesma regra de create_booking), mas tem teto próprio.
  v_max_people := greatest(0, least(v_booking.adults + v_booking.children, coalesce(v_capacity, 20)) - 1);

  for v_item in select * from jsonb_array_elements(p_companions) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Lista de acompanhantes inválida.';
    end if;
    v_type := v_item->>'guestType';
    if v_type is null or v_type not in ('adult', 'child', 'infant') then
      raise exception 'Tipo de acompanhante inválido.';
    end if;
    if v_type = 'infant' then v_infants := v_infants + 1; else v_people := v_people + 1; end if;
    v_name := trim(coalesce(v_item->>'fullName', ''));
    if length(v_name) < 2 or length(v_name) > 150 then
      raise exception 'Informe o nome de cada acompanhante.';
    end if;
    if nullif(v_item->>'birthDate', '') is not null then
      if (v_item->>'birthDate') !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception 'Data de nascimento inválida.';
      end if;
      v_birth := (v_item->>'birthDate')::date;
      if v_birth < date '1900-01-01' or v_birth > current_date then
        raise exception 'Data de nascimento inválida.';
      end if;
    elsif v_type = 'adult' then
      raise exception 'Informe a data de nascimento de cada adulto.';
    end if;
    v_doc := nullif(v_item->>'documentNumber', '');
    v_doc_type := nullif(v_item->>'documentType', '');
    v_keep := nullif(v_item->>'keepDocumentOf', '')::uuid;
    if v_doc is not null then
      if not precheckin_is_encrypted_document(v_doc) then
        raise exception 'Documento precisa chegar cifrado.';
      end if;
      if v_doc_type is null or v_doc_type not in ('CPF', 'RG', 'Passaporte', 'RNE', 'CNH', 'Certidão de nascimento') then
        raise exception 'Tipo de documento inválido.';
      end if;
    elsif v_doc_type is not null and v_keep is null then
      raise exception 'Documento inválido.';
    end if;
    if v_keep is not null then
      if not exists (
        select 1 from booking_guests bg
        where bg.id = v_keep and bg.booking_id = p_booking_id and bg.guest_type <> 'responsible'
          and bg.document_number is not null
      ) then
        raise exception 'Documento de acompanhante não encontrado nesta reserva.';
      end if;
    elsif v_doc is null and v_type = 'adult' then
      raise exception 'Informe o documento de cada adulto.';
    end if;
  end loop;

  if v_people > v_max_people then
    raise exception 'Sua reserva é para % pessoa(s). Para levar mais alguém, fale com a pousada.',
      v_max_people + 1;
  end if;
  if v_infants > greatest(v_booking.infants, 2) then
    raise exception 'Bebês demais para esta reserva. Fale com a pousada.';
  end if;

  -- ---- Escrita -----------------------------------------------------------
  update guests set
    phone = v_phone,
    birth_date = p_birth_date,
    nationality = v_nat,
    country = v_country,
    city = v_city,
    state = v_state,
    address = v_address,
    cep = v_cep,
    document_type = case when v_new_doc then p_document_type else document_type end,
    document_number = case when v_new_doc then p_document_number else document_number end,
    document_number_hash = case when v_new_doc then p_document_number_hash else document_number_hash end,
    document_last4 = case when v_new_doc then p_document_last4 else document_last4 end,
    updated_at = now()
  where id = v_booking.responsible_guest_id;

  -- Guardado antes de apagar as linhas antigas (keepDocumentOf): o documento e
  -- o que a EQUIPE anotou sobre o acompanhante (necessidade especial, notas
  -- operacionais) — o hóspede reenviar a ficha não pode apagar isso.
  select coalesce(jsonb_object_agg(bg.id::text, jsonb_build_object(
           'type', bg.document_type, 'number', bg.document_number,
           'special', bg.has_special_needs, 'notes', bg.operational_notes)), '{}'::jsonb)
    into v_old_docs
    from booking_guests bg
   where bg.booking_id = p_booking_id and bg.guest_type <> 'responsible';

  delete from booking_guests where booking_id = p_booking_id and guest_type <> 'responsible';

  for v_item in select * from jsonb_array_elements(p_companions) loop
    v_keep := nullif(v_item->>'keepDocumentOf', '')::uuid;
    v_doc := nullif(v_item->>'documentNumber', '');
    v_doc_type := nullif(v_item->>'documentType', '');
    if v_doc is null and v_keep is not null then
      v_doc := v_old_docs->v_keep::text->>'number';
      v_doc_type := coalesce(v_doc_type, v_old_docs->v_keep::text->>'type');
    end if;
    insert into booking_guests (
      booking_id, guest_id, full_name, guest_type, has_special_needs,
      birth_date, document_type, document_number, operational_notes
    ) values (
      p_booking_id, null, trim(v_item->>'fullName'), (v_item->>'guestType')::booking_guest_type,
      coalesce((v_old_docs->v_keep::text->>'special')::boolean, false),
      nullif(v_item->>'birthDate', '')::date, case when v_doc is null then null else v_doc_type end, v_doc,
      coalesce(v_old_docs->v_keep::text->>'notes', '')
    );
  end loop;

  update bookings set
    expected_arrival_time = v_arrival,
    precheckin_completed_at = now(),
    version = version + 1,
    updated_by = auth.uid(),
    updated_at = now()
  where id = p_booking_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'booking.precheckin_submitted', 'bookings', p_booking_id,
          jsonb_build_object('pousadaId', v_booking.pousada_id,
                             'companions', jsonb_array_length(p_companions),
                             'documentUpdated', v_new_doc));

  return jsonb_build_object('id', p_booking_id, 'completedAt', now());
end;
$$;

revoke all on function public.submit_precheckin(
  uuid, text, date, text, text, text, text, text, text, text, text, text, text, jsonb, text
) from public, anon;
grant execute on function public.submit_precheckin(
  uuid, text, date, text, text, text, text, text, text, text, text, text, text, jsonb, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- list_my_bookings (0085) + precheckin_completed_at. Muda o tipo de retorno:
-- drop + create, com os mesmos grants.
-- ---------------------------------------------------------------------------
drop function if exists public.list_my_bookings(uuid);
create function public.list_my_bookings(p_booking_id uuid default null)
returns table (
  id uuid,
  code text,
  pousada_id uuid,
  room_id uuid,
  room_name text,
  checkin date,
  checkout date,
  guests integer,
  subtotal integer,
  fee integer,
  discount integer,
  surcharge integer,
  total integer,
  balance_due numeric,
  status booking_status,
  origin booking_origin,
  payment_due_at timestamptz,
  cancellation_reason text,
  guest_name text,
  guest_email text,
  created_at timestamptz,
  precheckin_completed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.code, b.pousada_id, b.room_id, r.name, b.checkin, b.checkout,
         b.guests, b.subtotal, b.fee, b.discount, b.surcharge, b.total,
         b.balance_due, b.status, b.origin, b.payment_due_at,
         b.cancellation_reason, b.guest_name, b.guest_email, b.created_at,
         b.precheckin_completed_at
  from bookings b
  left join rooms r on r.id = b.room_id
  where auth.uid() is not null
    and b.guest_id = auth.uid()
    and (p_booking_id is null or b.id = p_booking_id)
  order by b.created_at desc;
$$;

revoke all on function public.list_my_bookings(uuid) from public, anon;
grant execute on function public.list_my_bookings(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Contexto dos e-mails (0071) + precheckinDone / hasTravelerAccount. Mesma
-- assinatura: `create or replace` mantém os grants (service_role only).
-- ---------------------------------------------------------------------------
create or replace function get_booking_notification_context(p_booking_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'bookingId', b.id,
    'code', b.code,
    'guestName', b.guest_name,
    'guestEmail', b.guest_email,
    'checkin', b.checkin,
    'checkout', b.checkout,
    'total', b.total,
    'currency', b.currency,
    'roomName', r.name,
    'status', b.status,
    'adults', b.adults,
    'children', b.children,
    'paymentDueAt', b.payment_due_at,
    'precheckinDone', b.precheckin_completed_at is not null,
    'hasTravelerAccount', b.guest_id is not null,
    'pousada', jsonb_build_object(
      'name', p.name,
      'city', p.city,
      'state', p.state,
      'timezone', p.timezone,
      'slug', p.slug,
      'address', p.address,
      'cep', p.cep,
      'checkinTime', p.checkin_time,
      'checkoutTime', p.checkout_time,
      'contactPhone', p.contact_phone,
      'whatsapp', p.whatsapp,
      'houseRules', p.house_rules,
      'cancellationPolicy', p.cancellation_policy
    )
  )
  into v_result
  from bookings b
  join rooms r on r.id = b.room_id
  join pousadas p on p.id = b.pousada_id
  where b.id = p_booking_id;

  return v_result;
end;
$$;

create or replace function list_and_mark_checkin_reminders(p_days_ahead int default 2)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_result jsonb;
begin
  with due as (
    update bookings set checkin_reminder_sent_at = now()
    where status = 'confirmed'
      and checkin_reminder_sent_at is null
      and checkin = (current_date + p_days_ahead)
      and guest_email is not null
    returning id, code, guest_name, guest_email, checkin, checkout, total, currency, room_id, pousada_id, status, adults, children, payment_due_at,
              precheckin_completed_at, guest_id
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'bookingId', due.id,
      'code', due.code,
      'guestName', due.guest_name,
      'guestEmail', due.guest_email,
      'checkin', due.checkin,
      'checkout', due.checkout,
      'total', due.total,
      'currency', due.currency,
      'roomName', r.name,
      'status', due.status,
      'adults', due.adults,
      'children', due.children,
      'paymentDueAt', due.payment_due_at,
      'precheckinDone', due.precheckin_completed_at is not null,
      'hasTravelerAccount', due.guest_id is not null,
      'pousada', jsonb_build_object(
        'name', p.name,
        'city', p.city,
        'state', p.state,
        'timezone', p.timezone,
        'slug', p.slug,
        'address', p.address,
        'cep', p.cep,
        'checkinTime', p.checkin_time,
        'checkoutTime', p.checkout_time,
        'contactPhone', p.contact_phone,
        'whatsapp', p.whatsapp,
        'houseRules', p.house_rules,
        'cancellationPolicy', p.cancellation_policy
      )
    )
  ), '[]'::jsonb)
  into v_result
  from due
  join rooms r on r.id = due.room_id
  join pousadas p on p.id = due.pousada_id;

  return v_result;
end;
$$;
