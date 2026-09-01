-- =============================================================================
-- Ciclo 4 (1/5) — Hóspedes.
--
-- `profiles` (0001) é só a conta de autenticação da plataforma (1:1 com
-- auth.users) — não tem documento, telefone, nacionalidade, preferências,
-- nem representa hóspede sem conta. Nova entidade dedicada.
--
-- DECISÃO DE ISOLAMENTO: `guests` é sempre escopada por `pousada_id` — cada
-- pousada tem seu próprio caderno de hóspedes. `user_id` (nullable) liga o
-- registro a uma conta de plataforma QUANDO existir, mas nunca é usado pela
-- RLS para conceder acesso — só `pousada_id` concede acesso. Um mesmo
-- viajante que se hospeda em duas pousadas diferentes gera duas linhas
-- independentes (uma por pousada) — cumpre "cadastro interno de uma pousada
-- não fica automaticamente disponível para outra" mesmo quando a pessoa é a
-- mesma. Dentro da MESMA pousada, o mesmo user_id/e-mail/telefone normalizado
-- é reaproveitado (hóspede recorrente) — ver função upsert_guest (0034).
-- =============================================================================

create type guest_source as enum (
  'platform_account', 'front_desk', 'owner', 'public_booking', 'import', 'other'
);

create table guests (
  id                     uuid primary key default gen_random_uuid(),
  pousada_id             uuid not null references pousadas(id) on delete cascade,
  user_id                uuid references profiles(id),
  full_name              text not null,
  preferred_name         text,
  email                  text,
  phone                  text,
  whatsapp               text,
  document_type          text,
  document_number        text,
  birth_date             date,
  nationality            text,
  country                text default 'BR',
  city                   text,
  state                  text,
  address                text,
  emergency_contact      jsonb not null default '{}'::jsonb,
  preferences            text[] not null default '{}',
  dietary_restrictions   text not null default '',
  accessibility_needs    text not null default '',
  internal_notes         text not null default '',
  marketing_consent      boolean not null default false,
  source                 guest_source not null default 'front_desk',
  created_by             uuid references profiles(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  -- Normalização (RB "evite duplicação por pequenas diferenças de formatação"):
  -- geradas, nunca escritas diretamente — usadas por upsert_guest (0034) para
  -- encontrar/reaproveitar um cadastro existente na MESMA pousada.
  email_normalized       text generated always as (nullif(lower(trim(email)), '')) stored,
  phone_normalized       text generated always as (nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '')) stored,
  check (length(trim(full_name)) > 0)
);

create index idx_guests_pousada on guests(pousada_id);
create index idx_guests_user on guests(user_id);
create index idx_guests_email_norm on guests(pousada_id, email_normalized);
create index idx_guests_phone_norm on guests(pousada_id, phone_normalized);
create index idx_guests_document on guests(pousada_id, document_number) where document_number is not null;

-- ----------------------------------------------------------------------------
-- RLS — leitura/escrita só para papéis operacionais da própria pousada.
-- Nunca `governanca` (não acessa cadastro de hóspede — regra do Ciclo 4),
-- nunca `financeiro_pousada` (só valores, nunca dado pessoal — LGPD/minimização).
-- Mutação de dado só acontecerá por RPC (upsert_guest, 0034) — aqui a policy
-- de escrita existe apenas como segunda camada consistente com o padrão já
-- usado no projeto (nunca dependemos só da RPC; RLS sempre reforça o mesmo
-- limite mesmo que alguém chame a tabela direto).
-- ----------------------------------------------------------------------------
alter table guests enable row level security;

create or replace function auth_has_guest_access(target_pousada uuid)
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
revoke execute on function auth_has_guest_access(uuid) from public;
grant execute on function auth_has_guest_access(uuid) to authenticated;

create policy "guests_read" on guests for select
  using (auth_has_guest_access(pousada_id) or auth_is_platform_admin());
create policy "guests_write" on guests for all
  using (auth_has_guest_access(pousada_id) or auth_is_platform_admin())
  with check (auth_has_guest_access(pousada_id) or auth_is_platform_admin());
