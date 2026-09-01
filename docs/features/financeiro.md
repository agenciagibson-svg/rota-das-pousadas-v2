# Feature: Financeiro (PMS/ERP)

Primeiro módulo financeiro do sistema de gestão. Consolida **receitas** (derivadas
das reservas) e **despesas** (lançadas pelo proprietário) em resumo + extrato.

## Camadas

| Camada | Arquivo | Papel |
|---|---|---|
| Cálculo (puro) | `features/financeiro/finance.ts` | `buildSummary` (receita/despesa/saldo) — testado |
| Types | `features/financeiro/types.ts` | `Expense`, `Transaction`, `FinanceSummary` |
| Schemas | `features/financeiro/schemas.ts` | `createExpenseSchema` (Zod) |
| Repository | `repositories/finance.repository.ts` | CRUD de `expenses` |
| Service | `features/financeiro/services/finance.service.ts` | resumo (reservas + despesas), lançar despesa |
| Server Query | `server/queries.ts` → `getFinance` | cache por request |
| Server Action | `features/financeiro/actions.ts` | `createExpenseAction` |
| UI | `finance-view`, `expense-form` | KPIs + extrato + form (Design System) |
| Página | `app/dashboard/financeiro` | painel financeiro |

## Regras

- **Receita realizada** = reservas `confirmada`/`em_estadia`/`concluida`.
- **A receber** = reservas `aguardando_pagamento`.
- Canceladas/expiradas/no-show **não** entram na receita.
- **Saldo** = receita realizada − despesas.
- **Despesas**: lançadas manualmente (contas a pagar), com categoria e vencimento.

## Segurança

- Tabela `expenses` com RLS: leitura por membros da pousada
  (`auth_is_member_of`), escrita por quem gerencia (`auth_can_manage_pousada`)
  ou plataforma. O service resolve a pousada do usuário via memberships.
- Receita vem de `bookings` (já com RLS por tenant) — o financeiro nunca vê
  dados de outra pousada.

## Setup de banco

Rodar `supabase/migrations/0006_expenses.sql` no Supabase.

## Próximos passos

- Marcar despesa como paga (toggle) e receita conciliada.
- Fluxo de caixa por mês (gráfico) e filtros por período/categoria.
- Emissão fiscal (NF) e exportação (CSV/PDF).
- Papel `financeiro_pousada` com acesso de escrita a despesas.
