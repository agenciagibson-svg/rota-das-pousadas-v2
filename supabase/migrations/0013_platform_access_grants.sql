-- =============================================================================
-- Ciclo 2 — Fase 1 do sistema de gestão: acesso institucional restrito.
--
-- Resolve o Conflito A da auditoria (Ciclo 1): hoje `auth_is_platform_admin()`
-- dá leitura irrestrita de reservas/pagamentos/despesas de QUALQUER pousada a
-- qualquer usuário com platform_role, sem justificativa nem registro. Isso
-- contraria o requisito de que o admin de plataforma não acesse dados
-- financeiros/pessoais das pousadas automaticamente.
--
-- A partir desta migration, acesso institucional a `bookings`, `payments` e
-- `expenses` passa a exigir uma concessão explícita, justificada e temporária
-- (`platform_access_grants`), em vez do papel de plataforma sozinho.
--
-- `pousadas` e `memberships` continuam com visão institucional plena — não
-- são dado financeiro/pessoal do hóspede, e o item 4 do escopo autoriza
-- explicitamente o admin de plataforma a administrar pousadas e acessos.
--
-- Aditivo e reversível: nenhuma tabela ou linha é removida; apenas as
-- policies de leitura/escrita das 3 tabelas sensíveis são substituídas.
--
-- [Revisão Ciclo 2B] Este arquivo nunca foi aplicado a um banco real — por
-- isso a correção abaixo foi feita IN PLACE em vez de numa migration nova:
-- a versão original desta migration criava a policy "audit_insert_self",
-- permitindo que qualquer cliente autenticado inserisse uma linha arbitrária
-- em audit_log (ação, entidade, metadados livres — só o actor_id era preso
-- ao próprio usuário). Isso permitia FORJAR um evento de auditoria sem que a
-- operação real tivesse acontecido. Removida — auditoria agora só é
-- gravada pelo servidor via service role (RLS nem entra em jogo), depois que
-- a autorização real já foi checada em código. Ver lib/supabase/service.ts
-- e lib/audit/log.ts.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Tabela de concessões de acesso institucional
-- ----------------------------------------------------------------------------
create table platform_access_grants (
  id          uuid primary key default gen_random_uuid(),
  pousada_id  uuid not null references pousadas(id) on delete cascade,
  granted_to  uuid not null references profiles(id),
  granted_by  uuid references profiles(id),
  reason      text not null,
  granted_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  check (expires_at > granted_at)
);
create index idx_grants_pousada on platform_access_grants(pousada_id);
create index idx_grants_grantee on platform_access_grants(granted_to);

alter table platform_access_grants enable row level security;

-- Só a própria plataforma cria/gerencia concessões; ninguém concede acesso
-- a si mesmo silenciosamente (a policy exige platform_role, mas a decisão de
-- QUEM pode chamar isso é reforçada também no RBAC da aplicação — ver rbac.ts).
create policy "grants_platform_manage" on platform_access_grants for all
  using (auth_is_platform_admin())
  with check (auth_is_platform_admin());

-- ----------------------------------------------------------------------------
-- Helper: existe concessão ativa (não expirada, não revogada) para o usuário
-- autenticado nesta pousada?
-- ----------------------------------------------------------------------------
create or replace function auth_has_active_grant(target_pousada uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from platform_access_grants g
    where g.pousada_id = target_pousada
      and g.granted_to = auth.uid()
      and g.revoked_at is null
      and g.expires_at > now()
  );
$$;

-- [Revisão Ciclo 2B] Esta função roda DENTRO de expressões de policy RLS
-- (bookings_read/payments_read/expenses_read/write) — o Postgres não garante
-- avaliação com curto-circuito estrito da esquerda para a direita num `or`
-- de RLS, então QUALQUER papel que possa consultar essas tabelas (inclusive
-- `anon`, ex.: visitante não autenticado abrindo /pousada/[slug]/reservar
-- antes de logar) precisa ter EXECUTE nesta função, senão a consulta falha
-- com "permission denied" em vez de simplesmente avaliar falso. Por isso o
-- grant é para `anon, authenticated` — igual ao padrão já usado pelos
-- helpers auth_is_member_of/auth_can_manage_pousada/auth_is_platform_admin
-- (0002_rls.sql), que também são avaliados para qualquer requisição. A
-- função em si é segura de expor: só retorna true/false, nunca dado.
revoke execute on function auth_has_active_grant(uuid) from public;
grant execute on function auth_has_active_grant(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- bookings: leitura/escrita institucional passa a exigir concessão ativa
-- ----------------------------------------------------------------------------
drop policy "bookings_read" on bookings;
create policy "bookings_read" on bookings for select
  using (guest_id = auth.uid() or auth_is_member_of(pousada_id) or auth_has_active_grant(pousada_id));

drop policy "bookings_update" on bookings;
create policy "bookings_update" on bookings for update
  using (guest_id = auth.uid() or auth_is_member_of(pousada_id) or auth_has_active_grant(pousada_id))
  with check (guest_id = auth.uid() or auth_is_member_of(pousada_id) or auth_has_active_grant(pousada_id));

-- ----------------------------------------------------------------------------
-- payments: leitura institucional passa a exigir concessão ativa
-- ----------------------------------------------------------------------------
drop policy "payments_read" on payments;
create policy "payments_read" on payments for select
  using (exists (select 1 from bookings b where b.id = payments.booking_id
                 and (b.guest_id = auth.uid() or auth_is_member_of(b.pousada_id) or auth_has_active_grant(b.pousada_id))));

-- ----------------------------------------------------------------------------
-- expenses: leitura/escrita institucional passa a exigir concessão ativa
-- (escrita nunca foi liberada para plataforma sem gerenciar a pousada; aqui
-- também deixa de bastar o papel de plataforma sozinho para leitura)
-- ----------------------------------------------------------------------------
drop policy "expenses_read" on expenses;
create policy "expenses_read" on expenses for select
  using (auth_is_member_of(pousada_id) or auth_has_active_grant(pousada_id));

drop policy "expenses_write" on expenses;
create policy "expenses_write" on expenses for all
  using (auth_can_manage_pousada(pousada_id) or auth_has_active_grant(pousada_id))
  with check (auth_can_manage_pousada(pousada_id) or auth_has_active_grant(pousada_id));

-- ----------------------------------------------------------------------------
-- audit_log: DE PROPÓSITO sem policy de insert/update/delete para nenhum
-- papel de cliente (nem authenticated, nem anon). Isso significa que RLS
-- bloqueia 100% das escritas vindas do navegador — a única forma de gravar
-- um evento é o servidor usando a service role (que ignora RLS), sempre
-- DEPOIS de a autorização real já ter sido checada em código (ver
-- lib/supabase/service.ts + lib/audit/log.ts). Nenhum client pode fabricar
-- um evento de auditoria informando só o próprio actor_id.
-- Leitura continua restrita à plataforma (policy "audit_read", inalterada).
-- ----------------------------------------------------------------------------
