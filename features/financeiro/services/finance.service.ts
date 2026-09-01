import 'server-only'
import { getOwnerPousada } from '@/features/gestao/services/pms.service'
import { listReservationsByPousada } from '@/repositories/management.repository'
import { listExpensesByPousada, insertExpense } from '@/repositories/finance.repository'
import { buildSummary } from '@/features/financeiro/finance'
import type { FinanceSummary, Transaction } from '@/features/financeiro/types'
import type { CreateExpenseInput } from '@/features/financeiro/schemas'

export type FinanceData = {
  summary: FinanceSummary
  transactions: Transaction[]
}

/** Resumo + extrato financeiro da pousada do usuário atual. */
export async function getFinance(): Promise<FinanceData> {
  const pousada = await getOwnerPousada()
  if (!pousada) {
    return {
      summary: {
        revenueTotal: 0,
        revenueConfirmed: 0,
        revenuePending: 0,
        expensesTotal: 0,
        expensesPending: 0,
        balance: 0,
      },
      transactions: [],
    }
  }

  const [reservations, expenses] = await Promise.all([
    listReservationsByPousada(pousada.id),
    listExpensesByPousada(pousada.id),
  ])

  const summary = buildSummary(
    reservations.map((r) => ({ total: r.total, status: r.status })),
    expenses.map((e) => ({ amount: e.amount, paid: e.paid })),
  )

  const transactions: Transaction[] = [
    ...reservations.map((r) => ({
      id: `b-${r.id}`,
      kind: 'receita' as const,
      description: `Reserva ${r.code}`,
      amount: r.total,
      date: r.checkin,
      status: r.status,
    })),
    ...expenses.map((e) => ({
      id: `e-${e.id}`,
      kind: 'despesa' as const,
      description: e.description,
      amount: e.amount,
      date: e.dueDate ?? e.createdAt.slice(0, 10),
      status: e.paid ? 'pago' : 'a_pagar',
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1))

  return { summary, transactions }
}

/** Lança uma despesa para a pousada do usuário atual. */
export async function addExpense(input: CreateExpenseInput): Promise<void> {
  const pousada = await getOwnerPousada()
  if (!pousada) throw new Error('Nenhuma pousada sob sua gestão.')
  await insertExpense({
    pousadaId: pousada.id,
    description: input.description,
    amount: input.amount,
    category: input.category,
    dueDate: input.dueDate ? input.dueDate : null,
  })
}
