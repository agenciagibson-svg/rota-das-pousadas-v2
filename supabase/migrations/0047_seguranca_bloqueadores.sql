-- =============================================================================
-- Auditoria de segurança de 14/09/2026 — correção dos bloqueadores de produção.
--
-- Diferente das migrations do Ciclo 2/2B, esta NÃO é feita in place: as
-- migrations 0001–0046 já estão aplicadas no banco remoto (ver
-- `estado-migrations.txt`), então cada correção precisa de um passo próprio e
-- reproduzível no histórico.
--
-- Fecha quatro achados que têm a mesma raiz: REGRA QUE SÓ EXISTE NA APLICAÇÃO,
-- em tabela ou RPC alcançável direto pela API REST do Supabase. A `anon key` é
-- pública por construção (vai no bundle do navegador), então qualquer usuário
-- autenticado pode chamar a RPC sem passar pela Server Action. Onde a RLS não
-- repete a regra, a "primeira barreira" é a única barreira.
--
--   (A) platform_access_grants aceitava INSERT de QUALQUER platform_role —
--       autoconcessão de acesso a reservas/pagamentos/despesas de todas as
--       pousadas, contornando o modelo inteiro da 0013.
--   (B) guests, quote_requests e channel_calendars nasceram depois da 0013 e
--       não herdaram o modelo de concessão: `auth_is_platform_admin()` dava
--       leitura de PII de todos os tenants a qualquer papel de plataforma.
--   (C) o fluxo público de reserva chamava `upsert_guest`, que exige acesso de
--       staff — a reserva pública não completava.
--   (D) `create_booking` gravava subtotal/total/código/prazo vindos do cliente
--       sem revalidar. Corrigir (C) sem corrigir (D) abriria adulteração de
--       preço; por isso os dois estão na MESMA migration.
--
-- Nada aqui remove tabela, coluna ou linha. Reversão: ver
-- `supabase/rollback/0047_rollback.sql`.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- (A.1) Helper: papel de plataforma MASTER.
--
-- `auth_is_platform_admin()` (0002) responde "tem algum platform_role?" — o que
-- inclui marketing, comercial, suporte e financeiro_plataforma. Para decisões
-- que a matriz RBAC restringe a `master` (lib/auth/rbac.ts), isso é largo
-- demais. Este helper é o espelho no banco de `platform:grant:manage`.
-- ----------------------------------------------------------------------------
create or replace function auth_is_platform_master()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.platform_role = 'master'
  );
$$;
revoke execute on function auth_is_platform_master() from public;
grant execute on function auth_is_platform_master() to anon, authenticated;

comment on function auth_is_platform_master() is
  'Espelho no banco de platform:grant:manage (lib/auth/rbac.ts). Use quando a decisão for de master, não de "qualquer platform_role" — auth_is_platform_admin() é mais largo do que a matriz RBAC.';

-- ----------------------------------------------------------------------------
-- (A.2) platform_access_grants deixa de ser escrevível por policy.
--
-- A policy anterior era `for all using/with check (auth_is_platform_admin())`.
-- O comentário da 0013 dizia "ninguém concede acesso a si mesmo silenciosamente",
-- mas quem impunha isso era só o RBAC da aplicação. Pela API REST, um usuário
-- `marketing` fazia POST em /rest/v1/platform_access_grants com granted_to =
-- ele mesmo e passava a enxergar reservas, pagamentos e despesas de qualquer
-- pousada.
--
-- Concessão a si mesmo CONTINUA permitida — é o fluxo real do painel
-- (admin.service.ts: grantSensitiveAccess concede ao próprio master, com
-- justificativa). O que muda é quem pode fazer isso e sob quais limites.
-- ----------------------------------------------------------------------------
drop policy if exists "grants_platform_manage" on platform_access_grants;

-- Leitura: master (visão de auditoria) e o próprio concedido (para saber o que
-- tem aberto em seu nome). Escrita: nenhuma policy — só as RPCs abaixo.
create policy "grants_read" on platform_access_grants for select
  using (auth_is_platform_master() or granted_to = auth.uid());

/** Teto de duração da concessão. Acesso institucional é exceção, não rotina. */
create or replace function grant_platform_access(
  p_pousada_id uuid,
  p_granted_to uuid,
  p_reason text,
  p_expires_at timestamptz
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not auth_is_platform_master() then
    raise exception 'Você não tem permissão para conceder acesso institucional.';
  end if;
  if not exists (select 1 from pousadas p where p.id = p_pousada_id) then
    raise exception 'Pousada não encontrada.';
  end if;
  if not exists (select 1 from profiles p where p.id = p_granted_to and p.platform_role is not null) then
    raise exception 'Acesso institucional só pode ser concedido à equipe da plataforma.';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'Descreva o motivo do acesso (mínimo 10 caracteres).';
  end if;
  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'A concessão precisa de uma data de expiração futura.';
  end if;
  if p_expires_at > now() + interval '7 days' then
    raise exception 'Concessão limitada a 7 dias — renove se ainda for necessária.';
  end if;

  insert into platform_access_grants (pousada_id, granted_to, granted_by, reason, expires_at)
  values (p_pousada_id, p_granted_to, auth.uid(), trim(p_reason), p_expires_at)
  returning id into v_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'platform_access_grant.create', 'platform_access_grants', v_id,
          jsonb_build_object('pousadaId', p_pousada_id, 'grantedTo', p_granted_to,
                             'selfGrant', p_granted_to = auth.uid(), 'expiresAt', p_expires_at));
  return v_id;
end;
$$;
revoke execute on function grant_platform_access(uuid, uuid, text, timestamptz) from public, anon;
grant execute on function grant_platform_access(uuid, uuid, text, timestamptz) to authenticated;

create or replace function revoke_platform_access(p_grant_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_grant platform_access_grants%rowtype;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  select * into v_grant from platform_access_grants where id = p_grant_id for update;
  if not found then raise exception 'Concessão não encontrada.'; end if;

  -- Master revoga qualquer uma; quem recebeu pode abrir mão da própria.
  if not (auth_is_platform_master() or v_grant.granted_to = auth.uid()) then
    raise exception 'Você não tem permissão para revogar esta concessão.';
  end if;
  if v_grant.revoked_at is not null then return; end if;

  update platform_access_grants set revoked_at = now() where id = p_grant_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'platform_access_grant.revoke', 'platform_access_grants', p_grant_id,
          jsonb_build_object('pousadaId', v_grant.pousada_id, 'grantedTo', v_grant.granted_to));
end;
$$;
revoke execute on function revoke_platform_access(uuid) from public, anon;
grant execute on function revoke_platform_access(uuid) to authenticated;

-- Fecha o caminho direto pela API REST mesmo que uma policy de escrita volte
-- por engano no futuro: sem privilégio de tabela, o INSERT nem chega na RLS.
revoke insert, update, delete on table platform_access_grants from anon, authenticated;

-- ----------------------------------------------------------------------------
-- (B) PII de hóspedes e leads passa a respeitar o modelo de concessão.
--
-- A decisão do Ciclo 2 (0013) foi: platform_role sozinho NÃO acessa dado
-- pessoal/financeiro de pousada — é preciso concessão justificada e temporária.
-- Na época isso cobriu bookings, payments e expenses. As tabelas criadas
-- depois ficaram de fora e continuaram com `auth_is_platform_admin()`:
--
--   guests (0030)            — document_number, birth_date, address, cep,
--                              emergency_contact, dietary_restrictions,
--                              accessibility_needs. É a tabela mais sensível
--                              do sistema; as duas últimas são, na prática,
--                              dado de saúde (LGPD art. 5º, II).
--   quote_requests (0046)    — nome, telefone, e-mail e mensagem livre de
--                              leads que nunca foram clientes.
--   channel_calendars (0044) — inclui export_token, o segredo que dá acesso ao
--                              feed iCal do quarto.
--
-- `auth_has_active_grant()` é a mesma ferramenta que bookings/payments já usam,
-- então o suporte legítimo continua funcionando — agora com registro.
-- ----------------------------------------------------------------------------
drop policy if exists "guests_read" on guests;
create policy "guests_read" on guests for select
  using (auth_has_guest_access(pousada_id) or auth_has_active_grant(pousada_id));

drop policy if exists "guests_write" on guests;
create policy "guests_write" on guests for all
  using (auth_has_guest_access(pousada_id) or auth_has_active_grant(pousada_id))
  with check (auth_has_guest_access(pousada_id) or auth_has_active_grant(pousada_id));

drop policy if exists "quote_requests_read" on quote_requests;
create policy "quote_requests_read" on quote_requests for select
  using (auth_has_guest_access(pousada_id) or auth_has_active_grant(pousada_id));

drop policy if exists "quote_requests_update" on quote_requests;
create policy "quote_requests_update" on quote_requests for update
  using (auth_has_guest_access(pousada_id) or auth_has_active_grant(pousada_id))
  with check (auth_has_guest_access(pousada_id) or auth_has_active_grant(pousada_id));

drop policy if exists "channel_calendars_read" on channel_calendars;
create policy "channel_calendars_read" on channel_calendars for select
  using (auth_can_read_channels(pousada_id) or auth_has_active_grant(pousada_id));

drop policy if exists "channel_calendars_write" on channel_calendars;
create policy "channel_calendars_write" on channel_calendars for all
  using (auth_can_manage_channels(pousada_id) or auth_has_active_grant(pousada_id))
  with check (auth_can_manage_channels(pousada_id) or auth_has_active_grant(pousada_id));

-- `set_quote_request_status` e `get_link_report` (0046) aceitavam
-- `auth_is_platform_admin()` como alternativa ao acesso de hóspede. Mesmo
-- motivo, mesma troca — sem isso, a policy acima é contornável pela RPC.
create or replace function set_quote_request_status(
  p_request_id uuid, p_status quote_request_status, p_notes text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_pousada uuid;
begin
  select pousada_id into v_pousada from quote_requests where id = p_request_id;
  if v_pousada is null then raise exception 'Pedido não encontrado.'; end if;
  if not (auth_has_guest_access(v_pousada) or auth_has_active_grant(v_pousada)) then
    raise exception 'Sem permissão para tratar pedidos desta pousada.';
  end if;

  update quote_requests
    set status = p_status,
        internal_notes = coalesce(left(trim(p_notes), 2000), internal_notes),
        handled_by = auth.uid(),
        handled_at = now(),
        updated_at = now()
    where id = p_request_id;

  insert into audit_log(actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'quote_request.' || p_status, 'quote_requests', p_request_id, '{}'::jsonb);
end;
$$;
revoke all on function set_quote_request_status(uuid, quote_request_status, text) from public, anon;
grant execute on function set_quote_request_status(uuid, quote_request_status, text) to authenticated;

-- ----------------------------------------------------------------------------
-- (C) ensure_traveler_guest — a porta que faltava para o fluxo público.
--
-- `upsert_guest` (0034/0043) exige `auth_has_guest_access`, ou seja, staff da
-- pousada. Está correto: é a RPC de cadastro de hóspede do balcão, com CPF,
-- data de nascimento, endereço e notas internas. Mas o fluxo público de reserva
-- chamava justamente ela (bookings.service.ts), com a sessão do VIAJANTE — e
-- recebia "Você não tem permissão para gerenciar hóspedes nesta pousada".
--
-- A porta pública é esta, deliberadamente estreita:
--   - grava SEMPRE `user_id = auth.uid()` — o viajante não consegue criar nem
--     tocar o cadastro de outra pessoa;
--   - não aceita documento, nascimento, endereço, notas internas nem consentimento
--     de marketing — esses campos são do balcão, não do formulário público;
--   - reaproveita o cadastro que o próprio viajante já tem naquela pousada, em
--     vez de deduplicar por e-mail/telefone (que permitiria sequestrar a ficha
--     de um hóspede existente informando o e-mail dele);
--   - só funciona em pousada publicada e ativa.
-- ----------------------------------------------------------------------------
create or replace function ensure_traveler_guest(
  p_pousada_id uuid,
  p_full_name text,
  p_email text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_name text := left(trim(coalesce(p_full_name, '')), 150);
  v_email text := nullif(left(lower(trim(coalesce(p_email, ''))), 200), '');
begin
  if auth.uid() is null then raise exception 'Faça login para concluir a reserva.'; end if;
  if length(v_name) < 2 then raise exception 'Informe seu nome completo.'; end if;
  if not exists (
    select 1 from pousadas p
    where p.id = p_pousada_id and p.status = 'publicada'
      and p.tenant_status in ('onboarding', 'active')
  ) then
    raise exception 'Esta pousada não está disponível para reserva.';
  end if;

  -- Só o cadastro do próprio usuário nesta pousada. Nunca casa por e-mail.
  select id into v_id from guests
  where pousada_id = p_pousada_id and user_id = auth.uid()
  order by created_at limit 1;

  if v_id is null then
    insert into guests (pousada_id, user_id, full_name, email, source, created_by)
    values (p_pousada_id, auth.uid(), v_name, v_email, 'public_booking', auth.uid())
    returning id into v_id;

    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'guest.created', 'guests', v_id,
            jsonb_build_object('pousadaId', p_pousada_id, 'source', 'public_booking'));
  else
    update guests
      set full_name = v_name,
          email = coalesce(v_email, email),
          updated_at = now()
      where id = v_id;
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;
revoke all on function ensure_traveler_guest(uuid, text, text) from public, anon;
grant execute on function ensure_traveler_guest(uuid, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- (B.2) upsert_guest passa pelo mesmo crivo da policy.
--
-- Fechar a leitura de `guests` sem fechar esta RPC não adiantaria: ela é
-- `security definer` e aceitava `auth_is_platform_admin()`, então um papel de
-- plataforma qualquer continuaria podendo CRIAR e ALTERAR ficha de hóspede em
-- qualquer pousada — pior do que só ler.
--
-- Corpo idêntico ao da 0043; muda uma linha (a checagem de permissão).
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
  p_source guest_source default 'front_desk',
  p_cep text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_email_norm text := nullif(lower(trim(p_email)), '');
  v_phone_norm text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
  v_action text;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  -- [0047] era `auth_is_platform_admin()`; concessão temporária, como na policy.
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
      address, cep, emergency_contact, preferences, dietary_restrictions, accessibility_needs,
      internal_notes, marketing_consent, source, created_by
    ) values (
      p_pousada_id, p_user_id, trim(p_full_name), p_preferred_name, p_email, p_phone, p_whatsapp,
      p_document_type, p_document_number, p_birth_date, p_nationality, p_country, p_city, p_state,
      p_address, p_cep, coalesce(p_emergency_contact, '{}'::jsonb), coalesce(p_preferences, '{}'),
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
$$;

-- ----------------------------------------------------------------------------
-- (D) create_booking — o preço deixa de ser palavra do cliente.
--
-- A versão da 0034 recebia p_subtotal/p_fee/p_discount/p_surcharge/
-- p_services_amount/p_total e gravava como vieram; o comentário original
-- assumia isso ("a RPC nunca recalcula preço") apoiado em que o cálculo
-- confiável roda em features/reservas/pricing.ts. Só que a RPC é concedida a
-- `authenticated` e chamável por fora da aplicação: um viajante logado podia
-- criar reserva de R$ 0,01 pela API REST, e a conciliação da 0042 confirmaria,
-- porque ela compara o pago contra `total` — exatamente o campo adulterado.
--
-- No ramo NÃO-STAFF, agora tudo que tem consequência é derivado aqui dentro:
--   preço  — recalculado de rooms.base_price, com o MESMO coalesce de
--            list_bookable_rooms (0044), senão a busca oferta um valor e a
--            reserva grava outro;
--   prazo  — 24h a partir de agora. p_payment_due_at livre permitia segurar um
--            quarto até 2099 com uma reserva pending que nunca expira;
--   código — gerado no banco. p_code livre permitia forjar/colidir código;
--   origem — travada em 'rota_das_pousadas'. Reserva pública se passando por
--            Airbnb/Booking distorce o relatório do link da bio e a conciliação;
--   notas  — internal_notes zerada. É campo lido pela equipe da pousada.
--
-- Fluxo administrativo (staff) segue idêntico: recepção precisa mesmo lançar
-- desconto, acréscimo, tarifa negociada e reserva de outro canal.
--
-- Assinatura preservada — `create or replace` mantém os grants da 0034/0035.
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
    if p_checkin < current_date then
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

    if p_origin is distinct from 'rota_das_pousadas'
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
    p_payment_due_at := now() + interval '24 hours';

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
$$;

comment on function create_booking(
  uuid, uuid, uuid, text, date, date, integer, integer, integer, boolean, integer, integer, integer,
  integer, integer, integer, booking_status, booking_origin, uuid, text, text, numeric, text, text, text, timestamptz
) is
  'Fluxo público: preço, prazo, código, origem e notas internas são derivados no banco — o que o formulário envia é apenas conferido. Fluxo staff: valores do formulário prevalecem (desconto, acréscimo, tarifa negociada, reserva de outro canal). Ver migration 0047.';
