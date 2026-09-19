-- =============================================================================
-- Financeiro do painel master — contas a pagar da própria Rota (não confundir
-- com `expenses`, migration 0006, que são despesas de CADA pousada). Achado
-- da análise de 19/09/2026 (doc do projeto
-- claude/analise-financeiro-painel-master-2026-09-19.md): não existia nenhum
-- lugar pra Rota registrar suas próprias despesas (infra, equipe, marketing,
-- impostos). Item independente do motor de cobrança de assinatura (esse fica
-- pra uma migration futura, depende de plans/subscriptions/invoices).
-- =============================================================================

create table platform_expenses (
  id          uuid primary key default gen_random_uuid(),
  description text not null,
  amount      integer not null check (amount >= 0),
  category    text not null default 'outros',
  due_date    date,
  paid        boolean not null default false,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);
create index idx_platform_expenses_due on platform_expenses(due_date);

alter table platform_expenses enable row level security;

-- Helper novo, mesmo padrão de `auth_can_manage_pousadas_platform` (0051):
-- só financeiro_plataforma/master enxergam e mexem no financeiro da própria
-- Rota — é dado interno sensível, não faz sentido abrir pra suporte/
-- comercial/marketing como o `audit:view` faz pra auditoria.
create or replace function auth_can_manage_platform_finance()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.platform_role in ('financeiro_plataforma', 'master')
  );
$$;
revoke execute on function auth_can_manage_platform_finance() from public;
grant execute on function auth_can_manage_platform_finance() to anon, authenticated;

create policy "platform_expenses_read" on platform_expenses for select
  using (auth_can_manage_platform_finance());

create policy "platform_expenses_write" on platform_expenses for all
  using (auth_can_manage_platform_finance())
  with check (auth_can_manage_platform_finance());
