-- =============================================================================
-- Canais — sincronização de calendário por iCal (Airbnb, Booking e afins).
--
-- POR QUE ESTA FEATURE EXISTE: a pousada que vende na Rota e também em OTA tem
-- dois calendários. Sem sincronismo, a mesma noite é vendida duas vezes e quem
-- paga o prejuízo é ela. iCal é padrão aberto publicado pelas próprias OTAs e
-- não depende de contrato de channel manager — é o caminho mais curto até uma
-- pousada real operar sem overbooking.
--
-- DUAS DIREÇÕES, INDEPENDENTES:
--   importação — a Rota LÊ o feed da OTA e grava o que está ocupado lá
--                (`channel_events`). Esses eventos bloqueiam inventário aqui.
--   exportação — a Rota PUBLICA um feed por quarto, autenticado por token na
--                URL, que a OTA lê para saber o que foi vendido aqui.
--
-- PRIVACIDADE DO FEED EXPORTADO: a URL de um calendário iCal é, por natureza,
-- um segredo fraco — ela é colada na extranet da OTA e trafega sem sessão. Por
-- isso o feed publicado contém APENAS período e um rótulo genérico. Nunca nome,
-- e-mail, telefone, documento ou valor do hóspede.
--
-- FAIL-CLOSED: se a sincronização falhar, os eventos já conhecidos PERMANECEM.
-- Um feed que não respondeu nunca libera quarto — mesma decisão da correção de
-- disponibilidade registrada em `docs/ANALISE-2026-09-11.md`.
-- =============================================================================

create type channel_provider as enum ('airbnb', 'booking', 'outro');
create type channel_sync_status as enum ('never', 'ok', 'error');

-- ----------------------------------------------------------------------------
-- (A) channel_calendars — um vínculo por quarto e por canal.
--
-- `export_token` é gerado na aplicação (Node `crypto`, como em
-- features/pagamentos/services/oauth-state.ts) e não aqui: `gen_random_bytes`
-- exigiria pgcrypto, extensão que este banco não usa em nenhuma outra migration.
-- ----------------------------------------------------------------------------
create table channel_calendars (
  id               uuid primary key default gen_random_uuid(),
  pousada_id       uuid not null references pousadas(id) on delete cascade,
  room_id          uuid not null references rooms(id) on delete cascade,
  provider         channel_provider not null,
  label            text not null default '',
  -- Feed da OTA que a Rota lê. Nulo = só exportação.
  import_url       text,
  -- Segredo do feed que a Rota publica. Trocar o token invalida a URL antiga.
  export_token     text not null unique,
  import_enabled   boolean not null default true,
  export_enabled   boolean not null default true,
  last_sync_at     timestamptz,
  last_sync_status channel_sync_status not null default 'never',
  last_sync_error  text not null default '',
  last_event_count integer not null default 0,
  created_by       uuid references profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Um vínculo por quarto e canal: evita dois feeds do mesmo Airbnb no mesmo
  -- quarto, que duplicaria bloqueio e mascararia qual feed está desatualizado.
  unique (room_id, provider),
  check (import_url is null or import_url ~* '^https://')
);

create index idx_channel_calendars_pousada on channel_calendars(pousada_id);
create index idx_channel_calendars_import on channel_calendars(id)
  where import_enabled and import_url is not null;

-- ----------------------------------------------------------------------------
-- (B) channel_events — o que a OTA diz estar ocupado.
--
-- `ends_on` é EXCLUSIVO, igual a `bookings.checkout`: uma estadia de 14 a 16
-- ocupa as noites 14 e 15, e o dia 16 já pode ser vendido. Manter a mesma
-- convenção é o que permite comparar reserva, bloqueio e evento de canal com o
-- mesmo operador de sobreposição, sem ajuste de mais-ou-menos-um em cada lugar.
-- ----------------------------------------------------------------------------
create table channel_events (
  id          uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references channel_calendars(id) on delete cascade,
  pousada_id  uuid not null references pousadas(id) on delete cascade,
  room_id     uuid not null references rooms(id) on delete cascade,
  -- UID do VEVENT na origem — é o que permite reconhecer o mesmo evento entre
  -- duas sincronizações em vez de apagar e recriar tudo a cada ciclo.
  uid         text not null,
  starts_on   date not null,
  ends_on     date not null,
  summary     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (calendar_id, uid),
  check (ends_on > starts_on)
);

create index idx_channel_events_room_period on channel_events(room_id, starts_on, ends_on);

-- ----------------------------------------------------------------------------
-- (C) RLS — escopo por pousada, nunca por usuário.
--
-- Governança não entra: calendário de canal é decisão comercial, e o papel de
-- limpeza já é excluído de dado comercial desde a 0030. Financeiro também não.
-- ----------------------------------------------------------------------------
alter table channel_calendars enable row level security;
alter table channel_events enable row level security;

create or replace function auth_can_manage_channels(target_pousada uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    join pousadas p on p.id = m.pousada_id
    where m.user_id = auth.uid()
      and m.pousada_id = target_pousada
      and m.role in ('proprietario', 'admin_pousada')
      and m.status = 'active'
      and p.tenant_status in ('onboarding', 'active')
  );
$$;
revoke execute on function auth_can_manage_channels(uuid) from public;
grant execute on function auth_can_manage_channels(uuid) to authenticated;

create or replace function auth_can_read_channels(target_pousada uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    join pousadas p on p.id = m.pousada_id
    where m.user_id = auth.uid()
      and m.pousada_id = target_pousada
      and m.role in ('proprietario', 'admin_pousada', 'recepcionista')
      and m.status = 'active'
      and p.tenant_status in ('onboarding', 'active')
  );
$$;
revoke execute on function auth_can_read_channels(uuid) from public;
grant execute on function auth_can_read_channels(uuid) to authenticated;

create policy "channel_calendars_read" on channel_calendars for select
  using (auth_can_read_channels(pousada_id) or auth_is_platform_admin());
create policy "channel_calendars_write" on channel_calendars for all
  using (auth_can_manage_channels(pousada_id) or auth_is_platform_admin())
  with check (auth_can_manage_channels(pousada_id) or auth_is_platform_admin());

create policy "channel_events_read" on channel_events for select
  using (auth_can_read_channels(pousada_id) or auth_is_platform_admin());
-- Escrita de evento só acontece por `sync_channel_events` (service_role): nenhum
-- usuário final inventa ocupação de canal. Sem policy de escrita, ninguém mais grava.

-- ----------------------------------------------------------------------------
-- (D) RPCs de gestão — chamadas pelo painel, com sessão de usuário.
-- ----------------------------------------------------------------------------
create or replace function save_channel_calendar(
  p_room_id uuid, p_provider channel_provider, p_label text,
  p_import_url text, p_export_token text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_pousada uuid;
  v_id uuid;
begin
  select pousada_id into v_pousada from rooms where id = p_room_id;
  if v_pousada is null then raise exception 'Acomodação não encontrada.'; end if;
  if not auth_can_manage_channels(v_pousada) then
    raise exception 'Sem permissão para configurar canais desta pousada.';
  end if;
  if p_import_url is not null and p_import_url !~* '^https://' then
    raise exception 'O link do calendário precisa começar com https://.';
  end if;
  if length(coalesce(p_export_token, '')) < 32 then
    raise exception 'Token de exportação inválido.';
  end if;

  insert into channel_calendars (pousada_id, room_id, provider, label, import_url, export_token, created_by)
    values (v_pousada, p_room_id, p_provider, coalesce(p_label, ''), p_import_url, p_export_token, auth.uid())
  on conflict (room_id, provider) do update
    -- O token NÃO é trocado em atualização: a URL já está colada na extranet da
    -- OTA e trocar silenciosamente quebraria o feed sem ninguém perceber.
    set label = excluded.label, import_url = excluded.import_url, updated_at = now()
  returning id into v_id;

  insert into audit_log(actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'channel.saved', 'channel_calendars', v_id,
      jsonb_build_object('roomId', p_room_id, 'provider', p_provider, 'hasImport', p_import_url is not null));
  return v_id;
end;
$$;
revoke all on function save_channel_calendar(uuid, channel_provider, text, text, text) from public, anon;
grant execute on function save_channel_calendar(uuid, channel_provider, text, text, text) to authenticated;

create or replace function delete_channel_calendar(p_calendar_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_pousada uuid;
begin
  select pousada_id into v_pousada from channel_calendars where id = p_calendar_id;
  if v_pousada is null then raise exception 'Canal não encontrado.'; end if;
  if not auth_can_manage_channels(v_pousada) then
    raise exception 'Sem permissão para remover canais desta pousada.';
  end if;
  delete from channel_calendars where id = p_calendar_id;
  insert into audit_log(actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'channel.deleted', 'channel_calendars', p_calendar_id, '{}'::jsonb);
end;
$$;
revoke all on function delete_channel_calendar(uuid) from public, anon;
grant execute on function delete_channel_calendar(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- (E) sync_channel_events — porta única de escrita da importação (service_role).
--
-- Tudo em uma transação: ou o calendário inteiro passa a refletir o feed, ou
-- nada muda. O estado intermediário — eventos antigos apagados e novos ainda
-- não gravados — liberaria quarto por alguns milissegundos.
--
-- FAIL-CLOSED: com p_status = 'error' os eventos existentes são preservados e
-- apenas o diagnóstico do calendário é atualizado.
-- ----------------------------------------------------------------------------
create or replace function sync_channel_events(
  p_calendar_id uuid, p_events jsonb, p_status channel_sync_status, p_error text default ''
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cal channel_calendars%rowtype;
  v_count integer := 0;
begin
  select * into v_cal from channel_calendars where id = p_calendar_id for update;
  if not found then raise exception 'Canal não encontrado.'; end if;

  if p_status = 'error' then
    update channel_calendars
      set last_sync_at = now(), last_sync_status = 'error',
          last_sync_error = left(coalesce(p_error, ''), 500), updated_at = now()
      where id = p_calendar_id;
    return jsonb_build_object('status', 'error', 'kept', v_cal.last_event_count);
  end if;

  if jsonb_typeof(p_events) <> 'array' then raise exception 'Eventos inválidos.'; end if;

  with incoming as (
    select
      e->>'uid' as uid,
      (e->>'startsOn')::date as starts_on,
      (e->>'endsOn')::date as ends_on,
      left(coalesce(e->>'summary', ''), 200) as summary
    from jsonb_array_elements(p_events) e
  ), valid as (
    select * from incoming
    where uid is not null and length(uid) between 1 and 400
      and starts_on is not null and ends_on is not null and ends_on > starts_on
  ), upserted as (
    insert into channel_events (calendar_id, pousada_id, room_id, uid, starts_on, ends_on, summary)
    select p_calendar_id, v_cal.pousada_id, v_cal.room_id, uid, starts_on, ends_on, summary from valid
    on conflict (calendar_id, uid) do update
      set starts_on = excluded.starts_on, ends_on = excluded.ends_on,
          summary = excluded.summary, updated_at = now()
    returning uid
  )
  select count(*) into v_count from upserted;

  -- Remove o que sumiu do feed (bloqueio cancelado na OTA).
  delete from channel_events
    where calendar_id = p_calendar_id
      and uid not in (select e->>'uid' from jsonb_array_elements(p_events) e where e->>'uid' is not null);

  update channel_calendars
    set last_sync_at = now(), last_sync_status = 'ok', last_sync_error = '',
        last_event_count = v_count, updated_at = now()
    where id = p_calendar_id;

  return jsonb_build_object('status', 'ok', 'events', v_count);
end;
$$;
revoke all on function sync_channel_events(uuid, jsonb, channel_sync_status, text) from public, anon, authenticated;
grant execute on function sync_channel_events(uuid, jsonb, channel_sync_status, text) to service_role;

-- ----------------------------------------------------------------------------
-- (F) Feeds a importar — lista mínima para o cron, sem expor a tabela.
-- ----------------------------------------------------------------------------
create or replace function list_channel_feeds_to_import()
returns table(calendar_id uuid, import_url text)
language sql stable security definer set search_path = public as $$
  select c.id, c.import_url
  from channel_calendars c
  join pousadas p on p.id = c.pousada_id
  where c.import_enabled and c.import_url is not null
    and p.tenant_status in ('onboarding', 'active')
  order by c.last_sync_at nulls first, c.id;
$$;
revoke all on function list_channel_feeds_to_import() from public, anon, authenticated;
grant execute on function list_channel_feeds_to_import() to service_role;

-- ----------------------------------------------------------------------------
-- (G) Feed de exportação — resolvido por token, sem sessão.
--
-- Devolve SÓ período e rótulo genérico. A ausência de qualquer dado do hóspede
-- aqui é a proteção de privacidade da URL pública, não uma escolha de layout.
-- ----------------------------------------------------------------------------
create or replace function get_channel_export_feed(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_cal channel_calendars%rowtype;
  v_room text;
  v_events jsonb;
begin
  if p_token is null or length(p_token) < 32 then return null; end if;
  select * into v_cal from channel_calendars where export_token = p_token and export_enabled;
  if not found then return null; end if;
  select name into v_room from rooms where id = v_cal.room_id;

  select coalesce(jsonb_agg(evt order by evt->>'startsOn'), '[]'::jsonb) into v_events from (
    select jsonb_build_object(
      'uid', 'booking-' || b.id::text, 'startsOn', b.checkin, 'endsOn', b.checkout, 'summary', 'Reservado'
    ) as evt
    from bookings b
    where b.room_id = v_cal.room_id
      and b.status in ('pending', 'confirmed', 'checked_in')
      and b.checkout > current_date - interval '1 day'
    union all
    select jsonb_build_object(
      'uid', 'block-' || rb.id::text,
      'startsOn', (rb.starts_at at time zone 'UTC')::date,
      'endsOn', greatest((rb.ends_at at time zone 'UTC')::date, (rb.starts_at at time zone 'UTC')::date + 1),
      'summary', 'Indisponível'
    )
    from room_blocks rb
    where rb.room_id = v_cal.room_id and rb.status = 'active'
      and rb.ends_at > now() - interval '1 day'
  ) s;

  return jsonb_build_object('roomName', coalesce(v_room, 'Acomodação'), 'events', v_events);
end;
$$;
revoke all on function get_channel_export_feed(text) from public, anon, authenticated;
grant execute on function get_channel_export_feed(text) to service_role;

-- ----------------------------------------------------------------------------
-- (H) Disponibilidade pública passa a respeitar os canais.
--
-- Reescreve `list_bookable_rooms` (0041) acrescentando UMA condição: quarto com
-- evento de canal sobreposto não é ofertável. O restante é idêntico — qualquer
-- outra mudança aqui é regressão de busca, não desta feature.
-- ----------------------------------------------------------------------------
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
