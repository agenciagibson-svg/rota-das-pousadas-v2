-- =============================================================================
-- Página da bio: medição do que acontece no link, e pedidos de orçamento.
--
-- DUAS COISAS SEPARADAS, DE PROPÓSITO:
--
--   link_events    — contadores anônimos do que aconteceu na página. NENHUM
--                    dado pessoal: sem IP, sem user agent, sem identificador de
--                    visitante. Só "houve uma visita", "buscaram 12 a 15/10 para
--                    2 pessoas e havia 0 acomodações". Não é rastreamento de
--                    pessoa; é contagem de demanda. Essa escolha é o que mantém
--                    a feature fora do escopo pesado da LGPD.
--
--   quote_requests — pedidos de orçamento. AQUI existe dado pessoal (nome,
--                    telefone, e-mail), então a tabela é escopada por pousada e
--                    lida só por quem já tem acesso a hóspede (mesmo conjunto
--                    de papéis da 0030): proprietário, admin e recepção.
--                    Governança e financeiro continuam de fora.
--
-- O PEDIDO DE ORÇAMENTO NÃO É UMA RESERVA. `bookings.room_id` e
-- `responsible_guest_id` são `not null`, e quem pede orçamento normalmente nem
-- escolheu quarto ("somos 12 para o réveillon, cabe?"). O pedido é um contato;
-- a pousada o converte depois numa reserva com status `quote`, que já existe no
-- enum desde a 0032 e já tem transição para `pending` e `confirmed`.
-- =============================================================================

create type link_event_type as enum ('view', 'search', 'quote_request', 'booking_started');

create table link_events (
  id              uuid primary key default gen_random_uuid(),
  pousada_id      uuid not null references pousadas(id) on delete cascade,
  event           link_event_type not null,
  -- Preenchidos só quando o evento é uma busca.
  checkin         date,
  checkout        date,
  guests          integer,
  -- Quantas acomodações atendiam ao que foi pedido. ZERO numa busca é o dado
  -- mais valioso do relatório: é demanda que bateu na porta e não foi atendida.
  available_count integer,
  created_at      timestamptz not null default now(),
  check (guests is null or (guests between 1 and 100)),
  check (checkout is null or checkin is null or checkout > checkin)
);

create index idx_link_events_pousada_date on link_events(pousada_id, created_at desc);
create index idx_link_events_unmet on link_events(pousada_id, checkin)
  where event = 'search' and available_count = 0;

create type quote_request_status as enum ('novo', 'respondido', 'convertido', 'descartado');

create table quote_requests (
  id             uuid primary key default gen_random_uuid(),
  pousada_id     uuid not null references pousadas(id) on delete cascade,
  name           text not null,
  email          text,
  phone          text not null,
  checkin        date,
  checkout       date,
  adults         integer not null default 1,
  children       integer not null default 0,
  pets           boolean not null default false,
  -- Réveillon, casamento, aniversário, retiro… é o que o calendário não sabe
  -- precificar e por isso vira orçamento em vez de reserva direta.
  occasion       text not null default '',
  message        text not null default '',
  status         quote_request_status not null default 'novo',
  handled_by     uuid references profiles(id),
  handled_at     timestamptz,
  internal_notes text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (length(trim(name)) > 0),
  check (length(trim(phone)) > 0),
  check (adults between 1 and 100),
  check (children between 0 and 100),
  check (checkout is null or checkin is null or checkout > checkin)
);

create index idx_quote_requests_pousada on quote_requests(pousada_id, created_at desc);
create index idx_quote_requests_pendentes on quote_requests(pousada_id) where status = 'novo';

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table link_events enable row level security;
alter table quote_requests enable row level security;

-- link_events: leitura só agregada, via RPC. Ninguém lê a tabela direto — nem
-- a equipe da pousada, que não tem o que fazer com linha solta de visita.
create policy "link_events_admin_read" on link_events for select
  using (auth_is_platform_admin());

-- quote_requests: mesmo conjunto de papéis que enxerga hóspede (0030).
create policy "quote_requests_read" on quote_requests for select
  using (auth_has_guest_access(pousada_id) or auth_is_platform_admin());
create policy "quote_requests_update" on quote_requests for update
  using (auth_has_guest_access(pousada_id) or auth_is_platform_admin())
  with check (auth_has_guest_access(pousada_id) or auth_is_platform_admin());
-- Sem policy de INSERT: pedido só entra pela RPC abaixo, que valida e limita.

-- ----------------------------------------------------------------------------
-- record_link_event — chamada durante a renderização da página pública.
--
-- Aceita `anon` porque a página é servida sem sessão. Em troca, a função não
-- grava nada que identifique alguém e tem um teto por pousada: acima de 300
-- eventos por minuto ela descarta em silêncio, para que um robô consiga no
-- máximo sujar um contador — nunca encher a tabela.
-- ----------------------------------------------------------------------------
create or replace function record_link_event(
  p_pousada_id uuid, p_event link_event_type,
  p_checkin date default null, p_checkout date default null,
  p_guests integer default null, p_available_count integer default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_pousada_id is null or p_event is null then return; end if;
  -- Só pousada existente e ativa: evita criar métrica para id inventado.
  if not exists (
    select 1 from pousadas p
    where p.id = p_pousada_id and p.tenant_status in ('onboarding', 'active')
  ) then return; end if;

  if (select count(*) from link_events
      where pousada_id = p_pousada_id and created_at > now() - interval '1 minute') > 300 then
    return;
  end if;

  insert into link_events (pousada_id, event, checkin, checkout, guests, available_count)
  values (
    p_pousada_id, p_event,
    p_checkin, p_checkout,
    case when p_guests between 1 and 100 then p_guests end,
    case when p_available_count >= 0 then least(p_available_count, 1000) end
  );
end;
$$;
revoke all on function record_link_event(uuid, link_event_type, date, date, integer, integer) from public;
grant execute on function record_link_event(uuid, link_event_type, date, date, integer, integer) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- create_quote_request — porta pública do formulário de orçamento.
--
-- Limite de 3 pedidos por telefone e por pousada a cada hora. Formulário
-- público sem limite vira porta de spam, e spam aqui não é só incômodo: enche
-- a caixa de entrada da pousada e ela para de olhar os pedidos de verdade.
-- ----------------------------------------------------------------------------
create or replace function create_quote_request(
  p_pousada_id uuid, p_name text, p_phone text, p_email text default null,
  p_checkin date default null, p_checkout date default null,
  p_adults integer default 1, p_children integer default 0, p_pets boolean default false,
  p_occasion text default '', p_message text default ''
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_phone_digits text;
  v_id uuid;
begin
  if not exists (
    select 1 from pousadas p
    where p.id = p_pousada_id and p.status = 'publicada'
      and p.tenant_status in ('onboarding', 'active')
  ) then
    raise exception 'Pousada indisponível para orçamento.';
  end if;

  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Informe seu nome.'; end if;
  v_phone_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(v_phone_digits) < 10 or length(v_phone_digits) > 13 then
    raise exception 'Informe um telefone válido com DDD.';
  end if;
  if p_checkin is not null and p_checkout is not null and p_checkout <= p_checkin then
    raise exception 'A saída deve ser posterior à entrada.';
  end if;
  if coalesce(p_adults, 1) < 1 or coalesce(p_adults, 1) > 100
     or coalesce(p_children, 0) < 0 or coalesce(p_children, 0) > 100 then
    raise exception 'Número de hóspedes inválido.';
  end if;

  if (select count(*) from quote_requests
      where pousada_id = p_pousada_id
        and regexp_replace(phone, '\D', '', 'g') = v_phone_digits
        and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Você já enviou pedidos recentes. A pousada vai responder em breve.';
  end if;

  insert into quote_requests (
    pousada_id, name, email, phone, checkin, checkout,
    adults, children, pets, occasion, message
  ) values (
    p_pousada_id,
    left(trim(p_name), 150),
    nullif(left(trim(coalesce(p_email, '')), 200), ''),
    left(trim(p_phone), 30),
    p_checkin, p_checkout,
    coalesce(p_adults, 1), coalesce(p_children, 0), coalesce(p_pets, false),
    left(trim(coalesce(p_occasion, '')), 80),
    left(trim(coalesce(p_message, '')), 2000)
  ) returning id into v_id;

  perform record_link_event(p_pousada_id, 'quote_request', p_checkin, p_checkout, null, null);

  return jsonb_build_object('status', 'ok', 'id', v_id);
end;
$$;
revoke all on function create_quote_request(uuid, text, text, text, date, date, integer, integer, boolean, text, text) from public;
grant execute on function create_quote_request(uuid, text, text, text, date, date, integer, integer, boolean, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- set_quote_request_status — a pousada marca o que fez com o pedido.
-- ----------------------------------------------------------------------------
create or replace function set_quote_request_status(
  p_request_id uuid, p_status quote_request_status, p_notes text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_pousada uuid;
begin
  select pousada_id into v_pousada from quote_requests where id = p_request_id;
  if v_pousada is null then raise exception 'Pedido não encontrado.'; end if;
  if not auth_has_guest_access(v_pousada) then
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
-- get_link_report — o relatório do painel do parceiro.
--
-- Devolve tudo em uma chamada: totais, série diária e a lista de datas
-- procuradas sem disponibilidade. Esta última é a razão de existir do
-- relatório — "14 pessoas procuraram o feriado de novembro e você não tinha
-- vaga" é acionável; "312 visitas" não é.
-- ----------------------------------------------------------------------------
create or replace function get_link_report(p_pousada_id uuid, p_days integer default 30)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_from date;
  v_result jsonb;
begin
  if not auth_has_guest_access(p_pousada_id) and not auth_is_platform_admin() then
    raise exception 'Sem permissão para ver o relatório desta pousada.';
  end if;
  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'Período inválido.';
  end if;
  v_from := current_date - (p_days - 1);

  with eventos as (
    select * from link_events
    where pousada_id = p_pousada_id and created_at >= v_from
  ), reservas as (
    select * from bookings
    where pousada_id = p_pousada_id and origin = 'link_bio'
      and created_at >= v_from and status not in ('cancelled', 'no_show')
  ), totais as (
    select
      count(*) filter (where event = 'view') as views,
      count(*) filter (where event = 'search') as searches,
      count(*) filter (where event = 'search' and available_count = 0) as searches_sem_vaga,
      count(*) filter (where event = 'quote_request') as quotes
    from eventos
  ), dias as (
    select d::date as dia from generate_series(v_from, current_date, interval '1 day') d
  ), serie as (
    select
      dias.dia,
      (select count(*) from eventos e where e.event = 'view' and e.created_at::date = dias.dia) as views,
      (select count(*) from eventos e where e.event = 'search' and e.created_at::date = dias.dia) as searches,
      (select count(*) from reservas r where r.created_at::date = dias.dia) as bookings
    from dias order by dias.dia
  ), perdidas as (
    select checkin, checkout, coalesce(guests, 0) as guests, count(*) as tentativas
    from eventos
    where event = 'search' and available_count = 0 and checkin is not null
    group by checkin, checkout, coalesce(guests, 0)
    order by count(*) desc, checkin
    limit 8
  )
  select jsonb_build_object(
    'days', p_days,
    'from', v_from,
    'totals', jsonb_build_object(
      'views', (select views from totais),
      'searches', (select searches from totais),
      'searchesWithoutAvailability', (select searches_sem_vaga from totais),
      'quotes', (select quotes from totais),
      'bookings', (select count(*) from reservas),
      'revenue', (select coalesce(sum(total), 0) from reservas)
    ),
    'daily', coalesce((select jsonb_agg(jsonb_build_object(
        'day', dia, 'views', views, 'searches', searches, 'bookings', bookings
      ) order by dia) from serie), '[]'::jsonb),
    'unmetDemand', coalesce((select jsonb_agg(jsonb_build_object(
        'checkin', checkin, 'checkout', checkout, 'guests', guests, 'tries', tentativas
      )) from perdidas), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;
revoke all on function get_link_report(uuid, integer) from public, anon;
grant execute on function get_link_report(uuid, integer) to authenticated;
