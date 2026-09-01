-- =============================================================================
-- Financeiro — despesas (contas a pagar) por pousada.
-- Receitas são derivadas das reservas (bookings); despesas são lançadas aqui.
-- =============================================================================

create table expenses (
  id          uuid primary key default gen_random_uuid(),
  pousada_id  uuid not null references pousadas(id) on delete cascade,
  description text not null,
  amount      integer not null check (amount >= 0),
  category    text not null default 'outros',
  due_date    date,
  paid        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index idx_expenses_pousada on expenses(pousada_id);
create index idx_expenses_due on expenses(due_date);

alter table expenses enable row level security;

-- Leitura: membros da pousada (equipe) ou plataforma.
create policy "expenses_read" on expenses for select
  using (auth_is_member_of(pousada_id) or auth_is_platform_admin());

-- Escrita: quem gerencia a pousada (proprietário/admin) ou plataforma.
create policy "expenses_write" on expenses for all
  using (auth_can_manage_pousada(pousada_id) or auth_is_platform_admin())
  with check (auth_can_manage_pousada(pousada_id) or auth_is_platform_admin());
