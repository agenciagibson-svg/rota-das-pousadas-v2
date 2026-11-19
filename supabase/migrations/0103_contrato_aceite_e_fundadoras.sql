-- =============================================================================
-- 0103 — Contrato da pousada com aceite eletrônico e pousadas fundadoras.
--
-- Modelo comercial de 19/11/2026: a Rota cobra comissão por reserva originada
-- pela plataforma, e a pousada aceita o contrato dentro do painel.
--
-- 1. contract_versions: o texto do contrato, versionado. O modelo usa campos
--    `{{razao_social}}`, `{{documento}}`, `{{nome_fantasia}}`, `{{endereco}}`,
--    `{{representante_nome}}` e `{{representante_email}}`. Só o master grava e
--    publica. A versão VIGENTE é a publicada mais recente. Sem versão
--    publicada, nada desta migration muda o comportamento do sistema: é o
--    interruptor da funcionalidade (o texto entra depois da revisão jurídica).
--
-- 2. pousada_contract_acceptances: a prova do aceite. Guarda a cópia exata do
--    texto aceito (montada AQUI no banco, nunca recebida do cliente), o hash
--    SHA-256, quem aceitou, quando, IP e navegador. Não se altera nem se apaga.
--    Só o proprietário ativo aceita; o hash que a tela mostrou precisa bater
--    com o texto montado na hora (ninguém aceita um texto diferente do que viu).
--
-- 3. Primeira publicação: com contrato vigente, a pousada só é publicada pela
--    primeira vez depois do aceite. Pousada que já foi publicada antes não é
--    barrada (não derruba quem já está no ar).
--
-- 4. Fundadoras: as 30 primeiras pousadas publicadas com contrato vigente
--    ganham `founder_rank`, isenção de comissão por 60 dias e o percentual
--    garantido por 12 meses, contados da primeira publicação. A cobrança da
--    comissão ainda não lê estas datas (entrega seguinte); aqui elas só são
--    gravadas e mostradas.
--
-- Rollback: supabase/rollback/0103_rollback.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Versões do contrato
-- ---------------------------------------------------------------------------
create table contract_versions (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique check (code ~ '^[a-z0-9][a-z0-9.-]{2,39}$'),
  title             text not null check (char_length(title) between 3 and 200),
  body_template     text not null check (char_length(body_template) between 200 and 200000),
  requires_reaccept boolean not null default true,
  published_at      timestamptz,
  created_by        uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table contract_versions enable row level security;
-- Sem policy de propósito: só as RPCs SECURITY DEFINER abaixo tocam a tabela.
revoke all on contract_versions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Aceites
-- ---------------------------------------------------------------------------
create table pousada_contract_acceptances (
  id                  uuid primary key default gen_random_uuid(),
  pousada_id          uuid not null references pousadas(id) on delete restrict,
  contract_version_id uuid not null references contract_versions(id) on delete restrict,
  accepted_by         uuid references profiles(id) on delete set null,
  accepted_by_name    text not null,
  accepted_by_email   text not null,
  accepted_at         timestamptz not null default now(),
  ip                  text not null default '' check (char_length(ip) <= 64),
  user_agent          text not null default '' check (char_length(user_agent) <= 400),
  rendered_body       text not null,
  body_sha256         text not null check (body_sha256 ~ '^[0-9a-f]{64}$'),
  unique (pousada_id, contract_version_id)
);

alter table pousada_contract_acceptances enable row level security;
revoke all on pousada_contract_acceptances from public, anon, authenticated;

-- A prova não muda: nenhuma alteração nem exclusão, nem pelo service_role.
-- Única exceção: a exclusão da conta de quem aceitou zera `accepted_by`
-- (o nome e o e-mail gravados na hora continuam na linha).
create or replace function guard_contract_acceptance_immutable()
returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE'
     and new.accepted_by is null
     and (to_jsonb(new) - 'accepted_by') = (to_jsonb(old) - 'accepted_by') then
    return new;
  end if;
  raise exception 'O aceite do contrato é um registro permanente e não pode ser alterado.';
end;
$$;

create trigger trg_contract_acceptance_immutable
  before update or delete on pousada_contract_acceptances
  for each row execute function guard_contract_acceptance_immutable();

-- ---------------------------------------------------------------------------
-- 3. Colunas da pousada: primeira publicação e condição de fundadora
-- ---------------------------------------------------------------------------
alter table pousadas
  add column first_published_at timestamptz,
  add column founder_rank smallint check (founder_rank between 1 and 30),
  add column commission_exempt_until timestamptz,
  add column commission_rate_locked_until timestamptz;

create unique index pousadas_founder_rank_unico on pousadas(founder_rank)
  where founder_rank is not null;

comment on column pousadas.first_published_at is
  'Primeira vez que a pousada foi publicada. Ver 0103.';
comment on column pousadas.founder_rank is
  'Posição entre as 30 primeiras pousadas publicadas com contrato vigente (fundadoras). Ver 0103.';
comment on column pousadas.commission_exempt_until is
  'Fim da isenção de comissão de lançamento (60 dias da primeira publicação). Ver 0103.';
comment on column pousadas.commission_rate_locked_until is
  'Até quando o percentual da comissão está garantido (12 meses da primeira publicação). Ver 0103.';

-- Quem já está (ou já esteve) no ar não é barrada pela regra do aceite.
update pousadas set first_published_at = created_at
 where status in ('publicada', 'suspensa');

-- ---------------------------------------------------------------------------
-- Funções internas (sem EXECUTE para a API)
-- ---------------------------------------------------------------------------
create or replace function current_contract_version_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select id from contract_versions
   where published_at is not null
   order by published_at desc, created_at desc
   limit 1;
$$;
revoke all on function current_contract_version_id() from public, anon, authenticated;

-- Monta o contrato da pousada: troca os campos do modelo pelos dados gravados.
-- `missing` lista o que falta preencher (rótulos para a tela).
create or replace function render_pousada_contract(
  p_pousada_id uuid, p_version_id uuid, p_user_id uuid
)
returns table (body text, missing text[])
language plpgsql stable security definer set search_path = public as $$
declare
  v_template text;
  v_p pousadas%rowtype;
  v_name text;
  v_email text;
  v_address text;
  v_missing text[] := '{}';
begin
  select c.body_template into v_template from contract_versions c where c.id = p_version_id;
  select * into v_p from pousadas p where p.id = p_pousada_id;
  if v_template is null or v_p.id is null then
    raise exception 'Contrato não encontrado.';
  end if;
  select btrim(pr.full_name) into v_name from profiles pr where pr.id = p_user_id;
  select u.email into v_email from auth.users u where u.id = p_user_id;

  if btrim(coalesce(v_p.legal_name, '')) = '' then v_missing := array_append(v_missing, 'Razão social ou nome completo'); end if;
  if btrim(coalesce(v_p.tax_id, '')) = '' then v_missing := array_append(v_missing, 'CNPJ ou CPF'); end if;
  if btrim(coalesce(v_p.address, '')) = '' then v_missing := array_append(v_missing, 'Endereço'); end if;
  if btrim(coalesce(v_p.city, '')) = '' or btrim(coalesce(v_p.state, '')) = '' then
    v_missing := array_append(v_missing, 'Cidade e estado');
  end if;
  if coalesce(v_name, '') = '' then v_missing := array_append(v_missing, 'Seu nome completo (em Meu perfil)'); end if;

  v_address := btrim(coalesce(v_p.address, '')) || ', ' || btrim(coalesce(v_p.city, ''))
    || '/' || btrim(coalesce(v_p.state, ''))
    || case when btrim(coalesce(v_p.cep, '')) <> '' then ', CEP ' || btrim(v_p.cep) else '' end;

  body := v_template;
  body := replace(body, '{{razao_social}}', btrim(coalesce(v_p.legal_name, '')));
  body := replace(body, '{{documento}}', btrim(coalesce(v_p.tax_id, '')));
  body := replace(body, '{{nome_fantasia}}', btrim(coalesce(v_p.name, '')));
  body := replace(body, '{{endereco}}', v_address);
  body := replace(body, '{{representante_nome}}', coalesce(v_name, ''));
  body := replace(body, '{{representante_email}}', coalesce(v_email, ''));
  missing := v_missing;
  return next;
end;
$$;
revoke all on function render_pousada_contract(uuid, uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Painel da pousada: situação do contrato
-- ---------------------------------------------------------------------------
-- Dono, gestor e a equipe da Rota que gerencia pousadas veem a situação. O
-- texto para aceitar (`body`) só vai para o proprietário ativo, que é quem
-- assina: ele sai com o nome e o e-mail de quem está pedindo.
create or replace function get_pousada_contract_state(p_pousada_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_version contract_versions%rowtype;
  v_p pousadas%rowtype;
  v_is_owner boolean;
  v_latest jsonb;
  v_accepted_current boolean := false;
  v_body text;
  v_missing text[];
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not (auth_can_manage_pousada(p_pousada_id) or auth_can_manage_pousadas_platform()) then
    raise exception 'Pousada não encontrada.';
  end if;
  select * into v_p from pousadas p where p.id = p_pousada_id;
  if v_p.id is null then raise exception 'Pousada não encontrada.'; end if;
  v_is_owner := auth_is_active_owner_of(p_pousada_id);

  select * into v_version from contract_versions c where c.id = current_contract_version_id();

  select jsonb_build_object(
           'acceptedAt', a.accepted_at, 'acceptedByName', a.accepted_by_name,
           'versionCode', c.code, 'versionTitle', c.title, 'sha256', a.body_sha256)
    into v_latest
  from pousada_contract_acceptances a join contract_versions c on c.id = a.contract_version_id
  where a.pousada_id = p_pousada_id
  order by a.accepted_at desc limit 1;

  if v_version.id is not null then
    v_accepted_current := exists (
      select 1 from pousada_contract_acceptances a
       where a.pousada_id = p_pousada_id and a.contract_version_id = v_version.id);
    if v_is_owner and not v_accepted_current then
      select r.body, r.missing into v_body, v_missing
      from render_pousada_contract(p_pousada_id, v_version.id, auth.uid()) r;
    end if;
  end if;

  return jsonb_build_object(
    'active', v_version.id is not null,
    'version', case when v_version.id is null then null else jsonb_build_object(
      'id', v_version.id, 'code', v_version.code, 'title', v_version.title,
      'publishedAt', v_version.published_at, 'requiresReaccept', v_version.requires_reaccept) end,
    'canAccept', v_is_owner,
    'acceptedCurrent', v_accepted_current,
    'latestAcceptance', v_latest,
    'body', v_body,
    'bodySha256', case when v_body is null then null
                       else encode(sha256(convert_to(v_body, 'UTF8')), 'hex') end,
    'missing', coalesce(to_jsonb(v_missing), '[]'::jsonb),
    'firstPublishedAt', v_p.first_published_at,
    'founderRank', v_p.founder_rank,
    'commissionExemptUntil', v_p.commission_exempt_until,
    'commissionRateLockedUntil', v_p.commission_rate_locked_until
  );
end;
$$;
revoke all on function get_pousada_contract_state(uuid) from public, anon;
grant execute on function get_pousada_contract_state(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Aceitar o contrato vigente
-- ---------------------------------------------------------------------------
create or replace function accept_pousada_contract(
  p_pousada_id uuid, p_version_id uuid, p_body_sha256 text,
  p_ip text default '', p_user_agent text default ''
)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_version contract_versions%rowtype;
  v_existing pousada_contract_acceptances%rowtype;
  v_body text;
  v_missing text[];
  v_sha text;
  v_name text;
  v_email text;
  v_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  -- Permissão antes de qualquer lock ou leitura que revele a pousada.
  if not auth_is_active_owner_of(p_pousada_id) then
    raise exception 'Só o proprietário da pousada pode aceitar o contrato.';
  end if;
  perform 1 from pousadas p where p.id = p_pousada_id for update;

  select * into v_version from contract_versions c where c.id = current_contract_version_id();
  if v_version.id is null then
    raise exception 'Não há contrato disponível para aceite no momento.';
  end if;
  if p_version_id is distinct from v_version.id then
    raise exception 'O contrato foi atualizado. Recarregue a página e leia a versão atual.';
  end if;

  select * into v_existing from pousada_contract_acceptances a
   where a.pousada_id = p_pousada_id and a.contract_version_id = v_version.id;
  if found then
    return jsonb_build_object('acceptedAt', v_existing.accepted_at,
                              'versionCode', v_version.code, 'already', true);
  end if;

  select r.body, r.missing into v_body, v_missing
  from render_pousada_contract(p_pousada_id, v_version.id, auth.uid()) r;
  if coalesce(array_length(v_missing, 1), 0) > 0 then
    raise exception 'Preencha antes de aceitar: %.', array_to_string(v_missing, '; ');
  end if;

  v_sha := encode(sha256(convert_to(v_body, 'UTF8')), 'hex');
  if p_body_sha256 is distinct from v_sha then
    raise exception 'Os dados da pousada mudaram desde que o contrato foi aberto. Recarregue a página e confira o texto.';
  end if;

  select btrim(pr.full_name) into v_name from profiles pr where pr.id = auth.uid();
  select u.email into v_email from auth.users u where u.id = auth.uid();

  insert into pousada_contract_acceptances (
    pousada_id, contract_version_id, accepted_by, accepted_by_name, accepted_by_email,
    ip, user_agent, rendered_body, body_sha256)
  values (
    p_pousada_id, v_version.id, auth.uid(), v_name, coalesce(v_email, ''),
    left(coalesce(p_ip, ''), 64), left(coalesce(p_user_agent, ''), 400), v_body, v_sha)
  returning accepted_at into v_at;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'pousada.contract_accepted', 'pousadas', p_pousada_id,
          jsonb_build_object('version', v_version.code, 'sha256', v_sha));

  return jsonb_build_object('acceptedAt', v_at, 'versionCode', v_version.code, 'already', false);
end;
$$;
revoke all on function accept_pousada_contract(uuid, uuid, text, text, text) from public, anon;
grant execute on function accept_pousada_contract(uuid, uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Ler o contrato aceito (cópia guardada), para o painel e para imprimir
-- ---------------------------------------------------------------------------
create or replace function get_pousada_contract_acceptance(p_pousada_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not (auth_can_manage_pousada(p_pousada_id) or auth_can_manage_pousadas_platform()) then
    raise exception 'Pousada não encontrada.';
  end if;
  select jsonb_build_object(
           'acceptedAt', a.accepted_at, 'acceptedByName', a.accepted_by_name,
           'acceptedByEmail', a.accepted_by_email, 'versionCode', c.code,
           'versionTitle', c.title, 'sha256', a.body_sha256, 'body', a.rendered_body,
           'pousadaName', p.name)
    into v
  from pousada_contract_acceptances a
  join contract_versions c on c.id = a.contract_version_id
  join pousadas p on p.id = a.pousada_id
  where a.pousada_id = p_pousada_id
  order by a.accepted_at desc limit 1;
  return v;
end;
$$;
revoke all on function get_pousada_contract_acceptance(uuid) from public, anon;
grant execute on function get_pousada_contract_acceptance(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin (master): versões do contrato
-- ---------------------------------------------------------------------------
create or replace function list_contract_versions()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not auth_is_platform_master() then
    raise exception 'Somente master pode gerenciar o contrato das pousadas.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', c.id, 'code', c.code, 'title', c.title, 'bodyTemplate', c.body_template,
             'requiresReaccept', c.requires_reaccept, 'publishedAt', c.published_at,
             'updatedAt', c.updated_at,
             'current', c.id = current_contract_version_id(),
             'acceptances', (select count(*) from pousada_contract_acceptances a
                              where a.contract_version_id = c.id))
           order by c.created_at desc)
    from contract_versions c), '[]'::jsonb);
end;
$$;
revoke all on function list_contract_versions() from public, anon;
grant execute on function list_contract_versions() to authenticated;

-- Cria ou corrige um RASCUNHO. Versão publicada não muda mais: correção de
-- texto é versão nova (é o que garante que o aceite antigo aponta para o texto
-- que a pousada leu).
create or replace function save_contract_version_draft(
  p_code text, p_title text, p_body_template text, p_requires_reaccept boolean default true
)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  v_id uuid;
  v_published timestamptz;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not auth_is_platform_master() then
    raise exception 'Somente master pode gerenciar o contrato das pousadas.';
  end if;
  if p_code is null or p_code !~ '^[a-z0-9][a-z0-9.-]{2,39}$' then
    raise exception 'Código da versão: de 3 a 40 letras minúsculas, números, ponto ou hífen.';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) < 3 then
    raise exception 'Informe o título do contrato.';
  end if;
  if char_length(coalesce(p_body_template, '')) < 200 then
    raise exception 'O texto do contrato está curto demais.';
  end if;

  select c.id, c.published_at into v_id, v_published
  from contract_versions c where c.code = p_code for update;
  if v_id is not null and v_published is not null then
    raise exception 'Esta versão já foi publicada e não muda mais. Crie uma versão nova.';
  end if;

  if v_id is null then
    insert into contract_versions (code, title, body_template, requires_reaccept, created_by)
    values (p_code, btrim(p_title), p_body_template, coalesce(p_requires_reaccept, true), auth.uid())
    returning id into v_id;
  else
    update contract_versions
       set title = btrim(p_title), body_template = p_body_template,
           requires_reaccept = coalesce(p_requires_reaccept, true), updated_at = now()
     where id = v_id;
  end if;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'contract.version_saved', 'contract_versions', v_id,
          jsonb_build_object('code', p_code));
  return v_id;
end;
$$;
revoke all on function save_contract_version_draft(text, text, text, boolean) from public, anon;
grant execute on function save_contract_version_draft(text, text, text, boolean) to authenticated;

-- Publica: a versão vira a vigente e o aceite passa a ser pedido.
create or replace function publish_contract_version(p_code text)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  v contract_versions%rowtype;
  v_rest text;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not auth_is_platform_master() then
    raise exception 'Somente master pode gerenciar o contrato das pousadas.';
  end if;
  select * into v from contract_versions c where c.code = p_code for update;
  if v.id is null then raise exception 'Versão do contrato não encontrada.'; end if;
  if v.published_at is not null then raise exception 'Esta versão já está publicada.'; end if;

  -- Campo desconhecido ou colchete esquecido iria para a tela da pousada.
  v_rest := v.body_template;
  v_rest := replace(v_rest, '{{razao_social}}', '');
  v_rest := replace(v_rest, '{{documento}}', '');
  v_rest := replace(v_rest, '{{nome_fantasia}}', '');
  v_rest := replace(v_rest, '{{endereco}}', '');
  v_rest := replace(v_rest, '{{representante_nome}}', '');
  v_rest := replace(v_rest, '{{representante_email}}', '');
  if position('{{' in v_rest) > 0 or position('}}' in v_rest) > 0 then
    raise exception 'O texto tem um campo que o sistema não conhece. Use só os campos listados na tela.';
  end if;
  if v_rest ~ '\[[^\]]*\]' then
    raise exception 'O texto ainda tem trechos entre colchetes para definir. Resolva todos antes de publicar.';
  end if;

  update contract_versions set published_at = now(), updated_at = now() where id = v.id;
  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'contract.version_published', 'contract_versions', v.id,
          jsonb_build_object('code', v.code));
  return v.id;
end;
$$;
revoke all on function publish_contract_version(text) from public, anon;
grant execute on function publish_contract_version(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3 e 4. Primeira publicação: exige o aceite e marca as fundadoras
-- ---------------------------------------------------------------------------
create or replace function pousada_first_publication()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_version uuid;
  v_founders integer;
begin
  -- Pousada que já nasce publicada (carga feita pela equipe da Rota; o dono não
  -- consegue, 0065): só registra a data. A regra do aceite vale para a
  -- publicação feita pelo painel, que é sempre uma mudança de situação.
  if tg_op = 'INSERT' then
    if new.status = 'publicada' and new.first_published_at is null then
      new.first_published_at := now();
    end if;
    return new;
  end if;

  if new.status <> 'publicada' or old.status = 'publicada' or old.first_published_at is not null then
    return new;
  end if;

  v_version := current_contract_version_id();
  if v_version is not null then
    if not exists (
      select 1 from pousada_contract_acceptances a
       where a.pousada_id = new.id and a.contract_version_id = v_version) then
      raise exception 'Esta pousada ainda não aceitou o contrato. O proprietário aceita em Configurações → Contrato; depois disso ela pode ser publicada.';
    end if;

    -- Uma publicação por vez decide a posição: sem a trava, duas publicações
    -- simultâneas contariam o mesmo total e a 31ª entraria como fundadora.
    perform pg_advisory_xact_lock(hashtext('rota:pousadas:founder_rank'));
    select count(*) into v_founders from pousadas where founder_rank is not null;
    if v_founders < 30 then
      new.founder_rank := (select coalesce(max(founder_rank), 0) + 1 from pousadas);
      new.commission_exempt_until := now() + interval '60 days';
      new.commission_rate_locked_until := now() + interval '12 months';
      insert into audit_log (actor_id, action, target_table, target_id, metadata)
      values (auth.uid(), 'pousada.founder_assigned', 'pousadas', new.id,
              jsonb_build_object('rank', new.founder_rank));
    end if;
  end if;

  new.first_published_at := now();
  return new;
end;
$$;
revoke all on function pousada_first_publication() from public, anon, authenticated;

-- O nome ordena depois de trg_guard_pousada_owner_changes: a guarda de colunas
-- do dono (0065) avalia o UPDATE antes de este gatilho mexer nas colunas novas.
create trigger trg_pousada_first_publication
  before insert or update of status on pousadas
  for each row execute function pousada_first_publication();
