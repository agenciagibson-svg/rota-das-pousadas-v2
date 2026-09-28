-- =============================================================================
-- 0080 — Plano de ação comercial: oferta de tráfego pago para as pousadas.
--
-- O painel master cruza o desempenho de cada pousada com o perfil dela e
-- recomenda a ação (arrumar o perfil, oferecer tráfego pago, acompanhar). A
-- equipe comercial acompanha a oferta num funil (a oferecer → oferecido →
-- interessado → aceito → campanha ativa → encerrado/recusado), com histórico
-- de contatos. O dono da pousada vê um convite no painel dele e pode clicar em
-- "Tenho interesse", o que avisa a equipe. O resultado da campanha (antes x
-- depois) é calculado na aplicação a partir das reservas e das datas daqui.
--
-- Quem opera: platform_role master, comercial ou marketing (growth:manage em
-- lib/auth/rbac.ts). Escrita só por RPC.
-- =============================================================================

create or replace function auth_can_manage_growth()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.platform_role in ('master', 'comercial', 'marketing')
  );
$$;
revoke execute on function auth_can_manage_growth() from public;
grant execute on function auth_can_manage_growth() to authenticated;
comment on function auth_can_manage_growth() is
  'Espelho de growth:manage (lib/auth/rbac.ts): master, comercial e marketing.';

create table if not exists growth_opportunities (
  pousada_id        uuid primary key references pousadas(id) on delete cascade,
  stage             text not null default 'a_oferecer' check (stage in (
                      'a_oferecer', 'oferecido', 'interessado', 'aceito',
                      'campanha_ativa', 'encerrado', 'recusado')),
  service_fee       numeric(12,2) check (service_fee >= 0),   -- mensalidade do serviço
  ad_budget         numeric(12,2) check (ad_budget >= 0),     -- verba mensal de anúncios
  next_contact      date,
  campaign_start    date,
  campaign_end      date,
  owner_interest_at timestamptz,
  owner_interest_by uuid references profiles(id) on delete set null,
  lost_reason       text not null default '' check (char_length(lost_reason) <= 300),
  updated_at        timestamptz not null default now(),
  updated_by        uuid references profiles(id) on delete set null,
  constraint growth_campaign_dates check (
    campaign_end is null or campaign_start is null or campaign_end >= campaign_start)
);

create table if not exists growth_activities (
  id         uuid primary key default gen_random_uuid(),
  pousada_id uuid not null references pousadas(id) on delete cascade,
  kind       text not null check (kind in ('nota', 'contato', 'etapa', 'interesse')),
  body       text not null check (char_length(trim(body)) between 1 and 1000),
  created_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists growth_activities_pousada_idx
  on growth_activities (pousada_id, created_at desc);

alter table growth_opportunities enable row level security;
alter table growth_activities enable row level security;

drop policy if exists "growth_opportunities_read" on growth_opportunities;
create policy "growth_opportunities_read" on growth_opportunities for select
  using (auth_can_manage_growth());
drop policy if exists "growth_activities_read" on growth_activities;
create policy "growth_activities_read" on growth_activities for select
  using (auth_can_manage_growth());

-- Rótulo da etapa para o histórico.
create or replace function growth_stage_label(p_stage text)
returns text language sql immutable as $$
  select case p_stage
    when 'a_oferecer' then 'A oferecer'
    when 'oferecido' then 'Oferecido'
    when 'interessado' then 'Interessado'
    when 'aceito' then 'Aceito'
    when 'campanha_ativa' then 'Campanha ativa'
    when 'encerrado' then 'Encerrado'
    when 'recusado' then 'Recusado'
    else p_stage end;
$$;

-- -----------------------------------------------------------------------------
-- Equipe: salvar a oportunidade (etapa, valores, datas).
-- -----------------------------------------------------------------------------
create or replace function save_growth_opportunity(
  p_pousada_id uuid,
  p_stage text,
  p_service_fee numeric,
  p_ad_budget numeric,
  p_next_contact date,
  p_campaign_start date,
  p_campaign_end date,
  p_lost_reason text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_old text;
begin
  if not auth_can_manage_growth() then
    raise exception 'Seu perfil não pode editar o plano de ação.';
  end if;
  if not exists (select 1 from pousadas where id = p_pousada_id) then
    raise exception 'Pousada não encontrada.';
  end if;
  if p_stage not in ('a_oferecer', 'oferecido', 'interessado', 'aceito',
                     'campanha_ativa', 'encerrado', 'recusado') then
    raise exception 'Etapa inválida.';
  end if;
  if p_stage = 'campanha_ativa' and p_campaign_start is null then
    raise exception 'Informe a data de início da campanha.';
  end if;
  if p_campaign_end is not null and p_campaign_start is not null and p_campaign_end < p_campaign_start then
    raise exception 'O fim da campanha não pode ser antes do início.';
  end if;

  select stage into v_old from growth_opportunities where pousada_id = p_pousada_id;

  insert into growth_opportunities as g (
    pousada_id, stage, service_fee, ad_budget, next_contact, campaign_start,
    campaign_end, lost_reason, updated_at, updated_by)
  values (
    p_pousada_id, p_stage, p_service_fee, p_ad_budget, p_next_contact, p_campaign_start,
    p_campaign_end, left(coalesce(p_lost_reason, ''), 300), now(), auth.uid())
  on conflict (pousada_id) do update set
    stage = excluded.stage,
    service_fee = excluded.service_fee,
    ad_budget = excluded.ad_budget,
    next_contact = excluded.next_contact,
    campaign_start = excluded.campaign_start,
    campaign_end = excluded.campaign_end,
    lost_reason = excluded.lost_reason,
    updated_at = now(),
    updated_by = auth.uid();

  if v_old is distinct from p_stage then
    insert into growth_activities (pousada_id, kind, body)
    values (p_pousada_id, 'etapa',
      coalesce(growth_stage_label(v_old) || ' → ', '') || growth_stage_label(p_stage));
  end if;
end;
$$;
revoke all on function save_growth_opportunity(uuid, text, numeric, numeric, date, date, date, text) from public, anon;
grant execute on function save_growth_opportunity(uuid, text, numeric, numeric, date, date, date, text) to authenticated;

-- Equipe: registrar nota ou contato.
create or replace function add_growth_activity(p_pousada_id uuid, p_kind text, p_body text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not auth_can_manage_growth() then
    raise exception 'Seu perfil não pode editar o plano de ação.';
  end if;
  if p_kind not in ('nota', 'contato') then raise exception 'Tipo inválido.'; end if;
  if char_length(trim(coalesce(p_body, ''))) = 0 then raise exception 'Escreva a anotação.'; end if;
  if not exists (select 1 from pousadas where id = p_pousada_id) then
    raise exception 'Pousada não encontrada.';
  end if;
  insert into growth_activities (pousada_id, kind, body)
  values (p_pousada_id, p_kind, left(trim(p_body), 1000));
  -- Garante a linha do funil (primeiro contato cria a oportunidade).
  insert into growth_opportunities (pousada_id, stage, updated_by)
  values (p_pousada_id, case when p_kind = 'contato' then 'oferecido' else 'a_oferecer' end, auth.uid())
  on conflict (pousada_id) do nothing;
end;
$$;
revoke all on function add_growth_activity(uuid, text, text) from public, anon;
grant execute on function add_growth_activity(uuid, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Dono da pousada: "Tenho interesse" e status do convite.
-- -----------------------------------------------------------------------------
create or replace function request_growth_help(p_pousada_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_last timestamptz;
begin
  if not auth_can_manage_pousada(p_pousada_id) then
    raise exception 'Só o proprietário ou administrador da pousada pode pedir.';
  end if;
  select owner_interest_at into v_last from growth_opportunities where pousada_id = p_pousada_id;
  -- Clique repetido no mesmo dia não gera aviso novo.
  if v_last is not null and v_last > now() - interval '1 day' then
    return jsonb_build_object('interestAt', v_last, 'duplicate', true);
  end if;

  insert into growth_opportunities as g (pousada_id, stage, owner_interest_at, owner_interest_by, updated_at)
  values (p_pousada_id, 'interessado', now(), auth.uid(), now())
  on conflict (pousada_id) do update set
    owner_interest_at = now(),
    owner_interest_by = auth.uid(),
    stage = case when g.stage in ('a_oferecer', 'oferecido', 'recusado', 'encerrado')
                 then 'interessado' else g.stage end,
    updated_at = now();

  insert into growth_activities (pousada_id, kind, body, created_by)
  values (p_pousada_id, 'interesse', 'A pousada pediu ajuda pelo painel (Tenho interesse).', auth.uid());
  return jsonb_build_object('interestAt', now(), 'duplicate', false);
end;
$$;
revoke all on function request_growth_help(uuid) from public, anon;
grant execute on function request_growth_help(uuid) to authenticated;

-- Perfil de venda de uma ou de todas as pousadas (fotos, descrição, pagamento
-- online, quartos, avaliações, contato do dono). Equipe vê todas; o dono vê a
-- dele (sem contato de terceiros).
create or replace function growth_profiles(p_pousada_id uuid default null)
returns table (
  pousada_id uuid,
  photos integer,
  has_cover boolean,
  description_len integer,
  has_mercado_pago boolean,
  has_pix boolean,
  active_rooms integer,
  reviews_count integer,
  owner_name text,
  owner_email text,
  whatsapp text,
  phone text
)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if p_pousada_id is null then
    if not auth_can_manage_growth() then
      raise exception 'Seu perfil não pode ver o plano de ação.';
    end if;
  elsif not (auth_can_manage_growth() or auth_can_manage_pousada(p_pousada_id)) then
    raise exception 'Pousada não encontrada.';
  end if;

  return query
  select
    p.id,
    coalesce(array_length(p.gallery, 1), 0) + case when coalesce(p.image, '') <> '' then 1 else 0 end,
    coalesce(p.image, '') <> '',
    char_length(coalesce(p.description, '')),
    exists (select 1 from pousada_payment_accounts a
             where a.pousada_id = p.id and a.access_token is not null),
    exists (select 1 from pousada_pix_settings x
             where x.pousada_id = p.id and x.enabled and coalesce(x.pix_key, '') <> ''),
    (select count(*)::int from rooms r where r.pousada_id = p.id and r.status = 'active'),
    (select count(*)::int from reviews v where v.pousada_id = p.id),
    case when auth_can_manage_growth() then pr.full_name else null end,
    case when auth_can_manage_growth() then u.email::text else null end,
    p.whatsapp,
    p.contact_phone
  from pousadas p
  left join profiles pr on pr.id = p.owner_id
  left join auth.users u on u.id = p.owner_id
  where p_pousada_id is null or p.id = p_pousada_id;
end;
$$;
revoke all on function growth_profiles(uuid) from public, anon;
grant execute on function growth_profiles(uuid) to authenticated;

-- Status do convite para o painel do dono (sem valores nem anotações internas).
create or replace function get_growth_status(p_pousada_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  g growth_opportunities%rowtype;
begin
  if not auth_can_manage_pousada(p_pousada_id) then
    raise exception 'Pousada não encontrada.';
  end if;
  select * into g from growth_opportunities where pousada_id = p_pousada_id;
  return jsonb_build_object(
    'stage', coalesce(g.stage, 'a_oferecer'),
    'interestAt', g.owner_interest_at,
    'campaignStart', g.campaign_start,
    'campaignEnd', g.campaign_end
  );
end;
$$;
revoke all on function get_growth_status(uuid) from public, anon;
grant execute on function get_growth_status(uuid) to authenticated;
