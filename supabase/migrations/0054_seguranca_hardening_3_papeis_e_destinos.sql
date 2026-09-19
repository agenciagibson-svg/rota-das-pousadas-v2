-- =============================================================================
-- 0054 -- Correcao critica: autopromocao a platform_role via RLS de coluna +
-- gestao de papeis de plataforma pela UI + CRUD de destinos.
--
-- Achado da avaliacao das telas "Em breve" (19/09/2026):
--
--   (A) `profiles_self_update` (0002) e `for update using (id = auth.uid())
--       with check (id = auth.uid())` -- RLS e por LINHA, nao por coluna. Sem
--       nenhuma restricao de coluna, qualquer usuario autenticado podia
--       chamar diretamente a API REST do Supabase (PATCH /rest/v1/profiles)
--       e fazer `platform_role = 'master'` na propria linha, ganhando
--       controle total da plataforma -- sem passar por nenhuma tela, RPC ou
--       regra de negocio da aplicacao. Bloqueador critico, ativo em producao.
--       Corrigido revogando a COLUNA `platform_role` (insert e update) do
--       grant de `authenticated`/`anon` -- `full_name` continua editavel
--       pelo mesmo caminho direto (repositories/profiles.repository.ts:
--       updateProfileName), so `platform_role` passa a exigir a RPC abaixo.
--
--   (B) Atribuicao de papel de plataforma so existia via SQL manual (gap
--       documentado em docs/features/onboarding-admin.md). `set_platform_role_by_email`
--       fecha (A) da forma certa: so master muta `platform_role`, com
--       protecao contra remover o ultimo master e auditoria na mesma
--       transacao. Mesmo padrao de `link_pousada_owner` (0052): quem chama
--       ja e equipe interna confiavel, entao erro explicito de "e-mail sem
--       conta" nao e risco de enumeracao (ao contrario de `invite_membership`,
--       que e alcancavel por qualquer proprietario).
--
--   (C) `destinations` so tinha policy de leitura (`ref_read_destinations`,
--       0002) -- nenhuma tela, RPC ou SQL documentado criava/editava/removia
--       um destino; o cadastro so acontecia manualmente no banco. Como o
--       card de destino na home (components/landing/destinations.tsx) exibe
--       `pousadas_count`/`rating`/`price_from` direto da tabela e nada nunca
--       populou essas colunas, a home sempre mostrou "0 pousadas" pra todo
--       destino -- um defeito real de producao, nao so uma tela faltando.
--       `create_destination`/`update_destination`/`delete_destination`
--       fecham a curadoria (comercial/marketing/master, mesmo escopo de
--       `pousada:approve`/`pousada:create` na matriz -- lib/auth/rbac.ts).
--       `pousadas_count` sai do controle manual: a leitura passa a calcular
--       ao vivo (repositories/destinations.repository.ts), entao a RPC nem
--       aceita esse campo.
--
-- Aditivo -- nenhuma tabela, coluna ou linha e removida. Reversao: ver
-- supabase/rollback/0054_rollback.sql.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- (A) profiles.platform_role deixa de ser gravavel pelo caminho direto
-- (RLS e por linha; isto restringe por COLUNA, complementando a policy).
-- ----------------------------------------------------------------------------
revoke update (platform_role) on public.profiles from authenticated, anon;
revoke insert (platform_role) on public.profiles from authenticated, anon;

comment on column public.profiles.platform_role is
  'Somente via RPC set_platform_role_by_email (0054, master-only). Coluna revogada de insert/update direto de authenticated/anon -- ver 0054 para o achado (autopromocao via PATCH direto).';

-- ----------------------------------------------------------------------------
-- (B.1) Helper: pode gerenciar catalogo de destinos? (comercial/marketing/master --
-- mesmo escopo de quem hoje aprova/cadastra pousada na plataforma.)
-- ----------------------------------------------------------------------------
create or replace function auth_can_manage_destinations()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.platform_role in ('comercial', 'marketing', 'master')
  );
$$;
revoke execute on function auth_can_manage_destinations() from public;
grant execute on function auth_can_manage_destinations() to anon, authenticated;

-- ----------------------------------------------------------------------------
-- (B.2) CRUD de destinos. `pousadas_count` fica de fora dos parametros de
-- proposito -- passa a ser calculado ao vivo na leitura, nunca digitado.
-- ----------------------------------------------------------------------------
create or replace function create_destination(
  p_slug text,
  p_name text,
  p_state text,
  p_image text,
  p_season text[],
  p_rating numeric,
  p_price_from integer
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_season text;
begin
  if auth.uid() is null then
    raise exception 'Nao autenticado.';
  end if;
  if not auth_can_manage_destinations() then
    raise exception 'Voce nao tem permissao para gerenciar destinos.';
  end if;

  if trim(coalesce(p_slug, '')) = '' then
    raise exception 'Informe um slug para o destino.';
  end if;
  if trim(coalesce(p_name, '')) = '' then
    raise exception 'Informe o nome do destino.';
  end if;
  if p_state !~ '^[A-Za-z]{2}$' then
    raise exception 'UF invalida.';
  end if;
  foreach v_season in array coalesce(p_season, '{}') loop
    if v_season not in ('verao', 'outono', 'inverno', 'primavera') then
      raise exception 'Estacao invalida: %', v_season;
    end if;
  end loop;
  if p_rating < 0 or p_rating > 5 then
    raise exception 'Nota deve estar entre 0 e 5.';
  end if;
  if p_price_from < 0 then
    raise exception 'Preco nao pode ser negativo.';
  end if;

  if exists (select 1 from destinations where slug = lower(trim(p_slug))) then
    raise exception 'Ja existe um destino com este slug.';
  end if;

  insert into destinations (slug, name, state, image, season, rating, price_from)
  values (lower(trim(p_slug)), trim(p_name), upper(p_state), coalesce(trim(p_image), ''), coalesce(p_season, '{}'), p_rating, p_price_from)
  returning id into v_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'destination.created', 'destinations', v_id, jsonb_build_object('slug', lower(trim(p_slug))));

  return jsonb_build_object('id', v_id, 'slug', lower(trim(p_slug)));
end;
$$;
revoke execute on function create_destination(text, text, text, text, text[], numeric, integer) from public;
revoke execute on function create_destination(text, text, text, text, text[], numeric, integer) from anon;
grant execute on function create_destination(text, text, text, text, text[], numeric, integer) to authenticated;

create or replace function update_destination(
  p_id uuid,
  p_slug text,
  p_name text,
  p_state text,
  p_image text,
  p_season text[],
  p_rating numeric,
  p_price_from integer
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_season text;
begin
  if auth.uid() is null then
    raise exception 'Nao autenticado.';
  end if;
  if not auth_can_manage_destinations() then
    raise exception 'Voce nao tem permissao para gerenciar destinos.';
  end if;
  if not exists (select 1 from destinations where id = p_id) then
    raise exception 'Destino nao encontrado.';
  end if;

  if trim(coalesce(p_slug, '')) = '' then
    raise exception 'Informe um slug para o destino.';
  end if;
  if trim(coalesce(p_name, '')) = '' then
    raise exception 'Informe o nome do destino.';
  end if;
  if p_state !~ '^[A-Za-z]{2}$' then
    raise exception 'UF invalida.';
  end if;
  foreach v_season in array coalesce(p_season, '{}') loop
    if v_season not in ('verao', 'outono', 'inverno', 'primavera') then
      raise exception 'Estacao invalida: %', v_season;
    end if;
  end loop;
  if p_rating < 0 or p_rating > 5 then
    raise exception 'Nota deve estar entre 0 e 5.';
  end if;
  if p_price_from < 0 then
    raise exception 'Preco nao pode ser negativo.';
  end if;

  if exists (select 1 from destinations where slug = lower(trim(p_slug)) and id <> p_id) then
    raise exception 'Ja existe um destino com este slug.';
  end if;

  update destinations
  set slug = lower(trim(p_slug)),
      name = trim(p_name),
      state = upper(p_state),
      image = coalesce(trim(p_image), ''),
      season = coalesce(p_season, '{}'),
      rating = p_rating,
      price_from = p_price_from
  where id = p_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'destination.updated', 'destinations', p_id, jsonb_build_object('slug', lower(trim(p_slug))));

  return jsonb_build_object('id', p_id, 'slug', lower(trim(p_slug)));
end;
$$;
revoke execute on function update_destination(uuid, text, text, text, text, text[], numeric, integer) from public;
revoke execute on function update_destination(uuid, text, text, text, text, text[], numeric, integer) from anon;
grant execute on function update_destination(uuid, text, text, text, text, text[], numeric, integer) to authenticated;

create or replace function delete_destination(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_slug text;
  v_linked integer;
begin
  if auth.uid() is null then
    raise exception 'Nao autenticado.';
  end if;
  if not auth_can_manage_destinations() then
    raise exception 'Voce nao tem permissao para gerenciar destinos.';
  end if;

  select slug into v_slug from destinations where id = p_id;
  if v_slug is null then
    raise exception 'Destino nao encontrado.';
  end if;

  select count(*) into v_linked from pousadas where destination_id = p_id;
  if v_linked > 0 then
    raise exception 'Este destino tem % pousada(s) vinculada(s) -- desvincule antes de excluir.', v_linked;
  end if;

  delete from destinations where id = p_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'destination.deleted', 'destinations', p_id, jsonb_build_object('slug', v_slug));

  return jsonb_build_object('status', 'ok');
end;
$$;
revoke execute on function delete_destination(uuid) from public;
revoke execute on function delete_destination(uuid) from anon;
grant execute on function delete_destination(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- (C.1) Gestao de papeis de plataforma -- so master. Resolve e-mail e muta
-- na mesma funcao (mesmo padrao de link_pousada_owner, 0052): quem chama ja
-- e master (equipe interna confiavel), entao erro explicito de "sem conta"
-- nao e oraculo de enumeracao aqui.
-- ----------------------------------------------------------------------------
create or replace function set_platform_role_by_email(p_email text, p_role platform_role)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_target_user uuid;
  v_old_role platform_role;
  v_master_count integer;
begin
  if auth.uid() is null then
    raise exception 'Nao autenticado.';
  end if;
  if not auth_is_platform_master() then
    raise exception 'Voce nao tem permissao para gerenciar papeis de plataforma.';
  end if;

  select p.id, p.platform_role into v_target_user, v_old_role
  from profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = lower(trim(p_email))
  limit 1;

  if v_target_user is null then
    raise exception 'Nenhuma conta encontrada com este e-mail. A pessoa precisa criar conta em /entrar antes de receber um papel.';
  end if;

  if v_old_role = 'master' and p_role is distinct from 'master' then
    select count(*) into v_master_count from profiles where platform_role = 'master';
    if v_master_count <= 1 then
      raise exception 'Nao e possivel remover o unico master da plataforma.';
    end if;
  end if;

  update profiles set platform_role = p_role, updated_at = now() where id = v_target_user;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'platform_role.changed', 'profiles', v_target_user,
          jsonb_build_object('email', lower(trim(p_email)), 'old_role', v_old_role, 'new_role', p_role));

  return jsonb_build_object('status', 'ok');
end;
$$;
revoke execute on function set_platform_role_by_email(text, platform_role) from public;
revoke execute on function set_platform_role_by_email(text, platform_role) from anon;
grant execute on function set_platform_role_by_email(text, platform_role) to authenticated;

create or replace function revoke_platform_role_by_email(p_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  return set_platform_role_by_email(p_email, null);
end;
$$;
revoke execute on function revoke_platform_role_by_email(text) from public;
revoke execute on function revoke_platform_role_by_email(text) from anon;
grant execute on function revoke_platform_role_by_email(text) to authenticated;

-- ----------------------------------------------------------------------------
-- (C.2) Equipe atual de plataforma -- so master enxerga (mesmo escopo de
-- quem gerencia papeis). E-mail so existe em auth.users, mesmo padrao de
-- list_platform_hosts (0040): filtro dentro do WHERE, nunca lanca excecao --
-- quem nao e master so recebe conjunto vazio.
-- ----------------------------------------------------------------------------
create or replace function list_platform_team()
returns table(
  user_id uuid,
  full_name text,
  email text,
  platform_role platform_role,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, u.email, p.platform_role, p.created_at
  from profiles p
  join auth.users u on u.id = p.id
  where p.platform_role is not null
    and auth_is_platform_master()
  order by p.created_at asc;
$$;
revoke execute on function list_platform_team() from public;
grant execute on function list_platform_team() to authenticated;
