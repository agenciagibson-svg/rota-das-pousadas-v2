-- =============================================================================
-- 0097 — Relatório do mês por e-mail (p6) e fichas antigas completadas pelo
-- perfil do viajante (p8).
--
-- (A) Relatório do mês. Todo dia 1º (fuso de Brasília) o cron diário
--     `/api/cron/expiracao` (service_role, sem sessão) manda para o
--     proprietário e o gestor de cada pousada publicada o resumo do mês
--     anterior. O cálculo (ocupação, receita, diária média, origens) fica no
--     app, em `features/dashboard/monthly-report.ts`, com as MESMAS funções do
--     painel — o banco só entrega as linhas mínimas por RPC estreita.
--
--     `monthly_reports_sent(pousada_id, month)` é a trava de idempotência:
--       1. `claim_monthly_report` reserva a vez (insert ... on conflict). Duas
--          rodadas simultâneas nunca mandam o mesmo relatório duas vezes.
--       2. Depois do envio, `mark_monthly_report_sent` grava `sent_at`.
--       3. Se nenhum e-mail saiu, `release_monthly_report` apaga a reserva da
--          vez e a pousada volta na rodada seguinte (dias 2 e 3).
--     Uma vez reservada há mais de 30 minutos sem `sent_at` (processo que
--     morreu no meio), a vez pode ser pega de novo.
--
-- (B) Fichas antigas. Reserva feita antes do cadastro do viajante (0073)
--     deixou a ficha da pousada (`guests`) sem telefone, documento etc. — a
--     ficha só copia o perfil na reserva seguinte (`ensure_traveler_guest`).
--     As RPCs abaixo completam SÓ campo vazio da ficha, nunca sobrescrevem, e
--     só quando o próprio viajante fez reserva nesta pousada (mesma condição
--     em que `ensure_traveler_guest` já copiaria os dados). O documento é
--     decifrado, conferido e cifrado de novo no app (lib/crypto) — a RPC de
--     aplicação só aceita o documento se o hash bater com o do perfil.
--
-- Todas as funções são só de service_role: o cliente não lê receita de outra
-- pousada, não silencia o relatório e não copia dado pessoal chamando a API
-- REST com a anon key ou com uma sessão comum.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- (A) Relatório do mês
-- ----------------------------------------------------------------------------
create table if not exists monthly_reports_sent (
  pousada_id uuid not null references pousadas(id) on delete cascade,
  month      date not null check (extract(day from month) = 1),
  claimed_at timestamptz not null default now(),
  sent_at    timestamptz,
  recipients integer not null default 0 check (recipients >= 0),
  constraint monthly_reports_sent_pkey primary key (pousada_id, month)
);

-- Sem policy nenhuma: só as RPCs abaixo (security definer) leem e escrevem.
alter table monthly_reports_sent enable row level security;
revoke all on monthly_reports_sent from public, anon, authenticated;

comment on table monthly_reports_sent is
  '0097: controle do relatório mensal por e-mail — uma linha por pousada e mês. Escrita só por claim/mark/release_monthly_report (service_role).';

-- Quartos que entram na conta de ocupação do relatório: os ativos. Não é RPC.
create or replace function monthly_report_active_rooms(p_pousada_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from rooms r
  where r.pousada_id = p_pousada_id and r.status = 'active';
$$;
revoke all on function monthly_report_active_rooms(uuid) from public, anon, authenticated, service_role;

-- 1. Pousadas que ainda devem receber o relatório do mês `p_month`.
create or replace function list_monthly_report_pousadas(p_month date, p_limit integer default 40)
returns table (pousada_id uuid, name text, timezone text, active_rooms integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_month is null or extract(day from p_month) <> 1 then
    raise exception 'Mês inválido: use o primeiro dia do mês.';
  end if;
  return query
    select p.id, p.name, p.timezone, monthly_report_active_rooms(p.id)
    from pousadas p
    where p.status = 'publicada'
      and p.tenant_status in ('onboarding', 'active')
      and monthly_report_active_rooms(p.id) >= 1
      and not exists (
        select 1 from monthly_reports_sent s
        where s.pousada_id = p.id and s.month = p_month
          and (s.sent_at is not null or s.claimed_at > now() - interval '30 minutes')
      )
    order by p.created_at, p.id
    limit least(greatest(coalesce(p_limit, 40), 1), 200);
end;
$$;
revoke all on function list_monthly_report_pousadas(date, integer) from public, anon, authenticated;
grant execute on function list_monthly_report_pousadas(date, integer) to service_role;

-- 2. Uma pousada qualquer (prévia do master no /admin — sem filtro de status).
create or replace function get_monthly_report_pousada(p_pousada_id uuid)
returns table (pousada_id uuid, name text, timezone text, active_rooms integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.timezone, monthly_report_active_rooms(p.id)
  from pousadas p where p.id = p_pousada_id;
$$;
revoke all on function get_monthly_report_pousada(uuid) from public, anon, authenticated;
grant execute on function get_monthly_report_pousada(uuid) to service_role;

-- 3. Reservas mínimas para o cálculo (datas, valor, status, origem). Sem nome,
--    e-mail ou documento de hóspede. Janela de no máximo ~3 meses, só nos
--    status que o painel conta (ocupam quarto ou já saíram).
create or replace function list_monthly_report_bookings(p_pousada_id uuid, p_from date, p_to date)
returns table (checkin date, checkout date, total numeric, status booking_status, origin booking_origin)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > 93 then
    raise exception 'Período inválido para o relatório.';
  end if;
  return query
    select b.checkin, b.checkout, b.total::numeric, b.status, b.origin
    from bookings b
    where b.pousada_id = p_pousada_id
      and b.status in ('pending', 'confirmed', 'checked_in', 'checked_out')
      and b.checkin < p_to
      and b.checkout > p_from
    order by b.checkin, b.id;
end;
$$;
revoke all on function list_monthly_report_bookings(uuid, date, date) from public, anon, authenticated;
grant execute on function list_monthly_report_bookings(uuid, date, date) to service_role;

-- 4. Destinatários: proprietário e gestor (admin_pousada) com vínculo ativo.
--    Recepção não recebe (o relatório traz faturamento); o e-mail de aviso da
--    pousada (notification_email) também não, porque costuma ser a caixa
--    compartilhada da recepção.
create or replace function list_monthly_report_recipients(p_pousada_id uuid)
returns table (email text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct lower(trim(u.email))
  from memberships m
  join auth.users u on u.id = m.user_id
  where m.pousada_id = p_pousada_id
    and m.status = 'active'
    and m.role in ('proprietario', 'admin_pousada')
    and nullif(trim(coalesce(u.email, '')), '') is not null;
$$;
revoke all on function list_monthly_report_recipients(uuid) from public, anon, authenticated;
grant execute on function list_monthly_report_recipients(uuid) to service_role;

-- 5. Reserva a vez de enviar. true = esta rodada envia; false = já enviado ou
--    outra rodada está enviando agora.
create or replace function claim_monthly_report(p_pousada_id uuid, p_month date)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  if p_month is null or extract(day from p_month) <> 1 then
    raise exception 'Mês inválido: use o primeiro dia do mês.';
  end if;
  insert into monthly_reports_sent as s (pousada_id, month)
  values (p_pousada_id, p_month)
  on conflict (pousada_id, month) do update
    set claimed_at = now()
    where s.sent_at is null and s.claimed_at <= now() - interval '30 minutes';
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;
revoke all on function claim_monthly_report(uuid, date) from public, anon, authenticated;
grant execute on function claim_monthly_report(uuid, date) to service_role;

-- 6. Marca como enviado (chamar só depois de pelo menos um e-mail sair).
create or replace function mark_monthly_report_sent(p_pousada_id uuid, p_month date, p_recipients integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_marked boolean;
begin
  update monthly_reports_sent
     set sent_at = now(), recipients = greatest(coalesce(p_recipients, 0), 0)
   where pousada_id = p_pousada_id and month = p_month and sent_at is null;
  v_marked := found;
  if v_marked then
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (null, 'pousada.monthly_report.sent', 'pousadas', p_pousada_id,
            jsonb_build_object('month', to_char(p_month, 'YYYY-MM'),
                               'recipients', greatest(coalesce(p_recipients, 0), 0)));
  end if;
  return v_marked;
end;
$$;
revoke all on function mark_monthly_report_sent(uuid, date, integer) from public, anon, authenticated;
grant execute on function mark_monthly_report_sent(uuid, date, integer) to service_role;

-- 7. Devolve a vez (nenhum e-mail saiu): a pousada volta na próxima rodada.
--    Relatório já enviado nunca é apagado.
create or replace function release_monthly_report(p_pousada_id uuid, p_month date)
returns void
language sql
security definer
set search_path = public
as $$
  delete from monthly_reports_sent
  where pousada_id = p_pousada_id and month = p_month and sent_at is null;
$$;
revoke all on function release_monthly_report(uuid, date) from public, anon, authenticated;
grant execute on function release_monthly_report(uuid, date) to service_role;

-- ----------------------------------------------------------------------------
-- (B) Fichas antigas completadas pelo perfil do viajante
-- ----------------------------------------------------------------------------

-- Cada ficha é completada UMA vez (revisão de 26/10/2026, LGPD/finalidade):
-- se a recepção apagar depois um campo da ficha, rodar a rotina de novo não
-- traz de volta o dado (nem a versão mais nova do perfil). Tabela sem acesso
-- direto para ninguém além das RPCs abaixo.
create table if not exists guest_profile_backfills (
  guest_id uuid primary key references guests(id) on delete cascade,
  done_at  timestamptz not null default now()
);
alter table guest_profile_backfills enable row level security;
revoke all on guest_profile_backfills from public, anon, authenticated;
comment on table guest_profile_backfills is
  '0097: fichas já completadas pelo perfil do viajante (uma vez por ficha). Escrita só por apply_guest_profile_backfill (service_role).';

-- Campos da ficha que estão vazios e que o perfil do viajante tem. Vazio =
-- nulo ou só espaço (texto), '{}' (contato de emergência). Ficha elegível só
-- quando o próprio viajante (guests.user_id) fez reserva nesta pousada — a
-- mesma situação em que `ensure_traveler_guest` copiaria os dados. Não é RPC.
create or replace function guest_profile_backfill_fields(p_guest_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_remove(array[
    case when nullif(trim(coalesce(g.phone, '')), '') is null
          and nullif(trim(coalesce(tp.phone, '')), '') is not null then 'phone' end,
    case when nullif(trim(coalesce(g.whatsapp, '')), '') is null
          and nullif(trim(coalesce(tp.whatsapp, '')), '') is not null then 'whatsapp' end,
    case when nullif(trim(coalesce(g.document_number, '')), '') is null
          and nullif(trim(coalesce(tp.document_number, '')), '') is not null
          and tp.document_number_hash is not null
          and (nullif(trim(coalesce(g.document_type, '')), '') is null
               or g.document_type = tp.document_type) then 'document' end,
    case when g.birth_date is null and tp.birth_date is not null then 'birth_date' end,
    case when nullif(trim(coalesce(g.nationality, '')), '') is null
          and nullif(trim(coalesce(tp.nationality, '')), '') is not null then 'nationality' end,
    case when nullif(trim(coalesce(g.country, '')), '') is null
          and nullif(trim(coalesce(tp.country, '')), '') is not null then 'country' end,
    case when nullif(trim(coalesce(g.city, '')), '') is null
          and nullif(trim(coalesce(tp.city, '')), '') is not null then 'city' end,
    case when nullif(trim(coalesce(g.state, '')), '') is null
          and nullif(trim(coalesce(tp.state, '')), '') is not null then 'state' end,
    case when nullif(trim(coalesce(g.address, '')), '') is null
          and nullif(trim(coalesce(tp.address, '')), '') is not null then 'address' end,
    case when nullif(trim(coalesce(g.cep, '')), '') is null
          and nullif(trim(coalesce(tp.cep, '')), '') is not null then 'cep' end,
    case when coalesce(g.emergency_contact, '{}'::jsonb) = '{}'::jsonb
          and coalesce(tp.emergency_contact, '{}'::jsonb) <> '{}'::jsonb then 'emergency_contact' end,
    case when nullif(trim(coalesce(g.dietary_restrictions, '')), '') is null
          and nullif(trim(coalesce(tp.dietary_restrictions, '')), '') is not null then 'dietary_restrictions' end,
    case when nullif(trim(coalesce(g.accessibility_needs, '')), '') is null
          and nullif(trim(coalesce(tp.accessibility_needs, '')), '') is not null then 'accessibility_needs' end
  ], null), '{}')
  from guests g
  join traveler_profiles tp on tp.user_id = g.user_id
  where g.id = p_guest_id
    and not exists (select 1 from guest_profile_backfills d where d.guest_id = g.id)
    and exists (
      select 1 from bookings b
      where b.pousada_id = g.pousada_id
        and b.guest_id = g.user_id
        and b.created_by = g.user_id
    );
$$;
revoke all on function guest_profile_backfill_fields(uuid) from public, anon, authenticated, service_role;

-- 8. Fichas com algo a completar, em páginas por id (cursor `p_after`). Volta o
--    documento do perfil só CIFRADO (e o hash), e só quando ele vai ser usado.
create or replace function list_guests_pending_profile_backfill(
  p_after uuid default null,
  p_limit integer default 200
)
returns table (
  guest_id uuid,
  fields text[],
  profile_document_number text,
  profile_document_number_hash text
)
language sql
stable
security definer
set search_path = public
as $$
  select x.id, x.fields,
         case when 'document' = any(x.fields) then tp.document_number end,
         case when 'document' = any(x.fields) then tp.document_number_hash end
  from (
    select g.id, g.user_id, guest_profile_backfill_fields(g.id) as fields
    from guests g
    where g.user_id is not null
      and (p_after is null or g.id > p_after)
      and exists (select 1 from traveler_profiles t where t.user_id = g.user_id)
  ) x
  join traveler_profiles tp on tp.user_id = x.user_id
  where cardinality(x.fields) > 0
  order by x.id
  limit least(greatest(coalesce(p_limit, 200), 1), 500);
$$;
revoke all on function list_guests_pending_profile_backfill(uuid, integer) from public, anon, authenticated;
grant execute on function list_guests_pending_profile_backfill(uuid, integer) to service_role;

-- 9. Completa uma ficha. Recalcula os campos vazios com a linha travada, então
--    nunca sobrescreve o que já foi preenchido (nem o que alguém preencheu
--    entre a listagem e a aplicação). O documento chega cifrado pelo app e só
--    é aceito se o hash for o mesmo do perfil do viajante. Devolve os campos
--    efetivamente preenchidos (nomes, nunca valores).
create or replace function apply_guest_profile_backfill(
  p_guest_id uuid,
  p_document_number text default null,
  p_document_number_hash text default null,
  p_document_last4 text default null
)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_g guests%rowtype;
  v_tp traveler_profiles%rowtype;
  v_fields text[];
  v_doc boolean;
  v_doc_pending boolean;
begin
  select * into v_g from guests where id = p_guest_id for update;
  if not found or v_g.user_id is null then return '{}'; end if;

  v_fields := coalesce(guest_profile_backfill_fields(p_guest_id), '{}');
  if cardinality(v_fields) = 0 then return '{}'; end if;

  select * into v_tp from traveler_profiles where user_id = v_g.user_id;
  if not found then return '{}'; end if;

  v_doc_pending := 'document' = any(v_fields);
  v_doc := 'document' = any(v_fields)
    and nullif(trim(coalesce(p_document_number, '')), '') is not null
    and p_document_number_hash is not null
    and p_document_number_hash = v_tp.document_number_hash;
  if not v_doc then
    v_fields := array_remove(v_fields, 'document');
  end if;
  if cardinality(v_fields) = 0 then return '{}'; end if;

  update guests set
    phone                = case when 'phone' = any(v_fields) then trim(v_tp.phone) else phone end,
    whatsapp             = case when 'whatsapp' = any(v_fields) then trim(v_tp.whatsapp) else whatsapp end,
    document_type        = case when v_doc then coalesce(nullif(trim(coalesce(document_type, '')), ''), v_tp.document_type) else document_type end,
    document_number      = case when v_doc then p_document_number else document_number end,
    document_number_hash = case when v_doc then p_document_number_hash else document_number_hash end,
    document_last4       = case when v_doc then p_document_last4 else document_last4 end,
    birth_date           = case when 'birth_date' = any(v_fields) then v_tp.birth_date else birth_date end,
    nationality          = case when 'nationality' = any(v_fields) then v_tp.nationality else nationality end,
    country              = case when 'country' = any(v_fields) then v_tp.country else country end,
    city                 = case when 'city' = any(v_fields) then v_tp.city else city end,
    state                = case when 'state' = any(v_fields) then v_tp.state else state end,
    address              = case when 'address' = any(v_fields) then v_tp.address else address end,
    cep                  = case when 'cep' = any(v_fields) then v_tp.cep else cep end,
    emergency_contact    = case when 'emergency_contact' = any(v_fields) then v_tp.emergency_contact else emergency_contact end,
    dietary_restrictions = case when 'dietary_restrictions' = any(v_fields) then v_tp.dietary_restrictions else dietary_restrictions end,
    accessibility_needs  = case when 'accessibility_needs' = any(v_fields) then v_tp.accessibility_needs else accessibility_needs end,
    updated_at           = now()
  where id = p_guest_id;

  -- Marca como feita só quando tudo o que faltava entrou. Um documento que o
  -- app não conseguiu decifrar fica para a próxima rodada (só ele: os outros
  -- campos já estão preenchidos e não são mais "vazios").
  if not (v_doc_pending and not v_doc) then
    insert into guest_profile_backfills (guest_id) values (p_guest_id)
    on conflict (guest_id) do nothing;
  end if;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (null, 'guest.profile_backfill', 'guests', p_guest_id,
          jsonb_build_object('pousadaId', v_g.pousada_id, 'fields', to_jsonb(v_fields)));

  return v_fields;
end;
$$;
revoke all on function apply_guest_profile_backfill(uuid, text, text, text) from public, anon, authenticated;
grant execute on function apply_guest_profile_backfill(uuid, text, text, text) to service_role;

comment on function list_guests_pending_profile_backfill(uuid, integer) is
  '0097: service_role só — fichas de hóspede com campo vazio que o perfil do viajante tem (só quem reservou na pousada).';
comment on function apply_guest_profile_backfill(uuid, text, text, text) is
  '0097: service_role só — completa campos vazios da ficha pelo perfil do viajante. Nunca sobrescreve. Idempotente.';
