-- 0101 — Link de demonstração (captação de pousadas).
--
-- Objetivo: a equipe da Rota cadastra uma pousada que ainda não é cliente
-- (fotos, acomodações, preços aproximados) e manda para o dono um link
-- privado mostrando a pousada DELE funcionando na Rota, sem publicar nada.
--
-- 1. pousada_demo_links: um link por pousada. Token aleatório de 43 caracteres
--    (mesmo gerador do link de viagem, 0094). Contagem de aberturas sem dado
--    pessoal (nada de IP, navegador ou visitante — igual a link_events, 0045).
--    Sem acesso direto pela API: só as RPCs abaixo tocam a tabela.
--
-- 2. Gerar, trocar e desativar: só a equipe que gerencia pousadas na
--    plataforma (comercial/master, `auth_can_manage_pousadas_platform`, o mesmo
--    grupo que cria e aprova pousada). Auditado na mesma transação.
--
-- 3. get_demo_pousada(token): anon. Só responde para pousada NÃO publicada e
--    não arquivada, com link ativo. Devolve as colunas da vitrine (as mesmas de
--    PUBLIC_POUSADA_COLUMNS, nunca documento, razão social, e-mail ou dono) e
--    as acomodações ativas e visíveis, sem disponibilidade nem cotação. Pousada
--    que já foi publicada devolve só {"published": true, "slug"} para a página
--    mandar para o endereço de verdade. Conta no máximo uma abertura por
--    minuto (a prévia do WhatsApp e o clique logo depois contam uma vez).
--
-- A página /demo/<token> não reserva: create_booking (0099) já recusa reserva
-- pública em pousada que não está publicada, e a tela não mostra o formulário.
--
-- Rollback: supabase/rollback/0101_rollback.sql

create table pousada_demo_links (
  pousada_id      uuid primary key references pousadas(id) on delete cascade,
  token           text not null unique check (token ~ '^[A-Za-z0-9_-]{40,64}$'),
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  revoked_at      timestamptz,
  views           integer not null default 0 check (views >= 0),
  first_viewed_at timestamptz,
  last_viewed_at  timestamptz
);

alter table pousada_demo_links enable row level security;
-- Sem policy de propósito: só as RPCs SECURITY DEFINER abaixo tocam a tabela.
revoke all on pousada_demo_links from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Gerar (ou trocar) o link
-- ---------------------------------------------------------------------------
create or replace function create_pousada_demo_link(p_pousada_id uuid, p_renew boolean default false)
returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_status pousada_status;
  v_link pousada_demo_links%rowtype;
  v_token text;
  v_existed boolean;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not auth_can_manage_pousadas_platform() then
    raise exception 'Você não tem permissão para gerar link de demonstração.';
  end if;

  select p.status into v_status from pousadas p where p.id = p_pousada_id for update;
  if v_status is null then raise exception 'Pousada não encontrada.'; end if;
  if v_status = 'publicada' then
    raise exception 'Esta pousada já está publicada: mande o endereço normal dela.';
  end if;
  if v_status = 'arquivada' then
    raise exception 'Pousada arquivada não tem link de demonstração.';
  end if;

  select * into v_link from pousada_demo_links where pousada_id = p_pousada_id;
  v_existed := found;
  if v_existed and v_link.revoked_at is null and not coalesce(p_renew, false) then
    return v_link.token;
  end if;

  v_token := new_booking_share_token();
  -- Link novo (ou trocado): a contagem recomeça, para a equipe saber se o
  -- link que acabou de mandar foi aberto.
  insert into pousada_demo_links (pousada_id, token, created_by)
  values (p_pousada_id, v_token, auth.uid())
  on conflict (pousada_id) do update
    set token = excluded.token, created_by = excluded.created_by, created_at = now(),
        revoked_at = null, views = 0, first_viewed_at = null, last_viewed_at = null;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(),
          case when v_existed then 'pousada.demo_link_renewed' else 'pousada.demo_link_created' end,
          'pousadas', p_pousada_id, '{}'::jsonb);
  return v_token;
end;
$$;
revoke all on function create_pousada_demo_link(uuid, boolean) from public, anon;
grant execute on function create_pousada_demo_link(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Desativar
-- ---------------------------------------------------------------------------
create or replace function revoke_pousada_demo_link(p_pousada_id uuid)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not auth_can_manage_pousadas_platform() then
    raise exception 'Você não tem permissão para desativar link de demonstração.';
  end if;
  update pousada_demo_links set revoked_at = now()
  where pousada_id = p_pousada_id and revoked_at is null;
  if found then
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'pousada.demo_link_revoked', 'pousadas', p_pousada_id, '{}'::jsonb);
  end if;
end;
$$;
revoke all on function revoke_pousada_demo_link(uuid) from public, anon;
grant execute on function revoke_pousada_demo_link(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Lista para o /admin (links ativos e desativados, com aberturas)
-- ---------------------------------------------------------------------------
create or replace function list_pousada_demo_links()
returns table (
  pousada_id uuid, token text, active boolean, created_at timestamptz,
  views integer, first_viewed_at timestamptz, last_viewed_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not auth_can_manage_pousadas_platform() then
    raise exception 'Você não tem permissão para ver os links de demonstração.';
  end if;
  return query
  select l.pousada_id,
         case when l.revoked_at is null then l.token else null end,
         l.revoked_at is null, l.created_at, l.views, l.first_viewed_at, l.last_viewed_at
  from pousada_demo_links l;
end;
$$;
revoke all on function list_pousada_demo_links() from public, anon;
grant execute on function list_pousada_demo_links() to authenticated;

-- ---------------------------------------------------------------------------
-- A página pública do link
-- ---------------------------------------------------------------------------
create or replace function get_demo_pousada(p_token text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_pousada_id uuid;
  v_status pousada_status;
  v_slug text;
  v_pousada jsonb;
  v_rooms jsonb;
begin
  -- Formato inválido nem chega a consultar (e responde igual a "não existe").
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{40,64}$' then return null; end if;

  select l.pousada_id, p.status, p.slug into v_pousada_id, v_status, v_slug
  from pousada_demo_links l join pousadas p on p.id = l.pousada_id
  where l.token = p_token and l.revoked_at is null;
  if v_pousada_id is null or v_status = 'arquivada' then return null; end if;

  -- Já virou cliente: a página manda para o endereço de verdade.
  if v_status = 'publicada' then
    return jsonb_build_object('published', true, 'slug', v_slug);
  end if;

  -- No máximo uma abertura por minuto: a prévia do WhatsApp e o clique logo
  -- depois contam uma vez só, e recarregar a página não infla o número.
  update pousada_demo_links
     set views = views + 1,
         first_viewed_at = coalesce(first_viewed_at, now()),
         last_viewed_at = now()
   where pousada_id = v_pousada_id
     and (last_viewed_at is null or last_viewed_at < now() - interval '1 minute');

  -- As colunas da vitrine, uma a uma (as mesmas de PUBLIC_POUSADA_COLUMNS):
  -- nunca `to_jsonb(p)`, que levaria junto qualquer coluna sensível futura.
  select to_jsonb(x) into v_pousada from (
    select p.id, p.slug, p.name, p.city, p.state, p.destination_id, p.image, p.gallery,
           p.rating, p.reviews, p.price_per_night, p.tags, p.description, p.status,
           p.created_at, p.updated_at, p.checkin_time, p.checkout_time, p.contact_phone,
           p.house_rules, p.cancellation_policy, p.tenant_status, p.whatsapp, p.address,
           p.country, p.timezone, p.currency, p.language, p.instagram, p.cep,
           p.latitude, p.longitude
    from pousadas p where p.id = v_pousada_id
  ) x;

  -- Acomodações como a página pública mostra (mesmos filtros de
  -- bookable_rooms_core, 0087), sem disponibilidade nem cotação.
  select coalesce(jsonb_agg(to_jsonb(r) order by r.base_price, r.id), '[]'::jsonb) into v_rooms
  from (
    select r.id, r.name, r.description,
           coalesce(nullif(r.base_price, 0), p.price_per_night) as base_price,
           coalesce(r.capacity_max, r.capacity) as capacity,
           r.gallery
    from rooms r join pousadas p on p.id = r.pousada_id
    left join accommodation_categories c on c.id = r.category_id
    where r.pousada_id = v_pousada_id
      and r.status = 'active' and r.public_visible
      and (r.category_id is null or c.status = 'active')
  ) r;

  return jsonb_build_object('published', false, 'pousada', v_pousada, 'rooms', v_rooms);
end;
$$;
revoke all on function get_demo_pousada(text) from public;
grant execute on function get_demo_pousada(text) to anon, authenticated;
